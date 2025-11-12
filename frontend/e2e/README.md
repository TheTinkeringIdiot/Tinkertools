# TinkerTools E2E Tests

End-to-end tests for TinkerTools using Playwright.

## Quick Start

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (interactive)
npm run test:e2e:ui

# Run with headed browsers (visible)
npm run test:e2e:headed

# Debug mode (step through)
npm run test:e2e:debug
```

## Directory Structure

```
e2e/
├── fixtures/        # Test data (profiles, items, etc.)
├── pages/          # Page Object Models
├── tests/          # Test specifications
├── utils/          # Helper functions
└── screenshots/    # Failure screenshots
```

## Page Objects

- **ProfilePage** - Profile CRUD operations
- **ItemSearchPage** - Item search and filtering
- **EquipmentPage** - Equipment management
- **TinkerPlantsPage** - Implant planning

## Test Coverage

Current tests:
- [x] Profile CRUD (create, read, update, delete)
- [ ] Item search and filtering
- [ ] Equipment management
- [ ] Buff management
- [ ] Implant planning
- [ ] Nano compatibility checking

## Documentation

See `/tmp/e2e-setup-guide.md` for complete documentation on:
- Writing new tests
- Creating page objects
- Using test fixtures
- Debugging tests
- Best practices

## Example Test

```typescript
import { test, expect } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage';

test('should create profile', async ({ page }) => {
  const profilePage = new ProfilePage(page);
  await profilePage.goto();
  await profilePage.createProfile('TestChar', 220, 'Enforcer');

  expect(await profilePage.hasProfile('TestChar')).toBe(true);
});
```

## Configuration

See `../playwright.config.ts` for:
- Browser configuration
- Timeouts and retries
- Screenshot/video settings
- Web server setup
