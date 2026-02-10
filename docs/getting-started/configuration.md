# Configuration

S4 is configured using environment variables. This guide covers essential configuration for getting started.

> **Complete Reference**: For all environment variables and advanced configuration, see [Deployment → Configuration Reference](../deployment/configuration.md).

## Basic Configuration

### Default Configuration

S4 works out of the box with sensible defaults:

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

This uses:

- S3 credentials: `s4admin` / `s4secret`
- Web UI port: `5000`
- S3 API port: `7480`
- No authentication on Web UI

### Custom S3 Credentials

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e AWS_ACCESS_KEY_ID=myadmin \
  -e AWS_SECRET_ACCESS_KEY=mysecretkey \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

### Enable Web UI Authentication

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e UI_USERNAME=admin \
  -e UI_PASSWORD=secure-password \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

When authentication is enabled:

- Users must log in to access the Web UI
- API requests require a valid JWT token
- Sessions expire after 8 hours (configurable)

## Common Configuration Scenarios

### External S3 Connection

Connect to AWS S3 or another S3-compatible service:

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -e AWS_S3_ENDPOINT=https://s3.amazonaws.com \
  -e AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE \
  -e AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  -e AWS_DEFAULT_REGION=us-east-1 \
  quay.io/rh-aiservices-bu/s4:latest
```

Note: When connecting to external S3, port 7480 is not needed.

### HuggingFace Model Import

Enable HuggingFace model import:

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e HF_TOKEN=hf_your_token_here \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

Get your HuggingFace token from: https://huggingface.co/settings/tokens

### Multiple Local Storage Paths

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e LOCAL_STORAGE_PATHS=/data1,/data2,/data3 \
  -v /host/data1:/data1 \
  -v /host/data2:/data2 \
  -v /host/data3:/data3 \
  -v s4-data:/var/lib/ceph/radosgw \
  quay.io/rh-aiservices-bu/s4:latest
```

### Behind Corporate Proxy

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e HTTP_PROXY=http://proxy.corp.com:8080 \
  -e HTTPS_PROXY=http://proxy.corp.com:8080 \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

### Custom Concurrency Limits

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e MAX_CONCURRENT_TRANSFERS=4 \
  -e MAX_FILE_SIZE_GB=50 \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

## Essential Environment Variables

| Variable                   | Default                 | Description              |
| -------------------------- | ----------------------- | ------------------------ |
| `AWS_ACCESS_KEY_ID`        | `s4admin`               | S3 access key            |
| `AWS_SECRET_ACCESS_KEY`    | `s4secret`              | S3 secret key            |
| `AWS_S3_ENDPOINT`          | `http://localhost:7480` | S3 endpoint URL          |
| `AWS_DEFAULT_REGION`       | `us-east-1`             | AWS region               |
| `PORT`                     | `5000`                  | Web UI port              |
| `UI_USERNAME`              | (none)                  | UI login username        |
| `UI_PASSWORD`              | (none)                  | UI login password        |
| `LOCAL_STORAGE_PATHS`      | (disabled)              | Local storage paths      |
| `HF_TOKEN`                 | (none)                  | HuggingFace API token    |
| `MAX_CONCURRENT_TRANSFERS` | `2`                     | Max concurrent transfers |
| `MAX_FILE_SIZE_GB`         | `20`                    | Max upload size (GB)     |

For a complete list, see [Deployment → Configuration Reference](../deployment/configuration.md).

## Using Environment Files

### Create Environment File

```bash
cat > s4.env << EOF
# S3 Configuration
AWS_ACCESS_KEY_ID=myadmin
AWS_SECRET_ACCESS_KEY=mysecretkey
AWS_DEFAULT_REGION=us-east-1

# Web UI Authentication
UI_USERNAME=admin
UI_PASSWORD=secure-password

# HuggingFace Integration
HF_TOKEN=hf_your_token_here

# Performance Tuning
MAX_CONCURRENT_TRANSFERS=4
MAX_FILE_SIZE_GB=50

# Local Storage
LOCAL_STORAGE_PATHS=/opt/app-root/src/data,/mnt/models
EOF
```

### Run with Environment File

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  --env-file s4.env \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

## Kubernetes Configuration

### Using Secrets

```bash
# Create secret from literals
kubectl create secret generic s4-credentials \
  --from-literal=AWS_ACCESS_KEY_ID=s4admin \
  --from-literal=AWS_SECRET_ACCESS_KEY=s4secret \
  --from-literal=UI_USERNAME=admin \
  --from-literal=UI_PASSWORD=secure-password \
  --from-literal=HF_TOKEN=hf_your_token_here
```

### Using ConfigMaps

```bash
# Create ConfigMap for non-sensitive config
kubectl create configmap s4-config \
  --from-literal=MAX_CONCURRENT_TRANSFERS=4 \
  --from-literal=MAX_FILE_SIZE_GB=50 \
  --from-literal=LOCAL_STORAGE_PATHS=/opt/app-root/src/data
```

### Reference in Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: s4
spec:
  template:
    spec:
      containers:
        - name: s4
          image: quay.io/rh-aiservices-bu/s4:latest
          envFrom:
            - secretRef:
                name: s4-credentials
            - configMapRef:
                name: s4-config
```

## Authentication Configuration

### Authentication Modes

S4 supports two authentication modes:

1. **Disabled** (default) - No authentication required

   - Remove or don't set `UI_USERNAME` and `UI_PASSWORD`
   - Suitable for development and trusted environments

2. **Enabled** - JWT-based authentication
   - Set both `UI_USERNAME` and `UI_PASSWORD`
   - Suitable for production and multi-user environments

### JWT Configuration

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -e UI_USERNAME=admin \
  -e UI_PASSWORD=secure-password \
  -e JWT_SECRET=your-secret-key-at-least-32-chars \
  -e JWT_EXPIRATION_HOURS=8 \  # Default: 8 hours
  -e SSE_TICKET_TTL_SECONDS=120 \
  -v s4-data:/var/lib/ceph/radosgw \
  -v s4-storage:/opt/app-root/src/data \
  quay.io/rh-aiservices-bu/s4:latest
```

| Variable                 | Default          | Description               |
| ------------------------ | ---------------- | ------------------------- |
| `JWT_SECRET`             | (auto-generated) | JWT signing secret        |
| `JWT_EXPIRATION_HOURS`   | `8`              | Token expiration in hours |
| `SSE_TICKET_TTL_SECONDS` | `60`             | SSE ticket TTL in seconds |

⚠️ **Production Note**: Always set `JWT_SECRET` explicitly in production to ensure consistent tokens across restarts and multiple replicas.

For detailed authentication documentation, see [Security → Authentication](../security/authentication.md).

## Runtime Configuration

Some settings can be changed at runtime via the Web UI or API:

### S3 Connection Settings

- Via Web UI: **Settings** → **S3 Connection**
- Via API: `PUT /api/settings/s3`

Note: Runtime settings are **not persisted** and will reset on container restart. Use environment variables for persistent configuration.

### HuggingFace Token

- Via Web UI: **Settings** → **HuggingFace**
- Via API: `PUT /api/settings/huggingface`

### Transfer Concurrency

- Via Web UI: **Settings** → **Advanced**
- Via API: `PUT /api/settings/max-concurrent-transfers`

## Validation

### Verify Configuration

```bash
# Check environment variables
podman exec s4 env | grep -E 'AWS|UI_|HF_|MAX_'

# Test S3 connection
curl -I http://localhost:7480

# Test Web UI
curl -I http://localhost:5000

# Test authentication (if enabled)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"secure-password"}'
```

### Common Configuration Errors

**Error**: S3 connection failed

```
Solution: Verify AWS_S3_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```

**Error**: Authentication not working

```
Solution: Ensure both UI_USERNAME and UI_PASSWORD are set (both required)
```

**Error**: HuggingFace import fails

```
Solution: Set HF_TOKEN with valid token from huggingface.co
```

## Next Steps

- **[Deployment](../deployment/README.md)** - Deploy to Kubernetes/OpenShift
- **[Security](../security/README.md)** - Security best practices
- **[API Reference](../api/README.md)** - Explore the API

## Further Reading

- [Deployment → Configuration Reference](../deployment/configuration.md) - Complete environment variable reference
- [Security → Authentication](../security/authentication.md) - Authentication details
- [Deployment → Production Readiness](../deployment/production-readiness.md) - Production configuration checklist
