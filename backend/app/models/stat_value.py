"""
StatValue model - Reusable stat-value pairs with unique constraints.
"""

from sqlalchemy import Column, Integer, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class StatValue(Base):
    __tablename__ = 'stat_values'
    
    id = Column(Integer, primary_key=True)
    stat = Column(Integer, nullable=False)
    value = Column(Integer, nullable=False)
    
    # Relationships
    attack_defense_attacks = relationship(
        'AttackDefenseAttack', 
        back_populates='stat_value',
        cascade='all, delete-orphan'
    )
    attack_defense_defenses = relationship(
        'AttackDefenseDefense',
        back_populates='stat_value',
        cascade='all, delete-orphan'
    )
    item_stats = relationship(
        'ItemStats',
        back_populates='stat_value',
        cascade='all, delete-orphan'
    )
    
    __table_args__ = (
        UniqueConstraint('stat', 'value', name='unique_stat_value'),
    )
    
    def __repr__(self):
        return f"<StatValue(id={self.id}, stat={self.stat}, value={self.value})>"