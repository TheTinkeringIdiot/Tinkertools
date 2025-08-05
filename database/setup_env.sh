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
    
    echo "✅ Database configuration:"
    echo "   Host: $DB_HOST:$DB_PORT"
    echo "   Database: $DB_NAME"
    echo "   User: $DB_USER"
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
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
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
run_migrations() {
    echo "🔄 Running database migrations..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    # Check if migration table exists
    MIGRATION_TABLE_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'schema_migrations'
        );
    " | xargs)
    
    if [ "$MIGRATION_TABLE_EXISTS" = "f" ]; then
        echo "📝 Setting up migration tracking..."
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/000_create_migration_table.sql
    else
        echo "📝 Migration tracking table already exists"
    fi
    
    # Check if initial migration has been run
    INITIAL_MIGRATION_EXISTS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT EXISTS (
            SELECT FROM schema_migrations WHERE version = '001'
        );
    " | xargs)
    
    if [ "$INITIAL_MIGRATION_EXISTS" = "f" ]; then
        echo "🏗️ Creating database schema..."
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/001_initial_schema.sql
    else
        echo "🏗️ Initial schema migration already applied"
    fi
    
    echo "✅ Migrations completed successfully"
}

# Function to seed sample data
seed_data() {
    echo "🌱 Checking sample data..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    # Check if sample data already exists
    ITEM_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM items;
    " | xargs)
    
    if [ "$ITEM_COUNT" -gt "0" ]; then
        echo "📊 Found $ITEM_COUNT existing items, skipping sample data"
        return
    fi
    
    if [ -f "seeds/sample_data.sql" ]; then
        echo "🌱 Seeding sample data..."
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f seeds/sample_data.sql
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
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    " | xargs)
    
    echo "📊 Found $TABLE_COUNT tables in database"
    
    # Count sample data
    ITEM_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM items;
    " | xargs)
    
    STAT_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT COUNT(*) FROM stat_values;
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
        WHERE schemaname = 'public'
        GROUP BY schemaname;
    "
    
    echo ""
    echo "Sample Data Counts:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
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
        echo "Example:"
        echo "  export DATABASE_URL=\"postgresql://user:pass@localhost:5432/tinkertools\""
        echo "  $0"
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