"""
ShopHash model for shop/vendor mechanics.
"""

from sqlalchemy import Column, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base


class ShopHash(Base):
    __tablename__ = 'shop_hash'
    
    id = Column(Integer, primary_key=True)
    min_level = Column(Integer)
    max_level = Column(Integer)
    
    # Relationships
    item_shop_hashes = relationship(
        'ItemShopHash',
        back_populates='shop_hash',
        cascade='all, delete-orphan'
    )
    
    def __repr__(self):
        return f"<ShopHash(id={self.id}, min_level={self.min_level}, max_level={self.max_level})>"