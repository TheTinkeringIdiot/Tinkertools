#!/bin/bash

# TinkerTools Database Backup and Restore Script
# REQUIRES: DATABASE_URL environment variable must be set
# Assumes database exists with user-level access (no postgres superuser needed)

set -e  # Exit on any error

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

echo_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to parse DATABASE_URL
parse_database_url() {
    if [ -z "$DATABASE_URL" ]; then
        echo_error "DATABASE_URL environment variable is not set"
        echo ""
        echo "Please set DATABASE_URL in the format:"
        echo "  export DATABASE_URL=\"postgresql://user:password@host:port/database\""
        echo ""
        echo "Example:"
        echo "  export DATABASE_URL=\"postgresql://tinkertools_user:password@localhost:5432/tinkertools\""
        exit 1
    fi
    
    echo_info "Using DATABASE_URL for connection"
    
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
    
    echo_info "Database: $DB_NAME on $DB_HOST:$DB_PORT as $DB_USER"
}

# Function to check database connection
check_database_connection() {
    echo_info "Checking database connection..."
    
    export PGPASSWORD=$DB_PASSWORD
    
    if ! psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1; then
        echo_error "Cannot connect to database"
        echo "Please ensure DATABASE_URL is correct and database is accessible"
        exit 1
    fi
    
    echo_success "Database connection verified"
}

# Function to create backup directory
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        echo_info "Created backup directory: $BACKUP_DIR"
    fi
}

# Function to backup database
backup_database() {
    echo_info "Starting database backup..."
    
    parse_database_url
    check_database_connection
    create_backup_dir
    
    export PGPASSWORD=$DB_PASSWORD
    
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"
    local schema_file="${BACKUP_DIR}/${DB_NAME}_schema_${TIMESTAMP}.sql"
    local data_file="${BACKUP_DIR}/${DB_NAME}_data_${TIMESTAMP}.sql"
    
    # Full backup
    echo_info "Creating full database backup..."
    pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$backup_file"
    
    # Schema-only backup
    echo_info "Creating schema-only backup..."
    pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only -f "$schema_file"
    
    # Data-only backup
    echo_info "Creating data-only backup..."
    pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --data-only -f "$data_file"
    
    # Compress backups
    echo_info "Compressing backup files..."
    gzip "$backup_file"
    gzip "$schema_file"
    gzip "$data_file"
    
    echo_success "Database backup completed:"
    echo "  Full backup: ${backup_file}.gz"
    echo "  Schema only: ${schema_file}.gz"
    echo "  Data only: ${data_file}.gz"
    
    # List backup files with sizes
    ls -lh "${BACKUP_DIR}/"*"${TIMESTAMP}"*.gz
}

# Function to restore database from backup
restore_database() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        echo_error "Please specify backup file to restore"
        echo "Usage: $0 restore <backup_file>"
        echo "Available backups:"
        ls -1 "${BACKUP_DIR}/"*.sql.gz 2>/dev/null || echo "No backups found"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    parse_database_url
    check_database_connection
    
    echo_warning "This will DROP ALL TABLES in the database!"
    echo_warning "Database: $DB_NAME on $DB_HOST:$DB_PORT"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Restore cancelled."
        exit 0
    fi
    
    echo_info "Starting database restore from: $backup_file"
    
    export PGPASSWORD=$DB_PASSWORD
    
    # Drop all tables (user-level, not dropping database)
    echo_info "Dropping all existing tables..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        DO \$\$ 
        DECLARE 
            r RECORD;
        BEGIN
            -- Drop all tables in public schema
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
            LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END \$\$;
    "
    
    # Restore from backup
    echo_info "Restoring database from backup..."
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
    else
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$backup_file"
    fi
    
    echo_success "Database restore completed successfully!"
}

# Function to restore schema only
restore_schema() {
    local schema_file="$1"
    
    if [ -z "$schema_file" ]; then
        echo_error "Please specify schema file to restore"
        echo "Usage: $0 restore-schema <schema_file>"
        exit 1
    fi
    
    if [ ! -f "$schema_file" ]; then
        echo_error "Schema file not found: $schema_file"
        exit 1
    fi
    
    parse_database_url
    check_database_connection
    
    echo_warning "This will recreate the database schema!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Schema restore cancelled."
        exit 0
    fi
    
    export PGPASSWORD=$DB_PASSWORD
    
    # Drop all tables first
    echo_info "Dropping existing tables..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        DO \$\$ 
        DECLARE 
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
            LOOP
                EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
            END LOOP;
        END \$\$;
    "
    
    # Restore schema
    echo_info "Restoring schema..."
    if [[ "$schema_file" == *.gz ]]; then
        gunzip -c "$schema_file" | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
    else
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$schema_file"
    fi
    
    echo_success "Schema restore completed!"
}

# Function to clean old backups
clean_old_backups() {
    local days=${1:-7}  # Default to 7 days
    
    echo_info "Cleaning backups older than $days days..."
    
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$days -delete
        echo_success "Old backups cleaned"
    else
        echo_warning "Backup directory not found"
    fi
}

# Function to list available backups
list_backups() {
    echo_info "Available database backups:"
    
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        ls -lht "${BACKUP_DIR}/"*.sql.gz 2>/dev/null | head -20
    else
        echo "No backups found"
    fi
}

# Function to verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        echo_error "Please specify backup file to verify"
        exit 1
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    echo_info "Verifying backup integrity: $backup_file"
    
    # Check if file can be decompressed and has valid SQL
    if [[ "$backup_file" == *.gz ]]; then
        if gunzip -t "$backup_file" 2>/dev/null; then
            echo_success "Backup file compression is valid"
        else
            echo_error "Backup file compression is corrupted"
            exit 1
        fi
        
        # Check for SQL content
        if gunzip -c "$backup_file" | head -20 | grep -q "PostgreSQL database dump"; then
            echo_success "Backup contains valid PostgreSQL dump"
        else
            echo_error "Backup does not contain valid PostgreSQL dump"
            exit 1
        fi
    else
        if head -20 "$backup_file" | grep -q "PostgreSQL database dump"; then
            echo_success "Backup contains valid PostgreSQL dump"
        else
            echo_error "Backup does not contain valid PostgreSQL dump"
            exit 1
        fi
    fi
    
    echo_success "Backup verification completed successfully"
}

# Function to show database size
show_database_size() {
    echo_info "Database size information:"
    
    parse_database_url
    check_database_connection
    
    export PGPASSWORD=$DB_PASSWORD
    
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    "
    
    echo
    echo_info "Total database size:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as database_size;
    "
}

# Function to show help
show_help() {
    echo "TinkerTools Database Backup and Restore Script"
    echo ""
    echo "REQUIRES: DATABASE_URL environment variable must be set"
    echo "Assumes database exists with user-level access (no postgres superuser needed)"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  backup                 Create a full database backup"
    echo "  restore <file>         Restore database from backup file (drops all tables)"
    echo "  restore-schema <file>  Restore schema only from backup file"
    echo "  list                   List available backup files"
    echo "  verify <file>          Verify backup file integrity"
    echo "  clean [days]           Clean backups older than [days] (default: 7)"
    echo "  size                   Show database size information"
    echo "  help                   Show this help message"
    echo ""
    echo "Required Environment Variables:"
    echo "  DATABASE_URL           Full PostgreSQL URL (postgresql://user:pass@host:port/db)"
    echo ""
    echo "Example:"
    echo "  export DATABASE_URL=\"postgresql://user:pass@localhost:5432/tinkertools\""
    echo "  $0 backup"
    echo "  $0 restore backups/tinkertools_20231201_120000.sql.gz"
    echo "  $0 restore-schema backups/tinkertools_schema_20231201_120000.sql.gz"
    echo "  $0 clean 14"
    echo "  $0 verify backups/tinkertools_20231201_120000.sql.gz"
}

# Main execution
case "$1" in
    "backup")
        backup_database
        ;;
    "restore")
        restore_database "$2"
        ;;
    "restore-schema")
        restore_schema "$2"
        ;;
    "list")
        list_backups
        ;;
    "verify")
        verify_backup "$2"
        ;;
    "clean")
        clean_old_backups "$2"
        ;;
    "size")
        show_database_size
        ;;
    "help"|"--help"|"-h")
        show_help
        ;;
    *)
        echo_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac