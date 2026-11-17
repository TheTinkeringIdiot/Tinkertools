#!/usr/bin/env bash
# Dump the content-addressed store of the development database for a server.
#
#   cd backend && set -a && . ./.env.local && set +a
#   ../scripts/deploy/dump-store.sh [OUT_FILE]     (default: tinkertools-store.dump)
#
# Reads DATABASE_URL; STORE_SCHEMA names another schema than `cas`. The
# database is only read. The dump holds the schema, the two extensions that
# live in it, and every table's rows except those of legacy_item_id: that map
# belongs to the database a deployment replaces, and development's would
# translate the ids in production browsers to the wrong items (DEPLOYMENT.md).
set -euo pipefail

out="${1:-tinkertools-store.dump}"
schema="${STORE_SCHEMA:-cas}"
: "${DATABASE_URL:?DATABASE_URL is not set}"
# SQLAlchemy's postgresql+driver:// is not a libpq URL.
url="$(printf '%s' "$DATABASE_URL" | sed -E 's#^postgresql\+[a-z0-9]+://#postgresql://#')"

query() { psql "$url" -X -At -v ON_ERROR_STOP=1 -c "$1"; }

builds="$(query "SELECT count(*) FROM \"$schema\".build WHERE enabled")"
if [ "$builds" -eq 0 ]; then
  echo "Schema $schema has no enabled build: nothing worth serving" >&2
  exit 1
fi
for extension in btree_gist pg_trgm; do
  home="$(query "SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = '$extension'")"
  if [ "$home" != "$schema" ]; then
    echo "Extension $extension lives in schema '${home:-none}', not in $schema: the dump would not restore" >&2
    exit 1
  fi
done

pg_dump "$url" --format=custom --no-owner --no-acl \
  --schema="$schema" --extension=btree_gist --extension=pg_trgm \
  --exclude-table-data="$schema.legacy_item_id" \
  --file="$out.part"
mv "$out.part" "$out"

echo "Wrote $out: $(du -h "$out" | cut -f1), $builds enabled builds, newest per family:"
query "SELECT DISTINCT ON (branch) '  ' || branch || ': ' || slug FROM \"$schema\".build ORDER BY branch, ordinal DESC"
echo "sha256 $(sha256sum "$out" | cut -d' ' -f1)"
