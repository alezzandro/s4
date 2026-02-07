# Authentication Guide

Detailed guide to S4's authentication system.

## Overview

S4 supports optional JWT-based authentication with two modes:

- **Disabled** (default) - No authentication required
- **Enabled** - JWT token authentication required

## Authentication Modes

### Disabled Mode (Default)

When `UI_USERNAME` and `UI_PASSWORD` are **not** configured:

- All API endpoints are accessible without authentication
- No login page displayed
- Suitable for development, demos, and trusted environments

```bash
# No authentication - default
# Don't set UI_USERNAME or UI_PASSWORD
```

### Enabled Mode

When **both** `UI_USERNAME` and `UI_PASSWORD` are configured:

- Authentication required for all API endpoints except public routes
- Login page displayed on application load
- JWT tokens issued upon successful login
- Suitable for production deployments

```bash
# Enable authentication
UI_USERNAME=admin
UI_PASSWORD=your-secure-password
JWT_SECRET=your-random-secret-key  # Optional but recommended
```

## JWT Authentication Flow

### 1. Application Load

```
User → Frontend → GET /api/auth/info
                ← { authMode: "simple", authRequired: true }

If authRequired:
  User → Login Page
Else:
  User → Application
```

### 2. Login Process

```
User → Login Form (username, password)
     → POST /api/auth/login
     ← { token: "eyJhbGciOiJIUzI1NiIs..." }

Frontend stores token in sessionStorage
Frontend redirects to application
```

### 3. Authenticated Requests

```
User → API Request
     → Header: Authorization: Bearer <token>
     → Backend validates token
     ← Response (200 OK) or 401 Unauthorized
```

### 4. Token Expiration

```
Token expires after JWT_EXPIRATION_HOURS (default: 8)

User → API Request
     → Backend: Token expired
     ← 401 Unauthorized

Frontend → Emits auth:unauthorized event
         → Logout user
         → Redirect to login
```

## Public Routes

These routes are accessible without authentication:

- `GET /api/auth/info` - Check authentication status
- `POST /api/auth/login` - Login with credentials

All other `/api/*` routes require authentication when enabled.

## Protected Routes

When authentication is enabled, these routes require valid JWT token:

- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout (informational)
- `GET /api/auth/sse-ticket` - Generate SSE ticket
- All `/api/buckets/*` endpoints
- All `/api/objects/*` endpoints
- All `/api/settings/*` endpoints
- All `/api/transfer/*` endpoints

## Token Management

### Token Structure

JWT tokens contain:

```json
{
  "sub": "user-id",
  "username": "admin",
  "roles": ["admin"],
  "iat": 1234567890,
  "exp": 1234596690
}
```

### Token Storage

- **Location**: Browser sessionStorage
- **Key**: `auth_token`
- **Lifetime**: Until browser tab closes or token expires
- **Security**: sessionStorage is cleared on tab close (more secure than localStorage)

### Token Expiration

- **Default**: 8 hours
- **Configurable**: `JWT_EXPIRATION_HOURS` environment variable
- **Behavior**: Auto-logout on expiration
- **No refresh**: Tokens cannot be refreshed (user must re-login)

## SSE Authentication (Server-Sent Events)

S4 uses a secure **one-time ticket system** for SSE connections instead of JWT tokens.

### Why One-Time Tickets?

JWT tokens in query parameters are insecure because:

- Logged by proxies, web servers, load balancers
- Stored in browser history
- Long-lived (8 hours default)

One-time tickets provide:

- **Time-limited**: 60-second TTL (configurable)
- **Single-use**: Deleted after first use
- **Resource-scoped**: Valid for specific transfer/upload only

### Ticket Generation

```
Frontend → POST /api/auth/sse-ticket
           Body: { resource: "job-123", resourceType: "transfer" }
         ← { ticket: "random-256-bit-token" }

Frontend → EventSource(url + "?ticket=" + ticket)
Backend  → Validates ticket
         → Deletes ticket (single-use)
         → Streams events
```

### Ticket Properties

- **Size**: 256-bit random token (Base64url-encoded)
- **TTL**: 60 seconds (configurable via `SSE_TICKET_TTL_SECONDS`)
- **Scope**: Resource-specific (jobId or encodedKey)
- **Usage**: Single-use (deleted after validation)
- **Rate Limit**: 20 requests per minute per IP

### SSE Endpoints

- `GET /api/transfer/progress/:jobId?ticket=...` - Transfer progress
- `GET /api/objects/upload-progress/:encodedKey?ticket=...` - Upload progress

## Rate Limiting

### Login Endpoint

- **Limit**: 5 attempts per minute per IP address
- **Purpose**: Prevent brute-force attacks
- **Response**: 429 Too Many Requests
- **Reset**: 1 minute

### SSE Ticket Generation

- **Limit**: 20 requests per minute per IP address
- **Purpose**: Prevent ticket flooding
- **Response**: 429 Too Many Requests
- **Reset**: 1 minute

**Note**: Rate limiting uses in-memory storage. Limits reset on restart. This is the intended design for S4's single-replica deployment model.

## Security Considerations

### Password Security

- **Storage**: Passwords compared using timing-safe comparison
- **Hashing**: Not currently implemented (simple authentication only)
- **Strength**: Use strong, random passwords (16+ characters)
- **Rotation**: Rotate passwords regularly

### JWT Secret

- **Default**: Auto-generated on startup (32-byte random)
- **Production**: Set `JWT_SECRET` environment variable
- **Multi-Replica**: MUST use shared secret across replicas
- **Strength**: Minimum 32 characters, random

```bash
# Generate secure JWT secret
openssl rand -base64 32
```

### Token Security

- **Transport**: Tokens sent in Authorization header (not query params)
- **Storage**: sessionStorage (cleared on tab close)
- **Expiration**: Tokens expire after configured hours
- **Revocation**: Not currently supported

## Configuration

### Environment Variables

| Variable                 | Default | Description                                    |
| ------------------------ | ------- | ---------------------------------------------- |
| `UI_USERNAME`            | (none)  | Admin username (enables auth when both set)    |
| `UI_PASSWORD`            | (none)  | Admin password (enables auth when both set)    |
| `JWT_SECRET`             | (auto)  | JWT signing secret (auto-generated if not set) |
| `JWT_EXPIRATION_HOURS`   | `8`     | JWT token expiration in hours                  |
| `SSE_TICKET_TTL_SECONDS` | `60`    | SSE ticket time-to-live in seconds             |

### Docker/Podman

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e UI_USERNAME=admin \
  -e UI_PASSWORD=your-secure-password \
  -e JWT_SECRET=your-random-secret-key \
  -e JWT_EXPIRATION_HOURS=4 \
  quay.io/rh-aiservices-bu/s4:latest
```

### Kubernetes

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: s4-credentials
stringData:
  UI_USERNAME: 'admin'
  UI_PASSWORD: 'your-secure-password'
  JWT_SECRET: 'shared-secret-for-all-replicas'
```

## API Examples

### Check Authentication Status

```bash
curl http://localhost:5000/api/auth/info

# Response when disabled:
# { "authMode": "none", "authRequired": false }

# Response when enabled:
# { "authMode": "simple", "authRequired": true }
```

### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"pass"}'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": {
#     "id": "1",
#     "username": "admin",
#     "roles": ["admin"]
#   }
# }
```

### Authenticated Request

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl http://localhost:5000/api/buckets \
  -H "Authorization: Bearer $TOKEN"
```

### Generate SSE Ticket

```bash
curl -X POST http://localhost:5000/api/auth/sse-ticket \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resource":"job-123","resourceType":"transfer"}'

# Response:
# { "ticket": "random-256-bit-token" }
```

## Troubleshooting

### Authentication Not Working

```bash
# Check if auth is enabled
curl http://localhost:5000/api/auth/info

# Verify credentials are set
docker exec s4 env | grep UI_
# Should show UI_USERNAME and UI_PASSWORD
```

### Token Expired

```bash
# Check token expiration
echo $TOKEN | cut -d. -f2 | base64 -d | jq .exp

# Compare with current time
date +%s
```

### Multi-Replica Issues

```bash
# Verify JWT_SECRET is set in Secret
kubectl get secret s4-credentials -o jsonpath='{.data.JWT_SECRET}' | base64 -d

# Check if all pods use same secret
kubectl get pods -l app=s4 -o jsonpath='{.items[*].spec.containers[0].env}'
```

## Limitations

Current authentication limitations:

- **Single admin user** - No multi-user support
- **No RBAC** - All authenticated users have full access
- **No session revocation** - Cannot revoke active tokens
- **No token refresh** - Users must re-login after expiration
- **In-memory rate limiting** - Limits reset on restart
- **Simple password comparison** - No bcrypt/scrypt hashing

For enterprise deployments, consider integrating with:

- OAuth2/OIDC (Keycloak, Auth0)
- LDAP/Active Directory
- SAML 2.0
- Multi-factor authentication (MFA)

## Related Documentation

- [Security Policy](./README.md) - Overall security policy
- [Best Practices](./best-practices.md) - Security recommendations
- [Configuration Guide](../deployment/configuration.md) - Environment variables
- [Production Readiness](../deployment/production-readiness.md) - Production checklist
