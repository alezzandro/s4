# Transfer API

Manage cross-storage file transfers (S3 ↔ Local) with real-time progress tracking.

## Overview

The Transfer API enables efficient file transfers between S3 buckets and local storage with:

- Streaming transfers (no intermediate storage)
- Concurrent file transfers (configurable limit)
- Real-time progress via Server-Sent Events (SSE)
- Conflict detection and resolution
- Cancellation support

---

## Create Transfer

Initiate a file transfer between storage locations.

**Endpoint**: `POST /api/transfer`

**Authentication**: Required (when enabled)

**Request Body**:

```json
{
  "source": {
    "type": "s3",
    "locationId": "my-bucket",
    "path": "models/"
  },
  "destination": {
    "type": "local",
    "locationId": "local-0",
    "path": "/datasets"
  },
  "items": [
    { "path": "config.json", "type": "file" },
    { "path": "weights/", "type": "directory" }
  ],
  "conflictResolution": "skip"
}
```

**Fields**:

- `source.type` - Storage type: `s3` or `local`
- `source.locationId` - Bucket name or location ID
- `source.path` - Base path (relative paths in items)
- `destination.*` - Same structure as source
- `items` - Array of files/directories to transfer
- `conflictResolution` - How to handle conflicts: `overwrite`, `skip`, or `rename`

**Request**:

```bash
curl -X POST http://localhost:5000/api/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "type": "s3",
      "locationId": "my-bucket",
      "path": "models/"
    },
    "destination": {
      "type": "local",
      "locationId": "local-0",
      "path": "/backup"
    },
    "items": [
      { "path": "config.json", "type": "file" }
    ],
    "conflictResolution": "skip"
  }'
```

**Response** (200 OK):

```json
{
  "jobId": "transfer-abc123",
  "status": "pending",
  "filesQueued": 15,
  "estimatedBytes": 1048576000
}
```

---

## Transfer Progress (SSE)

Monitor transfer progress in real-time via Server-Sent Events.

**Endpoint**: `GET /api/transfer/progress/:jobId?ticket=TICKET`

**Authentication**: One-time ticket (obtained from `/api/auth/sse-ticket`)

**URL Parameters**:

- `jobId` - Transfer job ID

**Query Parameters**:

- `ticket` - One-time SSE authentication ticket

**Example**:

```javascript
// 1. Get SSE ticket
const ticketResp = await fetch('/api/auth/sse-ticket', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    resource: jobId,
    resourceType: 'transfer',
  }),
});
const { ticket } = await ticketResp.json();

// 2. Create EventSource
const eventSource = new EventSource(`/api/transfer/progress/${jobId}?ticket=${ticket}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Event Format**:

```json
{
  "type": "progress",
  "job": {
    "id": "transfer-abc123",
    "status": "in_progress",
    "filesCompleted": 5,
    "totalFiles": 10,
    "bytesTransferred": 524288000,
    "totalBytes": 1048576000,
    "startTime": 1642234567890,
    "errors": []
  },
  "currentFile": {
    "path": "models/weights.bin",
    "loaded": 262144000,
    "total": 524288000,
    "status": "transferring"
  }
}
```

**Status Values**:

- `pending` - Queued, not started
- `in_progress` - Actively transferring
- `completed` - All files transferred
- `cancelled` - Transfer cancelled by user
- `failed` - Transfer failed with errors

**Event Types**:

- `progress` - Transfer progress update
- `complete` - Transfer finished
- `error` - Error occurred
- `cancelled` - Transfer was cancelled

---

## Cancel Transfer

Cancel an in-progress or pending transfer.

**Endpoint**: `POST /api/transfer/cancel/:jobId`

**Authentication**: Required (when enabled)

**URL Parameters**:

- `jobId` - Transfer job ID

**Request**:

```bash
curl -X POST http://localhost:5000/api/transfer/cancel/transfer-abc123 \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Transfer cancelled",
  "jobId": "transfer-abc123",
  "filesCompleted": 5,
  "totalFiles": 10
}
```

**Notes**:

- Gracefully stops transfer after current file completes
- Does not rollback already transferred files
- Job status becomes `cancelled`

---

## Clean Up Transfer

Remove transfer job from memory after completion.

**Endpoint**: `POST /api/transfer/cleanup/:jobId`

**Authentication**: Required (when enabled)

**URL Parameters**:

- `jobId` - Transfer job ID

**Request**:

```bash
curl -X POST http://localhost:5000/api/transfer/cleanup/transfer-abc123 \
  -H "Authorization: Bearer $TOKEN"
```

**Response** (200 OK):

```json
{
  "message": "Transfer job cleaned up",
  "jobId": "transfer-abc123"
}
```

**Notes**:

- Removes job from active transfers
- Frees memory
- Cannot cleanup transfers still in progress

---

## Check Conflicts

Check for file conflicts before starting a transfer.

**Endpoint**: `POST /api/transfer/check-conflicts`

**Authentication**: Required (when enabled)

**Request Body**:

```json
{
  "source": {
    "type": "s3",
    "locationId": "my-bucket",
    "path": "models/"
  },
  "destination": {
    "type": "local",
    "locationId": "local-0",
    "path": "/datasets"
  },
  "items": [
    { "path": "config.json", "type": "file" },
    { "path": "weights/", "type": "directory" }
  ]
}
```

**Request**:

```bash
curl -X POST http://localhost:5000/api/transfer/check-conflicts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type": application/json" \
  -d '{
    "source": {"type": "s3", "locationId": "my-bucket", "path": "models/"},
    "destination": {"type": "local", "locationId": "local-0", "path": "/backup"},
    "items": [{"path": "config.json", "type": "file"}]
  }'
```

**Response** (200 OK):

```json
{
  "conflicts": ["models/config.json", "models/weights.bin"],
  "nonConflicting": ["models/tokenizer.json"],
  "warning": {
    "type": "large_folder",
    "fileCount": 1500,
    "totalSize": 15000000000,
    "message": "This folder contains 1500 files (14 GB). Transfer may take significant time."
  }
}
```

**Fields**:

- `conflicts` - Files that exist in both source and destination
- `nonConflicting` - Files only in source (no conflicts)
- `warning` - Optional warning for large transfers (>1000 files or >10GB)

---

## Transfer Workflows

### Complete Transfer with Progress

```javascript
// 1. Create transfer
const createResp = await fetch('/api/transfer', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(transferRequest),
});
const { jobId } = await createResp.json();

// 2. Get SSE ticket
const ticketResp = await fetch('/api/auth/sse-ticket', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    resource: jobId,
    resourceType: 'transfer',
  }),
});
const { ticket } = await ticketResp.json();

// 3. Track progress
const eventSource = new EventSource(`/api/transfer/progress/${jobId}?ticket=${ticket}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'complete') {
    console.log('Transfer completed!');
    eventSource.close();
  } else if (data.type === 'progress') {
    const percent = ((data.job.bytesTransferred / data.job.totalBytes) * 100).toFixed(2);
    console.log(`Progress: ${percent}%`);
  }
};

eventSource.onerror = () => {
  console.error('Connection lost');
  eventSource.close();
};
```

### Check Conflicts Before Transfer

```bash
# 1. Check for conflicts
conflicts_response=$(curl -s -X POST http://localhost:5000/api/transfer/check-conflicts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$transfer_request")

conflicts=$(echo "$conflicts_response" | jq -r '.conflicts | length')

# 2. Decide conflict resolution
if [ "$conflicts" -gt 0 ]; then
  echo "Found $conflicts conflicts. Choose resolution: skip, overwrite, or rename"
  # Update transfer request with chosen resolution
fi

# 3. Start transfer
curl -X POST http://localhost:5000/api/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$transfer_request"
```

### Cancel Long-Running Transfer

```bash
# Cancel transfer
curl -X POST http://localhost:5000/api/transfer/cancel/transfer-abc123 \
  -H "Authorization: Bearer $TOKEN"

# Clean up after confirmation
curl -X POST http://localhost:5000/api/transfer/cleanup/transfer-abc123 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Concurrency Control

**Default**: 2 concurrent file transfers

**Configure**: Via `/api/settings/max-concurrent-transfers`

```bash
# Update concurrency limit
curl -X PUT http://localhost:5000/api/settings/max-concurrent-transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxConcurrentTransfers": 4}'
```

---

## Error Handling

**Transfer Errors**:

- Partial failures reported in job status
- Individual file errors in `job.errors` array
- Transfer continues for remaining files

**Error Response Format**:

```json
{
  "job": {
    "errors": [
      {
        "file": "models/missing.bin",
        "error": "NoSuchKey",
        "message": "The specified key does not exist"
      }
    ]
  }
}
```

---

## Related Endpoints

- **[Objects API](objects.md)** - S3 object operations
- **[Local Storage API](local.md)** - Local file operations
- **[Settings API](settings.md)** - Configure concurrency
