# Objects API

Manage S3 objects: upload, download, list, delete, and view operations.

## Base64 Encoding

All object keys and paths in URLs **must be Base64-encoded** to safely handle special characters (slashes, spaces, etc.).

**Encoding**:

```bash
# Linux/macOS
echo -n "models/llama-2-7b/config.json" | base64 | tr '+/' '-_' | tr -d '='

# Result: bW9kZWxzL2xsYW1hLTItN2IvY29uZmlnLmpzb24
```

**Decoding** (backend handles automatically):

```javascript
const decoded = Buffer.from(encoded, 'base64').toString('utf8');
```

---

## List Objects

List objects in a bucket with optional prefix filtering and pagination.

**Endpoint**: `GET /api/objects/:bucketName[/:encodedPrefix]`

**Authentication**: Required (when enabled)

**URL Parameters**:

- `bucketName` - Bucket name (not encoded)
- `encodedPrefix` - Base64-encoded prefix (optional)

**Query Parameters**:

- `maxKeys` - Maximum objects to return (default: 500, max: 2000)
- `continuationToken` - Token for pagination
- `q` - Search query (filename matching)
- `mode` - Search mode: `startsWith` or `contains` (default: `contains`)
- `autoBroaden` - Auto-switch to contains if startsWith returns no results (default: `false`)

**Request**:

```bash
# List all objects in bucket
curl "http://localhost:5000/api/objects/my-bucket" \
  -H "Authorization: Bearer $TOKEN"

# List with prefix (encoded)
prefix=$(echo -n "models/" | base64 | tr '+/' '-_' | tr -d '=')
curl "http://localhost:5000/api/objects/my-bucket/$prefix" \
  -H "Authorization: Bearer $TOKEN"

# Search for files containing "config"
curl "http://localhost:5000/api/objects/my-bucket?q=config&mode=contains" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "objects": [
    {
      "Key": "models/config.json",
      "LastModified": "2024-01-15T10:30:00.000Z",
      "Size": 1024,
      "ETag": "\"abc123...\"",
      "StorageClass": "STANDARD"
    }
  ],
  "prefixes": [
    {
      "Prefix": "models/llama-2-7b/"
    }
  ],
  "isTruncated": true,
  "nextContinuationToken": "TOKEN_FOR_NEXT_PAGE",
  "filter": {
    "q": "config",
    "mode": "contains",
    "matches": {
      "objects": {
        "models/config.json": [[7, 13]]
      }
    },
    "scanPages": 3,
    "partialResult": false
  }
}
```

**Search Modes**:

- `startsWith` - Fast, matches beginning of filename
- `contains` - Slower, scans multiple pages, rate-limited (5/min)

---

## Upload Object

Upload a file to S3 with streaming support and real-time progress.

**Endpoint**: `POST /api/objects/upload/:bucketName/:encodedKey`

**Authentication**: Required (when enabled)

**URL Parameters**:

- `bucketName` - Bucket name (not encoded)
- `encodedKey` - Base64-encoded object key

**Request**:

```bash
# Upload file
key=$(echo -n "models/config.json" | base64 | tr '+/' '-_' | tr -d '=')
curl -X POST "http://localhost:5000/api/objects/upload/my-bucket/$key" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@config.json"
```

**Response** (200 OK):

```json
{
  "message": "Upload successful",
  "key": "models/config.json",
  "bucket": "my-bucket"
}
```

**Upload Progress (SSE)**:

```javascript
// 1. Get SSE ticket
const ticketResponse = await fetch('/api/auth/sse-ticket', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    resource: encodedKey,
    resourceType: 'upload',
  }),
});
const { ticket } = await ticketResponse.json();

// 2. Create EventSource with ticket
const eventSource = new EventSource(`/api/objects/upload-progress/${encodedKey}?ticket=${ticket}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`Uploaded: ${data.loaded} / ${data.total} bytes`);
};
```

**Error Responses**:

**413 Payload Too Large**:

```json
{
  "error": "PayloadTooLarge",
  "message": "File size exceeds maximum limit of 20GB"
}
```

**507 Insufficient Storage**:

```json
{
  "error": "InsufficientStorage",
  "message": "Not enough disk space"
}
```

---

## Download Object

Download an object from S3 with streaming support.

**Endpoint**: `GET /api/objects/download/:bucketName/:encodedKey`

**Authentication**: Required (when enabled)

**URL Parameters**:

- `bucketName` - Bucket name (not encoded)
- `encodedKey` - Base64-encoded object key

**Request**:

```bash
key=$(echo -n "models/config.json" | base64 | tr '+/' '-_' | tr -d '=')
curl "http://localhost:5000/api/objects/download/my-bucket/$key" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded.json
```

**Response Headers**:

```
Content-Type: application/json
Content-Length: 1024
Content-Disposition: attachment; filename="config.json"
```

**Response Body**: File content (streamed)

**Error Responses**:

**404 Not Found**:

```json
{
  "error": "NoSuchKey",
  "message": "The specified key does not exist"
}
```

---

## Delete Object

Delete an object or folder (with all contents) from S3.

**Endpoint**: `DELETE /api/objects/:bucketName/:encodedKey`

**Authentication**: Required (when enabled)

**URL Parameters**:

- `bucketName` - Bucket name (not encoded)
- `encodedKey` - Base64-encoded object key or prefix

**Request**:

```bash
# Delete single object
key=$(echo -n "models/config.json" | base64 | tr '+/' '-_' | tr -d '=')
curl -X DELETE "http://localhost:5000/api/objects/my-bucket/$key" \
  -H "Authorization: Bearer $TOKEN"

# Delete folder (all objects with prefix)
prefix=$(echo -n "models/old/" | base64 | tr '+/' '-_' | tr -d '=')
curl -X DELETE "http://localhost:5000/api/objects/my-bucket/$prefix" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Deleted successfully",
  "deleted": [
    { "Key": "models/config.json", "success": true },
    { "Key": "models/weights.bin", "success": true }
  ]
}
```

**Folder Deletion**:

- Deletes all objects with the given prefix
- Uses batch delete (up to 1000 objects per request)
- Returns success/failure for each object

---

## View Object

Get object metadata and content preview.

**Endpoint**: `GET /api/objects/view/:bucketName/:encodedKey`

**Authentication**: Required (when enabled)

**URL Parameters**:

- `bucketName` - Bucket name (not encoded)
- `encodedKey` - Base64-encoded object key

**Request**:

```bash
key=$(echo -n "models/config.json" | base64 | tr '+/' '-_' | tr -d '=')
curl "http://localhost:5000/api/objects/view/my-bucket/$key" \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "metadata": {
    "key": "models/config.json",
    "size": 1024,
    "lastModified": "2024-01-15T10:30:00.000Z",
    "contentType": "application/json",
    "etag": "\"abc123...\""
  },
  "preview": {
    "available": true,
    "content": "{\n  \"model\": \"llama-2-7b\",\n  ...\n}",
    "truncated": false
  }
}
```

**Preview Support**:

- Text files: Full content up to 1MB
- JSON: Formatted with syntax highlighting
- Images: Base64-encoded data URL
- Binary files: No preview (`available: false`)

---

## HuggingFace Import

Import a model from HuggingFace Hub to S3.

**Endpoint**: `POST /api/objects/huggingface-import`

**Authentication**: Required (when enabled)

**Request Body**:

```json
{
  "bucketName": "models",
  "hfRepoId": "meta-llama/Llama-2-7b-hf",
  "s3Prefix": "llama-2-7b"
}
```

**Request**:

```bash
curl -X POST http://localhost:5000/api/objects/huggingface-import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bucketName": "models",
    "hfRepoId": "meta-llama/Llama-2-7b-hf",
    "s3Prefix": "llama-2-7b"
  }'
```

**Response** (200 OK):

```json
{
  "message": "Import started",
  "jobId": "import-abc123",
  "estimatedFiles": 15,
  "estimatedSize": 13500000000
}
```

**Requirements**:

- HuggingFace token configured (`HF_TOKEN` environment variable or `/api/settings/huggingface`)
- Sufficient storage space
- Valid HuggingFace repository ID

**Progress Tracking**:
Use transfer progress API with returned `jobId`.

---

## Upload Progress (SSE)

Real-time upload progress via Server-Sent Events.

**Endpoint**: `GET /api/objects/upload-progress/:encodedKey?ticket=TICKET`

**Authentication**: One-time ticket (obtained from `/api/auth/sse-ticket`)

**Request**:

```javascript
const eventSource = new EventSource(`/api/objects/upload-progress/${encodedKey}?ticket=${ticket}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // { loaded: 512000, total: 1048576, status: 'uploading' }
};
```

**Event Format**:

```json
{
  "loaded": 512000,
  "total": 1048576,
  "status": "uploading"
}
```

**Status Values**:

- `idle` - Not started
- `queued` - Waiting for slot
- `uploading` - In progress
- `completed` - Upload finished

---

## Common Use Cases

### Upload with Progress

```javascript
// 1. Get SSE ticket
const ticketResp = await fetch('/api/auth/sse-ticket', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    resource: encodedKey,
    resourceType: 'upload',
  }),
});
const { ticket } = await ticketResp.json();

// 2. Start upload
const formData = new FormData();
formData.append('file', file);

const uploadPromise = fetch(`/api/objects/upload/my-bucket/${encodedKey}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

// 3. Track progress
const eventSource = new EventSource(`/api/objects/upload-progress/${encodedKey}?ticket=${ticket}`);

eventSource.onmessage = (event) => {
  const { loaded, total, status } = JSON.parse(event.data);
  const percent = ((loaded / total) * 100).toFixed(2);
  console.log(`Upload progress: ${percent}% (${status})`);

  if (status === 'completed') {
    eventSource.close();
  }
};

await uploadPromise;
```

### Download Large File

```bash
# Stream download to file
key=$(echo -n "models/weights.bin" | base64 | tr '+/' '-_' | tr -d '=')
curl "http://localhost:5000/api/objects/download/my-bucket/$key" \
  -H "Authorization: Bearer $TOKEN" \
  -o weights.bin
```

### Delete Folder Recursively

```bash
# Delete all objects in "old-models/" prefix
prefix=$(echo -n "old-models/" | base64 | tr '+/' '-_' | tr -d '=')
curl -X DELETE "http://localhost:5000/api/objects/my-bucket/$prefix" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Rate Limiting

**Contains Search**: 5 requests per minute (prevents DoS)

Other object operations are not rate-limited.

---

## Related Endpoints

- **[Buckets API](buckets.md)** - Manage buckets
- **[Transfer API](transfer.md)** - Transfer files between storage
- **[Settings API](settings.md)** - Configure HuggingFace token
