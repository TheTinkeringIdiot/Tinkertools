# TinkerTools Project Requirements

## Overview

This document contains binary, testable requirements for the TinkerTools suite - a collection of six web-based utilities for the sci-fi MMORPG Anarchy Online. Each requirement is stated as a measurable condition that can be verified through testing.

## System Architecture Requirements

### REQ-ARCH-001: Technology Stack
**Requirement:** The system SHALL use Vue 3 with TypeScript, PrimeVue UI components, TailwindCSS for styling, and Pinia for state management on the frontend.
**Test:** Verify package.json contains specified dependencies and tsconfig.json is configured for TypeScript.

### REQ-ARCH-002: Backend API
**Requirement:** The system SHALL use FastAPI with Python for the backend REST API.
**Test:** Verify backend server responds to API requests and serves OpenAPI documentation at `/docs`.

### REQ-ARCH-003: Database
**Requirement:** The system SHALL use PostgreSQL as the primary database with the schema defined in `docs/02_database_schema.md`.
**Test:** Execute schema DDL scripts and verify all tables, indexes, and constraints are created successfully.

### REQ-ARCH-004: Client-Side Data Storage
**Requirement:** User data and character profiles SHALL be stored exclusively in browser LocalStorage, not on the server.
**Test:** Verify no user profile data is transmitted to or stored on the backend server during normal operation.

### REQ-ARCH-005: Single Page Application
**Requirement:** The system SHALL be a Single Page Application (SPA) with client-side routing.
**Test:** Verify navigation between applications occurs without full page refreshes and URLs update correctly.

## Data Management Requirements

### REQ-DATA-001: StatValue Uniqueness
**Requirement:** The system SHALL enforce unique constraints on `(stat, value)` pairs in the stat_values table.
**Test:** Attempt to insert duplicate stat-value pairs and verify constraint violation occurs.

### REQ-DATA-002: Item Data Integrity
**Requirement:** All items SHALL have valid AOID (Anarchy Online ID) references when provided.
**Test:** Verify all non-null AOID values in items table are positive integers.

### REQ-DATA-003: Spell-Criteria Relationships
**Requirement:** Spells SHALL support many-to-many relationships with criteria through junction tables.
**Test:** Create spells with multiple criteria and verify relationships are stored and retrieved correctly.

### REQ-DATA-004: Symbiant-PocketBoss Relationships
**Requirement:** Pocket bosses SHALL support many-to-many relationships with symbiant drops.
**Test:** Assign multiple symbiants to a pocket boss and verify the relationship is queryable in both directions.

### REQ-DATA-005: No Timestamp Tracking
**Requirement:** The database schema SHALL NOT include created_at or updated_at timestamp fields on any tables except expires_at for cache expiration.
**Test:** Verify schema contains no timestamp columns except application_cache.expires_at.

## Application-Specific Requirements

### TinkerPlants Requirements

### REQ-PLANTS-001: Implant Planning
**Requirement:** TinkerPlants SHALL allow users to plan implant configurations for characters.
**Test:** Create an implant configuration, save it to LocalStorage, and verify it persists across browser sessions.

### REQ-PLANTS-002: Symbiant Integration
**Requirement:** TinkerPlants SHALL display available symbiants and their stat bonuses.
**Test:** Load symbiant data from the database and verify stat values are displayed correctly.

### REQ-PLANTS-003: Stat Calculations
**Requirement:** TinkerPlants SHALL calculate total stat bonuses from selected implants and symbiants.
**Test:** Select multiple items and verify the sum of stat bonuses is calculated and displayed correctly.

### TinkerFite Requirements

### REQ-FITE-001: Weapon Database
**Requirement:** TinkerFite SHALL display searchable weapon data including attack ratings and damage values.
**Test:** Search for weapons by name and verify results include attack/defense statistics.

### REQ-FITE-002: Weapon Comparison
**Requirement:** TinkerFite SHALL allow side-by-side comparison of up to 3 weapons.
**Test:** Select 3 weapons and verify their stats are displayed in comparable format.

### REQ-FITE-003: Attack/Defense Analysis
**Requirement:** TinkerFite SHALL calculate and display weapon effectiveness against different armor types.
**Test:** Input armor values and verify weapon damage calculations are performed correctly.

### TinkerNanos Requirements

### REQ-NANOS-001: Nano Database
**Requirement:** TinkerNanos SHALL display all nano programs with filtering by school and quality level.
**Test:** Filter nanos by school (e.g., "Meta Physics") and verify only matching results are shown.

### REQ-NANOS-002: Nano Requirements
**Requirement:** TinkerNanos SHALL display skill requirements for each nano program.
**Test:** View nano details and verify all skill requirements are listed with correct values.

### REQ-NANOS-003: Character Compatibility
**Requirement:** TinkerNanos SHALL highlight which nanos a character can use based on their skills.
**Test:** Input character skills and verify nanos are marked as usable/unusable correctly.

### TinkerNukes Requirements

### REQ-NUKES-001: Offensive Nano Focus
**Requirement:** TinkerNukes SHALL display only offensive nano programs suitable for Nanotechnicians.
**Test:** Verify displayed nanos are filtered to offensive spells with appropriate profession restrictions.

### REQ-NUKES-002: Damage Calculations
**Requirement:** TinkerNukes SHALL calculate expected damage output for nano programs.
**Test:** Input character stats and verify damage calculations match expected formulas.

### REQ-NUKES-003: Nano Strain Management
**Requirement:** TinkerNukes SHALL track nano strain usage and warn of conflicts.
**Test:** Select multiple nanos using the same strain and verify conflict warnings are displayed.

### TinkerPocket Requirements

### REQ-POCKET-001: Boss Database
**Requirement:** TinkerPocket SHALL display pocket boss information including level, location, and drops.
**Test:** Search for a pocket boss and verify all location and drop information is displayed.

### REQ-POCKET-002: Drop Tracking
**Requirement:** TinkerPocket SHALL show which symbiants drop from each pocket boss.
**Test:** View pocket boss details and verify associated symbiant drops are listed.

### REQ-POCKET-003: Item Collection
**Requirement:** TinkerPocket SHALL allow users to track collected items in LocalStorage.
**Test:** Mark items as collected and verify the status persists across browser sessions.

### TinkerItems Requirements

### REQ-ITEMS-001: Comprehensive Search
**Requirement:** TinkerItems SHALL provide full-text search across item names and descriptions.
**Test:** Search for partial item names and verify relevant results are returned using PostgreSQL full-text search.

### REQ-ITEMS-002: Advanced Filtering
**Requirement:** TinkerItems SHALL support filtering by item class, quality level, and stat requirements.
**Test:** Apply multiple filters simultaneously and verify results match all criteria.

### REQ-ITEMS-003: Item Details
**Requirement:** TinkerItems SHALL display complete item information including stats, spells, and requirements.
**Test:** View item details and verify all database relationships (stats, spells, actions) are displayed.

## Performance Requirements

### REQ-PERF-001: Database Query Performance
**Requirement:** Complex stat-based item queries SHALL execute in under 500ms on the target hardware.
**Test:** Execute the most complex query patterns and verify response times meet the threshold.

### REQ-PERF-002: Client-Side Performance
**Requirement:** Application switching between tools SHALL complete in under 200ms.
**Test:** Measure time between navigation clicks and full component render completion.

### REQ-PERF-003: Initial Load Time
**Requirement:** The application SHALL load and become interactive within 3 seconds on a standard broadband connection.
**Test:** Measure time from page request to first interactive element using browser performance tools.

## User Interface Requirements

### REQ-UI-001: Responsive Design
**Requirement:** All applications SHALL be fully functional on screens from 320px to 1920px width.
**Test:** Test functionality across mobile, tablet, and desktop viewports using browser developer tools.

### REQ-UI-002: Dark/Light Theme Support
**Requirement:** The system SHALL support both dark and light color themes with persistent user preference.
**Test:** Toggle between themes and verify preference persists across browser sessions.

### REQ-UI-003: Accessibility Compliance
**Requirement:** The system SHALL meet WCAG 2.1 AA accessibility standards for keyboard navigation and screen readers.
**Test:** Navigate entire application using only keyboard and verify all functions are accessible.

### REQ-UI-004: Loading States
**Requirement:** The system SHALL display loading indicators for all operations taking longer than 200ms.
**Test:** Throttle network requests and verify loading indicators appear for delayed operations.

## Data Integrity Requirements

### REQ-INT-001: Foreign Key Constraints
**Requirement:** All foreign key relationships SHALL be enforced at the database level.
**Test:** Attempt to insert records with invalid foreign key references and verify constraint violations.

### REQ-INT-002: Unique Constraints
**Requirement:** Unique constraints on stat_values and criteria SHALL prevent duplicate entities.
**Test:** Attempt to create duplicate stat-value and criterion combinations and verify rejections.

### REQ-INT-003: Data Validation
**Requirement:** The API SHALL validate all input data against defined schemas before database operations.
**Test:** Submit invalid data through API endpoints and verify appropriate error responses.

## Security Requirements

### REQ-SEC-001: Read-Only Game Data
**Requirement:** The system SHALL provide read-only access to game data with no user modification capabilities.
**Test:** Verify no API endpoints allow modification of items, spells, or other game data.

### REQ-SEC-002: No Authentication Required
**Requirement:** The system SHALL operate without user accounts or authentication systems.
**Test:** Verify all functionality is accessible without login or authentication prompts.

### REQ-SEC-003: Client-Side Data Privacy
**Requirement:** User data SHALL remain on the client device and never be transmitted to the server.
**Test:** Monitor network traffic and verify no character or preference data is sent to the backend.

## Deployment Requirements

### REQ-DEPLOY-001: Container Support
**Requirement:** The system SHALL be deployable using Docker containers for both frontend and backend.
**Test:** Build and run Docker containers successfully and verify all functionality works.

### REQ-DEPLOY-002: Database Migration
**Requirement:** The system SHALL include automated database migration scripts for schema deployment.
**Test:** Run migration scripts on empty database and verify complete schema creation.

### REQ-DEPLOY-003: Static Asset Serving
**Requirement:** The frontend SHALL be deployable as static assets served by any web server.
**Test:** Build production assets and verify they serve correctly from standard web servers.

## Testing Requirements

### REQ-TEST-001: Unit Test Coverage
**Requirement:** Backend code SHALL maintain minimum 80% unit test coverage.
**Test:** Run coverage analysis and verify threshold is met.

### REQ-TEST-002: Integration Testing
**Requirement:** All API endpoints SHALL have integration tests verifying database interactions.
**Test:** Execute integration test suite and verify all endpoints are tested.

### REQ-TEST-003: End-to-End Testing
**Requirement:** Critical user workflows SHALL be covered by automated end-to-end tests.
**Test:** Run E2E test suite and verify key user journeys complete successfully.

## Compatibility Requirements

### REQ-COMPAT-001: Browser Support
**Requirement:** The system SHALL support modern browsers: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+.
**Test:** Test core functionality in each supported browser version.

### REQ-COMPAT-002: Mobile Compatibility
**Requirement:** The system SHALL be fully functional on iOS 14+ and Android 10+ devices.
**Test:** Test all features on target mobile platforms using real devices or simulators.

### REQ-COMPAT-003: Database Version
**Requirement:** The system SHALL be compatible with PostgreSQL 12+ with required extensions available.
**Test:** Deploy and test against PostgreSQL 12, 13, 14, and 15 versions.

## Maintenance Requirements

### REQ-MAINT-001: Data Updates
**Requirement:** The system SHALL support updating game data without application downtime.
**Test:** Perform database updates during application runtime and verify continued operation.

### REQ-MAINT-002: Cache Management
**Requirement:** The system SHALL automatically expire cached data based on configured TTL values.
**Test:** Verify cache entries are removed after expiration timeout and fresh data is retrieved.

### REQ-MAINT-003: Error Logging
**Requirement:** The system SHALL log all errors with sufficient detail for debugging without exposing sensitive information.
**Test:** Trigger error conditions and verify appropriate logs are generated with necessary context.

---

**Total Requirements:** 47 functional and non-functional requirements
**Last Updated:** 2025-01-03
**Version:** 1.0

This requirements document serves as the definitive specification for TinkerTools development and testing. Each requirement is designed to be objectively verifiable and forms the basis for acceptance testing.