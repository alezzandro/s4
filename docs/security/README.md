# Security Policy

S4's security policy and reporting procedures.

## Reporting Security Vulnerabilities

If you discover a security vulnerability in S4, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. **Report privately** via:
   - GitHub Security Advisories: https://github.com/rh-aiservices-bu/s4/security/advisories
   - Email: (Contact maintainers)
3. **Include details**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Security Response Process

1. **Acknowledgment** (48 hours) - We confirm receipt and begin investigation
2. **Assessment** (1 week) - We evaluate severity and impact
3. **Fix Development** (varies) - We develop and test a fix
4. **Disclosure** (coordinated) - We release fix and advisory together

## Supported Versions

| Version | Supported |
| ------- | --------- |
| latest  | ✅ Yes    |
| < 1.0   | ❌ No     |

We only provide security updates for the latest version. Please upgrade to the latest release.

## Security Best Practices

S4 implements several security measures:

- **JWT-based authentication** - Secure session management
- **One-time SSE tickets** - Secure Server-Sent Events without token leakage
- **Input validation** - S3 bucket and object name validation
- **Header sanitization** - Protection against header injection
- **Credential masking** - Prevents credential leakage in logs
- **Regular dependency audits** - Continuous monitoring and updates

See [Security Best Practices](./best-practices.md) for deployment recommendations.

## Security Features

### Authentication

- **Optional JWT authentication** - Enable with `UI_USERNAME` and `UI_PASSWORD`
- **Token expiration** - Configurable via `JWT_EXPIRATION_HOURS` (default: 8 hours)
- **Secure token storage** - sessionStorage (cleared on tab close)
- **Rate limiting** - Login endpoint limited to 5 attempts per minute

See [Authentication Guide](./authentication.md) for details.

### Authorization

- **Simple access control** - Single admin user (no RBAC currently)
- **Protected routes** - All API endpoints require authentication when enabled
- **Public endpoints** - Only `/api/auth/info` and `/api/auth/login` are public

### Data Protection

- **Credential masking in logs** - AWS credentials sanitized in error messages
- **HTTPS recommended** - Deploy behind HTTPS reverse proxy/ingress
- **Secure headers** - CORS, CSP headers configured

### Dependency Security

- **Regular audits** - Run `npm audit` before each release
- **Automated scanning** - GitHub Dependabot enabled
- **Vulnerability tracking** - Known issues documented

See [Vulnerability Management](./vulnerability-management.md) for audit status.

## Limitations

Current security limitations to consider:

- **Single admin user** - No multi-user support or role-based access control
- **In-memory rate limiting** - Rate limits reset on restart
- **No session revocation** - Cannot revoke active JWT tokens
- **Ephemeral audit logs** - No persistent audit trail (console only)
- **Auto-generated JWT secrets** - Not suitable for multi-replica without configuration

## Production Recommendations

For production deployments:

1. **Enable authentication** - Set `UI_USERNAME` and `UI_PASSWORD`
2. **Use strong credentials** - Random, complex passwords (16+ characters)
3. **Configure JWT secret** - Set `JWT_SECRET` for multi-replica deployments
4. **Deploy behind HTTPS** - Use reverse proxy or Ingress with TLS
5. **Regular updates** - Subscribe to security advisories
6. **Security scanning** - Scan container images regularly
7. **Network isolation** - Restrict access with firewalls/network policies

See [Security Best Practices](./best-practices.md) for complete guide.

## Compliance

S4 provides features to support compliance requirements:

- **Authentication and authorization** - Control access to resources
- **Audit logging** - Console logs (external aggregation required)
- **Data encryption** - At rest (storage layer), in transit (HTTPS)
- **Access controls** - Network policies, RBAC (Kubernetes)

**Note**: S4 is designed for development and POC use. For production regulatory compliance (HIPAA, SOC2, etc.), additional implementation is required. See [Production Readiness](../deployment/production-readiness.md).

## Security Contacts

- **GitHub Issues**: https://github.com/rh-aiservices-bu/s4/issues
- **Security Advisories**: https://github.com/rh-aiservices-bu/s4/security/advisories
- **Maintainers**: See CONTRIBUTING.md

## Related Documentation

- [Authentication Guide](./authentication.md) - JWT and SSE authentication details
- [Vulnerability Management](./vulnerability-management.md) - Audit status and policy
- [Best Practices](./best-practices.md) - Security recommendations
- [Production Readiness](../deployment/production-readiness.md) - Production deployment checklist
