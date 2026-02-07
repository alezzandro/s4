import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { FileEntry, StorageType, TransferItem, TransferRequest, storageService } from '@app/services/storageService';
import { DestinationPicker } from './DestinationPicker';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { TransferProgress } from './TransferProgress';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core';
import { notifyError, notifySuccess } from '@app/utils/notifications';
import config from '@app/config';
import { formatBytes } from '@app/utils/format';

interface TransferActionProps {
  sourceLocationId: string;
  sourceType: StorageType;
  sourcePath: string;
  selectedFiles: string[];
  isOpen: boolean;
  onClose: () => void;
  currentListing?: FileEntry[]; // New optional prop
}

/**
 * TransferAction - Orchestrates the complete transfer workflow
 *
 * Workflow:
 * 1. Pick destination → DestinationPicker
 * 2. Check for conflicts → storageService.checkConflicts
 * 3. If conflicts exist, resolve them → ConflictResolutionModal
 * 4. Initiate transfer → storageService.initiateTransfer
 * 5. Show progress → TransferProgress
 */
export const TransferAction: React.FC<TransferActionProps> = ({
  sourceLocationId,
  sourceType,
  sourcePath,
  selectedFiles,
  isOpen,
  onClose,
  currentListing = [], // Default to empty array if not provided
}) => {
  const { t } = useTranslation('transfer');

  const buildTransferItems = (): TransferItem[] => {
    return selectedFiles.map((itemPath) => {
      // Strip sourcePath prefix to make paths relative to the source directory
      let relativePath = itemPath;
      if (sourcePath) {
        // Handle both "sourcePath/" and "sourcePath" prefixes
        const sourcePathWithSlash = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`;
        if (itemPath.startsWith(sourcePathWithSlash)) {
          relativePath = itemPath.substring(sourcePathWithSlash.length);
        } else if (itemPath === sourcePath) {
          // Edge case: transferring the directory itself
          relativePath = '';
        }
      }

      // Find item in current listing to determine type
      const item = currentListing.find((entry) => entry.path === itemPath);

      // Handle symlink as file
      const type = item?.type === 'symlink' ? 'file' : (item?.type as 'file' | 'directory') || 'file';

      return {
        path: relativePath,
        type,
      };
    });
  };
  const [step, setStep] = React.useState<'destination' | 'conflicts' | 'progress'>('destination');
  const [destinationLocationId, setDestinationLocationId] = React.useState<string>('');
  const [destinationPath, setDestinationPath] = React.useState<string>('');
  const [destinationType, setDestinationType] = React.useState<StorageType>('s3');
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [sseUrl, setSseUrl] = React.useState<string | null>(null);

  // Large folder warning state
  const [showLargeFolderWarning, setShowLargeFolderWarning] = React.useState(false);
  const [largeFolderWarningData, setLargeFolderWarningData] = React.useState<{
    fileCount: number;
    totalSize: number;
    message: string;
  } | null>(null);

  // Pending transfer state (used for large folder warning)
  const [pendingTransfer, setPendingTransfer] = React.useState<{
    destLocationId: string;
    destPath: string;
    destType: StorageType;
  } | null>(null);

  // Conflict tracking state
  const [conflictingFiles, setConflictingFiles] = React.useState<string[]>([]);
  const [nonConflictingFiles, setNonConflictingFiles] = React.useState<string[]>([]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setStep('destination');
      setDestinationLocationId('');
      setDestinationPath('');
      setJobId(null);
      setSseUrl(null);
    }
  }, [isOpen]);

  const handleDestinationSelected = async (locationId: string, path: string) => {
    // Determine destination type from location ID
    const { locations } = await storageService.getLocations();
    const location = locations.find((loc) => loc.id === locationId);
    const destType = location?.type || 's3';

    // Check for conflicts
    try {
      const items = buildTransferItems();
      const conflictResponse = await storageService.checkConflicts(
        sourceLocationId,
        sourcePath,
        items,
        locationId,
        path,
      );

      // Store large folder warning data
      if (conflictResponse.warning) {
        setShowLargeFolderWarning(true);
        setLargeFolderWarningData(conflictResponse.warning);
        setPendingTransfer({ destLocationId: locationId, destPath: path, destType });
        return;
      }

      // Store conflict and non-conflicting file data
      setConflictingFiles(conflictResponse.conflicts);
      setNonConflictingFiles(conflictResponse.nonConflicting);

      if (conflictResponse.conflicts.length > 0) {
        // Set state for the conflict resolution modal
        setDestinationLocationId(locationId);
        setDestinationPath(path);
        setDestinationType(destType);
        setStep('conflicts');
      } else {
        // No conflicts, proceed with transfer using values directly
        await initiateTransfer('rename', locationId, path, destType);
      }
    } catch (error) {
      console.error('Failed to check conflicts:', error);
      notifyError(t('conflicts.checkError'), error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleProceedWithTransfer = async () => {
    setShowLargeFolderWarning(false);

    // Check for conflicts (warning already shown, now check conflicts)
    if (pendingTransfer) {
      const items = buildTransferItems();
      const response = await storageService.checkConflicts(
        sourceLocationId,
        sourcePath,
        items,
        pendingTransfer.destLocationId,
        pendingTransfer.destPath,
      );

      if (response.conflicts.length > 0) {
        setConflictingFiles(response.conflicts);
        setNonConflictingFiles(response.nonConflicting);
        setDestinationLocationId(pendingTransfer.destLocationId);
        setDestinationPath(pendingTransfer.destPath);
        setDestinationType(pendingTransfer.destType);
        setStep('conflicts');
      } else {
        // No conflicts - proceed
        await initiateTransfer(
          'skip',
          pendingTransfer.destLocationId,
          pendingTransfer.destPath,
          pendingTransfer.destType,
        );
      }
    }
  };

  const handleConflictsResolved = async (resolution: 'overwrite' | 'skip' | 'rename') => {
    await initiateTransfer(resolution, destinationLocationId, destinationPath, destinationType);
  };

  const initiateTransfer = async (
    conflictResolution: 'overwrite' | 'skip' | 'rename',
    destLocationId: string,
    destPath: string,
    destType: StorageType,
  ) => {
    const transferRequest: TransferRequest = {
      source: {
        type: sourceType,
        locationId: sourceLocationId,
        path: sourcePath,
      },
      destination: {
        type: destType,
        locationId: destLocationId,
        path: destPath,
      },
      items: buildTransferItems(),
      conflictResolution,
    };

    try {
      const response = await storageService.initiateTransfer(transferRequest);
      setJobId(response.jobId);
      setSseUrl(`${config.backend_api_url}${response.sseUrl}`);
      setStep('progress');

      notifySuccess(
        t('notifications.started.title'),
        t('notifications.started.message', { count: selectedFiles.length }),
      );
    } catch (error) {
      console.error('Failed to initiate transfer:', error);
      notifyError(t('notifications.startError'), error instanceof Error ? error.message : 'Unknown error');
      onClose();
    }
  };

  const handleCancel = () => {
    setStep('destination');
    setDestinationLocationId('');
    setDestinationPath('');
    setJobId(null);
    setSseUrl(null);
    onClose();
  };

  return (
    <>
      {step === 'destination' && (
        <DestinationPicker isOpen={isOpen} onSelect={handleDestinationSelected} onCancel={handleCancel} />
      )}

      {step === 'conflicts' && (
        <ConflictResolutionModal
          isOpen={true}
          conflictingFiles={conflictingFiles}
          nonConflictingFiles={nonConflictingFiles}
          onResolve={handleConflictsResolved}
          onCancel={handleCancel}
        />
      )}

      {step === 'progress' && <TransferProgress isOpen={true} jobId={jobId} sseUrl={sseUrl} onClose={handleCancel} />}

      {showLargeFolderWarning && largeFolderWarningData && (
        <Modal
          className="standard-modal"
          variant="small"
          isOpen={showLargeFolderWarning}
          onClose={() => {
            setShowLargeFolderWarning(false);
            setLargeFolderWarningData(null);
          }}
        >
          <ModalHeader title={t('largeTransfer.title')} />
          <ModalBody>
            <Alert variant="warning" isInline title={t('largeTransfer.alertTitle')} className="pf-u-margin-bottom-md">
              <p>{largeFolderWarningData.message}</p>
            </Alert>
            <DescriptionList isHorizontal>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('largeTransfer.filesToTransfer')}</DescriptionListTerm>
                <DescriptionListDescription>
                  {largeFolderWarningData.fileCount.toLocaleString()} {t('largeTransfer.filesSuffix')}
                </DescriptionListDescription>
              </DescriptionListGroup>
              <DescriptionListGroup>
                <DescriptionListTerm>{t('largeTransfer.totalSize')}</DescriptionListTerm>
                <DescriptionListDescription>{formatBytes(largeFolderWarningData.totalSize)}</DescriptionListDescription>
              </DescriptionListGroup>
            </DescriptionList>
            <p className="pf-u-margin-top-md pf-u-text-subtle">{t('largeTransfer.instructions')}</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="primary" onClick={handleProceedWithTransfer}>
              {t('actions.proceed')}
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setShowLargeFolderWarning(false);
                setLargeFolderWarningData(null);
              }}
            >
              {t('actions.cancel')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
};
