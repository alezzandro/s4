# Authentication API Reference

S4 supports optional JWT-based authentication with secure one-time tickets for Server-Sent Events (SSE) connections.

## Overview

**Authentication Modes**:

- **Disabled** (default): No `UI_USERNAME` or `UI_PASSWORD` set - all endpoints accessible
- **Enabled**: Both `UI_USERNAME` and `UI_PASSWORD` set - protected endpoints require JWT token

**Authentication Methods**:

1. **HTTP-Only Cookie** (recommended): Secure cookie set by `/api/auth/login`, automatically included in requests
2. **Bearer Token**: JWT token in `Authorization: Bearer <token>` header
3. **SSE Tickets**: One-time tickets for EventSource connections (cannot use custom headers)

**Security Features**:

- JWT tokens with configurable expiration (default: 8 hours)
- HTTP-only, secure cookies (requires HTTPS in production)
- Rate limiting on login (5 attempts/min) and SSE tickets (20 requests/min)
- Timing-safe credential comparison
- One-time SSE tickets with 60-second TTL

---

## Endpoints

### Get Authentication Info

Returns current authentication mode and whether authentication is required.

```bash
GET /api/auth/info
```

**Authentication**: None (always public)

**Response** (200 OK):

```json
{
  "authMode": "simple",
  "authRequired": true
}
```

**Field Descriptions**:

- `authMode`: `"simple"` when credentials configured, `"none"` otherwise
- `authRequired`: `true` when authentication is enabled

**Example**:

```bash
curl http://localhost:5000/api/auth/info
```

---

### Login

Authenticate with username and password, receive JWT token.

```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "yourpassword"
}
```

**Authentication**: None (always public, but rate-limited)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Username configured in `UI_USERNAME` |
| `password` | string | Yes | Password configured in `UI_PASSWORD` |

**Response** (200 OK):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "admin",
    "username": "admin",
    "roles": ["admin"]
  },
  "expiresIn": 28800
}
```

**Response Headers**:

```
Set-Cookie: s4_auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly; Secure; SameSite=Strict
```

**Field Descriptions**:

- `token`: JWT token (for backward compatibility with sessionStorage clients)
- `user.id`: User identifier (always "admin" in current implementation)
- `user.username`: Authenticated username
- `user.roles`: User roles array (always `["admin"]` in current implementation)
- `expiresIn`: Token expiration time in seconds (default: 28800 = 8 hours)

**Error Responses**:

**400 Bad Request** - Authentication not enabled:

```json
{
  "error": "Bad Request",
  "message": "Authentication is not enabled"
}
```

**400 Bad Request** - Missing credentials:

```json
{
  "error": "Bad Request",
  "message": "Username and password are required"
}
```

**401 Unauthorized** - Invalid credentials:

```json
{
  "error": "Unauthorized",
  "message": "Invalid username or password"
}
```

**429 Too Many Requests** - Rate limit exceeded:

```json
{
  "error": "RateLimitExceeded",
  "message": "Too many login attempts. Maximum 5 per minute.",
  "retryAfter": 1643723456789
}
```

**Rate Limiting**: 5 attempts per minute per IP address

**Example**:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}' \
  -c cookies.txt
```

---

### Logout

Clear authentication cookie and invalidate session.

```bash
POST /api/auth/logout
```

**Authentication**: Optional (works with or without auth enabled)

**Headers**:

```
Cookie: s4_auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
{
  "message": "Logged out successfully"
}
```

**Response Headers**:

```
Set-Cookie: s4_auth_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

**Example**:

```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

**Note**: JWT tokens stored in sessionStorage must be cleared client-side.

---

### Get Current User

Returns information about the authenticated user.

```bash
GET /api/auth/me
```

**Authentication**: Required (when auth enabled)

**Headers**:

```
Cookie: s4_auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# OR
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "admin",
    "username": "admin",
    "roles": ["admin"]
  }
}
```

**Error Responses**:

**401 Unauthorized** - No token provided or invalid token:

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**Example**:

```bash
# Using cookie
curl http://localhost:5000/api/auth/me -b cookies.txt

# Using Bearer token
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Generate SSE Ticket

Generate a one-time ticket for Server-Sent Events (SSE) authentication.

**Why SSE Tickets?** EventSource API cannot set custom headers, so JWT tokens can't be used. Placing JWTs in URLs would leak them in server logs. SSE tickets solve this with:

- Single-use tokens (deleted after first use)
- Short TTL (60 seconds)
- Resource-scoped (tied to specific transfer/upload)

```bash
POST /api/auth/sse-ticket
Content-Type: application/json

{
  "resource": "transfer-123",
  "resourceType": "transfer"
}
```

**Authentication**: Required (cookie or Bearer token)

**Headers**:

```
Cookie: s4_auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# OR
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `resource` | string | Yes | Resource identifier (transfer job ID or encoded object key) |
| `resourceType` | string | Yes | `"transfer"` or `"upload"` |

**Response** (200 OK):

```json
{
  "ticket": "4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f",
  "sseUrl": "/transfer/progress/transfer-123?ticket=4a3b2c1d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f",
  "expiresAt": 1643723456789,
  "expiresIn": 60
}
```

**Field Descriptions**:

- `ticket`: Base64url-encoded 256-bit random token (single-use)
- `sseUrl`: Complete SSE endpoint URL with ticket (prepend `/api` when using)
- `expiresAt`: Unix timestamp in milliseconds when ticket expires
- `expiresIn`: Seconds until expiration (60)

**Error Responses**:

**400 Bad Request** - Missing required fields:

```json
{
  "error": "BadRequest",
  "message": "Resource and resourceType are required"
}
```

**400 Bad Request** - Invalid resourceType:

```json
{
  "error": "BadRequest",
  "message": "Invalid resourceType. Must be 'transfer' or 'upload'"
}
```

**401 Unauthorized** - No authentication:

```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

**429 Too Many Requests** - Rate limit exceeded:

```json
{
  "error": "RateLimitExceeded",
  "message": "Too many ticket requests. Maximum 20 per minute.",
  "retryAfter": 1643723456789
}
```

**500 Internal Server Error** - Ticket generation failed:

```json
{
  "error": "InternalServerError",
  "message": "Failed to generate ticket"
}
```

**Rate Limiting**: 20 requests per minute per IP address

**Example**:

```bash
curl -X POST http://localhost:5000/api/auth/sse-ticket \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"resource":"transfer-123","resourceType":"transfer"}'
```

**Usage**:

```javascript
// Generate ticket
const response = await fetch('/api/auth/sse-ticket', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Include cookie
  body: JSON.stringify({
    resource: jobId,
    resourceType: 'transfer',
  }),
});

const { sseUrl } = await response.json();

// Connect to SSE endpoint
const eventSource = new EventSource(`/api${sseUrl}`);
```

---

## Authentication Flow

### Cookie-Based Flow (Recommended)

1. Frontend sends `POST /api/auth/login` with credentials
2. Backend validates credentials, generates JWT
3. Backend sets HTTP-only secure cookie with JWT
4. Cookie automatically included in subsequent requests
5. Backend verifies JWT on protected routes
6. Frontend calls `POST /api/auth/logout` to clear cookie

**Advantages**:

- XSS-resistant (JavaScript cannot access HTTP-only cookies)
- Automatic inclusion in requests
- Secure flag ensures HTTPS-only transmission

### Bearer Token Flow

1. Frontend sends `POST /api/auth/login` with credentials
2. Backend returns JWT in response body
3. Frontend stores JWT in sessionStorage
4. Frontend includes JWT in `Authorization: Bearer <token>` header
5. Backend verifies JWT on protected routes
6. Frontend clears sessionStorage on logout

**Use Cases**:

- API clients (curl, Postman, scripts)
- Environments where cookies disabled
- Cross-origin requests with custom headers

### SSE Ticket Flow

1. Frontend authenticates via cookie or Bearer token
2. Frontend requests SSE ticket for specific resource
3. Backend generates one-time ticket with 60s TTL
4. Frontend connects to SSE endpoint with ticket in URL
5. Backend validates ticket (once), establishes SSE connection
6. Ticket deleted after validation (single-use)

**Security Properties**:

- Tickets expire after 60 seconds
- Tickets deleted immediately after validation
- Resource-scoped (transfer tickets can't access uploads)
- No JWT leakage in server logs

---

## Security Considerations

### Token Storage

**HTTP-Only Cookies** (recommended):

- Immune to XSS attacks
- Automatically handled by browser
- Requires `COOKIE_REQUIRE_HTTPS=true` in production

**sessionStorage** (backward compatibility):

- Vulnerable to XSS attacks
- Requires manual management
- Suitable for development only

### Token Expiration

**Default**: 8 hours (`JWT_EXPIRATION_HOURS=8`)

**Configuration**:

```bash
# Shorter expiration for high-security environments
JWT_EXPIRATION_HOURS=1

# Longer expiration for development
JWT_EXPIRATION_HOURS=24
```

### HTTPS Requirements

**Production** (`COOKIE_REQUIRE_HTTPS=true` or unset):

- Cookies marked with `Secure` flag
- Only transmitted over HTTPS
- Prevents credential leakage over HTTP

**Development** (`COOKIE_REQUIRE_HTTPS=false`):

- Cookies work over HTTP (localhost)
- Suitable for local development only

### Rate Limiting

**Login Endpoint**: 5 attempts per minute per IP
**SSE Tickets**: 20 requests per minute per IP

**Implementation**: In-memory Map (suitable for single-replica deployment)

### SSE Ticket Security

**Ticket Properties**:

- 256-bit random tokens (cryptographically secure)
- Base64url-encoded (URL-safe)
- Single-use (deleted after validation)
- 60-second TTL (configurable via `SSE_TICKET_TTL_SECONDS`)

**Attack Mitigation**:

- Rate limiting prevents ticket exhaustion attacks
- Resource scoping prevents ticket reuse across resources
- Short TTL limits window of opportunity
- Single-use prevents replay attacks

---

## Configuration Reference

See [Configuration Reference](../deployment/configuration.md#authentication) for complete environment variable documentation:

- `UI_USERNAME` - Web UI username
- `UI_PASSWORD` - Web UI password
- `JWT_SECRET` - JWT signing secret (auto-generated if not set)
- `JWT_EXPIRATION_HOURS` - Token expiration (default: 8)
- `SSE_TICKET_TTL_SECONDS` - SSE ticket TTL (default: 60)
- `COOKIE_REQUIRE_HTTPS` - Require HTTPS for cookies (default: true)

---

## Related Documentation

- [Security → Authentication Guide](../security/authentication.md) - Implementation details, security architecture
- [API → Overview](README.md) - Complete API reference
- [Deployment → Configuration](../deployment/configuration.md) - Environment variables
