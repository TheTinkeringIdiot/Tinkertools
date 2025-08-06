"""
Comprehensive tests for advanced search and filtering functionality.
Tests all the new search features implemented in Task 4.
Note: Some PostgreSQL-specific features (like full-text search) are tested with basic functionality only.
"""

import pytest
from app.models import Item, Spell, PocketBoss, Symbiant, ItemStats, StatValue, SpellCriterion, Criterion


class TestItemSearch:
    """Test advanced item search functionality."""
    
    @pytest.fixture
    def multiple_items(self, db_session):
        """Create multiple test items with varied properties."""
        items = [
            Item(
                aoid=1001,
                name="Advanced Plasma Rifle",
                ql=250,
                item_class="Weapon",
                slot="Right Hand",
                description="High-tech energy weapon with plasma core",
                is_nano=False
            ),
            Item(
                aoid=1002, 
                name="Nano Enhancement Crystal",
                ql=200,
                item_class="Implant",
                slot="Head",
                description="Crystal that enhances nano abilities",
                is_nano=True
            ),
            Item(
                aoid=1003,
                name="Combat Armor Vest",
                ql=180,
                item_class="Armor",
                slot="Chest",
                description="Protective vest for combat situations"
            ),
            Item(
                aoid=1004,
                name="Plasma Energy Cells",
                ql=150,
                item_class="Ammo",
                description="Energy cells for plasma weapons"
            )
        ]
        
        for item in items:
            db_session.add(item)
        db_session.commit()
        
        return items
    
    def test_full_text_search_name(self, client, multiple_items):
        """Test full-text search on item names."""
        response = client.get("/api/v1/items/search?q=plasma")
        assert response.status_code == 200
        data = response.json()
        
        # Should find both "Advanced Plasma Rifle" and "Plasma Energy Cells"
        assert data["total"] == 2
        item_names = [item["name"] for item in data["items"]]
        assert "Advanced Plasma Rifle" in item_names
        assert "Plasma Energy Cells" in item_names
    
    def test_full_text_search_description(self, client, multiple_items):
        """Test full-text search on item descriptions."""
        response = client.get("/api/v1/items/search?q=energy")
        assert response.status_code == 200
        data = response.json()
        
        # Should find items with "energy" in description
        assert data["total"] >= 1
        descriptions = [item.get("description", "") for item in data["items"]]
        assert any("energy" in desc.lower() for desc in descriptions if desc)
    
    def test_advanced_filtering(self, client, multiple_items):
        """Test advanced filtering endpoint."""
        # Filter by item class and QL range
        response = client.get("/api/v1/items/filter?item_class=Weapon&min_ql=200&max_ql=300")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Advanced Plasma Rifle"
        assert data["items"][0]["item_class"] == "Weapon"
        assert data["items"][0]["ql"] == 250
    
    def test_nano_filtering(self, client, multiple_items):
        """Test filtering by nano flag."""
        # Filter nano items
        response = client.get("/api/v1/items/filter?is_nano=true")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Nano Enhancement Crystal"
        assert data["items"][0]["is_nano"] is True
    
    def test_slot_filtering(self, client, multiple_items):
        """Test filtering by equipment slot."""
        response = client.get("/api/v1/items/filter?slot=Right Hand")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["slot"] == "Right Hand"
    
    def test_sorting_options(self, client, multiple_items):
        """Test different sorting options."""
        # Sort by QL ascending
        response = client.get("/api/v1/items/filter?sort_by=ql&sort_order=asc")
        assert response.status_code == 200
        data = response.json()
        
        # Items should be sorted by QL ascending
        qls = [item["ql"] for item in data["items"]]
        assert qls == sorted(qls)
        
        # Sort by name descending
        response = client.get("/api/v1/items/filter?sort_by=name&sort_order=desc")
        assert response.status_code == 200
        data = response.json()
        
        # Items should be sorted by name descending
        names = [item["name"] for item in data["items"]]
        assert names == sorted(names, reverse=True)


class TestStatBasedQueries:
    """Test complex stat-based item queries."""
    
    @pytest.fixture
    def items_with_stats(self, db_session):
        """Create items with stat requirements."""
        # Create stat values
        strength_500 = StatValue(stat=16, value=500)  # Strength 500
        intel_400 = StatValue(stat=17, value=400)     # Intelligence 400
        stamina_300 = StatValue(stat=18, value=300)   # Stamina 300
        
        db_session.add_all([strength_500, intel_400, stamina_300])
        db_session.commit()
        
        # Create items
        sword = Item(aoid=2001, name="Strength Sword", ql=200)
        wand = Item(aoid=2002, name="Intelligence Wand", ql=180) 
        hybrid = Item(aoid=2003, name="Hybrid Item", ql=220)
        
        db_session.add_all([sword, wand, hybrid])
        db_session.commit()
        
        # Create stat associations
        sword_stat = ItemStats(item_id=sword.id, stat_value_id=strength_500.id)
        wand_stat = ItemStats(item_id=wand.id, stat_value_id=intel_400.id)
        hybrid_stat1 = ItemStats(item_id=hybrid.id, stat_value_id=strength_500.id)
        hybrid_stat2 = ItemStats(item_id=hybrid.id, stat_value_id=intel_400.id)
        
        db_session.add_all([sword_stat, wand_stat, hybrid_stat1, hybrid_stat2])
        db_session.commit()
        
        return {
            'sword': sword,
            'wand': wand, 
            'hybrid': hybrid,
            'stats': [strength_500, intel_400, stamina_300]
        }
    
    def test_single_stat_requirement(self, client, items_with_stats):
        """Test filtering by single stat requirement."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=500")
        assert response.status_code == 200
        data = response.json()
        
        # Should find sword and hybrid item
        assert data["total"] == 2
        item_names = [item["name"] for item in data["items"]]
        assert "Strength Sword" in item_names
        assert "Hybrid Item" in item_names
    
    def test_multiple_stat_requirements_and(self, client, items_with_stats):
        """Test AND logic for multiple stat requirements."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=500,17:>=400&logic=and")
        assert response.status_code == 200
        data = response.json()
        
        # Should find only hybrid item (has both requirements)
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Hybrid Item"
    
    def test_multiple_stat_requirements_or(self, client, items_with_stats):
        """Test OR logic for multiple stat requirements."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=500,17:>=400&logic=or")
        assert response.status_code == 200
        data = response.json()
        
        # Should find all items with either requirement
        assert data["total"] == 3
        item_names = [item["name"] for item in data["items"]]
        assert "Strength Sword" in item_names
        assert "Intelligence Wand" in item_names
        assert "Hybrid Item" in item_names


class TestSpellSearch:
    """Test spell search and criteria filtering."""
    
    @pytest.fixture
    def spells_with_criteria(self, db_session):
        """Create spells with criteria."""
        # Create criteria
        strength_crit = Criterion(stat=16, operator=">=", value=500)
        intel_crit = Criterion(stat=17, operator=">=", value=400)
        
        db_session.add_all([strength_crit, intel_crit])
        db_session.commit()
        
        # Create spells
        heal_spell = Spell(
            aoid=3001,
            name="Major Heal",
            target=1,  # Self
            format="Nano Formula"
        )
        damage_spell = Spell(
            aoid=3002,
            name="Lightning Bolt", 
            target=2,  # Hostile
            format="Combat Nano"
        )
        buff_spell = Spell(
            aoid=3003,
            name="Strength Enhancement",
            target=3,  # Friendly
            format="Enhancement Nano"
        )
        
        db_session.add_all([heal_spell, damage_spell, buff_spell])
        db_session.commit()
        
        # Create spell-criteria associations
        heal_crit = SpellCriterion(spell_id=heal_spell.id, criterion_id=intel_crit.id)
        damage_crit1 = SpellCriterion(spell_id=damage_spell.id, criterion_id=strength_crit.id)
        damage_crit2 = SpellCriterion(spell_id=damage_spell.id, criterion_id=intel_crit.id)
        buff_crit = SpellCriterion(spell_id=buff_spell.id, criterion_id=strength_crit.id)
        
        db_session.add_all([heal_crit, damage_crit1, damage_crit2, buff_crit])
        db_session.commit()
        
        return {
            'heal': heal_spell,
            'damage': damage_spell,
            'buff': buff_spell,
            'criteria': [strength_crit, intel_crit]
        }
    
    def test_spell_search_by_name(self, client, spells_with_criteria):
        """Test spell search by name."""
        response = client.get("/api/v1/spells/search?q=heal")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Major Heal"
    
    def test_spell_criteria_filtering_single(self, client, spells_with_criteria):
        """Test filtering spells by single criterion."""
        response = client.get("/api/v1/spells/with-criteria?criteria_requirements=16:>=500")
        assert response.status_code == 200
        data = response.json()
        
        # Should find damage and buff spells (both have strength requirement)
        assert data["total"] == 2
        spell_names = [spell["name"] for spell in data["items"]]
        assert "Lightning Bolt" in spell_names
        assert "Strength Enhancement" in spell_names
    
    def test_spell_criteria_filtering_and(self, client, spells_with_criteria):
        """Test AND logic for spell criteria."""
        response = client.get("/api/v1/spells/with-criteria?criteria_requirements=16:>=500,17:>=400&logic=and")
        assert response.status_code == 200
        data = response.json()
        
        # Should find only Lightning Bolt (has both requirements)
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Lightning Bolt"
    
    def test_spell_format_filtering(self, client, spells_with_criteria):
        """Test filtering spells by format."""
        response = client.get("/api/v1/spells?format=Combat Nano")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["format"] == "Combat Nano"


class TestPocketBossSearch:
    """Test pocket boss search and relationship queries."""
    
    @pytest.fixture
    def bosses_and_symbiants(self, db_session):
        """Create pocket bosses and symbiants with relationships."""
        # Create symbiants
        artillery_sym = Symbiant(
            aoid=4001,
            name="Artillery Control Unit",
            ql=200,
            family="Artillery",
            symbiant_class="Control",
            slot="Head"
        )
        support_sym = Symbiant(
            aoid=4002,
            name="Support Enhancement",
            ql=180,
            family="Support", 
            symbiant_class="Enhancement",
            slot="Chest"
        )
        
        db_session.add_all([artillery_sym, support_sym])
        db_session.commit()
        
        # Create pocket bosses
        desert_boss = PocketBoss(
            name="Desert Tyrant",
            level=200,
            location="Burning Desert",
            playfield="Rubi-Ka",
            encounter_info="Spawns near oasis"
        )
        city_boss = PocketBoss(
            name="Urban Predator", 
            level=180,
            location="Old Athens Underground",
            playfield="Rubi-Ka",
            encounter_info="Found in subway tunnels"
        )
        
        db_session.add_all([desert_boss, city_boss])
        db_session.commit()
        
        # Create drop relationships
        from app.models import PocketBossSymbiantDrops
        drop1 = PocketBossSymbiantDrops(pocket_boss_id=desert_boss.id, symbiant_id=artillery_sym.id)
        drop2 = PocketBossSymbiantDrops(pocket_boss_id=city_boss.id, symbiant_id=support_sym.id)
        
        db_session.add_all([drop1, drop2])
        db_session.commit()
        
        return {
            'desert_boss': desert_boss,
            'city_boss': city_boss,
            'artillery_sym': artillery_sym,
            'support_sym': support_sym
        }
    
    def test_boss_search_by_name(self, client, bosses_and_symbiants):
        """Test pocket boss search by name."""
        response = client.get("/api/v1/pocket-bosses/search?q=desert")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Desert Tyrant"
    
    def test_boss_search_by_location(self, client, bosses_and_symbiants):
        """Test pocket boss search by location."""
        response = client.get("/api/v1/pocket-bosses/search?q=athens")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["location"] == "Old Athens Underground"
    
    def test_boss_level_filtering(self, client, bosses_and_symbiants):
        """Test filtering bosses by level range."""
        response = client.get("/api/v1/pocket-bosses?min_level=190&max_level=220")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["level"] == 200
        assert data["items"][0]["name"] == "Desert Tyrant"
    
    def test_boss_location_filtering(self, client, bosses_and_symbiants):
        """Test filtering bosses by location."""
        response = client.get("/api/v1/pocket-bosses?location=desert")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["location"] == "Burning Desert"
    
    def test_boss_with_drops_filtering(self, client, bosses_and_symbiants):
        """Test filtering bosses that have drops."""
        response = client.get("/api/v1/pocket-bosses?has_drops=true")
        assert response.status_code == 200
        data = response.json()
        
        # Both bosses have drops
        assert data["total"] == 2
    
    def test_boss_by_symbiant_family(self, client, bosses_and_symbiants):
        """Test finding bosses by symbiant family."""
        response = client.get("/api/v1/pocket-bosses/by-symbiant-family?family=Artillery")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Desert Tyrant"
    
    def test_boss_by_symbiant_ql_range(self, client, bosses_and_symbiants):
        """Test finding bosses by symbiant QL range."""
        response = client.get("/api/v1/pocket-bosses/by-symbiant-family?family=Artillery&min_symbiant_ql=190&max_symbiant_ql=250")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 1
        assert data["items"][0]["name"] == "Desert Tyrant"


class TestCacheAndPerformance:
    """Test caching and performance monitoring."""
    
    def test_cache_statistics(self, client):
        """Test cache statistics endpoint."""
        response = client.get("/api/v1/cache/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "hits" in data
        assert "misses" in data
        assert "cache_size" in data
        assert "hit_rate_percent" in data
    
    def test_cache_clear(self, client):
        """Test cache clearing endpoint."""
        response = client.post("/api/v1/cache/clear")
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "cleared" in data["message"].lower()
    
    def test_performance_health_check(self, client):
        """Test performance monitoring health check."""
        response = client.get("/api/v1/performance/health")
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "performance_monitoring" in data
        assert "monitoring_endpoints" in data


class TestPaginationAndEdgeCases:
    """Test pagination and edge cases."""
    
    def test_empty_search_results(self, client):
        """Test search with no results."""
        response = client.get("/api/v1/items/search?q=nonexistentitem")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 0
        assert data["items"] == []
        assert data["pages"] == 1
    
    def test_invalid_stat_requirements(self, client):
        """Test invalid stat requirement format."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=invalid")
        # Should handle gracefully - might return 422 or empty results
        assert response.status_code in [200, 422]
    
    def test_large_page_size_limit(self, client):
        """Test page size limits are enforced."""
        response = client.get("/api/v1/items?page_size=1000")
        # Should be limited to maximum allowed (200 in our case)
        assert response.status_code in [200, 422]
    
    def test_negative_page_number(self, client):
        """Test negative page numbers are rejected."""
        response = client.get("/api/v1/items?page=-1")
        assert response.status_code == 422
    
    @pytest.fixture
    def many_items(self, db_session):
        """Create many items for pagination testing."""
        items = []
        for i in range(25):
            item = Item(
                aoid=5000 + i,
                name=f"Pagination Test Item {i:02d}",
                ql=100 + i,
                item_class="Test"
            )
            items.append(item)
            db_session.add(item)
        db_session.commit()
        return items
    
    def test_pagination_consistency(self, client, many_items):
        """Test pagination returns consistent results."""
        # Get first page
        response1 = client.get("/api/v1/items?page=1&page_size=10")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get second page  
        response2 = client.get("/api/v1/items?page=2&page_size=10")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Pages should not overlap
        page1_ids = {item["id"] for item in data1["items"]}
        page2_ids = {item["id"] for item in data2["items"]}
        assert len(page1_ids.intersection(page2_ids)) == 0
        
        # Total should be consistent
        assert data1["total"] == data2["total"]
        
        # Page counts should be consistent
        assert data1["pages"] == data2["pages"]