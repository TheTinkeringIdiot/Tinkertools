"""
AnimationMesh model for animation and mesh data.
"""

from sqlalchemy import Column, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base


class AnimationMesh(Base):
    __tablename__ = 'animation_mesh'
    
    id = Column(Integer, primary_key=True)
    animation_value = Column(Integer)
    mesh_value = Column(Integer)
    override_texture_id = Column(Integer)
    
    # Relationships
    items = relationship(
        'Item',
        back_populates='animation_mesh'
    )
    
    def __repr__(self):
        return f"<AnimationMesh(id={self.id}, animation={self.animation_value}, mesh={self.mesh_value})>"