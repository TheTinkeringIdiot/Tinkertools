# Deploying TinkerTools

TinkerTools runs as three containers described by `docker-compose.yml`. The same file runs on a workstation and under [Coolify](https://coolify.io) on a server. This is the one description of deployment; `backend/IMPORT_README.md` is the guide to the game data itself.

## What runs

| Service | Image | Role |
|---|---|---|
| `db` | `postgres:16` | The game data: the content-addressed store, schema `cas`, in the named volume `db_data`. Reached by `api` only; no port is published. |
| `api` | `backend/Dockerfile` (Python 3.12) | The FastAPI backend under gunicorn with uvicorn workers, port 8000 inside the stack. Also carries the data commands run against a deployed store: `import_cli.py load-legacy-ids`, `tools/verify_cas.py`. |
| `web` | `frontend/Dockerfile` (Caddy) | The built frontend as static files, with every unknown path answered by `index.html`, and `/api/*` proxied to `api`. Plain HTTP on port 80. The only service the outside reaches. |

- **One origin.** The browser loads the application and calls the API on the same host (`VITE_API_BASE_URL=/api/v1` is compiled in), so the API needs no CORS settings for the site itself, and the stack works unchanged under any hostname or a bare IP address.
- **Two hostnames, one deployment.** `ao.tinkeringidiot.com` and `prk.tinkeringidiot.com` both point at `web`. The hostname only decides which game family a first visit opens (`VITE_VERSION_HOSTNAME_MAP`, compiled in; default `{"prk.tinkeringidiot.com":"prk"}`, every other hostname opens the store's default build).
- **TLS** belongs to the proxy in front (Coolify's). `web` publishes its port on `127.0.0.1:${WEB_PORT}` of the host only (default 8088).
- **Caching.** Files under `/assets/` carry their content hash in their name and are served `immutable` for a year; everything else, `index.html` above all, is served `no-cache`. A missing asset is a 404, never the application.
- **Health.** `db`: `pg_isready`. `api`: `GET /health` (answers without the database, so a server whose store is not loaded yet still deploys). `web`: `GET /healthz`.
- **Why Debian's PostgreSQL image and not alpine's.** The API sorts names in the database, and the store is built under glibc's `en_US.UTF-8`. The alpine image (musl) orders text differently; the Debian image orders it exactly as the development database does (checked on all 128,831 names).

### Settings

Environment variables with defaults in `docker-compose.yml`; `.env.example` lists them. For a local run copy it to `.env`; in Coolify they are the resource's environment variables.

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_PASSWORD` | `tinkertools` | **Set on a server.** It is put into a URL: generate it without special characters (`openssl rand -hex 24`). Read when the volume is first created; changing it later does not change the role's password. |
| `POSTGRES_USER`, `POSTGRES_DB` | `tinkertools` | Role and database of `db` |
| `WEB_PORT` | `8088` | Port on the host's loopback that reaches `web` |
| `API_WORKERS` | `2` | gunicorn workers. Each has a response cache of its own and can reach about 500 MB (`backend/README.md`, "Memory per worker") |
| `RESPONSE_CACHE_MAX_BYTES` | `268435456` | Bound of one worker's response cache |
| `CORS_ORIGINS` | the two production origins | Other origins that may call the API from a browser |
| `DB_SHARED_BUFFERS`, `DB_EFFECTIVE_CACHE_SIZE` | `1GB`, `3GB` | PostgreSQL memory, sized for a host with about 8 GB |
| `VITE_VERSION_HOSTNAME_MAP` | unset | Build-time override of the hostname map above |

There are no other secrets: no accounts, no sessions, no third-party keys.

## The data

Game data is not imported on the server: the importer reads extracted client builds (40 GB) that stay on the development machine. The server's database is a copy of the development store, moved as a dump.

```
development machine                                  server
import-cas -> schema cas -- dump-store.sh --> file -- scp --> stack.sh restore -> db
```

`python import_cli.py import-cas` on the development machine remains the only tool that adds a build or applies an edit of the curated files (`backend/IMPORT_README.md`). To publish the result, dump and restore again.

### Produce the dump (development machine)

```bash
cd backend && source venv/bin/activate && set -a && . ./.env.local && set +a
python tools/verify_cas.py --store --extracts-dir ~/projects/AO/extracts   # 0 differences
../scripts/deploy/dump-store.sh ~/tinkertools-store.dump
```

`dump-store.sh` runs `pg_dump` (version 16 or later) and only reads. The dump holds schema `cas` and nothing else of the database: its tables, and the extensions `btree_gist` and `pg_trgm`, which live in that schema. It is about 54 MB for 147 builds and takes 6 seconds. It prints the newest build of each family and the file's SHA-256.

**The dump never holds the legacy id map.** `cas.legacy_item_id` of the development database was built from the development machine's old store; in production it would translate the ids in users' browsers to the wrong items, for good. The table is dumped empty. See [Ids that browsers hold](#ids-that-browsers-hold).

### Restore it (server, or any host running the stack)

`scripts/deploy/stack.sh` needs only Docker, so it is copied to the server next to the dump:

```bash
scp ~/tinkertools-store.dump scripts/deploy/stack.sh SERVER:
ssh SERVER
./stack.sh restore tinkertools-store.dump
./stack.sh verify     # optional: the store's own rules, 0 differences, about a minute
```

The first load and every later one are the same command. What it does, and why a visitor never sees a half-restored store:

1. Restores the dump into a new database, `<name>_incoming`, beside the one being served. The API keeps serving the old store, untouched. A dump that fails to restore, or restores without an enabled build or its extensions, is dropped and nothing has changed.
2. Copies the legacy id map from the database being served into the new one, since a dump never holds it.
3. `ANALYZE`.
4. Stops `api`, swaps the names of the two databases in one transaction, starts `api`, and waits until `GET /api/v1/versions` answers. The API has to restart in any case: each worker holds responses and revision facts of the store it started on.
5. Drops the old database and prints what is now served.

Measured locally with the stack running (147 builds): 36 s to restore and analyse, during which the old store was served; 3 s without an API (requests in those seconds fail with 502; the application itself still loads); 835 MB on disk afterwards, and room for a second copy is needed during a restore.

The containers are found by their Compose service names. When the host runs more than one TinkerTools stack, name the Compose project: `TT_PROJECT=<project> ./stack.sh ...` (`docker compose ls`); `TT_API_CONTAINER` and `TT_DB_CONTAINER` name the containers outright.

**Order when code and data change together.** A release that needs a newer store (a new table or column: `backend/database/cas/*.sql` changed) is deployed data first if the old code can read the new store, otherwise code first and the restore immediately after. A new build needs no code: restore the dump; commit `builds.toml` as always.

### Ids that browsers hold

Users' data lives in their browsers, and some of it names rows of the database that served them (`backend/IMPORT_README.md`, "Ids that clients hold"). Both kinds of id come from the production database being replaced and are exported from it once, read-only, with `backend/tools/export_legacy_item_ids.py`.

**Internal item ids** are translated through the map in `cas.legacy_item_id`. Load production's export into the running stack:

```bash
./stack.sh legacy-ids legacy_item_ids.csv
```

- It copies the file into the `api` container and runs `python import_cli.py load-legacy-ids --legacy-ids-file ...` there, which makes the table equal to the file. No extracts are needed. It takes 6 seconds for 392,348 ids, and no restart: the route reads the table on every request.
- It refuses, writing nothing, when the store holds no build of a family the file names, or lacks a build that `backend/database/builds.toml` of the deployed code describes: browsers translate against the newest build and drop for good the ids of items it lacks, so the map must not be loaded into a store that is behind.
- Until the map is loaded, `POST /api/v1/<version>/legacy-item-ids/resolve` answers `"available": false`. The frontend then keeps the ids it holds and asks again on the next load. Loading the map late loses nothing; loading the wrong map does.
- A later `stack.sh restore` carries the map over. It is loaded once.

**Mob ids** are not translated; the store must number its mobs as production did. Check with the mobs file of the same export:

```bash
./stack.sh mob-ids legacy_mobs.csv      # must end with "0 difference(s)"
```

It runs `python tools/verify_cas.py --legacy-mobs-file ...` in the `api` container and only reads. The same check can be run on the development machine before a dump is taken, against the development store, whose mobs the dump carries. If it reports differences, do not point the domains at the new server: `backend/IMPORT_README.md`, "Mob ids".

### No backup job

The server holds no user data: profiles, favourites and progress live in the users' browsers. Everything in `db` is game reference data that the dump reproduces, and the dump is reproduced by the importer from the extracts. So there is no database backup job, and none is needed. What must be kept, off the server: the two export files (`legacy_item_ids.csv`, `legacy_mobs.csv`), which are the only record of the old database's ids once it is gone, and on the development machine the extracts folder.

## Run it locally

```bash
cp .env.example .env
docker compose up -d --build
scripts/deploy/stack.sh restore ~/tinkertools-store.dump
```

Then `http://localhost:8088`. The first `up` builds both images (about a minute). Without a restored store the site loads and the API answers 503 for the game versions.

## Deploy with Coolify

The server: one VPS (2 vCPU, 7.7 GB RAM, Ubuntu), firewall open on 22, 80 and 443. The stack takes about 2 GB with a warm database and two busy API workers; a restore needs about 1 GB of free disk on top of the store.

Steps in Coolify's UI. Names of fields differ between Coolify versions: where a step says *verify in the UI*, check what your version shows instead of trusting the wording here.

1. **Add the repository as a source.** A GitHub App for a private repository, or the public repository URL.
2. **New resource** from that repository, on the branch to deploy. **Build pack: Docker Compose.** Base directory `/`, Docker Compose location `/docker-compose.yml`.
3. **Domains.** Coolify lists the services of the compose file. Give `web`, and only `web`, both domains with the container port 80: `https://ao.tinkeringidiot.com:80,https://prk.tinkeringidiot.com:80` (the `:80` names the port inside the container the proxy routes to, not a public port; *verify in the UI* how your version writes this). `api` and `db` get no domain.
4. **Environment variables.** Set `POSTGRES_PASSWORD`. Everything else has a default (see [Settings](#settings)). `VITE_VERSION_HOSTNAME_MAP` is read while the image is built; if you set it, *verify in the UI* that it is available at build time and that the JSON arrives unquoted.
5. **Leave the stack on its own network** (do not enable "Connect to predefined network", *verify in the UI*): `web` finds the backend under the name `api` and the backend finds `db`, and those names must mean this stack's containers.
6. **Deploy.** All three services must become healthy. The site loads; the API answers 503 for game versions until the store is restored.
7. **Load the store**: [Restore it](#restore-it-server-or-any-host-running-the-stack). Then `./stack.sh status`.
8. **Load the legacy id map and check the mob ids** once the two exports from the old production database exist: [Ids that browsers hold](#ids-that-browsers-hold).
9. **Point DNS** of both hostnames at the server, last. Coolify's proxy obtains the certificates once the names resolve to it.

Later deployments (a push to the branch, or "Redeploy") rebuild `api` and `web`; the volume `db_data` and with it the store stay. *Verify in the UI* that the resource's persistent storage lists the volume before relying on that.

### Before DNS is moved

The stack does not care what it is called, so it can be tried before the hostnames point at it:

- **SSH tunnel**, no Coolify setting involved: `ssh -L 8088:127.0.0.1:8088 SERVER`, then `http://localhost:8088`.
- **A temporary domain** on `web` in Coolify, for example `http://tinkertools.<server-ip>.sslip.io:80` (*verify in the UI*; with `http://` no certificate is requested).
- **The real hostnames from one machine**: with the domains of step 3 set, add `<server-ip> ao.tinkeringidiot.com prk.tinkeringidiot.com` to that machine's hosts file. The certificate is not valid until DNS moves, so expect a browser warning. This is the way to see `prk.tinkeringidiot.com` open Project Rubi-Ka on a first visit, since the frontend decides that from the hostname.

Checks worth making on the server before step 9:

```bash
curl -s http://127.0.0.1:8088/healthz -o /dev/null -w '%{http_code}\n'      # 200
curl -s http://127.0.0.1:8088/api/v1/versions | head -c 200                 # the builds
curl -s http://127.0.0.1:8088/ao/items -o /dev/null -w '%{http_code}\n'     # 200, the application
curl -s -X POST http://127.0.0.1:8088/api/v1/ao/legacy-item-ids/resolve \
     -H 'content-type: application/json' -d '{"item_ids":[1]}'              # "available": true once the map is loaded
```

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and on pushes to `main`: the frontend's type-check, lint and unit tests, a formatting check of the backend, and a build of both images without pushing them. The backend's tests are not run there: they read the loaded store of the development database. Run them before a release where the store is (`python -m pytest app/tests -q` in `backend/`).
