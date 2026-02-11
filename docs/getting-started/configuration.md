# Configuration

S4 is configured using environment variables. This guide covers essential configuration for getting started.

> **Complete Reference**: For all environment variables, Kubernetes/OpenShift configuration, and advanced options, see [Deployment → Configuration Reference](../deployment/configuration.md).

## Basic Configuration

### Default Configuration

S4 works out of the box with sensible defaults:

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  -v s4-data:/var/lib/ceph/radosgw \
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
  quay.io/rh-aiservices-bu/s4:latest
```

When authentication is enabled:

- Users must log in to access the Web UI
- API requests require a valid JWT token
- Sessions expire after 8 hours (configurable)

For JWT options and details, see [Security → Authentication](../security/authentication.md).

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

## Using Environment Files

```bash
cat > s4.env << EOF
AWS_ACCESS_KEY_ID=myadmin
AWS_SECRET_ACCESS_KEY=mysecretkey
UI_USERNAME=admin
UI_PASSWORD=secure-password
HF_TOKEN=hf_your_token_here
LOCAL_STORAGE_PATHS=/opt/app-root/src/data,/mnt/models
EOF
```

```bash
podman run -d \
  --name s4 \
  -p 5000:5000 \
  -p 7480:7480 \
  --env-file s4.env \
  -v s4-data:/var/lib/ceph/radosgw \
  quay.io/rh-aiservices-bu/s4:latest
```

## Runtime Configuration

Some settings can be changed at runtime via the Web UI Settings page or API (e.g., S3 connection, HuggingFace token, transfer concurrency). Runtime settings are **not persisted** and will reset on container restart. Use environment variables for persistent configuration.

## Next Steps

- **[Deployment → Configuration Reference](../deployment/configuration.md)** - Complete environment variable reference, Kubernetes/OpenShift configuration, proxy settings, and concurrency tuning
- **[Security → Authentication](../security/authentication.md)** - JWT configuration and authentication details
- **[Operations → Troubleshooting](../operations/troubleshooting.md)** - Configuration validation and common errors
- **[Deployment](../deployment/README.md)** - Deploy to Kubernetes/OpenShift
