"""
SymbiantItem model for materialized view of symbiants.
This is a read-only model representing the symbiant_items materialized view.
"""

from sqlalchemy import Column, Integer, String
from app.core.database import Base


class SymbiantItem(Base):
    __tablename__ = 'symbiant_items'
    __table_args__ = {'info': {'is_view': True}}  # Mark as materialized view

    id = Column(Integer, primary_key=True)
    aoid = Column(Integer, index=True)
    name = Column(String)
    ql = Column(Integer)
    slot_id = Column(Integer)
    family = Column(String(32), index=True)

    # Read-only model (materialized view)
    # No relationships or write operations

    def __repr__(self):
        return f"<SymbiantItem(id={self.id}, aoid={self.aoid}, name='{self.name}', family='{self.family}', ql={self.ql})>"
