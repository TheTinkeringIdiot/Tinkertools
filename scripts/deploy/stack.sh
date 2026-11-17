#!/usr/bin/env bash
# Data commands for a running TinkerTools container stack (docker-compose.yml),
# run on the host that runs it. The script needs nothing but Docker, so it can
# be copied to a server on its own, next to the files it is given.
#
#   stack.sh restore DUMP       load or replace the store from a dump written by
#                               dump-store.sh
#   stack.sh legacy-ids CSV     make the map of old internal item ids equal to a
#                               file of tools/export_legacy_item_ids.py
#   stack.sh mob-ids CSV        check the store's mob ids against the mobs file
#                               of the same export (reads only)
#   stack.sh verify             check the store's rules with tools/verify_cas.py
#                               --store (reads only, about a minute)
#   stack.sh status             the builds and the size of the map now served
#
# The containers are found by their Compose service names, `api` and `db`.
# TT_PROJECT names the Compose project when the host runs more than one such
# stack; TT_API_CONTAINER and TT_DB_CONTAINER name the containers outright.
# STORE_SCHEMA names another schema than `cas`.
#
# restore never lets the API read a store that is half there. The dump goes
# into a database of its own beside the one being served, which stays in use
# and untouched until the new one is complete and checked; a dump that fails
# to restore changes nothing. Only then is the API stopped, the two databases
# swap names in one transaction, and the API starts on the new one, with empty
# caches. The legacy id map, which a dump never holds, is copied from the
# database being replaced. DEPLOYMENT.md has the procedure around this.
set -euo pipefail

schema="${STORE_SCHEMA:-cas}"

die() {
  echo "$*" >&2
  exit 1
}

container_of() {
  local service="$1" given="$2" found
  if [ -n "$given" ]; then
    echo "$given"
    return
  fi
  local filters=(--filter "label=com.docker.compose.service=$service")
  if [ -n "${TT_PROJECT:-}" ]; then
    filters+=(--filter "label=com.docker.compose.project=$TT_PROJECT")
  elif [ "$service" != api ]; then
    filters+=(--filter "label=com.docker.compose.project=$project")
  fi
  found="$(docker ps -a -q "${filters[@]}")"
  case "$(printf '%s' "$found" | grep -c .)" in
    1) echo "$found" ;;
    0) die "No container of service '$service' found. Set TT_PROJECT, or TT_API_CONTAINER and TT_DB_CONTAINER (docker ps)" ;;
    *) die "More than one container of service '$service'. Set TT_PROJECT to the Compose project (docker compose ls)" ;;
  esac
}

api="$(container_of api "${TT_API_CONTAINER:-}")"
project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$api")"
db="$(container_of db "${TT_DB_CONTAINER:-}")"
user="$(docker exec "$db" printenv POSTGRES_USER)"
live="$(docker exec "$db" printenv POSTGRES_DB)"
incoming="${live}_incoming"
previous="${live}_previous"

# query SQL [DATABASE]: one statement or several, unaligned output.
query() {
  docker exec -i "$db" psql -X -At -v ON_ERROR_STOP=1 -U "$user" -d "${2:-$live}" -c "$1"
}

# administer SQL: a statement on databases, run from the maintenance database.
administer() {
  docker exec -i -e PGOPTIONS='-c client_min_messages=warning' "$db" \
    psql -X -q -At -v ON_ERROR_STOP=1 -U "$user" -d postgres -c "$1" >/dev/null
}

has_store() {
  [ "$(query "SELECT to_regclass('\"$schema\".build') IS NOT NULL" "$1")" = t ]
}

api_ready() {
  docker exec "$api" python -c "
import urllib.request
urllib.request.urlopen('http://127.0.0.1:8000/api/v1/versions', timeout=5)" 2>/dev/null
}

status() {
  if ! has_store "$live"; then
    echo "Database $live holds no store in schema $schema yet"
    return
  fi
  query "SELECT branch || ': ' || count(*) || ' builds, newest ' ||
                (array_agg(slug ORDER BY ordinal DESC))[1]
         FROM \"$schema\".build WHERE enabled GROUP BY branch ORDER BY branch"
  query "SELECT 'legacy item ids: ' || coalesce(string_agg(branch || ' ' || n, ', '), 'none')
         FROM (SELECT branch, count(*) AS n FROM \"$schema\".legacy_item_id GROUP BY branch
               ORDER BY branch) AS families"
  echo "store size: $(query "SELECT pg_size_pretty(pg_database_size(current_database()))")"
}

restore() {
  local dump="$1" inside=/tmp/tinkertools-store.dump started=$SECONDS
  [ -f "$dump" ] || die "Dump not found: $dump"

  echo "Restoring $dump into database $incoming (the API keeps serving $live)"
  docker exec -i "$db" sh -c "cat > $inside" <"$dump"
  administer "DROP DATABASE IF EXISTS \"$incoming\" WITH (FORCE)"
  administer "DROP DATABASE IF EXISTS \"$previous\" WITH (FORCE)"
  administer "CREATE DATABASE \"$incoming\" OWNER \"$user\" TEMPLATE template0"
  if ! docker exec "$db" pg_restore --no-owner --no-acl --exit-on-error --jobs 2 \
    -U "$user" -d "$incoming" "$inside"; then
    docker exec "$db" rm -f "$inside"
    administer "DROP DATABASE IF EXISTS \"$incoming\" WITH (FORCE)"
    die "The dump did not restore. Nothing was changed: $live is served as before"
  fi
  docker exec "$db" rm -f "$inside"

  local builds extensions
  builds="$(query "SELECT count(*) FROM \"$schema\".build WHERE enabled" "$incoming")"
  extensions="$(query "SELECT count(*) FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
                       WHERE e.extname IN ('btree_gist', 'pg_trgm') AND n.nspname = '$schema'" "$incoming")"
  if [ "$builds" -eq 0 ] || [ "$extensions" -ne 2 ]; then
    administer "DROP DATABASE \"$incoming\" WITH (FORCE)"
    die "The restored store has $builds enabled builds and $extensions of its 2 extensions. Nothing was changed"
  fi
  if has_store "$live"; then
    docker exec "$db" sh -c "
      set -e
      psql -X -v ON_ERROR_STOP=1 -U '$user' -d '$live' \
           -c 'COPY \"$schema\".legacy_item_id (branch, item_id, aoid) TO STDOUT' |
      psql -X -q -v ON_ERROR_STOP=1 -U '$user' -d '$incoming' \
           -c 'COPY \"$schema\".legacy_item_id (branch, item_id, aoid) FROM STDIN'"
  fi
  query "ANALYZE" "$incoming" >/dev/null
  echo "Restored and analysed in $((SECONDS - started)) s; swapping"

  local stopped=$SECONDS
  docker stop "$api" >/dev/null
  if ! administer "BEGIN;
              SELECT pg_terminate_backend(pid) FROM pg_stat_activity
              WHERE datname IN ('$live', '$incoming') AND pid <> pg_backend_pid();
              ALTER DATABASE \"$live\" RENAME TO \"$previous\";
              ALTER DATABASE \"$incoming\" RENAME TO \"$live\";
              COMMIT;"; then
    docker start "$api" >/dev/null
    die "The databases could not be swapped. $live is served as before; the new store waits in $incoming"
  fi
  docker start "$api" >/dev/null
  local waited=0
  until api_ready; do
    waited=$((waited + 1))
    [ "$waited" -le 60 ] || die "The API does not answer /api/v1/versions on the new store. The store before it is kept in database $previous"
    sleep 2
  done
  echo "The API was down for $((SECONDS - stopped)) s and now serves:"
  administer "DROP DATABASE \"$previous\" WITH (FORCE)"
  status
}

# copy_in FILE NAME: put a file into the api container, print its path there.
copy_in() {
  [ -f "$1" ] || die "File not found: $1"
  docker exec -i "$api" sh -c "cat > /tmp/$2" <"$1"
  echo "/tmp/$2"
}

case "${1:-}" in
  restore)
    [ $# -eq 2 ] || die "usage: stack.sh restore DUMP"
    restore "$2"
    ;;
  legacy-ids)
    [ $# -eq 2 ] || die "usage: stack.sh legacy-ids CSV"
    inside="$(copy_in "$2" legacy_item_ids.csv)"
    docker exec "$api" python import_cli.py load-legacy-ids --schema "$schema" --legacy-ids-file "$inside"
    status
    ;;
  mob-ids)
    [ $# -eq 2 ] || die "usage: stack.sh mob-ids CSV"
    inside="$(copy_in "$2" legacy_mobs.csv)"
    docker exec "$api" python tools/verify_cas.py --schema "$schema" --legacy-mobs-file "$inside"
    ;;
  verify)
    docker exec "$api" python tools/verify_cas.py --schema "$schema" --store
    ;;
  status)
    status
    ;;
  *)
    die "usage: stack.sh restore DUMP | legacy-ids CSV | mob-ids CSV | verify | status"
    ;;
esac
