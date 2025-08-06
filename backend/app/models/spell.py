"""
Spell model and related junction tables.
"""

from sqlalchemy import Column, Integer, String, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class Spell(Base):
    __tablename__ = 'spells'
    
    id = Column(Integer, primary_key=True)
    target = Column(Integer)
    tick_count = Column(Integer)
    tick_interval = Column(Integer)
    spell_id = Column(Integer)
    spell_format = Column(String(512))
    spell_params = Column(JSON, default=list)
    
    # Relationships
    spell_criteria = relationship(
        'SpellCriterion',
        back_populates='spell',
        cascade='all, delete-orphan'
    )
    spell_data_spells = relationship(
        'SpellDataSpells',
        back_populates='spell',
        cascade='all, delete-orphan'
    )
    
    # Access criteria directly through association proxy
    @property
    def criteria(self):
        return [sc.criterion for sc in self.spell_criteria]
    
    def __repr__(self):
        return f"<Spell(id={self.id}, spell_id={self.spell_id})>"


class SpellCriterion(Base):
    __tablename__ = 'spell_criteria'
    
    spell_id = Column(Integer, ForeignKey('spells.id', ondelete='CASCADE'), primary_key=True)
    criterion_id = Column(Integer, ForeignKey('criteria.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    spell = relationship('Spell', back_populates='spell_criteria')
    criterion = relationship('Criterion', back_populates='spell_criteria')
    
    def __repr__(self):
        return f"<SpellCriterion(spell_id={self.spell_id}, criterion_id={self.criterion_id})>"