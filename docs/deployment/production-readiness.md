# Production Readiness Guide

This document outlines requirements and considerations for deploying S4 to production.

## Executive Summary

S4 has undergone comprehensive cleanup and hardening for production readiness:

- ✅ **Security**: Header sanitization, input validation, credential protection
- ✅ **Type Safety**: Comprehensive TypeScript types, minimal `as any` usage
- ✅ **Code Quality**: Centralized utilities, consistent error handling
- ✅ **Logging**: Standardized logging patterns throughout

However, some features require additional implementation for production multi-instance deployments.

## Security Updates Status

### Completed Remediations (2026-01-29)

The following security vulnerabilities have been successfully addressed:

**Backend**:

1. **Removed @kubernetes/client-node** (v0.12.2)

   - Eliminated 2 CRITICAL SSRF vulnerabilities (CVE-2023-28155)
   - Eliminated 4 HIGH severity vulnerabilities
   - Package was unused in codebase

2. **Updated @fastify/multipart** (v7.7.3 → v8.3.1)

   - Fixed CVE-2025-24033 (GHSA-27c6-mcxv-x3fh)
   - HIGH severity: Resource exhaustion in `saveRequestFiles`

3. **Updated TypeScript ESLint** (v7.1.1 → v8.54.0)
   - Eliminated 8 MODERATE severity vulnerabilities

**Frontend**:

1. **Removed react-docgen-typescript-loader** - Eliminated 14 vulnerabilities
2. **Updated React Router** (7.9.6 → 7.13.0) - Fixed 3 HIGH/MODERATE vulnerabilities
3. **Updated transitive dependencies** - Fixed 8 additional vulnerabilities

### Current Audit Status

- **Backend**: 6 vulnerabilities (0 Critical, 0 High, 3 Moderate, 3 Low)
- **Frontend**: 1-5 vulnerabilities (0 High, 1 Moderate, 0-4 Low)
- **Reduction**: 94% improvement from initial audit

All remaining vulnerabilities are LOW or MODERATE severity in optional dev dependencies.

See [Vulnerability Management](../security/vulnerability-management.md) for complete audit details.

## Critical Requirements for Production

### 1. Rate Limiting

**Current State**: In-memory Map (resets on restart)

**Design Decision**: S4 uses in-memory rate limiting, which is appropriate for its single-replica deployment model. Rate limit state resets on container restart.

**Behavior**:

- Rate limit state lost on pod restart (acceptable)
- Not shared across replicas (S4 is single-replica by design)
- Hardcoded limits per operation type

**Implementation Priority**: ✅ COMPLETE (in-memory by design)

---

### 2. Audit Logging

**Current State**: Console-only structured logging (via pino logger)

**Design Decision**: S4 logs audit events to stdout as structured JSON. This is intentional:

- Container logs are automatically collected by Kubernetes
- Integrates with existing log aggregation (Fluentd, Loki, CloudWatch, etc.)
- No file system dependencies or permission issues
- Follows 12-factor app principles

**For Compliance Requirements**:

- Aggregate container logs to external SIEM (Splunk, ELK, etc.)
- Enable log retention policies at the infrastructure level
- Use immutable log storage for tamper-proofing

**Implementation**: `backend/src/utils/auditLog.ts`

**Implementation Priority**: ✅ COMPLETE (console-only by design)

**For External Integration**: Configure your log aggregation platform to collect stdout logs

---

### 3. Authentication & Authorization

**Current State**: Simple JWT with single admin user

**Issues**:

- Only supports single user (no multi-user support)
- No role-based access control (RBAC)
- JWT secrets auto-generated on startup (not suitable for multi-replica)
- No session revocation or token refresh

**Required Changes**:

- OAuth2/OIDC integration for enterprise identity providers
- Multi-factor authentication (MFA)
- Session management with revocation capabilities
- Role-based access control (admin, read-only, etc.)
- Shared JWT secret (via Kubernetes Secret) for multi-replica deployments
- Token refresh mechanism for long-lived sessions

**Implementation Priority**: 🔴 HIGH
**Effort**: ~5-7 days

**Workaround**:

- Set `JWT_SECRET` in Kubernetes Secret for multi-replica
- Use single admin account with strong password

---

### 4. Configuration Persistence

**Current State**: Ephemeral (runtime updates not persisted)

**Issues**:

- S3 configuration updates via `/api/settings` API lost on restart
- No configuration history or rollback capability

**Required Changes**:

- Persist runtime configuration to database or ConfigMap/Secret
- Implement configuration versioning and rollback
- Add validation before applying configuration changes
- Consider using Kubernetes Operators for declarative configuration

**Implementation Priority**: 🟠 MEDIUM-HIGH
**Effort**: ~2-3 days

**Workaround**: Configure via environment variables only

---

## Important Recommendations

### 5. Secrets Management

**Current State**: Environment variables or plain Kubernetes Secrets

**Recommended**:

- HashiCorp Vault integration
- AWS Secrets Manager / Azure Key Vault
- External Secrets Operator for Kubernetes
- Encrypted S3 credentials at rest

**Implementation Priority**: 🟠 MEDIUM
**Effort**: ~2-3 days

---

### 6. Monitoring & Observability

**Current State**: Basic console logging

**Recommended**:

- Application Performance Monitoring (APM) - New Relic, Datadog, Dynatrace
- Distributed tracing - OpenTelemetry, Jaeger, Zipkin
- Error tracking and alerting - Sentry, Rollbar
- Custom metrics and dashboards - Prometheus + Grafana
- Resource usage monitoring - CPU, memory, disk, network

**Implementation Priority**: 🟠 MEDIUM
**Effort**: ~3-4 days

See [Monitoring Guide](../operations/monitoring.md) for recommendations.

---

### 7. Security Hardening

**Current State**: Basic security measures in place

**Recommended Enhancements**:

- HTTPS enforcement (TLS termination at ingress or service mesh)
- CORS configuration review and tightening
- Rate limiting on ALL endpoints (not just auth)
- Request size limits and upload quotas
- Content Security Policy (CSP) headers
- OWASP Top 10 security controls
- Regular security scanning (Snyk, Trivy, etc.)
- Penetration testing before production launch

**Implementation Priority**: 🟠 MEDIUM-HIGH
**Effort**: ~3-5 days

See [Security Best Practices](../security/best-practices.md) for complete guide.

---

### 8. High Availability & Scalability

**Current State**: Single replica deployment

**Recommended**:

- Multi-replica deployment (3+ replicas)
- Pod Disruption Budgets (PDB)
- Horizontal Pod Autoscaling (HPA) based on CPU/memory
- Load balancing with session affinity (if needed)
- Health checks and readiness probes (already implemented)
- Graceful shutdown handling
- Database connection pooling (if adding database)

**Implementation Priority**: 🟠 MEDIUM
**Effort**: ~2-3 days

**Note**: Multi-replica requires shared JWT secret and ReadWriteMany storage or external S3.

---

## Environment Variables for Production

### Required Additions for Future Enhancements

```bash
# Authentication enhancements
OAUTH2_CLIENT_ID=<client-id>
OAUTH2_CLIENT_SECRET=<secret>
OAUTH2_ISSUER_URL=https://auth.example.com
MFA_ENABLED=true

# Secrets management
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=<token>
USE_EXTERNAL_SECRETS=true

# Monitoring
APM_SERVICE_NAME=s4-backend
APM_SERVER_URL=https://apm.example.com
SENTRY_DSN=https://sentry.example.com/project
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector:4317

# Performance
ENABLE_RESPONSE_CACHING=true
CACHE_TTL_SECONDS=300
ENABLE_COMPRESSION=true

# Multi-replica support
JWT_SECRET=<shared-secret-from-k8s-secret>  # REQUIRED for multi-replica
NODE_ENV=production
POD_NAME=${POD_NAME}  # Kubernetes downward API
POD_NAMESPACE=${POD_NAMESPACE}
```

## Migration Path (Phased Rollout)

### Phase 1: Security & Stability (Week 1-2)

1. Implement shared JWT secret (if using external load balancer)
2. Implement persistent audit logging
3. Security hardening review

### Phase 2: Infrastructure (Week 3-4)

5. Integrate secrets management (Vault/External Secrets)
6. Add monitoring and observability (APM, tracing, metrics)
7. Implement configuration persistence

### Phase 3: Scalability (Week 5-6)

8. Enable multi-replica deployment with HPA
9. Add health checks and graceful shutdown
10. Performance optimization (caching, compression)

### Phase 4: Enterprise Features (Week 7-8)

11. OAuth2/OIDC integration (if needed)
12. Role-based access control (if needed)
13. Backup and disaster recovery procedures

## Testing Requirements

Before each production deployment:

### 1. Security Testing

- OWASP ZAP or Burp Suite scan
- Dependency vulnerability scan (`npm audit`, Snyk)
- Container image scan (Trivy, Clair)

### 2. Performance Testing

- Load testing with realistic workloads (k6, JMeter)
- Stress testing to find breaking points
- Endurance testing for memory leaks

### 3. Disaster Recovery Testing

- Backup and restore procedures
- Failover testing
- Data corruption recovery

### 4. Compliance Testing

- Audit log verification
- Access control validation
- Data encryption verification

## Known Limitations

Document these limitations when planning production deployment:

1. **Single Admin User** - No multi-user support or RBAC
2. **Ephemeral Configuration** - Runtime updates not persisted
3. **In-Memory Rate Limiting** - Not suitable for multi-replica
4. **No Audit Trail** - Console logging only, not compliant
5. **Limited Error Recovery** - Basic retry logic for S3 operations
6. **SQLite Backend** - Ceph RGW uses SQLite (may not scale to millions of objects)
7. **No Database** - All state from S3/environment (no transfer history, user management)

## Production Deployment Checklist

Before deploying to production, ensure:

- [ ] **Authentication enabled** - `UI_USERNAME` and `UI_PASSWORD` set
- [ ] **Strong credentials** - Random, complex passwords (16+ characters)
- [ ] **JWT secret configured** - Shared secret for multi-replica (32+ characters)
- [ ] **HTTPS enabled** - TLS termination at ingress/load balancer
- [ ] **Secrets management** - Vault/External Secrets (or Kubernetes Secrets at minimum)
- [ ] **Monitoring configured** - APM, logging, alerting
- [ ] **Resource limits set** - CPU, memory limits defined
- [ ] **Persistent storage** - PVCs or external S3 configured
- [ ] **Backup strategy** - Regular backups scheduled and tested
- [ ] **Security scan complete** - No critical/high vulnerabilities
- [ ] **Load testing complete** - Meets performance SLAs
- [ ] **Disaster recovery plan** - Runbooks created and tested
- [ ] **On-call rotation** - Incident response plan established

## Minimum Production Configuration

### Using Helm (Recommended)

```yaml
# production-values.yaml
image:
  repository: quay.io/rh-aiservices-bu/s4
  tag: v1.0.0 # Pin to specific version
  pullPolicy: IfNotPresent

auth:
  enabled: true
  username: admin
  password: strong-random-password-16chars
  jwtSecret: shared-secret-min-32-characters-random

s3:
  accessKeyId: prod-s3-key
  secretAccessKey: prod-s3-secret

storage:
  data:
    size: 100Gi
    # storageClass: ""  # Leave empty to use cluster default
  localStorage:
    size: 500Gi
    # storageClass: ""  # Leave empty to use cluster default

resources:
  requests:
    memory: 1Gi
    cpu: 500m
  limits:
    memory: 4Gi
    cpu: 2000m

# For OpenShift
route:
  enabled: true
  tls:
    termination: edge

# For Kubernetes
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: s4.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: s4-tls
      hosts:
        - s4.example.com
```

```bash
helm install s4 ./charts/s4 -n s4 --create-namespace -f production-values.yaml
```

### Using Raw Manifests (Legacy)

```yaml
# kubernetes/production/s4-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: s4-credentials
stringData:
  AWS_ACCESS_KEY_ID: 'prod-s3-key'
  AWS_SECRET_ACCESS_KEY: 'prod-s3-secret'
  UI_USERNAME: 'admin'
  UI_PASSWORD: 'strong-random-password-16chars'
  JWT_SECRET: 'shared-secret-min-32-characters-random'

---
# kubernetes/production/s4-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: s4
spec:
  replicas: 1 # S4 is designed for single-replica deployment
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    spec:
      containers:
        - name: s4
          image: quay.io/rh-aiservices-bu/s4:v1.0.0 # Pin version
          envFrom:
            - secretRef:
                name: s4-credentials
            - configMapRef:
                name: s4-config
          resources:
            requests:
              memory: '1Gi'
              cpu: '500m'
            limits:
              memory: '4Gi'
              cpu: '2000m'
          readinessProbe:
            httpGet:
              path: /api/disclaimer
              port: 5000
            initialDelaySeconds: 15
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/disclaimer
              port: 5000
            initialDelaySeconds: 60
            periodSeconds: 30
```

## Support and Escalation

For production issues:

1. Check [Troubleshooting Guide](../operations/troubleshooting.md)
2. Review [FAQ](../operations/faq.md)
3. Search [GitHub Issues](https://github.com/rh-aiservices-bu/s4/issues)
4. Open new issue with production incident template

## Related Documentation

- [Configuration Guide](./configuration.md) - Environment variables reference
- [Kubernetes Deployment](./kubernetes.md) - Kubernetes deployment guide
- [Security Best Practices](../security/best-practices.md) - Security recommendations
- [Monitoring Guide](../operations/monitoring.md) - Monitoring and observability
- [Troubleshooting Guide](../operations/troubleshooting.md) - Common issues and solutions
