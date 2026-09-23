"""
Derived nano properties (migration 008).
"""

from sqlalchemy import Column, Integer, SmallInteger, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from app.core.database import Base


class NanoProperties(Base):
    """School, casting professions and minimum caster level of a nano.

    Filled by the importer from the NanoSchool stat and the Use action criteria
    (app/core/nano_properties.py); see that module for what each value means.
    """

    __tablename__ = "nano_properties"

    item_id = Column(
        Integer, ForeignKey("items.id", ondelete="CASCADE"), primary_key=True
    )
    school = Column(SmallInteger)
    professions = Column(ARRAY(Integer), nullable=False, default=list)
    min_level = Column(SmallInteger)

    item = relationship("Item", back_populates="nano_properties", viewonly=True)

    def __repr__(self):
        return (
            f"<NanoProperties(item_id={self.item_id}, school={self.school}, "
            f"professions={self.professions}, min_level={self.min_level})>"
        )
