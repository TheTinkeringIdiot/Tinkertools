"""
SpellData model and junction table for spell collections.
"""

from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class SpellData(Base):
    __tablename__ = 'spell_data'
    
    id = Column(Integer, primary_key=True)
    event = Column(Integer)
    
    # Relationships
    spell_data_spells = relationship(
        'SpellDataSpells',
        back_populates='spell_data',
        cascade='all, delete-orphan'
    )
    item_spell_data = relationship(
        'ItemSpellData',
        back_populates='spell_data',
        cascade='all, delete-orphan'
    )
    
    # Access spells directly
    @property
    def spells(self):
        return [sds.spell for sds in self.spell_data_spells]
    
    def __repr__(self):
        return f"<SpellData(id={self.id}, event={self.event})>"


class SpellDataSpells(Base):
    __tablename__ = 'spell_data_spells'
    
    spell_data_id = Column(Integer, ForeignKey('spell_data.id', ondelete='CASCADE'), primary_key=True)
    spell_id = Column(Integer, ForeignKey('spells.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    spell_data = relationship('SpellData', back_populates='spell_data_spells')
    spell = relationship('Spell', back_populates='spell_data_spells')
    
    def __repr__(self):
        return f"<SpellDataSpells(spell_data_id={self.spell_data_id}, spell_id={self.spell_id})>"