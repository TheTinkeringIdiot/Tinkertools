"""
Item model and related junction tables.
"""

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Item(Base):
    __tablename__ = 'items'
    
    id = Column(Integer, primary_key=True)
    aoid = Column(Integer, nullable=False)
    name = Column(String(512), nullable=False)
    ql = Column(Integer, nullable=False)
    item_class = Column(String(50))
    slot = Column(String(50))
    default_pos = Column(String(10))
    max_mass = Column(Integer)
    duration = Column(Integer)
    icon = Column(Integer)
    apply_on_friendly = Column(Boolean, default=False)
    apply_on_hostile = Column(Boolean, default=False)
    apply_on_self = Column(Boolean, default=False)
    dont_apply_on_self = Column(Boolean, default=False)
    can_pick_up = Column(Boolean, default=True)
    flags = Column(Integer)
    description = Column(Text)
    is_nano = Column(Boolean, default=False)
    animation_mesh_id = Column(Integer, ForeignKey('animation_mesh.id'))
    attack_defense_id = Column(Integer, ForeignKey('attack_defense.id'))
    
    # Relationships
    animation_mesh = relationship('AnimationMesh', back_populates='items')
    attack_defense = relationship('AttackDefense', back_populates='items')
    item_stats = relationship(
        'ItemStats',
        back_populates='item',
        cascade='all, delete-orphan'
    )
    item_spell_data = relationship(
        'ItemSpellData',
        back_populates='item',
        cascade='all, delete-orphan'
    )
    item_shop_hashes = relationship(
        'ItemShopHash',
        back_populates='item',
        cascade='all, delete-orphan'
    )
    actions = relationship(
        'Action',
        back_populates='item',
        cascade='all, delete-orphan'
    )
    
    # Access related data directly
    @property
    def stats(self):
        return [item_stat.stat_value for item_stat in self.item_stats]
    
    @property
    def spell_data(self):
        return [isd.spell_data for isd in self.item_spell_data]
    
    @property
    def shop_hashes(self):
        return [ish.shop_hash for ish in self.item_shop_hashes]
    
    def __repr__(self):
        return f"<Item(id={self.id}, aoid={self.aoid}, name='{self.name}', ql={self.ql})>"


class ItemStats(Base):
    __tablename__ = 'item_stats'
    
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), primary_key=True)
    stat_value_id = Column(Integer, ForeignKey('stat_values.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    item = relationship('Item', back_populates='item_stats')
    stat_value = relationship('StatValue', back_populates='item_stats')
    
    def __repr__(self):
        return f"<ItemStats(item_id={self.item_id}, stat_value_id={self.stat_value_id})>"


class ItemSpellData(Base):
    __tablename__ = 'item_spell_data'
    
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), primary_key=True)
    spell_data_id = Column(Integer, ForeignKey('spell_data.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    item = relationship('Item', back_populates='item_spell_data')
    spell_data = relationship('SpellData', back_populates='item_spell_data')
    
    def __repr__(self):
        return f"<ItemSpellData(item_id={self.item_id}, spell_data_id={self.spell_data_id})>"


class ItemShopHash(Base):
    __tablename__ = 'item_shop_hash'
    
    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), primary_key=True)
    shop_hash_id = Column(Integer, ForeignKey('shop_hash.id', ondelete='CASCADE'), primary_key=True)
    
    # Relationships
    item = relationship('Item', back_populates='item_shop_hashes')
    shop_hash = relationship('ShopHash', back_populates='item_shop_hashes')
    
    def __repr__(self):
        return f"<ItemShopHash(item_id={self.item_id}, shop_hash_id={self.shop_hash_id})>"