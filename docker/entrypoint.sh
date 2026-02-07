#!/bin/bash
set -e

# Ensure data directories exist (PVC mount may override Dockerfile-created dirs)
mkdir -p /var/lib/ceph/radosgw/{db,buckets,tmp}
mkdir -p /var/lib/ceph/radosgw/db/rgw_posix_lmdbs

# Create initial RGW user if not exists (will fail silently on subsequent runs)
radosgw-admin user create \
  --uid s4admin \
  --display-name "S4 Admin" \
  --access-key "${AWS_ACCESS_KEY_ID:-s4admin}" \
  --secret-key "${AWS_SECRET_ACCESS_KEY:-s4secret}" 2>/dev/null || true

# Start supervisord (manages both rgw and nodejs)
exec /usr/bin/supervisord -c /etc/supervisord.conf
