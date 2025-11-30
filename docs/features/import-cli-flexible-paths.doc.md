# Import CLI Flexible File Paths

## Overview
The backend import CLI now supports flexible file path resolution, allowing data files (items.json, nanos.json, symbiants.csv, perks.json) to be located anywhere on the filesystem instead of being hardcoded to backend/database/. This improves deployment flexibility and supports environment-specific data locations.

## User Perspective
Developers and deployment engineers can now:
- Specify custom file paths via CLI arguments (--items-file, --nanos-file, --symbiants-file, --perks-file)
- Use home directory expansion (~) for paths relative to user home
- Use environment variable expansion ($VAR or ${VAR}) for dynamic paths
- Override individual file locations while keeping others at defaults
- Deploy data files to separate data volumes without modifying code

## Data Flow
1. User invokes import_cli.py with optional --{dataset}-file arguments
2. CLI argument parser captures custom file paths (or None if not provided)
3. resolve_data_file_path() expands ~ and $VAR in custom paths or falls back to backend/database/{filename}
4. validate_files() checks all resolved paths exist and reports file sizes
5. DataImporter/OptimizedImporter initialized with perks_file parameter
6. Importers load data from resolved paths and process into database
7. CLI reports success/failure with detailed statistics

## Implementation

### Key Files
- `/home/quigley/projects/Tinkertools/backend/import_cli.py` - Main CLI with new path resolution logic (~166 lines added)
  - `resolve_data_file_path()` - Path expansion and validation function
  - Updated argument parser with 4 new --{dataset}-file arguments
  - Enhanced validate_files() to check custom paths
  - Updated import_items(), import_nanos(), import_symbiants(), import_all() to use resolved paths

- `/home/quigley/projects/Tinkertools/backend/app/core/importer.py` - Standard importer with perks_file support
  - Added perks_file parameter to __init__()
  - Updated load_perk_metadata() to use custom perks_file path

- `/home/quigley/projects/Tinkertools/backend/app/core/optimized_importer.py` - Optimized importer with perks_file support
  - Added perks_file parameter to __init__()
  - Class-level _perks_file_path for cache loading
  - Updated _load_perk_cache() to use custom path

### Database
No database changes required. This feature only affects how data files are loaded into the existing schema.

### Path Resolution Logic
```python
def resolve_data_file_path(cli_path: Optional[str], default_filename: str) -> Path:
    if cli_path:
        # Expand environment variables ($VAR, ${VAR})
        expanded_path = os.path.expandvars(cli_path)
        # Expand home directory (~)
        file_path = Path(expanded_path).expanduser()
    else:
        # Fall back to backend/database/{filename}
        file_path = Path(__file__).parent / "database" / default_filename

    if not file_path.exists():
        raise FileNotFoundError(f"Data file not found: {file_path}")

    return file_path
```

## Configuration
No environment variables required. Custom paths are specified via CLI arguments:

**CLI Arguments:**
- `--items-file PATH` - Custom path to items.json (default: backend/database/items.json)
- `--nanos-file PATH` - Custom path to nanos.json (default: backend/database/nanos.json)
- `--symbiants-file PATH` - Custom path to symbiants.csv (default: backend/database/symbiants.csv)
- `--perks-file PATH` - Custom path to perks.json (default: backend/database/perks.json)

All paths support:
- Absolute paths: `/data/items.json`
- Home directory expansion: `~/ao-data/items.json`
- Environment variables: `$AO_DATA/items.json` or `${DATA_DIR}/items.json`

## Usage Example

### Default Locations (No Change)
```bash
# Uses backend/database/*.json by default
cd /home/quigley/projects/Tinkertools/backend
python import_cli.py validate
python import_cli.py items --optimized
python import_cli.py all --optimized --clear
```

### Custom Single File
```bash
# Override just items.json location
python import_cli.py items --items-file /mnt/data/items.json --optimized

# Override with home directory
python import_cli.py nanos --nanos-file ~/anarchy-data/nanos.json
```

### Custom All Files with Environment Variables
```bash
# Set data directory via environment variable
export AO_DATA=/mnt/game-data/anarchy-online

# Use environment variable in all file paths
python import_cli.py all \
  --items-file $AO_DATA/items.json \
  --nanos-file $AO_DATA/nanos.json \
  --symbiants-file $AO_DATA/symbiants.csv \
  --perks-file $AO_DATA/perks.json \
  --optimized --clear
```

### Validation with Custom Paths
```bash
# Validate files before importing
python import_cli.py validate \
  --items-file ~/data/items.json \
  --nanos-file ~/data/nanos.json \
  --symbiants-file ~/data/symbiants.csv \
  --perks-file ~/data/perks.json

# Output shows resolved paths and file sizes:
# ✓ /home/user/data/items.json: 407.2 MB
# ✓ /home/user/data/nanos.json: 44.1 MB
# ✓ /home/user/data/symbiants.csv: 0.2 MB
# ✓ /home/user/data/perks.json: 0.4 MB
```

## Testing

### Manual Test: Default Paths
```bash
cd /home/quigley/projects/Tinkertools/backend
source venv/bin/activate
export $(cat .env.local | xargs)

# Validate default file locations
python import_cli.py validate

# Expected: Shows all 4 files in backend/database/ with sizes
```

### Manual Test: Custom Path
```bash
# Create test directory with symlink to items.json
mkdir -p /tmp/ao-test-data
ln -s /home/quigley/projects/Tinkertools/backend/database/items.json /tmp/ao-test-data/items.json

# Validate with custom path
python import_cli.py validate --items-file /tmp/ao-test-data/items.json

# Expected: Shows custom path with correct file size
```

### Manual Test: Environment Variable Expansion
```bash
export TEST_DATA_DIR=/tmp/ao-test-data

# Validate with environment variable
python import_cli.py validate --items-file $TEST_DATA_DIR/items.json

# Expected: Resolves $TEST_DATA_DIR and validates file
```

### Manual Test: Home Directory Expansion
```bash
# Validate with ~ expansion
python import_cli.py validate --items-file ~/projects/Tinkertools/backend/database/items.json

# Expected: Resolves ~ to /home/quigley and validates file
```

### Manual Test: Missing File Error Handling
```bash
# Try to validate non-existent file
python import_cli.py validate --items-file /nonexistent/items.json

# Expected: Error message "Data file not found: /nonexistent/items.json"
```

## Deployment Benefits

### Before (Hardcoded Paths)
- Data files must be in backend/database/ directory
- Difficult to use separate data volumes
- Can't reuse shared data directories
- Must copy large files into codebase location

### After (Flexible Paths)
- Data files can live anywhere on filesystem
- Easy to mount data volumes at custom locations
- Multiple deployments can share single data directory
- No need to duplicate 450+ MB of data files

### Docker Deployment Example
```dockerfile
# Mount data volume to any location
docker run -v /mnt/data:/app/data \
  -e AO_DATA=/app/data \
  tinkertools \
  python import_cli.py all \
    --items-file $AO_DATA/items.json \
    --nanos-file $AO_DATA/nanos.json \
    --optimized
```

## Related Documentation
- Import CLI usage: `/home/quigley/projects/Tinkertools/backend/import_cli.py --help`
- Database setup: `/home/quigley/projects/Tinkertools/database/setup.sh`
- Optimized importer: `/home/quigley/projects/Tinkertools/backend/app/core/optimized_importer.py`
- Environment configuration: `/home/quigley/projects/Tinkertools/INFRASTRUCTURE.md`
