"""
AnimationMesh model for animation and mesh data.
"""

from sqlalchemy import Column, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class AnimationMesh(Base):
    __tablename__ = 'animation_mesh'
    
    id = Column(Integer, primary_key=True)
    animation_id = Column(Integer, ForeignKey('stat_values.id'))
    mesh_id = Column(Integer, ForeignKey('stat_values.id'))
    
    # Relationships
    animation = relationship('StatValue', foreign_keys=[animation_id])
    mesh = relationship('StatValue', foreign_keys=[mesh_id])
    items = relationship(
        'Item',
        back_populates='animation_mesh'
    )
    
    def __repr__(self):
        return f"<AnimationMesh(id={self.id}, animation_id={self.animation_id}, mesh_id={self.mesh_id})>"