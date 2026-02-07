import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bullseye, Spinner } from '@patternfly/react-core';
import { useStorageLocations } from '@app/hooks';
import { notifyWarning } from '@app/utils/notifications';
import StorageBrowser from '@app/components/StorageBrowser/StorageBrowser';

/**
 * Route guard component for the Storage Browser route.
 *
 * This component consolidates storage availability checking and provides
 * smart redirect behavior:
 * - Shows a loading spinner while storage locations are being loaded
 * - Redirects to /buckets with a single notification when no storage is available
 * - Renders StorageBrowser when storage locations exist
 *
 * This prevents duplicate notifications that would occur when both
 * StorageBrowser and useStorageLocations independently check for storage.
 */
const StorageRouteGuard: React.FC = () => {
  const navigate = useNavigate();
  const hasHandledRedirect = React.useRef(false);

  // Suppress notifications from hook - we handle them here
  const { locations, loading } = useStorageLocations({
    suppressNotifications: true,
  });

  React.useEffect(() => {
    if (hasHandledRedirect.current || loading) return;

    const availableLocations = locations.filter((l) => l.available);

    if (locations.length === 0 || availableLocations.length === 0) {
      hasHandledRedirect.current = true;

      // Single consolidated notification
      notifyWarning('No storage available', 'Please create a bucket to get started');

      // Redirect to Storage Management
      navigate('/buckets', { replace: true });
    }
  }, [loading, locations, navigate]);

  if (loading) {
    return (
      <Bullseye>
        <Spinner size="lg" aria-label="Loading storage locations" />
      </Bullseye>
    );
  }

  const availableLocations = locations.filter((l) => l.available);
  if (availableLocations.length > 0) {
    return <StorageBrowser />;
  }

  // Redirecting - render nothing
  return null;
};

export default StorageRouteGuard;
