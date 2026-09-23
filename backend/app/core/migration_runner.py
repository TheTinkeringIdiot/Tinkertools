"""
Schema-aware migration runner for TinkerTools.

Two migration sets:

- ``database/global_migrations/*.sql`` run once per database against ``public``
  and are tracked in ``public.global_migrations``. They own the cross-version
  tables (``game_versions``, ``item_revisions``).
- ``database/migrations/*.sql`` run once per game version schema (``gv_<slug>``)
  and are tracked in ``<schema>.schema_migrations``. The files are unqualified,
  so ``search_path`` decides which version they land in.

Both runners are versioned: the leading digits of a filename are its version,
already-applied versions are skipped, and each file runs in its own
transaction. This replaces the old "drop every table and replay every file"
behaviour, which could not survive an ``ALTER TABLE ADD COLUMN`` migration.
"""

import json
import logging
import os
import re
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Sequence

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Connection
from sqlalchemy.orm import sessionmaker

from app.core.versions import schema_name_for, validate_schema_name, validate_slug

logger = logging.getLogger(__name__)

_VERSION_RE = re.compile(r"^(\d+)")

# Tables a pre-multi-version database holds in ``public``. Used only by
# ``adopt_public_into_schema`` to move an existing install into gv_<slug>.
ADOPTABLE_TABLES: Sequence[str] = (
    "schema_migrations",
    "stat_values",
    "criteria",
    "spells",
    "spell_criteria",
    "spell_data",
    "spell_data_spells",
    "attack_defense",
    "attack_defense_attack",
    "attack_defense_defense",
    "animation_mesh",
    "shop_hash",
    "items",
    "item_stats",
    "item_spell_data",
    "item_shop_hash",
    "actions",
    "action_criteria",
    "source_types",
    "sources",
    "item_sources",
    "application_cache",
    "perks",
    "mobs",
    "symbiants",
    "pocket_bosses",
    "pocket_boss_symbiant_drops",
)

ADOPTABLE_MATVIEWS: Sequence[str] = ("symbiant_items",)

# Tables every version schema must have for the API to work. Note that
# `symbiants` and `pocket_bosses` are NOT here: migration 005 replaced them
# with `mobs` plus the `symbiant_items` materialized view.
REQUIRED_TABLES: Sequence[str] = (
    "items",
    "stat_values",
    "criteria",
    "spells",
    "spell_data",
    "actions",
    "attack_defense",
    "animation_mesh",
    "item_stats",
    "spell_criteria",
    "action_criteria",
    "perks",
    "mobs",
    "sources",
    "source_types",
    "item_sources",
)


def migration_version(filename: str) -> Optional[str]:
    """Version of a migration file: the leading digits of its name.

    ``007_add_item_content_hashes.sql`` -> ``"007"``. A file that does not
    start with digits has no version and is skipped.
    """
    match = _VERSION_RE.match(Path(filename).name)
    return match.group(1) if match else None


def migration_name(filename: str) -> str:
    """Human-readable name of a migration file: the stem minus its version prefix."""
    stem = Path(filename).stem
    return re.sub(r"^\d+[_-]?", "", stem) or stem


def strip_psql_directives(sql: str) -> str:
    """Remove ``\\echo`` lines, which are psql-only, and log what they said."""
    clean_lines = []
    for line in sql.split("\n"):
        if line.strip().startswith("\\echo"):
            logger.info(line.replace("\\echo", "").strip().strip("'"))
        else:
            clean_lines.append(line)
    return "\n".join(clean_lines)


def adoptable_tables_present(existing: Sequence[str]) -> List[str]:
    """Filter ``existing`` table names down to the ones we are willing to move."""
    present = set(existing)
    return [t for t in ADOPTABLE_TABLES if t in present]


class MigrationRunner:
    """Applies global and per-version migrations, and manages version schemas."""

    def __init__(self, db_url: str = None):
        """Initialize migration runner with database connection."""
        self.db_url = db_url or os.getenv("DATABASE_URL")
        if not self.db_url:
            raise ValueError(
                "DATABASE_URL environment variable must be set or db_url parameter provided"
            )

        # AUTOCOMMIT engine: schema-level DDL (CREATE/DROP SCHEMA) must not sit
        # inside a transaction we might roll back. Migration files get their own
        # transactional connection.
        self.engine = create_engine(self.db_url, isolation_level="AUTOCOMMIT")
        self.SessionLocal = sessionmaker(bind=self.engine)

        database_dir = Path(__file__).parent.parent.parent.parent / "database"
        self.migrations_dir = database_dir / "migrations"
        self.global_migrations_dir = database_dir / "global_migrations"
        if not self.migrations_dir.exists():
            raise ValueError(f"Migrations directory not found: {self.migrations_dir}")

    # -- helpers -----------------------------------------------------------

    def _transactional_connection(self) -> Connection:
        """Connection that uses real transactions rather than the AUTOCOMMIT default."""
        return self.engine.connect().execution_options(isolation_level="READ COMMITTED")

    @staticmethod
    def _table_exists(conn: Connection, schema: str, table: str) -> bool:
        return bool(conn.execute(
            text(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = :schema AND table_name = :table)"
            ),
            {"schema": schema, "table": table},
        ).scalar())

    @staticmethod
    def _applied_versions(conn: Connection, schema: str, table: str) -> set:
        if not MigrationRunner._table_exists(conn, schema, table):
            return set()
        rows = conn.execute(text(f'SELECT version FROM "{schema}"."{table}"')).scalars().all()
        return {str(v) for v in rows}

    def _pending_files(self, directory: Path, applied: set) -> List[Path]:
        pending = []
        for path in sorted(directory.glob("*.sql")):
            version = migration_version(path.name)
            if version is None:
                logger.warning("Skipping migration file without a version prefix: %s", path.name)
                continue
            if version in applied:
                logger.debug("Migration %s already applied, skipping", path.name)
                continue
            pending.append(path)
        return pending

    # -- global migrations -------------------------------------------------

    def run_global_migrations(self) -> int:
        """Apply pending ``database/global_migrations/*.sql`` to ``public``.

        Returns:
            Number of migration files executed.
        """
        if not self.global_migrations_dir.exists():
            logger.warning("No global migrations directory: %s", self.global_migrations_dir)
            return 0

        executed = 0
        with self._transactional_connection() as conn:
            conn.execute(text("SET search_path TO public"))
            conn.commit()

            applied = self._applied_versions(conn, "public", "global_migrations")
            pending = self._pending_files(self.global_migrations_dir, applied)

            if not pending:
                logger.info("Global migrations up to date")
                return 0

            for path in pending:
                version = migration_version(path.name)
                logger.info("Running global migration: %s", path.name)
                try:
                    sql = strip_psql_directives(path.read_text(encoding="utf-8"))
                    conn.execute(text(sql))
                    # The 001 file creates the tracking table and records itself;
                    # later files may not, so record them here.
                    if self._table_exists(conn, "public", "global_migrations"):
                        conn.execute(
                            text(
                                "INSERT INTO public.global_migrations (version, name) "
                                "VALUES (:version, :name) ON CONFLICT (version) DO NOTHING"
                            ),
                            {"version": version, "name": migration_name(path.name)},
                        )
                    conn.commit()
                    executed += 1
                    logger.info("✓ Applied global migration: %s", path.name)
                except Exception as exc:
                    conn.rollback()
                    logger.error("Failed global migration %s: %s", path.name, exc)
                    raise

        logger.info("Applied %d global migrations", executed)
        return executed

    # -- per-version migrations -------------------------------------------

    def run_migrations(self, schema_name: str) -> int:
        """Apply pending ``database/migrations/*.sql`` inside one version schema.

        Args:
            schema_name: Target schema, e.g. ``gv_ao``. Must already exist.

        Returns:
            Number of migration files executed.
        """
        schema = validate_schema_name(schema_name)
        logger.info("Running migrations from %s into %s", self.migrations_dir, schema)

        executed = 0
        with self._transactional_connection() as conn:
            conn.execute(text(f'SET search_path TO "{schema}", public'))
            conn.commit()

            applied = self._applied_versions(conn, schema, "schema_migrations")
            pending = self._pending_files(self.migrations_dir, applied)

            if not pending:
                logger.info("Schema %s is up to date (%d migrations applied)", schema, len(applied))
                return 0

            for path in pending:
                version = migration_version(path.name)
                logger.info("Running migration: %s", path.name)
                try:
                    sql = strip_psql_directives(path.read_text(encoding="utf-8"))
                    conn.execute(text(sql))
                    if self._table_exists(conn, schema, "schema_migrations"):
                        conn.execute(
                            text(
                                f'INSERT INTO "{schema}".schema_migrations (version, name) '
                                "VALUES (:version, :name) ON CONFLICT (version) DO NOTHING"
                            ),
                            {"version": version, "name": migration_name(path.name)},
                        )
                    conn.commit()
                    executed += 1
                    logger.info("✓ Applied migration %s to %s", path.name, schema)
                except Exception as exc:
                    conn.rollback()
                    logger.error("Failed migration %s in %s: %s", path.name, schema, exc)
                    if "relation" in str(exc) and "does not exist" in str(exc):
                        logger.error(
                            "This may be a CREATE TABLE / CREATE INDEX ordering problem "
                            "inside the migration file."
                        )
                    raise

        logger.info("Applied %d migrations to %s", executed, schema)
        return executed

    # -- schema lifecycle --------------------------------------------------

    def ensure_version_schema(self, slug: str) -> str:
        """Create the schema for ``slug`` if missing and bring it up to date.

        Returns:
            The schema name.
        """
        schema = schema_name_for(slug)
        with self.engine.connect() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))
        logger.info("Schema %s ready for version '%s'", schema, slug)
        self.run_migrations(schema)
        return schema

    def drop_version_schema(self, slug: str) -> str:
        """Drop a version's schema and everything in it."""
        schema = schema_name_for(slug)
        logger.warning("Dropping schema %s (version '%s') and all its data", schema, slug)
        with self.engine.connect() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
        return schema

    def reset_version_schema(self, slug: str) -> str:
        """Drop and recreate one version's schema from the migration files."""
        self.drop_version_schema(slug)
        return self.ensure_version_schema(slug)

    def list_version_schemas(self) -> List[str]:
        """Every ``gv_*`` schema present in the database."""
        with self.engine.connect() as conn:
            rows = conn.execute(text(
                r"SELECT schema_name FROM information_schema.schemata "
                r"WHERE schema_name LIKE 'gv\_%' ORDER BY schema_name"
            )).scalars().all()
        return list(rows)

    def adopt_public_into_schema(self, slug: str) -> List[str]:
        """Move an existing single-version install from ``public`` into ``gv_<slug>``.

        One-time transition step. Every TinkerTools table still sitting in
        ``public`` is moved with ``ALTER TABLE ... SET SCHEMA``; indexes and
        owned sequences follow automatically. Objects already moved (or never
        present) are skipped, so this is safe to re-run. Migrations are applied
        afterwards so the adopted schema picks up anything it is missing.

        Returns:
            Names of the objects moved.
        """
        schema = schema_name_for(slug)
        moved: List[str] = []

        with self.engine.connect() as conn:
            conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{schema}"'))

            existing = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
            )).scalars().all()
            for table in adoptable_tables_present(existing):
                conn.execute(text(f'ALTER TABLE public."{table}" SET SCHEMA "{schema}"'))
                moved.append(table)
                logger.info("Moved table public.%s -> %s.%s", table, schema, table)

            matviews = conn.execute(text(
                "SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'"
            )).scalars().all()
            for matview in ADOPTABLE_MATVIEWS:
                if matview in matviews:
                    conn.execute(
                        text(f'ALTER MATERIALIZED VIEW public."{matview}" SET SCHEMA "{schema}"')
                    )
                    moved.append(matview)
                    logger.info("Moved matview public.%s -> %s.%s", matview, schema, matview)

        if not moved:
            logger.info("Nothing to adopt: no TinkerTools objects left in public")

        self.run_migrations(schema)
        return moved

    # -- registry ----------------------------------------------------------

    def register_version(
        self,
        slug: str,
        display_name: str,
        family: str,
        parent_slug: Optional[str] = None,
        client_build: Optional[str] = None,
        snapshot_date: Optional[date] = None,
        sort_order: int = 0,
        enabled: bool = True,
        is_default: bool = False,
        features: Optional[Dict] = None,
        notes: Optional[str] = None,
    ) -> str:
        """Insert or update one row in ``public.game_versions``.

        Returns:
            The schema name recorded for the version.
        """
        validate_slug(slug)
        schema = schema_name_for(slug)
        if parent_slug:
            validate_slug(parent_slug)

        params = {
            "slug": slug,
            "schema_name": schema,
            "display_name": display_name or slug,
            "family": family,
            "parent_slug": parent_slug,
            "client_build": client_build,
            "snapshot_date": snapshot_date.isoformat() if isinstance(snapshot_date, date) else snapshot_date,
            "sort_order": sort_order,
            "enabled": enabled,
            "is_default": is_default,
            "features": json.dumps(features or {}),
            "notes": notes,
        }

        with self._transactional_connection() as conn:
            try:
                if is_default:
                    # A partial unique index allows only one default row.
                    conn.execute(
                        text(
                            "UPDATE public.game_versions SET is_default = FALSE "
                            "WHERE is_default AND slug <> :slug"
                        ),
                        {"slug": slug},
                    )

                conn.execute(
                    text(
                        """
                        INSERT INTO public.game_versions (
                            slug, schema_name, display_name, family, parent_slug,
                            client_build, snapshot_date, sort_order, enabled,
                            is_default, features, notes
                        ) VALUES (
                            :slug, :schema_name, :display_name, :family, :parent_slug,
                            :client_build, CAST(:snapshot_date AS DATE), :sort_order, :enabled,
                            :is_default, CAST(:features AS JSONB), :notes
                        )
                        ON CONFLICT (slug) DO UPDATE SET
                            schema_name = EXCLUDED.schema_name,
                            display_name = EXCLUDED.display_name,
                            family = EXCLUDED.family,
                            parent_slug = EXCLUDED.parent_slug,
                            client_build = EXCLUDED.client_build,
                            snapshot_date = EXCLUDED.snapshot_date,
                            sort_order = EXCLUDED.sort_order,
                            enabled = EXCLUDED.enabled,
                            is_default = EXCLUDED.is_default,
                            features = EXCLUDED.features,
                            notes = EXCLUDED.notes,
                            updated_at = CURRENT_TIMESTAMP
                        """
                    ),
                    params,
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise

        logger.info("Registered game version '%s' (schema %s)", slug, schema)
        return schema

    def set_default_version(self, slug: str) -> None:
        """Make ``slug`` the version served when a request carries no version segment."""
        validate_slug(slug)
        with self._transactional_connection() as conn:
            try:
                conn.execute(
                    text(
                        "UPDATE public.game_versions SET is_default = FALSE "
                        "WHERE is_default AND slug <> :slug"
                    ),
                    {"slug": slug},
                )
                result = conn.execute(
                    text(
                        "UPDATE public.game_versions SET is_default = TRUE, "
                        "updated_at = CURRENT_TIMESTAMP WHERE slug = :slug"
                    ),
                    {"slug": slug},
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise

        if result.rowcount == 0:
            logger.warning("Cannot set default: version '%s' is not registered", slug)
        else:
            logger.info("Default game version is now '%s'", slug)

    def unregister_version(self, slug: str) -> int:
        """Remove a version from the registry.

        ``public.item_revisions`` rows for the version go with it (ON DELETE
        CASCADE). The schema itself is not touched; use ``drop_version_schema``.

        Returns:
            Number of registry rows removed (0 or 1).
        """
        validate_slug(slug)
        with self._transactional_connection() as conn:
            if not self._table_exists(conn, "public", "game_versions"):
                return 0
            try:
                result = conn.execute(
                    text("DELETE FROM public.game_versions WHERE slug = :slug"), {"slug": slug}
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
        return result.rowcount

    def list_versions(self) -> List[Dict]:
        """Every row of ``public.game_versions``, ordered for display."""
        with self.engine.connect() as conn:
            if not self._table_exists(conn, "public", "game_versions"):
                return []
            rows = conn.execute(text(
                """
                SELECT slug, schema_name, display_name, family, parent_slug,
                       client_build, snapshot_date, sort_order, enabled,
                       is_default, features, notes
                FROM public.game_versions
                ORDER BY sort_order, slug
                """
            )).mappings().all()
        return [dict(row) for row in rows]

    # -- verification ------------------------------------------------------

    def get_tables(self, schema_name: str) -> List[str]:
        """Table names in one schema."""
        schema = validate_schema_name(schema_name)
        return inspect(self.engine).get_table_names(schema=schema)

    def verify_schema(self, schema_name: str) -> bool:
        """Check that a version schema has the tables the API needs."""
        try:
            tables = self.get_tables(schema_name)
            missing = [t for t in REQUIRED_TABLES if t not in tables]

            if missing:
                logger.error(
                    "Schema %s is missing required tables: %s", schema_name, ", ".join(missing)
                )
                return False

            logger.info("Schema %s verified: %d tables", schema_name, len(tables))
            return True

        except Exception as exc:
            logger.error("Schema verification failed for %s: %s", schema_name, exc)
            return False
