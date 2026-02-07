# Settings API

Configure S4 runtime settings: S3 connection, HuggingFace integration, proxy, and performance tuning.

## S3 Settings

### Get S3 Configuration

**GET /api/settings/s3**

```bash
curl http://localhost:5000/api/settings/s3 \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:

```json
{
  "settings": {
    "accessKeyId": "s4admin",
    "secretAccessKey": "***REDACTED***",
    "region": "us-east-1",
    "endpoint": "http://localhost:7480",
    "defaultBucket": "my-bucket"
  }
}
```

### Update S3 Configuration

**PUT /api/settings/s3**

```bash
curl -X PUT http://localhost:5000/api/settings/s3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accessKeyId": "newkey",
    "secretAccessKey": "newsecret",
    "region": "us-west-2",
    "endpoint": "https://s3.amazonaws.com",
    "defaultBucket": "data"
  }'
```

### Test S3 Connection

**POST /api/settings/test-s3**

```bash
curl -X POST http://localhost:5000/api/settings/test-s3 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accessKeyId": "testkey",
    "secretAccessKey": "testsecret",
    "region": "us-east-1",
    "endpoint": "http://localhost:7480"
  }'
```

---

## HuggingFace Settings

### Get HuggingFace Token

**GET /api/settings/huggingface**

```bash
curl http://localhost:5000/api/settings/huggingface \
  -H "Authorization: Bearer $TOKEN"
```

### Update HuggingFace Token

**PUT /api/settings/huggingface**

```bash
curl -X PUT http://localhost:5000/api/settings/huggingface \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hfToken": "hf_..."}'
```

### Test HuggingFace Connection

**POST /api/settings/test-huggingface**

```bash
curl -X POST http://localhost:5000/api/settings/test-huggingface \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hfToken": "hf_..."}'
```

---

## Disclaimer Settings

Manage application disclaimer acceptance status (internal metadata).

### Get Disclaimer Status

Returns current disclaimer acceptance status.

```bash
GET /api/settings/disclaimer
```

**Authentication**: Required when auth enabled

**Response**:

```json
{
  "disclaimer": {
    "status": "accepted"
  }
}
```

**Example**:

```bash
curl http://localhost:5000/api/settings/disclaimer \
  -H "Authorization: Bearer $TOKEN"
```

### Update Disclaimer Status

Update disclaimer acceptance status.

```bash
PUT /api/settings/disclaimer
Content-Type: application/json

{
  "status": "accepted"
}
```

**Authentication**: Required when auth enabled

**Response**:

```json
{
  "message": "Disclaimer status updated"
}
```

**Example**:

```bash
curl -X PUT http://localhost:5000/api/settings/disclaimer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'
```

**Storage Location**: `/opt/app-root/src/.local/share/s4/config` (ephemeral, resets without PVC)

**Status Values**: `"accepted"` (current implementation accepts any string value)

---

## Proxy Settings

### Get Proxy Configuration

**GET /api/settings/proxy**

### Update Proxy Configuration

**PUT /api/settings/proxy**

```bash
curl -X PUT http://localhost:5000/api/settings/proxy \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "httpProxy": "http://proxy.example.com:8080",
    "httpsProxy": "https://proxy.example.com:8443"
  }'
```

### Test Proxy Connection

**POST /api/settings/test-proxy**

```bash
curl -X POST http://localhost:5000/api/settings/test-proxy \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "httpProxy": "http://proxy:8080",
    "httpsProxy": "https://proxy:8443",
    "testUrl": "https://s3.amazonaws.com"
  }'
```

---

## Performance Settings

### Max Concurrent Transfers

**GET /api/settings/max-concurrent-transfers**

**PUT /api/settings/max-concurrent-transfers**

```bash
curl -X PUT http://localhost:5000/api/settings/max-concurrent-transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxConcurrentTransfers": 4}'
```

### Max Files Per Page

**GET /api/settings/max-files-per-page**

**PUT /api/settings/max-files-per-page**

```bash
curl -X PUT http://localhost:5000/api/settings/max-files-per-page \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxFilesPerPage": 1000}'
```
