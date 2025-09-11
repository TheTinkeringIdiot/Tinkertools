"""
AOSetups Proxy Routes

Proxy endpoint for AOSetups API to bypass CORS restrictions
"""

from fastapi import APIRouter, HTTPException, Query
import httpx
import re
from typing import Optional

router = APIRouter(tags=["aosetups"])


@router.get("/aosetups/profile/{profile_id}")
async def get_aosetups_profile(profile_id: str):
    """
    Proxy endpoint to fetch AOSetups profile data.
    
    Args:
        profile_id: AOSetups profile ID (24 character hex string)
        
    Returns:
        Profile data from AOSetups API
        
    Raises:
        HTTPException: If profile not found or API request fails
    """
    # Validate profile ID format (24 character hex string)
    if not re.match(r'^[a-f0-9]{24}$', profile_id):
        raise HTTPException(
            status_code=400, 
            detail="Invalid profile ID format. Must be a 24-character hexadecimal string."
        )
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://www.aosetups.com/api/equip/{profile_id}",
                headers={
                    "User-Agent": "TinkerTools/1.0.0 (Profile Import Tool)",
                    "Accept": "application/json"
                }
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile with ID {profile_id} not found on AOSetups"
                )
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"AOSetups API returned status {response.status_code}: {response.text[:200]}"
                )
                
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request to AOSetups API timed out. Please try again."
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to connect to AOSetups API: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error while fetching profile: {str(e)}"
        )


@router.get("/aosetups/profile-from-url")
async def get_aosetups_profile_from_url(url: str = Query(..., description="Full AOSetups profile URL")):
    """
    Proxy endpoint to fetch AOSetups profile data from a full URL.
    
    Args:
        url: Full AOSetups profile URL (e.g., https://www.aosetups.com/equip/63d44b91a247b52f79ea5ff6)
        
    Returns:
        Profile data from AOSetups API
        
    Raises:
        HTTPException: If URL is invalid or profile not found
    """
    # Extract profile ID from URL
    match = re.search(r'aosetups\.com/equip/([a-f0-9]{24})', url, re.IGNORECASE)
    if not match:
        raise HTTPException(
            status_code=400,
            detail="Invalid AOSetups URL format. Expected format: https://www.aosetups.com/equip/{profile_id}"
        )
    
    profile_id = match.group(1)
    
    # Use the existing profile endpoint
    return await get_aosetups_profile(profile_id)