# Deployment Guide

S4 can be deployed as a standalone container or in Kubernetes/OpenShift environments.

## Deployment Options

### 1. Container Deployment (Docker/Podman)

Best for:

- Development and testing
- Single-server deployments
- Quick POCs and demos
- Local development environments

[View Docker/Podman Deployment Guide](./docker.md)

### 2. Kubernetes Deployment (Helm - Recommended)

Best for:

- Production environments
- GitOps workflows
- Easy configuration management
- Kubernetes and OpenShift deployments

[View Kubernetes Deployment Guide](./kubernetes.md) | [Helm Chart README](../charts/s4/README.md)

### 3. OpenShift Deployment

Best for:

- Red Hat OpenShift environments
- Enterprise deployments
- Enhanced security requirements
- Integration with OpenShift ecosystem

[View OpenShift Deployment Guide](./openshift.md)

## Quick Start

### Docker/Podman

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

### Kubernetes (Helm)

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set auth.username=admin \
  --set auth.password=your-secure-password
kubectl port-forward svc/s4 5000:5000 7480:7480 -n s4
```

### Kubernetes (Raw Manifests)

```bash
kubectl apply -f kubernetes/
kubectl port-forward svc/s4 5000:5000 7480:7480
```

### OpenShift

```bash
oc apply -f kubernetes/
oc expose svc/s4
```

## Architecture Overview

S4 runs as a single container with two processes:

1. **Ceph RGW** (port 7480) - S3-compatible API with SQLite backend
2. **Node.js backend** (port 5000) - Fastify server serving React frontend and API

```
┌─────────────────────────────────────────────┐
│                S4 Container                  │
├─────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐ │
│  │   Web UI (5000) │  │  S3 API (7480)   │ │
│  │   Node.js +     │  │   Ceph RGW +     │ │
│  │   React         │  │   SQLite         │ │
│  └────────┬────────┘  └────────┬─────────┘ │
│           │                    │            │
│           └────────────────────┘            │
│                    │                        │
│  ┌─────────────────┴──────────────────────┐│
│  │           Persistent Storage            ││
│  │  /var/lib/ceph/radosgw (S3 data)       ││
│  │  /opt/app-root/src/data (local files)  ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

## Configuration

S4 is configured via environment variables. See [Configuration Guide](./configuration.md) for complete reference.

### Essential Variables

| Variable                | Default    | Description                      |
| ----------------------- | ---------- | -------------------------------- |
| `AWS_ACCESS_KEY_ID`     | `s4admin`  | S3 access key                    |
| `AWS_SECRET_ACCESS_KEY` | `s4secret` | S3 secret key                    |
| `UI_USERNAME`           | (none)     | UI login username (enables auth) |
| `UI_PASSWORD`           | (none)     | UI login password (enables auth) |
| `PORT`                  | `5000`     | Web UI port                      |

## Storage Volumes

S4 requires two persistent volumes:

1. **S3 Data** - `/var/lib/ceph/radosgw`

   - Stores S3 bucket metadata and objects
   - SQLite database for RGW
   - Must persist across restarts

2. **Local Storage** - `/opt/app-root/src/data`
   - Local filesystem storage
   - File browser and transfer source/destination
   - Optional but recommended

## Networking

### Ports

- **5000** - Web UI (HTTP)
- **7480** - S3 API (HTTP)

### External Access

**Container**:

- Publish ports with `-p 5000:5000 -p 7480:7480`

**Kubernetes**:

- Service exposes ports
- Use Ingress for external HTTPS access

**OpenShift**:

- Service exposes ports
- Use Route for external HTTPS access

## Authentication

S4 supports optional JWT-based authentication:

### Disabled (Default)

No authentication required. Suitable for:

- Development environments
- Internal networks
- Trusted environments

### Enabled

Set both `UI_USERNAME` and `UI_PASSWORD` to enable authentication:

```bash
# Docker/Podman
-e UI_USERNAME=admin \
-e UI_PASSWORD=your-secure-password

# Kubernetes
# Add to Secret (see kubernetes/s4-secret.yaml)
```

See [Configuration Guide](./configuration.md) for authentication details.

## Production Considerations

Before deploying to production, review:

1. **[Production Readiness Guide](./production-readiness.md)** - Critical deployment considerations
2. **[Configuration Guide](./configuration.md)** - Complete environment variable reference
3. **[Security Best Practices](../security/best-practices.md)** - Security recommendations

### Key Production Requirements

- ✅ Enable authentication (`UI_USERNAME` and `UI_PASSWORD`)
- ✅ Use strong credentials and JWT secrets
- ✅ Deploy behind HTTPS (reverse proxy or ingress)
- ✅ Configure persistent storage
- ✅ Set up monitoring and logging
- ✅ Plan backup strategy

See [Production Readiness Guide](./production-readiness.md) for complete checklist.

## Choosing Deployment Method

### Use Container Deployment When

- Development and testing
- Single-server deployment
- Simple POCs and demos
- Learning and evaluation
- No orchestration required

### Use Kubernetes/OpenShift When

- Production environments
- High availability needed
- Auto-scaling required
- Multiple replicas needed
- Enterprise deployment

## Next Steps

1. Choose deployment method:

   - [Docker/Podman](./docker.md)
   - [Kubernetes](./kubernetes.md)
   - [OpenShift](./openshift.md)

2. Review [Configuration Guide](./configuration.md)

3. Check [Production Readiness Guide](./production-readiness.md)

4. Set up [monitoring and operations](../operations/monitoring.md)

## Related Documentation

- [Configuration Guide](./configuration.md) - Environment variables
- [Production Readiness](./production-readiness.md) - Production deployment checklist
- [Docker Deployment](./docker.md) - Container deployment details
- [Kubernetes Deployment](./kubernetes.md) - Kubernetes deployment details
- [OpenShift Deployment](./openshift.md) - OpenShift deployment details
- [Security Best Practices](../security/best-practices.md) - Security recommendations
