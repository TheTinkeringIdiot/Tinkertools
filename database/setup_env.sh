#!/bin/bash

# TinkerTools Database Setup Script (Environment-Aware)
# This script requires DATABASE_URL environment variable to be set
# Designed for environments where postgres superuser is not available

set -e  # Exit on any error

# Function to parse DATABASE_URL
parse_database_url() {
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ ERROR: DATABASE_URL environment variable is not set"
        echo ""
        echo "Please set DATABASE_URL in the format:"
        echo "  export DATABASE_URL=\"postgresql://user:password@host:port/database\""
        echo ""
        echo "Example:"
        echo "  export DATABASE_URL=\"postgresql://tinkertools_user:password@localhost:5432/tinkertools\""
        exit 1
    fi
    
    echo "📋 Parsing DATABASE_URL..."
    
    # Parse postgresql://user:password@host:port/database
    # Remove protocol
    DB_URL_NO_PROTOCOL=${DATABASE_URL#postgresql://}
    
    # Extract user and password
    USER_PASS=${DB_URL_NO_PROTOCOL%%@*}
    DB_USER=${USER_PASS%%:*}
    DB_PASSWORD=${USER_PASS#*:}
    
    # Extract host, port, and database
    HOST_PORT_DB=${DB_URL_NO_PROTOCOL#*@}
    HOST_PORT=${HOST_PORT_DB%/*}
    DB_NAME=${HOST_PORT_DB##*/}
    
    DB_HOST=${HOST_PORT%:*}
    DB_PORT=${HOST_PORT#*:}
    
    # Game version this invocation operates on. Each version's tables live in
    # their own schema; public holds only the cross-version registry.
    GAME_VERSION=${GAME_VERSION:-ao}
    VERSION_SCHEMA="gv_$(echo "$GAME_VERSION" | tr '.-' '__')"

    echo "✅ Database configuration:"
    echo "   Host: $DB_HOST:$DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
    echo "   Game version: $GAME_VERSION (schema $VERSION_SCHEMA)"
}

# Function to check database connection
check_database_connection() {
    echo "📋 Checking database connection..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        echo "❌ Cannot connect to database at $DB_HOST:$DB_PORT/$DB_NAME as user $DB_USER"
        echo "Please ensure:"
        echo "  1. PostgreSQL is running"
        echo "  2. Database '$DB_NAME' exists"
        echo "  3. User '$DB_USER' has access to the database"
        echo "  4. DATABASE_URL is correct"
        exit 1
    fi
    echo "✅ Database connection successful"
}

# Function to check if schema exists
check_existing_schema() {
    echo "📋 Checking existing schema..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    # Count existing tables
    TABLE_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = '$VERSION_SCHEMA' AND table_type = 'BASE TABLE';
    " | xargs)
    
    echo "📊 Found $TABLE_COUNT existing tables"
    
    if [ "$TABLE_COUNT" -gt "0" ]; then
        echo "⚠️  Database already contains tables. "
        read -p "Do you want to continue? This may modify existing data (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Setup cancelled by user."
            exit 0
        fi
    fi
}

# Function to run migrations
#
# Two sets of migrations:
#   global_migrations/*.sql  -> public (registry tables, once per database)
#   migrations/*.sql         -> gv_<GAME_VERSION> (one game version's tables)
#
# GAME_VERSION defaults to "ao", so the schema is gv_ao. Files are unqualified,
# so search_path decides where they land. Files already recorded in the
# tracking tables are skipped.
run_migrations() {
    GAME_VERSION=${GAME_VERSION:-ao}
    VERSION_SCHEMA="gv_$(echo "$GAME_VERSION" | tr '.-' '__')"

    echo "🔄 Running database migrations (version '$GAME_VERSION' -> schema $VERSION_SCHEMA)..."

    export PGPASSWORD=$DB_PASSWORD
    PSQL="psql -v ON_ERROR_STOP=1 -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"

    # Is migration $3 already recorded in $1.$2? Prints "t" or "f".
    migration_applied() {
        local schema="$1" table="$2" version="$3"
        local exists
        exists=$($PSQL -t -c "
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = '$schema' AND table_name = '$table'
            );
        " 2>/dev/null | xargs)
        if [ "$exists" != "t" ]; then
            echo "f"
            return
        fi
        $PSQL -t -c "
            SELECT EXISTS (SELECT 1 FROM \"$schema\".\"$table\" WHERE version = '$version');
        " 2>/dev/null | xargs
    }

    # --- global migrations (public) ---
    for migration in $(ls -1 global_migrations/*.sql 2>/dev/null | sort); do
        version=$(basename "$migration" | grep -o '^[0-9]\+')
        APPLIED=$(migration_applied public global_migrations "$version")

        if [ "$APPLIED" = "t" ]; then
            echo "⏭️  Global migration $(basename "$migration") already applied"
        else
            echo "🌍 Applying global migration $(basename "$migration")..."
            $PSQL -c "SET search_path TO public;" -f "$migration"
        fi
    done

    # --- per-version migrations (gv_<slug>) ---
    echo "🏗️ Ensuring schema $VERSION_SCHEMA exists..."
    $PSQL -c "CREATE SCHEMA IF NOT EXISTS \"$VERSION_SCHEMA\";"

    for migration in $(ls -1 migrations/*.sql 2>/dev/null | sort); do
        version=$(basename "$migration" | grep -o '^[0-9]\+')
        APPLIED=$(migration_applied "$VERSION_SCHEMA" schema_migrations "$version")

        if [ "$APPLIED" = "t" ]; then
            echo "⏭️  Migration $(basename "$migration") already applied to $VERSION_SCHEMA"
        else
            echo "📝 Applying $(basename "$migration") to $VERSION_SCHEMA..."
            $PSQL -c "SET search_path TO \"$VERSION_SCHEMA\", public;" -f "$migration"
            $PSQL -c "
                INSERT INTO \"$VERSION_SCHEMA\".schema_migrations (version, name)
                VALUES ('$version', '$(basename "$migration" .sql)')
                ON CONFLICT (version) DO NOTHING;
            " > /dev/null
        fi
    done

    echo "✅ Migrations completed successfully"
}

# Function to seed sample data
seed_data() {
    echo "🌱 Checking sample data..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    # Check if sample data already exists
    ITEM_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SET search_path TO $VERSION_SCHEMA, public; SELECT COUNT(*) FROM items;
    " | xargs)
    
    if [ "$ITEM_COUNT" -gt "0" ]; then
        echo "📊 Found $ITEM_COUNT existing items, skipping sample data"
        return
    fi
    
    if [ -f "seeds/sample_data.sql" ]; then
        echo "🌱 Seeding sample data..."
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SET search_path TO $VERSION_SCHEMA, public;" -f seeds/sample_data.sql
        echo "✅ Sample data seeded successfully"
    else
        echo "⚠️  No sample data file found, skipping..."
    fi
}

# Function to verify setup
verify_setup() {
    echo "🔍 Verifying database setup..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    # Count tables
    TABLE_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = '$VERSION_SCHEMA' AND table_type = 'BASE TABLE';
    " | xargs)
    
    echo "📊 Found $TABLE_COUNT tables in database"
    
    # Count sample data
    ITEM_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SET search_path TO $VERSION_SCHEMA, public; SELECT COUNT(*) FROM items;
    " | xargs)
    
    STAT_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SET search_path TO $VERSION_SCHEMA, public; SELECT COUNT(*) FROM stat_values;
    " | xargs)
    
    if [ "$TABLE_COUNT" -ge "20" ]; then
        echo "✅ Database setup verified successfully!"
        echo ""
        echo "🎉 TinkerTools database is ready!"
        echo "   Database: $DB_NAME"
        echo "   User: $DB_USER"
        echo "   Host: $DB_HOST:$DB_PORT"
        echo "   Tables: $TABLE_COUNT"
        echo "   Sample Items: $ITEM_COUNT"
        echo "   Sample Stats: $STAT_COUNT"
    else
        echo "❌ Database setup verification failed - expected at least 20 tables, found $TABLE_COUNT"
        exit 1
    fi
}

# Function to run tests
run_tests() {
    echo "🧪 Running database tests..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    if [ -f "tests/test_schema.sql" ]; then
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f tests/test_schema.sql
        echo "✅ Database tests completed"
    else
        echo "⚠️  No test file found, skipping tests..."
    fi
}

# Function to show database info
show_info() {
    echo "📊 Database Information:"
    
    parse_database_url
    export PGPASSWORD=$DB_PASSWORD
    
    echo ""
    echo "Connection Details:"
    echo "  Host: $DB_HOST:$DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
    
    # Show table counts
    echo "Schema Information:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT 
            schemaname,
            COUNT(*) as table_count
        FROM pg_tables 
        WHERE schemaname = '$VERSION_SCHEMA'
        GROUP BY schemaname;
    "
    
    echo ""
    echo "Sample Data Counts:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SET search_path TO $VERSION_SCHEMA, public;
        SELECT 'items' as table_name, COUNT(*) as count FROM items
        UNION ALL
        SELECT 'stat_values', COUNT(*) FROM stat_values
        UNION ALL
        SELECT 'spells', COUNT(*) FROM spells
        UNION ALL
        SELECT 'symbiants', COUNT(*) FROM symbiants
        UNION ALL
        SELECT 'pocket_bosses', COUNT(*) FROM pocket_bosses
        ORDER BY table_name;
    "
}

# Main execution
main() {
    parse_database_url
    check_database_connection
    check_existing_schema
    run_migrations
    seed_data
    verify_setup
}

# Parse command line arguments
case "$1" in
    "verify")
        parse_database_url
        verify_setup
        ;;
    "test")
        parse_database_url
        run_tests
        ;;
    "info")
        show_info
        ;;
    "migrate")
        parse_database_url
        check_database_connection
        run_migrations
        echo "✅ Migration completed"
        ;;
    "seed")
        parse_database_url
        check_database_connection
        seed_data
        echo "✅ Seeding completed"
        ;;
    "help"|"--help"|"-h")
        echo "TinkerTools Database Setup Script (Environment-Aware)"
        echo ""
        echo "REQUIRES: DATABASE_URL environment variable must be set"
        echo "Assumes database exists and user has appropriate permissions."
        echo "Does not require postgres superuser access."
        echo ""
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  (no args)   Set up database schema and sample data"
        echo "  migrate     Run migrations only"
        echo "  seed        Seed sample data only"
        echo "  verify      Verify database setup"
        echo "  test        Run database tests"
        echo "  info        Show database information"
        echo "  help        Show this help"
        echo ""
        echo "Required Environment Variables:"
        echo "  DATABASE_URL     Full PostgreSQL URL (postgresql://user:pass@host:port/db)"
        echo ""
        echo "Optional Environment Variables:"
        echo "  GAME_VERSION     Game version slug to operate on (default: ao)."
        echo "                   Its tables live in the schema gv_<slug>; public holds"
        echo "                   only the cross-version registry."
        echo ""
        echo "Example:"
        echo "  export DATABASE_URL=\"postgresql://user:pass@localhost:5432/tinkertools\""
        echo "  $0"
        echo "  GAME_VERSION=prk $0 migrate"
        echo ""
        echo "Prerequisites:"
        echo "  - PostgreSQL database exists"
        echo "  - User has CREATE, INSERT, SELECT, UPDATE, DELETE permissions"
        echo "  - User can create tables and indexes"
        ;;
    *)
        main
        ;;
esac