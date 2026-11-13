"""
AOSetups Proxy Routes

Proxy endpoint for AOSetups API to bypass CORS restrictions
"""

from fastapi import APIRouter, HTTPException
import httpx
import re

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
    if not re.match(r"^[a-f0-9]{24}$", profile_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid profile ID format. Must be a 24-character hexadecimal string.",
        )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://www.aosetups.com/api/equip/{profile_id}",
                headers={
                    "User-Agent": "TinkerTools/1.0.0 (Profile Import Tool)",
                    "Accept": "application/json",
                },
            )

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail=f"Profile with ID {profile_id} not found on AOSetups",
                )
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"AOSetups API returned status {response.status_code}: {response.text[:200]}",
                )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Request to AOSetups API timed out. Please try again.",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=502, detail=f"Failed to connect to AOSetups API: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Unexpected error while fetching profile: {str(e)}"
        )
