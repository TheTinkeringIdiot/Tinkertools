#!/usr/bin/env python3
"""
Nano CSV Compactor

Converts the expanded all_nanos_comprehensive.csv (12,426 rows) 
to a compacted format with one row per nano program (4,038 rows).

Each nano gets:
- Minimum QL from non-test crystals
- Semicolon-separated list of crystal IDs
- All other nano data from the canonical entry
"""

import csv
from collections import defaultdict
from typing import Dict, List


def compact_nanos(input_path: str, output_path: str):
    """Compact the nano CSV to one row per nano program"""
    
    print(f"Reading comprehensive nano data from {input_path}...")
    
    # Group all rows by nano_id
    nano_groups = defaultdict(list)
    
    with open(input_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            nano_groups[row['nano_id']].append(row)
    
    print(f"Found {len(nano_groups)} unique nano programs")
    
    # Process each nano group
    compacted_records = []
    stats = {
        'total_nanos': len(nano_groups),
        'excluded_testitem_crystals': 0,
        'total_crystals_kept': 0,
        'nanos_with_varying_qls': 0
    }
    
    for nano_id, rows in nano_groups.items():
        # Filter out TESTITEM crystals
        real_crystals = [r for r in rows if 'TESTITEM' not in r['crystal_name'].upper()]
        
        stats['excluded_testitem_crystals'] += len(rows) - len(real_crystals)
        stats['total_crystals_kept'] += len(real_crystals)
        
        if not real_crystals:
            # If only test crystals exist, keep one for completeness
            real_crystals = [rows[0]]
        
        # Calculate QL statistics
        qls = [int(r['ql']) for r in real_crystals]
        unique_qls = set(qls)
        
        if len(unique_qls) > 1:
            stats['nanos_with_varying_qls'] += 1
        
        # Select minimum QL as canonical
        primary_ql = min(qls) if qls else int(rows[0]['ql'])
        
        # Create sorted crystal list (by QL, then by ID)
        sorted_crystals = sorted(real_crystals, key=lambda x: (int(x['ql']), int(x['crystal_id'])))
        crystal_ids = ';'.join([c['crystal_id'] for c in sorted_crystals])
        
        # Use first real crystal as template (or first row if no real crystals)
        template = real_crystals[0] if real_crystals else rows[0]
        
        # Create compacted record
        compacted_record = {
            'nano_id': nano_id,
            'ql': primary_ql,
            'crystal_ids': crystal_ids,
            'crystal_count': len(real_crystals),
            'ql_range': f"{min(qls)}-{max(qls)}" if len(unique_qls) > 1 else str(primary_ql),
            'nano_name': template['nano_name'],
            'nano_description': template['nano_description'],
            'school': template['school'],
            'strain': template['strain'],
            'strain_id': template['strain_id'],
            'sub_strain': template['sub_strain'],
            'professions': template['professions'],
            'location': template['location'],
            'nano_cost': template['nano_cost'],
            'froob_friendly': template['froob_friendly'],
            'sort_order': template['sort_order'],
            'nano_deck': template['nano_deck'],
            'spec': template['spec'],
            'min_level': template['min_level'],
            'mm': template['mm'],
            'bm': template['bm'],
            'pm': template['pm'],
            'si': template['si'],
            'ts': template['ts'],
            'mc': template['mc'],
            'source': template['source'],
            'has_nanostrain_stat': template['has_nanostrain_stat'],
            'nanostrain_value': template['nanostrain_value']
        }
        
        compacted_records.append(compacted_record)
    
    # Sort by nano_id for consistency
    compacted_records.sort(key=lambda x: int(x['nano_id']))
    
    # Write compacted CSV
    fieldnames = [
        'nano_id', 'ql', 'crystal_ids', 'crystal_count', 'ql_range',
        'nano_name', 'nano_description', 'school', 'strain', 'strain_id', 'sub_strain',
        'professions', 'location', 'nano_cost', 'froob_friendly', 'sort_order',
        'nano_deck', 'spec', 'min_level', 'mm', 'bm', 'pm', 'si', 'ts', 'mc',
        'source', 'has_nanostrain_stat', 'nanostrain_value'
    ]
    
    print(f"Writing compacted nano data to {output_path}...")
    
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_NONNUMERIC)
        writer.writeheader()
        writer.writerows(compacted_records)
    
    # Print summary report
    print(f"\n{'='*60}")
    print("NANO COMPACTION COMPLETE")
    print(f"{'='*60}")
    
    print(f"📊 Compaction Results:")
    print(f"  Input rows: {sum(len(rows) for rows in nano_groups.values()):,}")
    print(f"  Output rows: {len(compacted_records):,}")
    print(f"  Compression ratio: {sum(len(rows) for rows in nano_groups.values()) / len(compacted_records):.1f}x")
    
    print(f"\n💎 Crystal Analysis:")
    print(f"  Total crystals preserved: {stats['total_crystals_kept']:,}")
    print(f"  TESTITEM crystals excluded: {stats['excluded_testitem_crystals']:,}")
    print(f"  Nanos with varying QLs: {stats['nanos_with_varying_qls']:,}")
    
    print(f"\n📁 Output: {output_path}")
    

if __name__ == "__main__":
    compact_nanos(
        "all_nanos_comprehensive.csv", 
        "nanos_compacted.csv"
    )