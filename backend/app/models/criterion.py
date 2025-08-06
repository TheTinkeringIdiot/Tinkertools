"""
Criterion model - Reusable criteria for spells and actions.
"""

from sqlalchemy import Column, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class Criterion(Base):
    __tablename__ = 'criteria'
    
    id = Column(Integer, primary_key=True)
    value1 = Column(Integer, nullable=False)
    value2 = Column(Integer, nullable=False)
    operator = Column(Integer, nullable=False)
    
    # Relationships
    spell_criteria = relationship(
        'SpellCriterion',
        back_populates='criterion',
        cascade='all, delete-orphan'
    )
    action_criteria = relationship(
        'ActionCriteria',
        back_populates='criterion',
        cascade='all, delete-orphan'
    )
    
    __table_args__ = (
        UniqueConstraint('value1', 'value2', 'operator', name='unique_criterion'),
    )
    
    def __repr__(self):
        return f"<Criterion(id={self.id}, value1={self.value1}, value2={self.value2}, operator={self.operator})>"