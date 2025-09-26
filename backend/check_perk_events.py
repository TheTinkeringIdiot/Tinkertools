import sys
sys.path.append('.')
import os
from app.core.database import SessionLocal
from app.models.item import Item, ItemSpellData
from app.models.perk import Perk
from app.models.spell_data import SpellData
from sqlalchemy.orm import joinedload

# Load environment
env_file = '.env.claude'
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                key, value = line.strip().split('=', 1)
                os.environ[key] = value

db = SessionLocal()
try:
    sample_perks = db.query(Item).join(Perk).join(ItemSpellData).join(SpellData).options(
        joinedload(Item.perk),
        joinedload(Item.item_spell_data).joinedload(ItemSpellData.spell_data)
    ).limit(5).all()

    if sample_perks:
        events = set()
        for perk in sample_perks:
            print(f'Perk: {perk.perk.name} (Level {perk.perk.counter})')
            for isd in perk.item_spell_data:
                sd = isd.spell_data
                print(f'  SpellData ID: {sd.id}, Event: {sd.event}')
                events.add(sd.event)
        print(f'\nUnique event IDs found: {sorted(events)}')
    else:
        print('No perks with spell data found')
finally:
    db.close()