"""
Source models for tracking item origins.
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DECIMAL
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class SourceType(Base):
    __tablename__ = 'source_types'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    
    # Relationships
    sources = relationship(
        'Source',
        back_populates='source_type',
        cascade='all, delete-orphan'
    )
    
    def __repr__(self):
        return f"<SourceType(id={self.id}, name='{self.name}')>"


class Source(Base):
    __tablename__ = 'sources'

    id = Column(Integer, primary_key=True)
    source_type_id = Column(Integer, ForeignKey('source_types.id', ondelete='CASCADE'), nullable=False)
    source_id = Column(Integer, nullable=False)  # References the actual entity ID
    name = Column(String(255), nullable=False)  # Denormalized for performance
    source_metadata = Column('metadata', JSONB, default={})  # Column in DB is named 'metadata'

    # Alias for backward compatibility
    @property
    def extra_data(self):
        return self.source_metadata

    @extra_data.setter
    def extra_data(self, value):
        self.source_metadata = value
    
    # Relationships
    source_type = relationship('SourceType', back_populates='sources')
    item_sources = relationship(
        'ItemSource',
        back_populates='source',
        cascade='all, delete-orphan'
    )
    
    # Access items that come from this source
    @property
    def items(self):
        return [item_source.item for item_source in self.item_sources]
    
    def __repr__(self):
        return f"<Source(id={self.id}, type={self.source_type.name if self.source_type else 'None'}, name='{self.name}')>"


class ItemSource(Base):
    __tablename__ = 'item_sources'

    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), primary_key=True)
    source_id = Column(Integer, ForeignKey('sources.id', ondelete='CASCADE'), primary_key=True)
    drop_rate = Column(DECIMAL(5, 2))  # 0.01 to 100.00
    min_ql = Column(Integer)
    max_ql = Column(Integer)
    conditions = Column(Text)
    source_metadata = Column('metadata', JSONB, default={})  # Column in DB is named 'metadata'

    # Alias for backward compatibility
    @property
    def extra_data(self):
        return self.source_metadata

    @extra_data.setter
    def extra_data(self, value):
        self.source_metadata = value
    
    # Relationships
    item = relationship('Item', back_populates='item_sources')
    source = relationship('Source', back_populates='item_sources')
    
    def __repr__(self):
        return f"<ItemSource(item_id={self.item_id}, source_id={self.source_id}, drop_rate={self.drop_rate})>"