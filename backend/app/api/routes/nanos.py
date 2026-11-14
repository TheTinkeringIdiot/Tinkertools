"""
Nano programs API endpoints with rich spell data.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.schemas import ItemDetail, PaginatedResponse
from app.api.schemas.nano import NanoItemDetail, NanoProgram, NanoStrainsResponse
from app.core.decorators import cached_response, performance_monitor
from app.services import nanos
from app.services.nanos import NanoFilters
from app.store import Build, get_build, get_store, page_fields

router = APIRouter(prefix="/nanos", tags=["nanos"])

SCHOOL_QUERY = Query(
    None,
    description="Filter by school; repeat for several (school=Medical&school=Psi). "
    "One of Combat, Medical, Protection, Psi, Space, or its NanoSchool value 1-5",
)
PROFESSION_QUERY = Query(
    None,
    description="Filter by profession name (e.g. Doctor) or id; repeat for several. "
    "Matches nanos castable by any of them: those whose Use action allows one of "
    "them, plus those whose Use action allows every profession",
)
STRAIN_QUERY = Query(
    None,
    description="Filter by NanoStrain (stat 75) id, or name as in the frontend's "
    "NANO_STRAIN table; repeat for several, matching any of them",
)
LEVEL_MIN_QUERY = Query(
    None, description="Minimum of the lowest level that can cast it"
)
LEVEL_MAX_QUERY = Query(
    None, description="Maximum of the lowest level that can cast it"
)
QL_MIN_QUERY = Query(None, description="Minimum quality level")
QL_MAX_QUERY = Query(None, description="Maximum quality level")
SEARCH_QUERY = Query(
    None, min_length=1, description="Only nanos whose name or description contains this"
)
SORT_BY_QUERY = Query("name", description="Sort by: name, ql, level")
SORT_DESC_QUERY = Query(False, description="Sort descending")


@router.get("", response_model=PaginatedResponse[NanoProgram])
@cached_response("nanos_list")
@performance_monitor
def get_nanos(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    school: Optional[List[str]] = SCHOOL_QUERY,
    strain: Optional[List[str]] = STRAIN_QUERY,
    profession: Optional[List[str]] = PROFESSION_QUERY,
    level_min: Optional[int] = LEVEL_MIN_QUERY,
    level_max: Optional[int] = LEVEL_MAX_QUERY,
    ql_min: Optional[int] = QL_MIN_QUERY,
    ql_max: Optional[int] = QL_MAX_QUERY,
    sort_by: str = SORT_BY_QUERY,
    sort_desc: bool = SORT_DESC_QUERY,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Get paginated list of nano programs with rich spell data.
    """
    filters = NanoFilters(
        school=school,
        profession=profession,
        strain=strain,
        level_min=level_min,
        level_max=level_max,
        ql_min=ql_min,
        ql_max=ql_max,
    )
    items, total = nanos.nano_page(
        db, build, filters, sort_by, sort_desc, page, page_size
    )
    return PaginatedResponse[NanoProgram](
        items=items, **page_fields(total, page, page_size)
    )


@router.get("/search", response_model=PaginatedResponse[NanoProgram])
@cached_response("nanos_search")
@performance_monitor
def search_nanos(
    q: str = Query(..., min_length=1, description="Search query"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    school: Optional[List[str]] = SCHOOL_QUERY,
    strain: Optional[List[str]] = STRAIN_QUERY,
    profession: Optional[List[str]] = PROFESSION_QUERY,
    level_min: Optional[int] = LEVEL_MIN_QUERY,
    level_max: Optional[int] = LEVEL_MAX_QUERY,
    ql_min: Optional[int] = QL_MIN_QUERY,
    ql_max: Optional[int] = QL_MAX_QUERY,
    sort_by: str = SORT_BY_QUERY,
    sort_desc: bool = SORT_DESC_QUERY,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Search nano programs by name or description, with the same filters and
    sorting as GET /nanos.
    """
    filters = NanoFilters(
        q=q,
        school=school,
        profession=profession,
        strain=strain,
        level_min=level_min,
        level_max=level_max,
        ql_min=ql_min,
        ql_max=ql_max,
    )
    items, total = nanos.nano_page(
        db, build, filters, sort_by, sort_desc, page, page_size
    )
    return PaginatedResponse[NanoProgram](
        items=items, **page_fields(total, page, page_size)
    )


@router.get("/strains", response_model=NanoStrainsResponse)
@cached_response("nanos_strains")
@performance_monitor
def get_nano_strains(
    q: Optional[str] = SEARCH_QUERY,
    school: Optional[List[str]] = SCHOOL_QUERY,
    profession: Optional[List[str]] = PROFESSION_QUERY,
    level_min: Optional[int] = LEVEL_MIN_QUERY,
    level_max: Optional[int] = LEVEL_MAX_QUERY,
    ql_min: Optional[int] = QL_MIN_QUERY,
    ql_max: Optional[int] = QL_MAX_QUERY,
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Distinct NanoStrains (stat 75) of the nanos matching the /nanos (or, with q,
    /nanos/search) filters, with how many nanos have each, sorted by name then
    id, ids without a name last. Nanos without a strain are not counted.

    The strain filter itself is not applied, so the list offers every strain
    the other filters leave, whichever strains are currently picked.
    """
    filters = NanoFilters(
        q=q,
        school=school,
        profession=profession,
        level_min=level_min,
        level_max=level_max,
        ql_min=ql_min,
        ql_max=ql_max,
    )
    return NanoStrainsResponse(strains=nanos.strain_counts(db, build, filters))


@router.get(
    "/profession/{profession_id}", response_model=PaginatedResponse[NanoItemDetail]
)
@cached_response("nanos_profession", ttl=3600)  # Cache for 1 hour
@performance_monitor
def get_nanos_by_profession(
    profession_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(1000, ge=1, le=1000, description="Items per page"),
    sort: str = Query("ql", description="Sort field: name, ql"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Get nano programs filtered by profession requirement, for TinkerNanos.

    Lists the nanoprograms that:
    - Name the profession in their Use action (every nano for profession_id 0)
    - Have a real strain (not 0 and not 99999)
    - Are not test items (name NOT LIKE 'TESTLIVEITEM%')
    """
    found = nanos.profession_page(
        db,
        nanos.castable_nanos(build, profession_id),
        sort,
        sort_order,
        page,
        page_size,
    )
    return PaginatedResponse[NanoItemDetail](
        items=nanos.nano_item_details(db, build, found.rev_ids),
        **page_fields(found.total, page, page_size),
    )


@router.get("/offensive/{profession_id}", response_model=PaginatedResponse[ItemDetail])
@cached_response("nanos_offensive", ttl=3600)  # Cache for 1 hour
@performance_monitor
def get_offensive_nanos_by_profession(
    profession_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(1000, ge=1, le=1000, description="Items per page"),
    sort: str = Query("ql", description="Sort field: name, ql"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    db: Session = Depends(get_store),
    build: Build = Depends(get_build),
):
    """
    Get offensive nano programs filtered by profession requirement, for
    TinkerNukes.

    Lists the nanoprograms of GET /nanos/profession/{profession_id} that
    lower a hostile target's health: an effect with target 3, spell 53002
    and Stat 27.
    """
    found = nanos.profession_page(
        db,
        nanos.offensive_nanos(build, profession_id),
        sort,
        sort_order,
        page,
        page_size,
    )
    return PaginatedResponse[ItemDetail](
        items=nanos.item_details(db, build, found.rev_ids),
        **page_fields(found.total, page, page_size),
    )
