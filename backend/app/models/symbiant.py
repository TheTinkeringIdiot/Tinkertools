"""
Symbiant model for symbiant definitions.
"""

from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Symbiant(Base):
    __tablename__ = 'symbiants'
    
    id = Column(Integer, primary_key=True)
    aoid = Column(Integer, nullable=False)
    family = Column(String(32))
    
    # Relationships
    pocket_boss_drops = relationship(
        'PocketBossSymbiantDrops',
        back_populates='symbiant',
        cascade='all, delete-orphan'
    )
    
    # Access pocket bosses that drop this symbiant
    @property
    def dropped_by(self):
        return [pbd.pocket_boss for pbd in self.pocket_boss_drops]
    
    def __repr__(self):
        return f"<Symbiant(id={self.id}, aoid={self.aoid}, name='{self.name}', family='{self.family}')>"