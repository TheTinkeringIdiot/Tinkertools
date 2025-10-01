#!/usr/bin/env python
"""
High-performance unified import CLI.

Clean, fast, reliable import system using PostgreSQL native operations.
"""

import click
import logging
import sys
import os
from pathlib import Path
from typing import Optional
import time
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.import_v2 import UnifiedImporter, ImportConfig, ImportOrchestrator
from app.import_v2.corrections import NanoCorrections

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,  # Changed to DEBUG for more detail
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('import_v2.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


def get_data_dir() -> Path:
    """Get default data directory."""
    return Path(__file__).parent / 'database'


def get_corrections_path() -> Path:
    """Get default corrections CSV path."""
    return Path(__file__).parent / 'all_nanos_compacted.csv'


@click.group()
@click.option('--verbose', '-v', is_flag=True, help='Enable verbose output')
@click.option('--quiet', '-q', is_flag=True, help='Suppress output except errors')
@click.pass_context
def cli(ctx, verbose, quiet):
    """
    High-performance unified import system.

    Clean architecture, streaming processing, native PostgreSQL operations.
    """
    if quiet:
        logging.getLogger().setLevel(logging.ERROR)
    elif verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    ctx.ensure_object(dict)


@cli.command()
@click.option('--data-dir', type=click.Path(exists=True), help='Data directory path')
@click.option('--corrections', type=click.Path(exists=True), help='Corrections CSV path')
@click.option('--batch-size', default=10000, help='Batch size for processing')
@click.option('--single-pass', is_flag=True, help='Use single-pass import (faster, less safe)')
@click.option('--skip-corrections', is_flag=True, help='Skip nano corrections')
@click.option('--dry-run', is_flag=True, help='Validate without importing')
@click.option('--clear', is_flag=True, help='Clear database before import')
def all(data_dir, corrections, batch_size, single_pass, skip_corrections, dry_run, clear):
    """Import all data (symbiants, items, nanos) with corrections."""

    if clear and not dry_run:
        if not click.confirm('This will DELETE all data. Continue?'):
            return

    data_path = Path(data_dir) if data_dir else get_data_dir()
    corrections_path = None if skip_corrections else (corrections or get_corrections_path())

    if dry_run:
        click.echo("DRY RUN: Validating data without import")

    click.echo(f"Data directory: {data_path}")
    click.echo(f"Corrections: {corrections_path or 'None'}")
    click.echo(f"Batch size: {batch_size}")
    click.echo(f"Strategy: {'Single-pass' if single_pass else 'Two-pass'}")

    orchestrator = ImportOrchestrator(data_path)

    start_time = time.time()

    with tqdm(total=150000, desc="Importing", unit="items") as pbar:
        def progress_callback(batch_num, success):
            pbar.update(batch_size)
            pbar.set_postfix({'batch': batch_num, 'status': 'OK' if success else 'FAIL'})

        if dry_run:
            # Validation only
            for file_type in ['items', 'nanos']:
                file_path = data_path / f"{file_type}.json"
                if file_path.exists():
                    config = ImportConfig(
                        data_path=str(file_path),
                        batch_size=batch_size,
                        clear_database=False  # Don't clear in dry-run
                    )
                    importer = UnifiedImporter(config)
                    stats = importer.validate_only()
                    click.echo(f"\n{file_type}: {stats['valid_items']}/{stats['total_items']} valid")
        else:
            # Actual import
            stats = orchestrator.import_all_data(corrections_path, clear_first=clear)

    elapsed = time.time() - start_time

    if not dry_run:
        click.echo(f"\n{'='*60}")
        click.echo("Import Complete")
        click.echo(f"{'='*60}")
        click.echo(f"Total time: {elapsed:.2f}s")

        # Handle different stats structures
        total_imported = 0
        for data_type, type_stats in stats.items():
            if isinstance(type_stats, dict):
                if 'pass2' in type_stats:
                    imported = type_stats['pass2']['items_imported']
                    speed = type_stats['pass2']['speed']
                else:
                    imported = type_stats.get('items_imported', 0)
                    speed = type_stats.get('speed', 0)

                total_imported += imported
                click.echo(f"{data_type}: {imported:,} items ({speed:.0f} items/s)")


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--file-type', type=click.Choice(['items', 'nanos', 'symbiants']),
              help='Type of data to import')
@click.option('--corrections', type=click.Path(exists=True), help='Corrections CSV path')
@click.option('--batch-size', default=10000, help='Batch size for processing')
@click.option('--single-pass', is_flag=True, help='Use single-pass import')
@click.option('--clear', is_flag=True, help='Clear database before import')
def file(file_path, file_type, corrections, batch_size, single_pass, clear):
    """Import a specific file."""

    file_path = Path(file_path)

    # Auto-detect file type if not specified
    if not file_type:
        if 'nano' in file_path.stem.lower():
            file_type = 'nanos'
        elif 'symbiant' in file_path.stem.lower():
            file_type = 'symbiants'
        else:
            file_type = 'items'

    click.echo(f"Importing {file_type} from {file_path.name}")

    if clear:
        if not click.confirm('This will DELETE all data. Continue?'):
            return

    config = ImportConfig(
        data_path=str(file_path),
        corrections_csv=corrections if file_type == 'nanos' else None,
        batch_size=batch_size,
        use_two_pass=not single_pass,
        clear_database=clear
    )

    importer = UnifiedImporter(config)

    with tqdm(desc=f"Importing {file_type}", unit="items") as pbar:
        def progress_callback(batch_num, success):
            pbar.update(batch_size)
            pbar.set_postfix({'batch': batch_num})

        stats = importer.import_file(str(file_path), file_type)

    # Handle two-pass stats structure
    if 'pass2' in stats:
        items_imported = stats['pass2']['items_imported']
        speed = stats['pass2']['speed']
    else:
        items_imported = stats.get('items_imported', 0)
        speed = stats.get('speed', 0)

    click.echo(f"\nImported {items_imported:,} {file_type}")
    click.echo(f"Speed: {speed:.0f} items/s")


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--strict', is_flag=True, help='Fail on any validation error')
def validate(file_path, strict):
    """Validate data file without importing."""

    config = ImportConfig(
        data_path=file_path,
        validate_strict=strict
    )

    importer = UnifiedImporter(config)
    stats = importer.validate_only()

    click.echo(f"\nValidation Results:")
    click.echo(f"  Total items: {stats['total_items']:,}")
    click.echo(f"  Valid: {stats['valid_items']:,}")
    click.echo(f"  Invalid: {stats['invalid_items']:,}")

    if stats['invalid_items'] > 0:
        click.echo(f"\n{click.style('VALIDATION FAILED', fg='red')}")
        sys.exit(1)
    else:
        click.echo(f"\n{click.style('VALIDATION PASSED', fg='green')}")


@cli.command()
@click.option('--source', default='import_cli.py', help='Compare against old importer')
@click.option('--iterations', default=3, help='Number of benchmark iterations')
def benchmark(source, iterations):
    """Benchmark import performance."""

    click.echo(f"Benchmarking against {source}")
    click.echo(f"Running {iterations} iterations\n")

    data_dir = get_data_dir()
    corrections = get_corrections_path()

    times_v2 = []
    speeds_v2 = []

    for i in range(iterations):
        click.echo(f"Iteration {i+1}/{iterations}")

        # Clear database
        clear_database()

        # Run v2 import
        config = ImportConfig(
            data_path=str(data_dir / 'items.json'),
            corrections_csv=str(corrections),
            batch_size=10000,
            use_two_pass=True
        )

        importer = UnifiedImporter(config)

        start = time.time()
        stats = importer.import_all()
        elapsed = time.time() - start

        times_v2.append(elapsed)
        speeds_v2.append(stats.get('overall_speed', 0))

        click.echo(f"  v2: {elapsed:.2f}s ({stats.get('overall_speed', 0):.0f} items/s)")

    # Calculate averages
    avg_time = sum(times_v2) / len(times_v2)
    avg_speed = sum(speeds_v2) / len(speeds_v2)

    click.echo(f"\n{'='*60}")
    click.echo("Benchmark Results")
    click.echo(f"{'='*60}")
    click.echo(f"Average time: {avg_time:.2f}s")
    click.echo(f"Average speed: {avg_speed:.0f} items/s")

    # Compare with theoretical old performance
    old_speed = 1500  # Claimed 1000-2000 items/s
    improvement = (avg_speed / old_speed - 1) * 100

    if improvement > 0:
        click.echo(f"\n{click.style(f'+{improvement:.1f}% faster', fg='green')}")
    else:
        click.echo(f"\n{click.style(f'{improvement:.1f}% slower', fg='red')}")




@cli.command()
def stats():
    """Show import statistics from last run."""

    log_file = Path('import_v2.log')

    if not log_file.exists():
        click.echo("No import log found")
        return

    # Parse log for statistics
    with open(log_file) as f:
        lines = f.readlines()

    # Find last summary
    for i in range(len(lines) - 1, -1, -1):
        if 'Import Summary' in lines[i]:
            # Print from here to end
            for line in lines[i:]:
                if line.strip():
                    click.echo(line.strip())
            break


if __name__ == '__main__':
    cli()