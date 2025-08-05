#!/bin/bash

# TinkerTools Database Setup Script
# This script creates the database, runs migrations, and seeds initial data

set -e  # Exit on any error

DB_NAME="tinkertools"
DB_USER="tinkertools_user"
DB_PASSWORD="tinkertools_dev"
DB_HOST="localhost"
DB_PORT="5432"

echo "🚀 Starting TinkerTools Database Setup..."

# Function to check if PostgreSQL is running
check_postgres() {
    echo "📋 Checking PostgreSQL connection..."
    if ! pg_isready -h $DB_HOST -p $DB_PORT; then
        echo "❌ PostgreSQL is not running or not accessible at $DB_HOST:$DB_PORT"
        echo "Please start PostgreSQL and try again."
        exit 1
    fi
    echo "✅ PostgreSQL is running"
}

# Function to create database and user
create_database() {
    echo "🔨 Creating database and user..."
    
    # Create user if it doesn't exist
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
                CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
            END IF;
        END
        \$\$;
    " || echo "User may already exist, continuing..."
    
    # Create database if it doesn't exist
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
    " || echo "Database may already exist, continuing..."
    
    # Grant privileges
    psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
        ALTER USER $DB_USER CREATEDB;
    "
    
    echo "✅ Database and user created/verified"
}

# Function to run migrations
run_migrations() {
    echo "🔄 Running database migrations..."
    
    # Set connection string
    export PGPASSWORD=$DB_PASSWORD
    
    # Run migration system setup first
    echo "📝 Setting up migration tracking..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/000_create_migration_table.sql
    
    # Run initial schema migration
    echo "🏗️ Creating database schema..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f migrations/001_initial_schema.sql
    
    echo "✅ Migrations completed successfully"
}

# Function to seed sample data
seed_data() {
    echo "🌱 Seeding sample data..."
    
    if [ -f "seeds/sample_data.sql" ]; then
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
    
    if [ "$TABLE_COUNT" -ge "20" ]; then
        echo "✅ Database setup verified successfully!"
        echo ""
        echo "🎉 TinkerTools database is ready!"
        echo "   Database: $DB_NAME"
        echo "   User: $DB_USER"
        echo "   Host: $DB_HOST:$DB_PORT"
        echo ""
        echo "🔗 Connection string: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
    else
        echo "❌ Database setup verification failed - expected at least 20 tables, found $TABLE_COUNT"
        exit 1
    fi
}

# Main execution
main() {
    check_postgres
    create_database
    run_migrations
    seed_data
    verify_setup
}

# Parse command line arguments
case "$1" in
    "reset")
        echo "🗑️ Resetting database..."
        psql -h $DB_HOST -p $DB_PORT -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
        psql -h $DB_HOST -p $DB_PORT -U postgres -c "DROP USER IF EXISTS $DB_USER;"
        main
        ;;
    "verify")
        verify_setup
        ;;
    *)
        main
        ;;
esac