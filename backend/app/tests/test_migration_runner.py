"""
Tests for the pure helpers in app/core/migration_runner.py and the slug/schema
mapping they rely on.

Nothing here touches a database: creating, dropping or migrating a schema is a
destructive operation and belongs in an operator's hands, not a test run.
"""

import pytest

from app.core.migration_runner import (
    ADOPTABLE_MATVIEWS,
    ADOPTABLE_TABLES,
    REQUIRED_TABLES,
    adoptable_tables_present,
    migration_name,
    migration_version,
    strip_psql_directives,
)
from app.core.versions import InvalidVersionSlug, schema_name_for, validate_schema_name


class TestMigrationVersionParsing:
    @pytest.mark.parametrize(
        "filename,expected",
        [
            ("000_create_migration_table.sql", "000"),
            ("001_initial_schema.sql", "001"),
            ("007_add_item_content_hashes.sql", "007"),
            ("0012_something.sql", "0012"),
            ("/abs/path/database/migrations/005_refactor_symbiant_system.sql", "005"),
        ],
    )
    def test_version_is_the_leading_digits(self, filename, expected):
        assert migration_version(filename) == expected

    @pytest.mark.parametrize(
        "filename",
        [
            "add_column.sql",
            "_001_backwards.sql",
            "readme.md",
        ],
    )
    def test_files_without_a_version_prefix_have_no_version(self, filename):
        assert migration_version(filename) is None

    def test_versions_sort_in_application_order(self):
        files = [
            "007_add_item_content_hashes.sql",
            "000_create_migration_table.sql",
            "001_initial_schema.sql",
        ]
        versions = [migration_version(f) for f in sorted(files)]
        assert versions == ["000", "001", "007"]

    @pytest.mark.parametrize(
        "filename,expected",
        [
            ("007_add_item_content_hashes.sql", "add_item_content_hashes"),
            ("001_initial_schema.sql", "initial_schema"),
            ("000_create_migration_table.sql", "create_migration_table"),
        ],
    )
    def test_name_drops_the_version_prefix(self, filename, expected):
        assert migration_name(filename) == expected


class TestStripPsqlDirectives:
    def test_echo_lines_are_removed(self):
        sql = "\\echo 'Adding columns...'\nALTER TABLE items ADD COLUMN x INT;\n"
        cleaned = strip_psql_directives(sql)
        assert "\\echo" not in cleaned
        assert "ALTER TABLE items ADD COLUMN x INT;" in cleaned

    def test_sql_without_directives_is_unchanged(self):
        sql = "SELECT 1;\nSELECT 2;"
        assert strip_psql_directives(sql) == sql


class TestAdoptionAllowlist:
    def test_only_allowlisted_tables_are_adopted(self):
        existing = [
            "items",
            "perks",
            "django_migrations",
            "pg_stat_statements",
            "spells",
        ]
        assert adoptable_tables_present(existing) == ["spells", "items", "perks"]

    def test_absent_tables_are_skipped(self):
        assert adoptable_tables_present([]) == []

    def test_result_follows_allowlist_order_not_input_order(self):
        # Order matters: schema_migrations first, junction tables after their
        # parents, so the move never trips a dependency.
        moved = adoptable_tables_present(["item_stats", "items", "schema_migrations"])
        assert moved == ["schema_migrations", "items", "item_stats"]

    def test_allowlist_has_no_duplicates(self):
        assert len(set(ADOPTABLE_TABLES)) == len(ADOPTABLE_TABLES)

    def test_allowlist_covers_every_required_table(self):
        assert set(REQUIRED_TABLES).issubset(set(ADOPTABLE_TABLES))

    def test_matview_is_not_in_the_table_allowlist(self):
        # symbiant_items is a materialized view and needs ALTER MATERIALIZED VIEW.
        for matview in ADOPTABLE_MATVIEWS:
            assert matview not in ADOPTABLE_TABLES


class TestSchemaNaming:
    @pytest.mark.parametrize(
        "slug,schema",
        [
            ("ao", "gv_ao"),
            ("prk", "gv_prk"),
            ("ao-15.0", "gv_ao_15_0"),
            ("ao-18.8.72", "gv_ao_18_8_72"),
        ],
    )
    def test_slug_maps_to_schema(self, slug, schema):
        assert schema_name_for(slug) == schema
        assert validate_schema_name(schema) == schema

    @pytest.mark.parametrize(
        "slug",
        [
            "AO",  # uppercase
            "gv_ao; DROP",  # injection attempt
            "-leading-dash",
            "",
            "a" * 41,  # too long
        ],
    )
    def test_invalid_slugs_are_rejected(self, slug):
        with pytest.raises(InvalidVersionSlug):
            schema_name_for(slug)

    @pytest.mark.parametrize(
        "schema",
        [
            "public",
            "gv_ao; DROP SCHEMA public",
            "items",
            "GV_AO",
        ],
    )
    def test_invalid_schema_names_are_rejected(self, schema):
        with pytest.raises(InvalidVersionSlug):
            validate_schema_name(schema)

    def test_distinct_slugs_map_to_distinct_schemas(self):
        slugs = ["ao", "prk", "ao-15.0", "ao-18.8.72", "prk-2024"]
        assert len({schema_name_for(s) for s in slugs}) == len(slugs)
