"""
Mob model for NPCs that drop items (pocket bosses and regular mobs).
"""

from sqlalchemy import Column, Integer, String, Boolean, ARRAY, Text, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class Mob(Base):
    __tablename__ = 'mobs'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, index=True)
    level = Column(Integer)
    playfield = Column(String(100), index=True)
    location = Column(String(255))
    mob_names = Column(ARRAY(Text))  # Array of mob names in pocket
    is_pocket_boss = Column(Boolean, default=True, index=True)
    mob_metadata = Column('metadata', JSONB)  # Column in DB is named 'metadata'
    created_at = Column(TIMESTAMP, server_default=text('CURRENT_TIMESTAMP'))

    @property
    def dropped_items(self):
        """Get all items dropped by this mob via sources system"""
        from sqlalchemy.orm import object_session
        from .source import Source, SourceType, ItemSource
        from .item import Item

        session = object_session(self)
        if not session:
            return []

        # Get source_type_id for 'mob'
        source_type = session.query(SourceType).filter_by(name='mob').first()
        if not source_type:
            return []

        return (
            session.query(Item)
            .join(ItemSource, Item.id == ItemSource.item_id)
            .join(Source, ItemSource.source_id == Source.id)
            .filter(Source.source_id == self.id)
            .filter(Source.source_type_id == source_type.id)
            .all()
        )

    def __repr__(self):
        return f"<Mob(id={self.id}, name='{self.name}', level={self.level}, is_pocket_boss={self.is_pocket_boss})>"
