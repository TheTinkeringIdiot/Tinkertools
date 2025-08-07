# TinkerTools Data Import Utility

A standalone utility for importing game data into the TinkerTools database. This utility is separate from the main FastAPI application and uses the `DATABASE_URL` environment variable to connect to any database.

## Requirements

### Data Files
Place the following files in the `backend/` directory:
- `items.json` (407MB) - Item data
- `nanos.json` (44MB) - Nano program data  
- `symbiants.csv` (208KB) - Symbiant data

### Environment
Set the database connection string:
```bash
export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"
```

For production deployment, simply change the DATABASE_URL to point to your production database.

## Usage

### Validate Files
Check if all required data files are present:
```bash
python import_cli.py validate
```

### Import Individual Datasets
```bash
# Import symbiants (smallest file, good for testing)
python import_cli.py symbiants

# Import items with custom chunk size
python import_cli.py items --chunk-size 50

# Import nanos
python import_cli.py nanos
```

### Import All Data
Import everything in optimal order (symbiants → items → nanos):
```bash
python import_cli.py all
```

### Clear Existing Data
Use the `--clear` flag to delete existing data before import:
```bash
python import_cli.py all --clear
```
**⚠️ WARNING: This will delete all existing data!**

## Options

- `--clear` - Clear existing data before import (destructive!)
- `--chunk-size N` - Process N items per chunk (default: 100)
- `--database-url URL` - Override DATABASE_URL environment variable

## Examples

```bash
# Development - import to local test database
export DATABASE_URL="postgresql://aodbuser:password@localhost:5432/tinkertools"
python import_cli.py all --clear

# Production - import to production database  
export DATABASE_URL="postgresql://prod_user:prod_pass@prod-host:5432/tinkertools_prod"
python import_cli.py all

# Test with small chunks for memory-constrained environments
python import_cli.py items --chunk-size 25
```

## Performance Notes

- **Symbiants**: ~1,000 records, imports in seconds
- **Items**: ~18.7M records, large file processing in chunks
- **Nanos**: ~2.1M records, medium processing time
- **Memory Usage**: Controlled by chunk size (default 100 items/chunk)

## Implementation Details

The import utility:
1. **Preprocesses singletons** - Extracts all StatValues and Criteria for bulk creation
2. **Processes in chunks** - Handles large files without memory issues  
3. **Uses transactions** - Each chunk is committed separately for reliability
4. **Maintains relationships** - Properly handles foreign keys and many-to-many relationships
5. **Provides progress tracking** - Logs progress and performance metrics

## Troubleshooting

### Import Fails
- Check `import.log` for detailed error messages
- Verify DATABASE_URL is correct and database is accessible
- Ensure sufficient disk space and memory
- Try smaller `--chunk-size` for memory issues

### Performance Issues  
- Use smaller chunk sizes: `--chunk-size 25`
- Monitor database performance during import
- Consider running during off-peak hours for production

### Data Quality
- The utility validates data during import
- Failed items are logged but don't stop the import
- Check logs for items that failed to import