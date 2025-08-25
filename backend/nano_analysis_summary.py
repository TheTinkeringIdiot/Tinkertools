#!/usr/bin/env python3
"""
Nano Analysis Summary

Provides comprehensive summary of the nano data analysis and 
shows what was accomplished.
"""

import pandas as pd
from collections import Counter


def analyze_results():
    print("🔬 NANO DATA ANALYSIS SUMMARY")
    print("=" * 50)
    
    # Load the data files
    try:
        original_df = pd.read_csv('/home/quigley/projects/Tinkertools/backend/nanos.csv')
        corrected_df = pd.read_csv('/home/quigley/projects/Tinkertools/backend/corrected_nanos_aoid.csv')
        
        print(f"📊 Data Overview:")
        print(f"  Original CSV: {len(original_df):,} nano entries")
        print(f"  Corrected CSV: {len(corrected_df):,} player-castable nanos")
        
        # Check strain coverage
        original_with_strains = len(original_df[original_df['strain_id'].notna() & (original_df['strain_id'] != 0)])
        corrected_with_strains = len(corrected_df[corrected_df['strain_id'] != 0])
        
        print(f"\n🏷️  Strain Assignment Coverage:")
        print(f"  Original CSV: {original_with_strains:,}/{len(original_df):,} ({original_with_strains/len(original_df)*100:.1f}%)")
        print(f"  Corrected CSV: {corrected_with_strains:,}/{len(corrected_df):,} ({corrected_with_strains/len(corrected_df)*100:.1f}%)")
        
        # Check what's new vs existing
        original_nano_ids = set(original_df['nano_id'].dropna())
        corrected_nano_ids = set(corrected_df['nano_id'].dropna())
        
        overlapping = original_nano_ids.intersection(corrected_nano_ids)
        new_in_corrected = corrected_nano_ids - original_nano_ids
        missing_from_corrected = original_nano_ids - corrected_nano_ids
        
        print(f"\n🔄 Nano ID Overlap Analysis:")
        print(f"  Nanos in both datasets: {len(overlapping):,}")
        print(f"  New nanos in corrected: {len(new_in_corrected):,}")
        print(f"  Nanos from original not in corrected: {len(missing_from_corrected):,}")
        
        # Check strain distribution
        print(f"\n📈 Top Strain Assignments in Corrected Data:")
        strain_counts = Counter(corrected_df[corrected_df['strain_id'] != 0]['strain'].dropna())
        for strain, count in strain_counts.most_common(10):
            print(f"  {strain}: {count} nanos")
        
        # Check crystal mapping success
        has_crystal = len(corrected_df[corrected_df['crystal_id'] != 0])
        print(f"\n🔗 Crystal Mapping Success:")
        print(f"  Nanos with crystal IDs: {has_crystal:,}/{len(corrected_df):,} ({has_crystal/len(corrected_df)*100:.1f}%)")
        
        # Check inference methods
        print(f"\n🧠 Inference Methods Used:")
        method_counts = Counter(corrected_df['inference_method'])
        for method, count in method_counts.most_common():
            print(f"  {method}: {count:,}")
        
        # Actionable next steps
        missing_strains = len(corrected_df[corrected_df['strain_id'] == 0])
        missing_crystals = len(corrected_df[corrected_df['crystal_id'] == 0])
        
        print(f"\n🎯 Next Steps:")
        print(f"  1. Review {missing_strains:,} nanos missing strain assignments")
        print(f"  2. Find crystal AOIDs for {missing_crystals:,} nanos missing crystals")
        print(f"  3. Validate {corrected_with_strains:,} inferred strain assignments")
        
        # Show sample of new nanos found
        if new_in_corrected:
            print(f"\n🆕 Sample of newly discovered player-castable nanos:")
            new_nanos = corrected_df[corrected_df['nano_id'].isin(new_in_corrected)].head(5)
            for _, nano in new_nanos.iterrows():
                print(f"  AOID {nano['nano_id']}: {nano['nano_name']} ({nano['professions']})")
        
        print(f"\n✅ Analysis complete! Main output file:")
        print(f"📁 /home/quigley/projects/Tinkertools/backend/corrected_nanos_aoid.csv")
        
    except FileNotFoundError as e:
        print(f"❌ Error: Could not find required files: {e}")
    except Exception as e:
        print(f"❌ Error during analysis: {e}")


if __name__ == "__main__":
    analyze_results()