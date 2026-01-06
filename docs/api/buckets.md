# Buckets API

Manage S3 buckets: list, create, and delete operations.

## Endpoints

### List Buckets

Retrieve all accessible S3 buckets.

**Endpoint**: `GET /api/buckets`

**Authentication**: Required (when enabled)

**Request**:

```bash
curl http://localhost:5000/api/buckets \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response** (200 OK):

```json
{
  "owner": {
    "ID": "s4admin",
    "DisplayName": "S4 Admin"
  },
  "defaultBucket": "my-default-bucket",
  "buckets": [
    {
      "Name": "my-bucket",
      "CreationDate": "2024-01-15T10:30:00.000Z"
    },
    {
      "Name": "models",
      "CreationDate": "2024-01-20T14:45:00.000Z"
    }
  ]
}
```

**Response Fields**:

- `owner` - S3 account owner information
- `defaultBucket` - Default bucket from configuration
- `buckets` - Array of accessible buckets (filtered by HeadBucket permission)

**Notes**:

- Only buckets the authenticated user can access are returned
- Buckets without read permission are silently filtered out

---

### Create Bucket

Create a new S3 bucket.

**Endpoint**: `POST /api/buckets`

**Authentication**: Required (when enabled)

**Request**:

```bash
curl -X POST http://localhost:5000/api/buckets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bucketName": "my-new-bucket"
  }'
```

**Request Body**:

```json
{
  "bucketName": "my-new-bucket"
}
```

**Validation Rules**:

- 3-63 characters long
- Only lowercase letters, numbers, dots (.), and hyphens (-)
- Must start and end with letter or number
- No consecutive periods
- Not formatted as IP address (e.g., `192.168.1.1`)

**Response** (200 OK):

```json
{
  "message": "Bucket created successfully",
  "data": {
    "Location": "/my-new-bucket"
  }
}
```

**Error Responses**:

**400 Bad Request** - Invalid bucket name:

```json
{
  "error": "InvalidBucketName",
  "message": "Bucket name must be between 3 and 63 characters"
}
```

**409 Conflict** - Bucket already exists:

```json
{
  "error": "BucketAlreadyExists",
  "message": "The requested bucket name is not available"
}
```

---

### Delete Bucket

Delete an empty S3 bucket.

**Endpoint**: `DELETE /api/buckets/:bucketName`

**Authentication**: Required (when enabled)

**Request**:

```bash
curl -X DELETE http://localhost:5000/api/buckets/my-bucket \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**URL Parameters**:

- `bucketName` - Name of the bucket to delete (not Base64-encoded)

**Response** (200 OK):

```json
{
  "message": "Bucket deleted successfully"
}
```

**Error Responses**:

**404 Not Found** - Bucket does not exist:

```json
{
  "error": "NoSuchBucket",
  "message": "The specified bucket does not exist"
}
```

**409 Conflict** - Bucket not empty:

```json
{
  "error": "BucketNotEmpty",
  "message": "The bucket you tried to delete is not empty"
}
```

**Notes**:

- Bucket must be empty before deletion
- Delete all objects first, then delete the bucket
- Operation is idempotent (deleting non-existent bucket returns 404)

---

## Bucket Naming Rules

### Valid Characters

- Lowercase letters (a-z)
- Numbers (0-9)
- Hyphens (-)
- Dots (.)

### Restrictions

- 3-63 characters long
- Must start and end with letter or number
- Cannot contain consecutive periods (`..`)
- Cannot be formatted as IP address
- Must be globally unique (in S3)

### Examples

**Valid**:

- `my-bucket`
- `data.2024`
- `models-7b`
- `abc`

**Invalid**:

- `My-Bucket` (uppercase not allowed)
- `my_bucket` (underscores not allowed)
- `ab` (too short)
- `-bucket` (cannot start with hyphen)
- `bucket-` (cannot end with hyphen)
- `my..bucket` (consecutive periods)
- `192.168.1.1` (IP address format)

---

## Common Use Cases

### List All Buckets

```bash
curl http://localhost:5000/api/buckets \
  -H "Authorization: Bearer $TOKEN"
```

### Create Bucket with Error Handling

```bash
response=$(curl -s -w "\n%{http_code}" \
  -X POST http://localhost:5000/api/buckets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bucketName": "new-bucket"}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n1)

if [ "$http_code" -eq 200 ]; then
  echo "Bucket created successfully"
else
  echo "Error: $body"
fi
```

### Delete Empty Bucket

```bash
# First, ensure bucket is empty
curl -X DELETE http://localhost:5000/api/buckets/old-bucket \
  -H "Authorization: Bearer $TOKEN"
```

### Create and Configure Bucket

```bash
# 1. Create bucket
curl -X POST http://localhost:5000/api/buckets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bucketName": "models"}'

# 2. Upload objects (see Objects API)
# 3. Use bucket
```

---

## Integration with AWS CLI

S4's S3 API is compatible with AWS CLI:

```bash
# Configure AWS CLI
export AWS_ACCESS_KEY_ID=s4admin
export AWS_SECRET_ACCESS_KEY=s4secret
export AWS_ENDPOINT_URL=http://localhost:7480

# Create bucket
aws s3 mb s3://my-bucket

# List buckets
aws s3 ls

# Delete bucket
aws s3 rb s3://my-bucket
```

**Note**: Use port **7480** for direct S3 API access, not port 5000 (Web UI).

---

## Related Endpoints

- **[Objects API](objects.md)** - Manage objects within buckets
- **[Settings API](settings.md)** - Configure S3 connection
- **[Transfer API](transfer.md)** - Transfer files between buckets

---

## Error Handling

All bucket operations return standard S3 error responses with appropriate HTTP status codes.

**Common Errors**:

- `InvalidBucketName` - Validation failed
- `BucketAlreadyExists` - Bucket name taken
- `BucketAlreadyOwnedByYou` - You already own this bucket
- `NoSuchBucket` - Bucket not found
- `BucketNotEmpty` - Cannot delete non-empty bucket

**Rate Limiting**:
Bucket operations are not rate-limited (authentication endpoints are).

**Idempotency**:

- Create: Not idempotent (returns 409 if exists)
- Delete: Idempotent (returns 404 if already deleted)
- List: Always idempotent
