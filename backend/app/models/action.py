"""
Action model and junction table for ordered criteria.
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Action(Base):
    __tablename__ = 'actions'
    
    id = Column(Integer, primary_key=True)
    action = Column(Integer)
    item_id = Column(Integer, ForeignKey('items.id'))
    
    # Relationships
    item = relationship('Item', back_populates='actions')
    action_criteria = relationship(
        'ActionCriteria',
        back_populates='action',
        cascade='all, delete-orphan',
        order_by='ActionCriteria.order_index'
    )
    
    # Access criteria in order
    @property
    def criteria(self):
        return [ac.criterion for ac in self.action_criteria]
    
    def __repr__(self):
        return f"<Action(id={self.id}, action={self.action}, item_id={self.item_id})>"


class ActionCriteria(Base):
    __tablename__ = 'action_criteria'
    
    id = Column(Integer, primary_key=True)
    action_id = Column(Integer, ForeignKey('actions.id', ondelete='CASCADE'))
    criterion_id = Column(Integer, ForeignKey('criteria.id', ondelete='CASCADE'))
    order_index = Column(Integer, nullable=False)
    
    # Relationships
    action = relationship('Action', back_populates='action_criteria')
    criterion = relationship('Criterion', back_populates='action_criteria')
    
    def __repr__(self):
        return f"<ActionCriteria(action_id={self.action_id}, criterion_id={self.criterion_id}, order={self.order_index})>"