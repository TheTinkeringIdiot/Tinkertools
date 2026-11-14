# Content-addressed game data store

Status: direction agreed 2026-11-13; nothing built. Supersedes the storage model in `.docs/plans/multi-version-support/design.md` §2 and §12 (untracked, local only) (schema-per-version, shared revisions with version arrays). The extraction side (`extract-contract.md`) is unchanged.

## 1. Why

The schema was inherited from an earlier Django iteration: a deeply normalized relational graph designed for row-level edits. The data is the opposite of that: small, immutable between imports, and read as whole items. Multi-version support was layered on top by storing whole item revisions and tagging each with the versions it belongs to. That works, but it stores more than it needs to, bloats on every import, and makes the headline feature we want (cross-version diffs) harder than it should be.

Goals, in order:

1. Cross-version diffs as a first-class feature: "what changed on this item", "what changed in build X", "compare any two builds", including AO against PRK.
2. One deployment serving every build, with imports that add little data and do not rewrite existing rows.
3. Simpler, faster reads: an item is a few key lookups, and responses are cacheable forever.

## 2. Measurements behind the decision

All numbers are from the development database on 2026-11-13: 147 versions (145 AO builds from 14.2.2 to 17.10.5, live AO 18.8.62, PRK 0.7.1), about 13 million item-version pairs.

### 2.1 What changes between builds

136,140 distinct AOIDs across the 146 AO builds; 125,517 changes between consecutive revisions of the same AOID.

| What changed | Changes | Share |
|---|---|---|
| Name or description | 72,871 | 58% |
| Stats | 55,513 | 44% |
| Spell effects | 35,941 | 29% |
| Attack/defense data | 25,227 | 20% |
| Actions and requirements | 18,094 | 14% |
| QL | 1,051 | under 1% |

- 45,125 AOIDs never change; 64,238 have two revisions; 21,861 have three; under 5,000 have four or more.
- Changes arrive in bursts: 14.8.0 (48,525, mostly a mass rename of implants), live (13,433), 14.5.0 (12,337), 15.0.1 (11,195).
- Most-changed stats are housekeeping: StaticInstance (23), Icon (79), DefaultSlot (88), flags (0), Slot (298), ItemClass (76).
- By a hand classification of about 50 stat IDs, 73,856 changes (59%) touch something gameplay-relevant. That is an upper bound; see 2.4.

### 2.2 AOID is a stable identity

- 4,333 AOIDs disappear before live. None reappears with identical content under a new AOID.
- 24 reappear with the same name and QL under a new AOID (18 at the jump to live, 6 at 14.7.1); their content differs, so they are replacements.
- One AOID vanishes and later returns.

AOID is therefore the key for items everywhere: storage, API, and user data.

### 2.3 Redundancy in the current store

Each revision already carries a hash per part (`stats_hash`, `spells_hash`, `actions_hash`, `text_hash`), but the parts themselves are stored per revision.

| Part | Stored copies | Distinct contents | Redundancy | Size |
|---|---|---|---|---|
| Actions and criteria | 197,260 | 29,687 | 6.6x | ~190 MB |
| Stats | 265,503 sets | 89,304 | 3.0x | 459 MB |
| Spell effects | 255,327 | 112,892 | 2.3x | ~455 MB |
| Text | 265,503 | 128,831 | 2.1x | in `gd.items` |

Distinct stat sets are fewer than distinct AOIDs, so sharing by part also deduplicates across different items.

Other waste:

- `gd.items` is 1.86 GB for 265,503 rows (1.1 GB heap, 724 MB indexes, 316 MB of that the GIN index on `vids`). Each revision carries an array of about 62 version IDs and every import rewrites roughly 125,000 of them. Estimated true size is under 400 MB.
- 1.4 GB of curated tables (`sources`, `item_sources`) copied into each of 147 schemas.
- Database total: 4.5 GB.

### 2.4 Spell-effect diff prototype

`prototype/spelldiff.py` matches effects between two builds (exact content, then effect type + target + stat/nano/skill, then looser fallbacks) and reports field-level differences. A full build-to-build comparison runs in about 1.5 s.

| Step | Items with different `spells_hash` | Reordered only | Real changes |
|---|---|---|---|
| 14.4.2 → 14.5.0 | 11,738 | 11,211 | 527 (462 of them only event 14 → 0) |
| 14.5.1 → 14.6.0 | 4,197 | 1,127 | ~3,070 |
| 17.10.5 → live | 5,057 | 119 | ~4,940 |

- The reordering is in the raw client data (confirmed against the extracts): implant modifiers were re-sorted by stat.
- Aggregated field transitions read as patch notes: "proc Chance 60 → 100 on 760 effects" (14.6.0), "nano Resistance 50 → 10 on 206 effects", "modifier target 2 → 3 on 814 effects" (live).
- Weakness: when one modifier is removed and a different one added, the loosest fallback pairs them and reports a stat change. Criteria are compared as whole lists.

Consequences: effect order must not affect the hash, build-wide renumberings need a normalization rule, and the 59% figure in 2.1 overstates real spell changes.

### 2.5 Query audit

A read of every route in `backend/app/api/routes` and the services behind them (code reading only; no queries were run, row volumes not measured, and it has not been independently re-checked).

- Nothing sorts on anything inside spells, criteria or attack/defense. Sort keys are item id, name, QL, item class, full-text rank and `nano_properties.min_level`.
- Server-side predicates that reach inside parts reduce to four families (§4).
- Whole-item reads cover item detail, all interpolate routes, revisions, symbiants, mob drops, perk lookups, equipment bonuses, and the second stage of every list endpoint including `weapons/analyze`.
- Per-version surrogate IDs leak into the API: `/nanos/{id}`, `/symbiants/{id}`, equipment bonuses, `item_sources.item_id`, `/spells/{id}`, `/stat-values/{id}`, and row IDs for stats, spells, criteria and actions inside responses.
- `/spells*` and `/stat-values*` expose parts as paginated entities; the frontend calls `/spells`, `/spells/{id}` and `/stat-values`.
- About 20 routes have no frontend caller (grep, not exhaustive): `/items/filter`, `/items/with-stats`, `/items/{aoid}/sources`, `/nanos/{id}`, `/nanos/stats`, `/nanos/profession/{id}/fast`, `/spells/with-criteria`, `/spells/search`, `/stat-values/{id}`, all `/equipment-bonuses/*`, `/perks` list, `/perks/search`, `/perks/stats`, `/perks/series`, `/perks/{name}`, `/perks/calculate`, `/perks/{name}/validate`, `/performance/*`, `/cache/*`.
- `shop_hash`, `item_shop_hash` and `application_cache` are never read. `animation_mesh` is read only by the `/stat-values` membership filter.

## 3. Storage model

### 3.1 Parts

Each distinct part is stored once, keyed by the hash of its canonical form.

| Part | Content |
|---|---|
| `text` | name, description |
| `stat_set` | stat → value map |
| `effect_set` | events, each with its spell effects (type, target, ticks, parameters, criteria) |
| `action_set` | actions, each with its ordered criteria |
| `atkdef` | attack and defense skill maps |
| `misc` | whatever else an item carries that is exposed or diffed (animation/mesh if kept) |

Parts are JSONB documents. Canonical form rules:

- Object keys sorted; numbers as integers; no derived text (`SpellDescription`, `SpellFormat` are rendered from the effect type, not stored per effect).
- Stats: sorted by stat ID.
- Effects within an event: sorted by a stable key (effect type, target, stat/nano/skill, then remaining parameters). The original order is kept as a separate field only if it is shown to matter in game.
- Criteria within an action or effect: order preserved (they are evaluated as a sequence).
- A stat/value pair repeated verbatim is stored once; an effect repeated within an event is kept as often as it appears.
- An attack/defense block with no entries is the same as none. NUL characters (present in some shop hashes) are written as the text `\u0000`, because PostgreSQL cannot store them.
- StaticInstance (stat 23) is kept in `misc`, not in the stat set.
- Events: keyed by event ID.

### 3.2 Revisions and presence

- `item_revision(rev_id, aoid, ql, item_class, is_nano, text_hash, stats_hash, effects_hash, actions_hash, atkdef_hash, misc_hash)`, unique on `(aoid, all hashes)`. Scalar columns exist for filtering and sorting.
- `build(build_id, family, slug, client_build, ordinal, released_on, parent_build_id, ...)`: one row per build, `ordinal` giving patch order within a family. Replaces `game_versions` plus the per-version schemas.
- `item_presence(family_or_branch, aoid, rev_id, from_ordinal, to_ordinal)`: one row per run of consecutive builds in which that revision is the item's content. An import of a new build extends the open range of unchanged items (one bulk update of a single integer, or no write at all if open ranges are stored as "until further notice") and adds rows only for changed, added and removed items.
- PRK is a branch whose parent is AO 17.10.5: its presence rows start from the fork and reference the same revisions and parts wherever content is identical.
- Removed items stay addressable: the revision remains, and its range simply ends.

"Item X as of build N" is `aoid = X and from <= N <= to`. "All items in build N" is the same range test with an index on `(branch, from, to)` or a range type.

### 3.3 Curated data

Perks, mobs, sources and item-source links are hand-maintained, not extracted. They are stored once, keyed by AOID, and apply in every build where the items they name are present (`backend/database/cas/002_curated_and_derived.sql`). Mob ids are part of the API and of stored farm progress, so they never change across imports.

The nano CSV is stored once as `nano_overlay` (QL, strain, substrain per nano AOID):

- A nano revision's `ql` column is the overlay QL. It is a derived column outside the revision hash.
- Effective strain is held per revision in `nano_properties`. Which side wins a disagreement is a property of the build (`build.overlay_strain_first`): the newest AO build and PRK take the overlay's strain, older builds keep their own valid strain and use the overlay only to fill gaps. This preserves what the current store does.
- In responses, a nano's stats are its stat set with NanoStrain (75) and NanoSubStrain (1003) replaced by the effective values.

### 3.4 Change log

Written at import, one row per item per build where it changed:

`change(branch, ordinal, aoid, kind, old_rev_id, new_rev_id, parts_changed, relevance)`

- `kind`: added, removed, changed.
- `parts_changed`: bitmask of the parts whose hash differs.
- `relevance`: gameplay, economy, cosmetic, text; from a maintained classification of stats and effect types (the hand split in 2.1 is the starting point).
- Build-level normalization notes (for example "event 14 renumbered to 0", "implants renamed") are stored once per build, and the item changes they explain are tagged so default views can hide them.

Field-level diffs are computed on demand from the two parts (cheap: both are single documents) and can be cached by `(old_hash, new_hash)` forever.

## 4. Search projections

Narrow tables derived from parts at import, keyed by part hash, so searches run over distinct contents instead of revisions.

| Projection | Columns | Predicates | Used by |
|---|---|---|---|
| Stats | stats_hash, stat, value | comparisons; bitmask tests (slot 298, NoDrop in stat 0); absence of a stat | item search and filters, nano lists, weapons |
| Requirements | actions_hash, action, position, stat, value, operator | "requires stat S op V"; scoped to an action (use, wield); bitmask operators 22 and 107; "has any requirement" | item search, `weapons/analyze`, nano profession lists |
| Modifiers | effects_hash, event, target, effect type, stat, amount | "modifies stat S by op V" (53045, 53012, 53014, 53026); offensive nano test (53002, target 3, stat 27); implant cluster set-equality | item search, `nanos/offensive`, `implants/lookup`, equipment bonuses |
| Attack skills | atkdef_hash, skill, value | "attack block has skill S at 50 or more" | `weapons/analyze` |

Also:

- Text search (substring and full-text with rank) runs on the `text` part: about 129,000 rows instead of 265,000.
- Interpolation groups QL variants by exact name + description, which becomes a lookup on `text_hash`.
- `nano_properties` (school, professions, min level, strain) stays as a projection and gains "caster professions", replacing the ordered-criteria predicate in the nano profession lists.
- `symbiant_items` stays as a derived table.

## 5. API changes

- The frontend-facing contract for item reads stays, with these changes.
- Every identifier becomes an AOID. Row IDs for stats, spells, criteria and actions are dropped from responses. `/nanos/{id}`, `/symbiants/{id}`, equipment bonuses and source links move to AOID. Client-side user data (nano favorites, farm progress) moves to AOID with it.
- Version stays in the URL path (`/api/v1/{slug}/...`), including the family aliases (`ao`, `prk`); it becomes a query parameter internally instead of a schema switch.
- Responses for a specific revision are immutable and served with long-lived cache headers keyed by revision.
- New endpoints for the headline feature: item timeline, build change list (filterable by relevance and item kind), and compare-two-builds.
- Routes with no caller are removed before the rewrite, after confirming each one.
- Open: whether `/spells` and `/stat-values` survive as browsable entities (§8).

## 6. Existing defects found by the audit

Unrelated to the redesign; listed so they are not lost. None has been reproduced.

- The frontend calls `POST /items/batch` and `POST /spells/batch`, which the backend does not define.
- `/perks/calculate` reads `spell_params["Value"]` where every other consumer reads `Amount`.
- `/implants/slots/{slot}/available` validates the slot but does not filter by it.
- `/implants/lookup` uses `LIMIT 1` with no ordering and builds part of its SQL with an f-string.
- `weapons/analyze` eager-loads attack stats in its first stage and never reads them.
- `/items/with-stats` with `logic=or` collects every matching ID in Python, and its declared response type does not match what it returns.
- `/perks`, `/perks/search` and `/perks/stats` load everything and sort, paginate or count in Python; perk effect extraction issues a query per spell block.
- `/nanos/profession/{id}/fast` disagrees with `/nanos/profession/{id}` (no NOT-operator exclusion, no sort tiebreak).
- `/items/search` accepts `search_fields=effects,stats` and ignores them; the default substring search has no trigram index.
- Interpolated items drop spell criteria, attack/defense and sources.

## 7. Phasing

1. **Prune and fix identity.** Remove confirmed-unused routes and tables. Move the API and client user data to AOID. Both are worthwhile under the current store and shrink the rewrite.
2. **Canonical forms and hashing.** Define the canonical form of each part and the effect ordering rule; verify on the extracts that order-only changes disappear and that every real change survives. Extend the diff prototype to actions, stats and attack/defense, and fix the remove-plus-add mispairing.
3. **New store and importer.** Parts, revisions, builds, presence ranges, projections, change log, written straight from the extracts. Built alongside the current store so the two can be compared build by build (item counts, per-item content equality after canonicalization).
4. **Read path.** Port routes family by family (item detail and interpolation first, then search, nanos, weapons, curated-data routes), each checked against the current API's responses for the same build.
5. **Diff features.** Timeline, build change list, compare view; relevance classification and normalization notes.
6. **Cutover.** Drop the per-version schemas and the old shared store; update import docs.

Acceptance for 3 and 4 is response equality with the current system on a fixed sample of builds (14.2.2, 15.0.1, 17.10.5, live, PRK), apart from the intended ID changes.

## 8. Decisions

Settled 2026-11-13:

- `/spells` and `/stat-values` are retired as browsable entities, after a stage 1 check of what the three frontend callers use them for.
- Effect order within an event is dropped. Effects are stored and displayed in canonical order and order does not affect the hash.
- All routes without a caller are deleted, after an exhaustive caller check that includes tests and known external consumers.
- Work stops at every stage gate for a report and approval of the next stage.

Still open:

- Relevance classification: who maintains the stat and effect-type lists, and where they live (data file in the repo is the default).
- Build dates: source for `released_on` for the historical builds.
- Whether curated facts need validity ranges at all in the first cut, or one current copy is enough.
- Serving shape: keep Postgres (default), or precompute per-revision documents to static files behind the API. Deferred until the read path is ported and measured.

## 9. Limits

- The archive has no builds between 17.10.5 and live, so that span is one step with no per-patch attribution.
- Diffs show client data only. Server-side changes (drop rates, mob stats, some proc behaviour) are invisible.
- Two CSV nanos and one record per early build are missing from the old extracts (parse errors recorded in the manifests).

## 10. Agentic implementation plan

The work in §7 is carried out by agents, with one orchestrating session acting as integrator. About a dozen build agents in total, never more than four at once.

### 10.1 Ground rules

- **Contracts before agents.** The orchestrator writes the three things every agent depends on: the canonical-form and hashing module, the table definitions for the new store, and the acceptance harness.
- **Golden reference.** API responses are captured for a fixed set of requests on five builds (14.2.2, 15.0.1, 17.10.5, live, PRK) with `backend/tools/golden.py`; the baseline is taken from the code as it stands after stage 1. Read-path work must reproduce it. The only differences allowed are listed at the top of that file: internal ids, order that carries no meaning, tie order within a sort key, and the criteria of effects, which are compared as a set because the current store keeps them de-duplicated and unordered while the new one keeps the client's sequence.
- **Isolation.** Each agent works in its own git worktree on a named set of files. The new store lives in its own database schema beside the current one, which agents may read but never write. Only the importer stage writes to the database.
- **Small test database.** Three builds in a scratch database, so an agent's loop takes seconds instead of a full import.
- **Builders do not sign off their own work.** See 10.3.

### 10.2 Stages

| Stage | Work | Agents | Objective gate |
|---|---|---|---|
| 0 | Golden capture harness, canonical forms, table definitions | orchestrator | Order-only changes vanish on the extracts and no real change is lost |
| 1 | Prune unused routes; move the API and client user data to AOID | 2 in parallel | Backend and frontend suites pass; golden reference re-captured |
| 2 | New importer: parts, revisions, build ranges, search projections, change log | 1 | Item-by-item equality with the current store on the five builds; full import timed and sized |
| 3 | Read path by route family: item detail and interpolation; search and filters; nanos; weapons and implants; symbiants, mobs and perks | 4 in parallel, after the orchestrator writes the shared item loader | Golden reference matches per family; performance budgets met |
| 4 | Diff engine and endpoints; frontend timeline, build change list, compare views | 2 in parallel | Diff output matches the hand-verified 14.5.0, 14.6.0 and live results (§2.4) |
| 5 | Cutover: remove per-version schemas and the old store, update import docs | orchestrator | Full suites pass; browser check on old and new builds |

Stage 1 does not depend on the new store and can run alongside stage 0. The importer (stage 2) is the critical path and runs at the highest model tier.

### 10.3 Stage review loop

A stage is complete only when both hold: its objective gate passes, and an independent grading agent passes it. This applies to all six stages.

- **Who grades.** A fresh agent each round. It is given the stage's goals, the diff and access to the running application. It is not given the builder's report or the orchestrator's opinion of the work.
- **What it does.** Reads the changes, runs the test suites, and uses the application in a browser on at least one old build, live and PRK. It measures; it does not estimate.
- **What it grades**, each on a 1 to 5 scale with evidence:
  - *Quality*: correctness, clarity, tests that test behaviour, no dead code or leftovers, consistency with the surrounding code.
  - *Fit and feel*: the application behaves coherently for a player. For stages with no visible change, this means nothing regressed and nothing got more awkward.
  - *Performance*: against the project budgets (complex stat queries under 500 ms, route navigation under 200 ms, initial page load under 3 s), plus import time and database size where the stage affects them, compared with the figures recorded before the stage.
- **Pass rule.** Every dimension scores 4 or higher and there is no unresolved blocking finding. A score below 4 must come with specific, reproducible findings; a low score without them does not block and the grader is asked to substantiate it.
- **Scope.** The grader judges the stage's goals and any regression. Problems that existed before the stage are recorded in a backlog and do not block, unless the stage made them worse.
- **On a fail.** Findings go back to a build agent, the objective gate is re-run, and a new grader reviews the result.
- **Limit.** Three grading rounds per stage. If the third fails, work stops and the findings go to the user.
- **Report.** At each gate the user receives the objective gate results and the grader's report unedited, and approves the next stage.
