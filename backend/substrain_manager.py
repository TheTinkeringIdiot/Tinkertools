#!/usr/bin/env python3
"""
Substrain ID Manager

Manages substrain ID assignments for nano programs:
1. Extracts unique substrains from nanos CSV
2. Assigns consistent numeric IDs (preserves existing IDs when re-run)
3. Updates CSV with sub_strain_id values
4. Creates/updates NANO_SUBSTRAINS constant in game-data.ts

Designed to be idempotent and manual-edit friendly.
"""

import csv
import re
import shutil
from collections import OrderedDict
from datetime import datetime
from typing import Dict, List, Optional, Set


class SubstrainManager:
    def __init__(self, csv_path: str, game_data_path: str):
        self.csv_path = csv_path
        self.game_data_path = game_data_path
        self.existing_mapping = {}  # id -> substrain
        self.reverse_mapping = {}   # substrain -> id
        self.changes_made = []
        
    def load_existing_mapping(self) -> Dict[int, str]:
        """Load existing NANO_SUBSTRAINS mapping from game-data.ts"""
        print("Checking for existing NANO_SUBSTRAINS mapping...")
        
        try:
            with open(self.game_data_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Look for NANO_SUBSTRAINS constant
            pattern = r'export\s+const\s+NANO_SUBSTRAINS\s*=\s*\{([^}]+)\}'
            match = re.search(pattern, content, re.DOTALL)
            
            if not match:
                print("No existing NANO_SUBSTRAINS found - starting fresh")
                return {}
            
            # Parse the existing mapping
            mapping_text = match.group(1)
            mapping = {}
            
            for line in mapping_text.strip().split('\n'):
                line = line.strip()
                if ':' in line and not line.startswith('//'):
                    try:
                        # Parse lines like: 123: "Substrain Name",
                        parts = line.split(':', 1)
                        if len(parts) == 2:
                            id_str = parts[0].strip()
                            substrain = parts[1].strip().rstrip(',').strip('"\'')
                            
                            if id_str.isdigit() and substrain:
                                mapping[int(id_str)] = substrain
                    except (ValueError, IndexError):
                        continue
            
            print(f"Loaded {len(mapping)} existing substrain mappings")
            return mapping
            
        except Exception as e:
            print(f"Warning: Could not load existing mapping: {e}")
            return {}
    
    def extract_unique_substrains(self) -> Set[str]:
        """Extract all unique substrain values from CSV"""
        print(f"Extracting unique substrains from {self.csv_path}...")
        
        substrains = set()
        
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                substrain = row.get('sub_strain', '').strip()
                if substrain:  # Only non-empty substrains
                    substrains.add(substrain)
        
        print(f"Found {len(substrains)} unique substrain values")
        return substrains
    
    def create_mapping(self, unique_substrains: Set[str]) -> Dict[int, str]:
        """Create/update the ID mapping preserving existing assignments"""
        print("Creating substrain ID mapping...")
        
        # Start with existing mapping
        final_mapping = dict(self.existing_mapping)
        self.reverse_mapping = {v: k for k, v in final_mapping.items()}
        
        # Add ID 0 for empty substrain
        if 0 not in final_mapping:
            final_mapping[0] = ""
        
        # Find next available ID
        next_id = max(final_mapping.keys(), default=0) + 1
        
        # Process substrains in alphabetical order for consistency
        new_substrains = []
        for substrain in sorted(unique_substrains):
            if substrain not in self.reverse_mapping:
                # New substrain - assign next ID
                final_mapping[next_id] = substrain
                self.reverse_mapping[substrain] = next_id
                new_substrains.append(f"ID {next_id}: \"{substrain}\"")
                next_id += 1
        
        if new_substrains:
            print(f"Assigned IDs to {len(new_substrains)} new substrains:")
            for assignment in new_substrains[:10]:  # Show first 10
                print(f"  {assignment}")
            if len(new_substrains) > 10:
                print(f"  ... and {len(new_substrains) - 10} more")
            self.changes_made.extend(new_substrains)
        else:
            print("No new substrains to assign")
        
        return final_mapping
    
    def update_csv_with_ids(self, mapping: Dict[int, str]):
        """Update CSV file with sub_strain_id values"""
        print(f"Updating {self.csv_path} with substrain IDs...")
        
        # Create backup
        backup_path = f"{self.csv_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(self.csv_path, backup_path)
        print(f"Created backup: {backup_path}")
        
        # Read all rows
        rows = []
        with open(self.csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            
            for row in reader:
                substrain = row.get('sub_strain', '').strip()
                
                # Set sub_strain_id based on mapping
                if substrain and substrain in self.reverse_mapping:
                    row['sub_strain_id'] = str(self.reverse_mapping[substrain])
                else:
                    row['sub_strain_id'] = "0"  # Empty substrain
                
                rows.append(row)
        
        # Write updated CSV
        with open(self.csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_NONNUMERIC)
            writer.writeheader()
            writer.writerows(rows)
        
        updated_count = sum(1 for row in rows if row['sub_strain_id'] != "0")
        print(f"Updated {updated_count} rows with substrain IDs")
    
    def update_game_data(self, mapping: Dict[int, str]):
        """Update/create NANO_SUBSTRAINS constant in game-data.ts"""
        print(f"Updating {self.game_data_path} with NANO_SUBSTRAINS...")
        
        with open(self.game_data_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Create the NANO_SUBSTRAINS constant
        substrain_lines = []
        for id_num in sorted(mapping.keys()):
            substrain = mapping[id_num]
            substrain_lines.append(f'  {id_num}: "{substrain}",')
        
        nano_substrains_constant = f"""
/**
 * Nano program substrain classifications
 * Maps substrain IDs to descriptive names for nano organization
 */
export const NANO_SUBSTRAINS = {{
{chr(10).join(substrain_lines)}
}} as const;
"""
        
        # Find insertion point (after NANO_STRAIN)
        nano_strain_end = content.find('export const NP_MODS')
        if nano_strain_end == -1:
            raise ValueError("Could not find insertion point (NP_MODS) in game-data.ts")
        
        # Check if NANO_SUBSTRAINS already exists
        existing_pattern = r'export\s+const\s+NANO_SUBSTRAINS\s*=\s*\{[^}]+\}\s*as\s+const;'
        if re.search(existing_pattern, content, re.DOTALL):
            # Replace existing
            new_content = re.sub(existing_pattern, nano_substrains_constant.strip(), content, flags=re.DOTALL)
            print("Replaced existing NANO_SUBSTRAINS constant")
        else:
            # Insert new
            insertion_point = content.rfind('\n', 0, nano_strain_end)
            if insertion_point == -1:
                insertion_point = nano_strain_end
            
            new_content = (content[:insertion_point] + 
                          nano_substrains_constant + 
                          content[insertion_point:])
            print("Added new NANO_SUBSTRAINS constant")
        
        # Create backup and write
        backup_path = f"{self.game_data_path}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy2(self.game_data_path, backup_path)
        
        with open(self.game_data_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print(f"Created backup: {backup_path}")
        print(f"Updated with {len(mapping)} substrain mappings")
    
    def run(self):
        """Execute the complete substrain management process"""
        print("="*60)
        print("SUBSTRAIN ID MANAGEMENT")
        print("="*60)
        
        # 1. Load existing mapping
        self.existing_mapping = self.load_existing_mapping()
        
        # 2. Extract current substrains
        unique_substrains = self.extract_unique_substrains()
        
        # 3. Create/update mapping
        final_mapping = self.create_mapping(unique_substrains)
        
        # 4. Update CSV
        self.update_csv_with_ids(final_mapping)
        
        # 5. Update TypeScript
        self.update_game_data(final_mapping)
        
        # 6. Summary report
        self.print_report(final_mapping, unique_substrains)
    
    def print_report(self, mapping: Dict[int, str], unique_substrains: Set[str]):
        """Print summary of changes made"""
        print(f"\n{'='*60}")
        print("SUBSTRAIN MANAGEMENT COMPLETE")
        print(f"{'='*60}")
        
        print(f"📊 Results:")
        print(f"  Total substrain mappings: {len(mapping)}")
        print(f"  Substrains from CSV: {len(unique_substrains)}")
        print(f"  New assignments: {len(self.changes_made)}")
        
        if self.changes_made:
            print(f"\\n🆕 New assignments made:")
            for change in self.changes_made[:5]:
                print(f"  {change}")
            if len(self.changes_made) > 5:
                print(f"  ... and {len(self.changes_made) - 5} more")
        
        print(f"\\n📁 Files updated:")
        print(f"  CSV: {self.csv_path}")
        print(f"  TypeScript: {self.game_data_path}")
        print(f"\\n⚠️  Backups created for both files")


def main():
    csv_path = "/home/quigley/projects/Tinkertools/backend/all_nanos_compacted.csv"
    game_data_path = "/home/quigley/projects/Tinkertools/frontend/src/services/game-data.ts"
    
    manager = SubstrainManager(csv_path, game_data_path)
    manager.run()


if __name__ == "__main__":
    main()