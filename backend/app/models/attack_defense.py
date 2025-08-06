"""
AttackDefense model and related junction tables.
"""

from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class AttackDefense(Base):
    __tablename__ = 'attack_defense'
    
    id = Column(Integer, primary_key=True)
    
    # Relationships
    attack_stats = relationship(
        'AttackDefenseAttack',
        back_populates='attack_defense',
        cascade='all, delete-orphan'
    )
    defense_stats = relationship(
        'AttackDefenseDefense',
        back_populates='attack_defense',
        cascade='all, delete-orphan'
    )
    items = relationship(
        'Item',
        back_populates='attack_defense'
    )
    
    # Access stat values directly
    @property
    def attack_values(self):
        return [ada.stat_value for ada in self.attack_stats]
    
    @property
    def defense_values(self):
        return [add.stat_value for add in self.defense_stats]
    
    def __repr__(self):
        return f"<AttackDefense(id={self.id})>"


class AttackDefenseAttack(Base):
    __tablename__ = 'attack_defense_attack'
    
    attack_defense_id = Column(Integer, ForeignKey('attack_defense.id', ondelete='CASCADE'), primary_key=True)
    stat_value_id = Column(Integer, ForeignKey('stat_values.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    attack_defense = relationship('AttackDefense', back_populates='attack_stats')
    stat_value = relationship('StatValue', back_populates='attack_defense_attacks')
    
    def __repr__(self):
        return f"<AttackDefenseAttack(attack_defense_id={self.attack_defense_id}, stat_value_id={self.stat_value_id})>"


class AttackDefenseDefense(Base):
    __tablename__ = 'attack_defense_defense'
    
    attack_defense_id = Column(Integer, ForeignKey('attack_defense.id', ondelete='CASCADE'), primary_key=True)
    stat_value_id = Column(Integer, ForeignKey('stat_values.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    attack_defense = relationship('AttackDefense', back_populates='defense_stats')
    stat_value = relationship('StatValue', back_populates='attack_defense_defenses')
    
    def __repr__(self):
        return f"<AttackDefenseDefense(attack_defense_id={self.attack_defense_id}, stat_value_id={self.stat_value_id})>"