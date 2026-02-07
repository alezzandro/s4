# Local Storage API

Manage files in local filesystem storage locations.

## List Storage Locations

**GET /api/local/locations**

```bash
curl http://localhost:5000/api/local/locations \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:

```json
{
  "locations": [
    {
      "id": "local-0",
      "name": "Local Storage",
      "path": "/opt/app-root/src/data",
      "type": "local",
      "available": true
    }
  ]
}
```

---

## List Files

**GET /api/local/files/:locationId/_encodedPath_**

```bash
# List root
curl "http://localhost:5000/api/local/files/local-0/" \
  -H "Authorization: Bearer $TOKEN"

# List subdirectory (Base64-encoded)
path=$(echo -n "datasets/training" | base64 | tr '+/' '-_' | tr -d '=')
curl "http://localhost:5000/api/local/files/local-0/$path" \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:

```json
{
  "files": [
    {
      "name": "data.csv",
      "path": "datasets/data.csv",
      "size": 1024,
      "type": "file",
      "lastModified": "2024-01-15T10:30:00.000Z"
    }
  ],
  "directories": [
    {
      "name": "models",
      "path": "datasets/models",
      "type": "directory"
    }
  ]
}
```

---

## Upload File

**POST /api/local/upload/:locationId/_encodedPath_**

```bash
path=$(echo -n "datasets/new-file.csv" | base64 | tr '+/' '-_' | tr -d '=')
curl -X POST "http://localhost:5000/api/local/upload/local-0/$path" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@data.csv"
```

---

## Download File

**GET /api/local/download/:locationId/_encodedPath_**

```bash
path=$(echo -n "datasets/data.csv" | base64 | tr '+/' '-_' | tr -d '=')
curl "http://localhost:5000/api/local/download/local-0/$path" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded.csv
```

---

## Delete File or Directory

**DELETE /api/local/:locationId/_encodedPath_**

```bash
path=$(echo -n "old-data/" | base64 | tr '+/' '-_' | tr -d '=')
curl -X DELETE "http://localhost:5000/api/local/local-0/$path" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Create Directory

**POST /api/local/create-directory/:locationId/_encodedPath_**

```bash
path=$(echo -n "new-folder" | base64 | tr '+/' '-_' | tr -d '=')
curl -X POST "http://localhost:5000/api/local/create-directory/local-0/$path" \
  -H "Authorization: Bearer $TOKEN"
```
