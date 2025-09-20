"""
Perk model for TinkerTools database.
"""

from sqlalchemy import Column, Integer, String, ARRAY, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Perk(Base):
    __tablename__ = 'perks'

    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), primary_key=True)
    name = Column(String(128), nullable=False)
    perk_series = Column(String(128), nullable=False)
    counter = Column(Integer, nullable=False)
    type = Column(String(10), nullable=False)  # SL/AI/LE
    level_required = Column(Integer, nullable=False)
    ai_level_required = Column(Integer, nullable=False)
    professions = Column(ARRAY(Integer), nullable=False)
    breeds = Column(ARRAY(Integer), nullable=False)

    # Relationships
    item = relationship('Item', back_populates='perk', uselist=False)

    def __repr__(self):
        return f"<Perk(item_id={self.item_id}, name='{self.name}', series='{self.perk_series}', counter={self.counter})>"