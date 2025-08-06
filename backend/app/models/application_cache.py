"""
ApplicationCache model for application caching with TTL expiration.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from app.core.database import Base


class ApplicationCache(Base):
    __tablename__ = 'application_cache'
    
    id = Column(Integer, primary_key=True)
    cache_key = Column(String(255), unique=True, nullable=False)
    cache_value = Column(Text)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    @property
    def is_expired(self):
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at
    
    def __repr__(self):
        return f"<ApplicationCache(id={self.id}, key='{self.cache_key}', expires={self.expires_at})>"