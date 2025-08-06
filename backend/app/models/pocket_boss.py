"""
PocketBoss model and junction table for symbiant drops.
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class PocketBoss(Base):
    __tablename__ = 'pocket_bosses'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(512), nullable=False)
    level = Column(Integer)
    location = Column(String(255))
    playfield = Column(String(255))
    encounter_info = Column(Text)
    mob_composition = Column(Text)
    
    # Relationships
    symbiant_drops = relationship(
        'PocketBossSymbiantDrops',
        back_populates='pocket_boss',
        cascade='all, delete-orphan'
    )
    
    # Access symbiants dropped by this boss
    @property
    def drops(self):
        return [sd.symbiant for sd in self.symbiant_drops]
    
    def __repr__(self):
        return f"<PocketBoss(id={self.id}, name='{self.name}', level={self.level}, location='{self.location}')>"


class PocketBossSymbiantDrops(Base):
    __tablename__ = 'pocket_boss_symbiant_drops'
    
    pocket_boss_id = Column(Integer, ForeignKey('pocket_bosses.id', ondelete='CASCADE'), primary_key=True)
    symbiant_id = Column(Integer, ForeignKey('symbiants.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    pocket_boss = relationship('PocketBoss', back_populates='symbiant_drops')
    symbiant = relationship('Symbiant', back_populates='pocket_boss_drops')
    
    def __repr__(self):
        return f"<PocketBossSymbiantDrops(pocket_boss_id={self.pocket_boss_id}, symbiant_id={self.symbiant_id})>"