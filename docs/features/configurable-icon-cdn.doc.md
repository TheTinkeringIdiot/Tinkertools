# Configurable Icon CDN

## Overview

This feature introduces environment-based configuration for the icon CDN base URL, allowing deployments to use different CDN endpoints for Anarchy Online game icons. The `VITE_ICON_BASE_URL` environment variable provides deployment flexibility while maintaining a sensible default for the TinkeringIdiot CDN.

## User Perspective

End users see no visible changes - icons continue to load seamlessly from the configured CDN. This feature is transparent to users but critical for deployment flexibility across different hosting environments.

For developers and deployment engineers, icon CDN configuration is now centralized through a single environment variable rather than hardcoded URLs scattered throughout the codebase. This enables:
- Testing with alternative CDN endpoints
- Using local icon mirrors for development
- Deploying to different hosting providers with custom CDN configurations
- Maintaining consistent icon URLs across the entire application

## Data Flow

1. **Build Time**: Vite reads `VITE_ICON_BASE_URL` from `.env` or `.env.local` files
2. **Type Safety**: TypeScript validates environment variable through `ImportMetaEnv` interface
3. **Runtime Access**: Components and services access `import.meta.env.VITE_ICON_BASE_URL`
4. **Fallback Behavior**: If undefined, defaults to `https://cdn.tinkeringidiot.com/aoicons`
5. **URL Construction**: Icon URLs built as `${baseUrl}/${iconId}.png` or `${baseUrl}/${aoid}.png`
6. **Rendering**: Browser fetches icons from the configured CDN endpoint

## Implementation

### Key Files Modified

#### TypeScript Type Definitions (10 lines added)
- **`frontend/env.d.ts`** - Environment variable type safety:
  - Added `ImportMetaEnv` interface with `VITE_API_BASE_URL` and `VITE_ICON_BASE_URL`
  - Added `ImportMeta` interface extension for Vite environment access
  - Provides autocomplete and type checking for `import.meta.env.*` usage

#### Icon Utility Functions (2 lines changed)
- **`frontend/src/services/game-utils.ts`** - Core icon URL generation:
  - Modified `getIconUrl(iconId: number)` function
  - Reads from `import.meta.env.VITE_ICON_BASE_URL` with fallback
  - Used by all regular items (weapons, armor, etc.)

#### Component Updates (2 lines changed)
- **`frontend/src/components/items/EquipmentSlotsDisplay.vue`** - Symbiant icon rendering:
  - Updated symbiant icon URL construction to use environment variable
  - Symbiants use `aoid` instead of icon stat (different data model)
  - Maintains same fallback pattern as utility function

#### Documentation (1 line added)
- **`INFRASTRUCTURE.md`** - Environment variable reference:
  - Documented `VITE_ICON_BASE_URL` with default value
  - Noted that base URL includes folder path (no hardcoded `/aoicons`)

## Configuration

### Environment Variable

**`VITE_ICON_BASE_URL`** - Icon CDN base URL including folder path
- **Type**: String (URL)
- **Required**: No
- **Default**: `https://cdn.tinkeringidiot.com/aoicons`
- **Format**: Full URL path without trailing slash
- **Examples**:
  - Production: `https://cdn.tinkeringidiot.com/aoicons`
  - Alternative CDN: `https://my-cdn.example.com/gameicons`
  - Local development: `http://localhost:3000/icons`

### Configuration Files

The environment variable can be set in:
- **`.env.local`** - Local development overrides (git-ignored)
- **`.env`** - Default configuration (git-tracked)
- **`.env.production`** - Production-specific settings
- **Deployment environment** - CI/CD pipeline variables

### Important Notes

1. **Include Folder Path**: The base URL should include the full path to the icon folder:
   - ✅ Correct: `https://cdn.example.com/aoicons`
   - ❌ Incorrect: `https://cdn.example.com` (missing `/aoicons`)

2. **No Trailing Slash**: Do not include a trailing slash:
   - ✅ Correct: `https://cdn.example.com/aoicons`
   - ❌ Incorrect: `https://cdn.example.com/aoicons/`

3. **VITE_ Prefix Required**: Vite only exposes environment variables prefixed with `VITE_` to client-side code

## Usage Example

### Setting the Environment Variable

```bash
# .env.local (for local development)
VITE_ICON_BASE_URL=http://localhost:3000/icons

# .env.production (for production builds)
VITE_ICON_BASE_URL=https://cdn.tinkeringidiot.com/aoicons
```

### Using in Components

```typescript
// Regular items (via game-utils.ts)
import { getIconUrl } from '@/services/game-utils';

const iconUrl = getIconUrl(12345);
// → https://cdn.tinkeringidiot.com/aoicons/12345.png

// Symbiants (in EquipmentSlotsDisplay.vue)
const baseUrl = import.meta.env.VITE_ICON_BASE_URL || 'https://cdn.tinkeringidiot.com/aoicons';
const symbiantIconUrl = `${baseUrl}/${item.aoid}.png`;
// → https://cdn.tinkeringidiot.com/aoicons/67890.png
```

### TypeScript Autocomplete

```typescript
// Type-safe environment access
const iconBaseUrl: string | undefined = import.meta.env.VITE_ICON_BASE_URL;
const apiBaseUrl: string | undefined = import.meta.env.VITE_API_BASE_URL;

// Autocomplete works for defined environment variables
import.meta.env.VITE_  // ← Triggers autocomplete
```

## Icon URL Patterns

### Regular Items (Weapons, Armor, etc.)
- **Source**: Icon ID from stat value (stat ID 79)
- **Function**: `getIconUrl(iconId: number)` in `game-utils.ts`
- **URL Pattern**: `${VITE_ICON_BASE_URL}/${iconId}.png`
- **Example**: `https://cdn.tinkeringidiot.com/aoicons/239205.png`

### Symbiants
- **Source**: AOID (Anarchy Online ID) from symbiant data
- **Location**: `EquipmentSlotsDisplay.vue` component
- **URL Pattern**: `${VITE_ICON_BASE_URL}/${aoid}.png`
- **Example**: `https://cdn.tinkeringidiot.com/aoicons/289348.png`

## Testing

### Manual Testing Steps

1. **Default Configuration Test**:
   ```bash
   # Start frontend without .env.local
   npm run dev
   # Visit http://localhost:5173/tinkeritems
   # Verify icons load from https://cdn.tinkeringidiot.com/aoicons/
   ```

2. **Custom CDN Test**:
   ```bash
   # Create .env.local with custom URL
   echo "VITE_ICON_BASE_URL=https://my-test-cdn.example.com/icons" > frontend/.env.local
   npm run dev
   # Open browser DevTools → Network tab
   # Verify icon requests go to custom CDN
   ```

3. **Symbiant Icon Test**:
   ```bash
   # Navigate to TinkerPlants
   # Open browser DevTools → Network tab
   # Filter for .png requests
   # Verify symbiant icons use configured base URL
   ```

### Expected Behavior

- Icons load successfully from configured CDN
- No console errors for missing environment variables
- TypeScript compilation succeeds with proper type checking
- Fallback to default CDN when variable is undefined
- Both regular items and symbiants use the same base URL

## Performance Considerations

### No Runtime Performance Impact
- Environment variable is resolved at build time by Vite
- No additional runtime checks or string concatenation overhead
- CDN URL construction is O(1) string interpolation
- Browser caching applies normally to CDN resources

### Build-Time Optimization
- Vite replaces `import.meta.env.VITE_ICON_BASE_URL` with literal string at build time
- Dead code elimination removes unused fallback branches in production
- No bundle size increase from configuration flexibility

## Deployment Scenarios

### Development Environment
```bash
# .env.local
VITE_ICON_BASE_URL=http://localhost:8080/static/icons
```
- Allows testing with local icon mirror
- Faster iteration without network requests
- Can test with modified icon assets

### Staging Environment
```bash
# .env.staging
VITE_ICON_BASE_URL=https://staging-cdn.tinkeringidiot.com/aoicons
```
- Separate CDN for pre-production testing
- Validates CDN configuration before production
- Can test CDN failover scenarios

### Production Environment
```bash
# .env.production
VITE_ICON_BASE_URL=https://cdn.tinkeringidiot.com/aoicons
```
- Production CDN with geographic distribution
- Optimized caching and compression
- High availability and performance

## Migration Notes

### Before This Feature
```typescript
// Hardcoded URLs scattered across codebase
export function getIconUrl(iconId: number): string {
  return `https://cdn.tinkeringidiot.com/aoicons/${iconId}.png`;
}

// Symbiants had different hardcoded URL
const iconUrl = `https://cdn.tinkeringidiot.com/static/icons/${item.aoid}.png`;
```

### After This Feature
```typescript
// Centralized configuration with environment variable
export function getIconUrl(iconId: number): string {
  const baseUrl = import.meta.env.VITE_ICON_BASE_URL || 'https://cdn.tinkeringidiot.com/aoicons';
  return `${baseUrl}/${iconId}.png`;
}

// Symbiants now use consistent base URL
const baseUrl = import.meta.env.VITE_ICON_BASE_URL || 'https://cdn.tinkeringidiot.com/aoicons';
const iconUrl = `${baseUrl}/${item.aoid}.png`;
```

### Breaking Changes
None. The default value maintains backward compatibility with existing deployments.

## Related Documentation

- **Infrastructure**: `INFRASTRUCTURE.md` - Environment variables section
- **Build Configuration**: `frontend/vite.config.ts` - Vite environment handling
- **Type Definitions**: `frontend/env.d.ts` - TypeScript environment types

## Future Enhancements

### Potential Improvements
- **Icon Version Hashing**: Add version parameter for cache busting (`${baseUrl}/${iconId}.png?v=${hash}`)
- **CDN Failover**: Implement fallback to secondary CDN if primary fails
- **Icon Format Selection**: Support WebP/AVIF with PNG fallback based on browser support
- **Lazy Loading**: Defer icon loading for off-screen equipment slots
- **Icon Preloading**: Preload common icons on application startup
- **Environment-Specific Icon Sets**: Different icon quality/size for mobile vs desktop

## Summary

The Configurable Icon CDN feature introduces deployment flexibility through the `VITE_ICON_BASE_URL` environment variable, allowing TinkerTools to be deployed with different CDN configurations without code changes.

**Key Benefits:**
- **Deployment Flexibility**: Easy CDN switching for different environments
- **Type Safety**: TypeScript interfaces prevent typos and provide autocomplete
- **Backward Compatibility**: Default value maintains existing behavior
- **Code Consolidation**: Centralized configuration instead of scattered hardcoded URLs
- **Zero Performance Impact**: Build-time resolution with no runtime overhead

**Implementation Quality:**
- **Minimal Changes**: 4 files modified with ~15 total lines changed
- **Consistent Pattern**: Same configuration approach for items and symbiants
- **Well Documented**: Environment variable documented in INFRASTRUCTURE.md
- **Production Ready**: Tested and working with sensible defaults

This infrastructure improvement supports future deployment scenarios while maintaining the simple, stateless architecture that makes TinkerTools easy to host and maintain.
