# S4 Helm Chart

S4 (Super Simple Storage Service) is a lightweight, self-contained S3-compatible storage solution.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.x
- PV provisioner support in the underlying infrastructure (for persistent storage)

## Installation

### Quick Start

```bash
# Clone the repository
git clone https://github.com/rh-aiservices-bu/s4.git
cd s4

# Install with authentication (required by default)
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set auth.username=admin \
  --set auth.password=your-secure-password

# Install with custom values
helm install s4 ./charts/s4 --namespace s4 --create-namespace -f my-values.yaml
```

## Uninstallation

```bash
helm uninstall s4 --namespace s4
```

**Note:** PersistentVolumeClaims are not deleted automatically. To remove all data:

```bash
kubectl delete pvc -l app.kubernetes.io/instance=s4 -n s4
```

## Configuration

The following table lists the configurable parameters and their default values.

### Image Configuration

| Parameter          | Description                | Default                       |
| ------------------ | -------------------------- | ----------------------------- |
| `image.repository` | Container image repository | `quay.io/rh-aiservices-bu/s4` |
| `image.tag`        | Container image tag        | `latest`                      |
| `image.pullPolicy` | Image pull policy          | `Always`                      |
| `imagePullSecrets` | Image pull secrets         | `[]`                          |

### S3 Configuration

| Parameter            | Description                            | Default                 |
| -------------------- | -------------------------------------- | ----------------------- |
| `s3.endpoint`        | S3 endpoint URL                        | `http://localhost:7480` |
| `s3.region`          | S3 region                              | `us-east-1`             |
| `s3.accessKeyId`     | S3 access key ID                       | `s4admin`               |
| `s3.secretAccessKey` | S3 secret access key                   | `s4secret`              |
| `s3.existingSecret`  | Use existing secret for S3 credentials | `""`                    |

### Authentication Configuration

| Parameter                 | Description                              | Default |
| ------------------------- | ---------------------------------------- | ------- |
| `auth.enabled`            | Enable UI authentication                 | `true`  |
| `auth.username`           | Username for UI login                    | `""`    |
| `auth.password`           | Password for UI login                    | `""`    |
| `auth.jwtSecret`          | JWT secret key (auto-generated if empty) | `""`    |
| `auth.jwtExpirationHours` | JWT token expiration in hours            | `8`     |
| `auth.cookieRequireHttps` | Require HTTPS for cookies                | `true`  |

### Storage Configuration

| Parameter                            | Description                        | Default         |
| ------------------------------------ | ---------------------------------- | --------------- |
| `storage.localPaths`                 | Local storage paths                | `""` (disabled) |
| `storage.maxFileSizeGB`              | Maximum file size in GB            | `20`            |
| `storage.maxConcurrentTransfers`     | Maximum concurrent transfers       | `2`             |
| `storage.data.size`                  | RGW data volume size               | `10Gi`          |
| `storage.data.storageClass`          | Storage class for data volume      | `""`            |
| `storage.data.existingClaim`         | Use existing PVC for data          | `""`            |
| `storage.localStorage.enabled`       | Enable local storage volume        | `false`         |
| `storage.localStorage.size`          | Local storage volume size          | `50Gi`          |
| `storage.localStorage.storageClass`  | Storage class for local storage    | `""`            |
| `storage.localStorage.existingClaim` | Use existing PVC for local storage | `""`            |

### Resource Configuration

| Parameter                   | Description    | Default |
| --------------------------- | -------------- | ------- |
| `resources.requests.cpu`    | CPU request    | `250m`  |
| `resources.requests.memory` | Memory request | `512Mi` |
| `resources.limits.cpu`      | CPU limit      | `2000m` |
| `resources.limits.memory`   | Memory limit   | `2Gi`   |

### Service Configuration

| Parameter                  | Description                        | Default     |
| -------------------------- | ---------------------------------- | ----------- |
| `service.type`             | Service type                       | `ClusterIP` |
| `service.port`             | Web UI port                        | `5000`      |
| `service.s3Port`           | S3 API port                        | `7480`      |
| `service.nodePort.enabled` | Enable additional NodePort service | `false`     |
| `service.nodePort.webPort` | NodePort for web UI                | `""`        |
| `service.nodePort.s3Port`  | NodePort for S3 API                | `""`        |

### Ingress Configuration

| Parameter             | Description                 | Default |
| --------------------- | --------------------------- | ------- |
| `ingress.enabled`     | Enable ingress              | `false` |
| `ingress.className`   | Ingress class name          | `""`    |
| `ingress.annotations` | Ingress annotations         | `{}`    |
| `ingress.hosts`       | Ingress hosts configuration | `[]`    |
| `ingress.tls`         | Ingress TLS configuration   | `[]`    |

### OpenShift Route Configuration

| Parameter                                 | Description            | Default    |
| ----------------------------------------- | ---------------------- | ---------- |
| `route.enabled`                           | Enable OpenShift Route | `true`     |
| `route.host`                              | Route hostname         | `""`       |
| `route.path`                              | Route path             | `""`       |
| `route.tls.termination`                   | TLS termination type   | `edge`     |
| `route.tls.insecureEdgeTerminationPolicy` | Insecure edge policy   | `Redirect` |

### Security Configuration

| Parameter                                  | Description                | Default |
| ------------------------------------------ | -------------------------- | ------- |
| `serviceAccount.create`                    | Create service account     | `true`  |
| `serviceAccount.name`                      | Service account name       | `""`    |
| `podSecurityContext.runAsNonRoot`          | Run as non-root            | `true`  |
| `podSecurityContext.fsGroup`               | File system group          | `0`     |
| `securityContext.allowPrivilegeEscalation` | Allow privilege escalation | `false` |
| `securityContext.runAsNonRoot`             | Run as non-root            | `true`  |

## Examples

> **Note:** All installation examples below require authentication credentials (`--set auth.username=... --set auth.password=...`) unless `--set auth.enabled=false` is specified.

### Basic Installation

Authentication is enabled by default and requires credentials:

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set auth.username=admin \
  --set auth.password=your-secure-password
```

### Without Authentication

To disable authentication:

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set auth.enabled=false
```

### With OpenShift Route (Default)

OpenShift Route is enabled by default. To customize the hostname:

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set route.host=s4.apps.example.com
```

### With Kubernetes Ingress

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set ingress.enabled=true \
  --set "ingress.hosts[0].host=s4.example.com" \
  --set "ingress.hosts[0].paths[0].path=/" \
  --set "ingress.hosts[0].paths[0].pathType=Prefix"
```

### With Custom Storage

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set storage.data.size=100Gi \
  --set storage.data.storageClass=fast-storage
```

### With Local File Browser

Local storage is disabled by default. To enable local file browsing:

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set storage.localStorage.enabled=true \
  --set storage.localPaths=/opt/app-root/src/data \
  --set storage.localStorage.size=500Gi \
  --set storage.localStorage.storageClass=fast-storage
```

### Using Existing PVCs

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set storage.data.existingClaim=my-existing-data-pvc
```

For local storage with an existing PVC:

```bash
helm install s4 ./charts/s4 --namespace s4 --create-namespace \
  --set storage.localStorage.enabled=true \
  --set storage.localPaths=/opt/app-root/src/data \
  --set storage.localStorage.existingClaim=my-existing-storage-pvc
```

### Using Existing Secret

```bash
# Create secret first
kubectl create secret generic my-s4-credentials \
  --from-literal=AWS_ACCESS_KEY_ID=mykey \
  --from-literal=AWS_SECRET_ACCESS_KEY=mysecret \
  -n s4

# Install using existing secret
helm install s4 ./charts/s4 --namespace s4 \
  --set s3.existingSecret=my-s4-credentials
```

## Upgrading

```bash
# Upgrade with new values
helm upgrade s4 ./charts/s4 --namespace s4 -f my-values.yaml

# Upgrade to new chart version
helm upgrade s4 ./charts/s4 --namespace s4 --reuse-values
```

## Accessing S4

### Port Forward (Development)

```bash
kubectl port-forward svc/s4 5000:5000 7480:7480 -n s4
```

Then access:

- Web UI: http://localhost:5000
- S3 API: http://localhost:7480

### NodePort

If `service.nodePort.enabled=true`, access via node IP and assigned ports.

### Ingress/Route

If configured, access via the specified hostname.

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n s4 -l app.kubernetes.io/name=s4
kubectl logs -n s4 -l app.kubernetes.io/name=s4
```

### Check Events

```bash
kubectl get events -n s4 --sort-by='.lastTimestamp'
```

### Verify Configuration

```bash
kubectl get configmap -n s4 -l app.kubernetes.io/name=s4 -o yaml
kubectl get secret -n s4 -l app.kubernetes.io/name=s4
```
