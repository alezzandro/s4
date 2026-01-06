import {
  Alert,
  Button,
  Card,
  CardBody,
  CardTitle,
  Flex,
  FlexItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Progress,
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { storageService } from '@app/services/storageService';
import { notifyError, notifyInfo, notifySuccess } from '@app/utils/notifications';
import { formatBytes } from '@app/utils/format';
import { createAuthenticatedEventSource } from '@app/utils/sseTickets';

// Interface for individual transfer items
interface TransferItem {
  path: string;
  type: 'file' | 'directory';
}

interface TransferProgressProps {
  isOpen: boolean;
  jobId: string | null;
  sseUrl: string | null;
  onClose: () => void;
  originalItems?: TransferItem[];
}

// Interface for the SSE event data from backend (job-level updates)
interface JobProgressEvent {
  jobId: string;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  progress: {
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    percentage: number;
  };
  files: Array<{
    file: string; // destinationPath
    loaded: number;
    total: number;
    status: 'queued' | 'transferring' | 'completed' | 'error';
    error?: string;
  }>;
}

// Interface for individual file transfer state (used in component state)
interface TransferEvent {
  file: string;
  status: 'queued' | 'transferring' | 'completed' | 'error';
  loaded?: number;
  total?: number;
  error?: string;
}

export const TransferProgress: React.FC<TransferProgressProps> = ({
  isOpen,
  jobId,
  sseUrl: _sseUrl,
  onClose,
  originalItems = [],
}) => {
  const { t } = useTranslation('transfer');
  const [transfers, setTransfers] = React.useState<Map<string, TransferEvent>>(new Map());
  const [jobStatus, setJobStatus] = React.useState<'active' | 'completed' | 'failed' | 'cancelled'>('active');
  const [showCancelConfirmation, setShowCancelConfirmation] = React.useState(false);

  // Calculate selection summary with expanded file count
  // Uses React.useMemo to recalculate when transfers update (reactive to SSE events)
  const selectionSummary = React.useMemo(() => {
    const folderCount = originalItems.filter((item) => item.type === 'directory').length;
    const fileCount = originalItems.filter((item) => item.type === 'file').length;

    let summary = '';
    if (folderCount > 0) {
      summary += `${folderCount} folder${folderCount !== 1 ? 's' : ''}`;
    }
    if (fileCount > 0) {
      if (folderCount > 0) summary += ', ';
      summary += `${fileCount} file${fileCount !== 1 ? 's' : ''}`;
    }

    // Add expanded total file count if available and different from selection
    // transfers.size represents the expanded count (all files from folders + individual files)
    const expandedCount = transfers.size;
    if (expandedCount > 0 && (folderCount > 0 || expandedCount !== fileCount)) {
      summary += ` → ${expandedCount} total files`;
    }

    return summary;
  }, [originalItems, transfers.size]);

  React.useEffect(() => {
    if (!jobId) return;

    // Use one-time ticket for SSE authentication (secure, prevents URL logging)
    let eventSource: EventSource | null = null;

    createAuthenticatedEventSource(jobId, 'transfer')
      .then((es) => {
        eventSource = es;

        eventSource.onmessage = (event) => {
          try {
            const data: JobProgressEvent = JSON.parse(event.data);

            // Update all files from the job update
            setTransfers((prev) => {
              const newTransfers = new Map(prev);
              data.files.forEach((fileData) => {
                newTransfers.set(fileData.file, {
                  file: fileData.file,
                  status: fileData.status,
                  loaded: fileData.loaded,
                  total: fileData.total,
                  error: fileData.error,
                });
              });
              return newTransfers;
            });

            // Close connection when job reaches terminal state
            if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
              setJobStatus(data.status);
              eventSource?.close();

              // Emit notification for job completion
              if (data.status === 'completed') {
                notifySuccess(
                  t('progress.notifications.completed.title'),
                  t('progress.notifications.completed.message', { count: data.progress.completedFiles }),
                );

                // Auto-close modal on successful completion (all files transferred, no failures)
                if (data.progress.failedFiles === 0) {
                  setTimeout(() => {
                    onClose();
                  }, 2000);
                }
              } else if (data.status === 'failed') {
                notifyError(
                  t('progress.notifications.failed.title'),
                  t('progress.notifications.failed.message', { count: data.progress.failedFiles }),
                );
              }
            }
          } catch (error) {
            console.error('[TransferProgress] Failed to parse SSE message:', error, 'Raw data:', event.data);
          }
        };

        eventSource.onerror = (error) => {
          console.error('[TransferProgress] SSE connection error:', error);
          console.error('[TransferProgress] EventSource readyState:', eventSource?.readyState);
          console.error('[TransferProgress] EventSource URL:', eventSource?.url);

          notifyError(
            t('progress.notifications.connectionError.title'),
            t('progress.notifications.connectionError.message'),
          );
          eventSource?.close();
        };

        eventSource.onopen = () => {
          // SSE connection established
        };
      })
      .catch((error) => {
        console.error('[TransferProgress] Failed to create SSE connection:', error);
        notifyError('Connection error', error.message || 'Failed to establish transfer progress connection');
      });

    return () => {
      eventSource?.close();
    };
  }, [jobId, onClose, t]);

  const handleCancelClick = () => {
    setShowCancelConfirmation(true);
  };

  const handleCancelConfirm = async () => {
    setShowCancelConfirmation(false);
    // Only attempt to cancel if job is still active
    if (jobId && jobStatus === 'active') {
      try {
        await storageService.cancelTransfer(jobId);
        notifyInfo(t('progress.notifications.cancelled.title'), t('progress.notifications.cancelled.message'));
      } catch (error) {
        console.error('Failed to cancel transfer:', error);
        notifyError(t('progress.notifications.cancelError'), error instanceof Error ? error.message : 'Unknown error');
      }
    }
    // Always close the modal
    onClose();
  };

  const handleClose = () => {
    // For completed/failed/cancelled jobs, just close
    onClose();
  };

  // Calculate transfer statistics (memoized for performance)
  const transferStats = React.useMemo(() => {
    const transfersArray = Array.from(transfers.values());

    // Single reduce for bytes and file counts
    const stats = transfersArray.reduce(
      (acc, transfer) => ({
        totalBytes: acc.totalBytes + (transfer.total || 0),
        transferredBytes: acc.transferredBytes + (transfer.loaded || 0),
        completedFiles: acc.completedFiles + (transfer.status === 'completed' ? 1 : 0),
        failedFiles: acc.failedFiles + (transfer.status === 'error' ? 1 : 0),
      }),
      {
        totalBytes: 0,
        transferredBytes: 0,
        completedFiles: 0,
        failedFiles: 0,
      },
    );

    return {
      ...stats,
      totalFiles: transfers.size,
      percentageComplete: stats.totalBytes > 0 ? Math.round((stats.transferredBytes / stats.totalBytes) * 100) : 0,
    };
  }, [transfers]);

  // Destructure for use in JSX
  const { totalBytes, transferredBytes, percentageComplete, completedFiles, totalFiles, failedFiles } = transferStats;

  return (
    <Modal variant="large" isOpen={isOpen} onClose={onClose} aria-labelledby="transfer-progress-modal">
      <ModalHeader
        title={selectionSummary ? t('progress.titleWithSummary', { summary: selectionSummary }) : t('progress.title')}
      />
      <ModalBody>
        {/* Progress overview */}
        <Card isCompact className="pf-u-margin-bottom-md">
          <CardBody>
            <Progress
              value={percentageComplete}
              title={`${formatBytes(transferredBytes)} / ${formatBytes(totalBytes)}`}
            />
            <div className="pf-u-margin-top-sm pf-u-flex-space-between">
              <span>
                {t('progress.fileCount', { completed: completedFiles, total: totalFiles })}
                {failedFiles > 0 && (
                  <Label color="red" className="pf-u-margin-left-sm">
                    {t('progress.failedCount', { count: failedFiles })}
                  </Label>
                )}
              </span>
              <span>{percentageComplete}%</span>
            </div>
          </CardBody>
        </Card>

        {/* Detailed file transfers */}
        {Array.from(transfers.values()).map((transfer) => (
          <Card key={transfer.file} isCompact className="pf-u-margin-bottom-md">
            <CardTitle>
              <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
                <FlexItem>{transfer.file}</FlexItem>
                <FlexItem>
                  {transfer.status === 'error' ? (
                    <Label color="red">{t('progress.status.error')}</Label>
                  ) : transfer.status === 'completed' ? (
                    <Label color="green">{t('progress.status.complete')}</Label>
                  ) : transfer.status === 'queued' ? (
                    <Label color="grey">{t('progress.status.queued')}</Label>
                  ) : (
                    <Label color="blue">{t('progress.status.transferring')}</Label>
                  )}
                </FlexItem>
              </Flex>
            </CardTitle>
            <CardBody>
              {transfer.status === 'transferring' && transfer.loaded && transfer.total && (
                <Progress
                  value={(transfer.loaded / transfer.total) * 100}
                  title={`${formatBytes(transfer.loaded)} / ${formatBytes(transfer.total)}`}
                />
              )}
              {transfer.error && (
                <Alert variant="danger" title={t('progress.errorAlert')} isInline>
                  {transfer.error}
                </Alert>
              )}
            </CardBody>
          </Card>
        ))}

        {transfers.size === 0 && (
          <Alert variant="info" title={t('progress.noTransfers.title')} isInline>
            {t('progress.noTransfers.message')}
          </Alert>
        )}
      </ModalBody>
      <ModalFooter>
        {jobStatus === 'active' ? (
          <Button variant="danger" onClick={handleCancelClick}>
            {t('actions.cancelTransfer')}
          </Button>
        ) : (
          <Button variant="primary" onClick={handleClose}>
            {t('actions.close')}
          </Button>
        )}
      </ModalFooter>
      <Modal
        variant="small"
        isOpen={showCancelConfirmation}
        onClose={() => setShowCancelConfirmation(false)}
        aria-labelledby="cancel-transfer-confirmation"
      >
        <ModalHeader title={t('confirmCancel.title')} titleIconVariant="warning" />
        <ModalBody>{t('confirmCancel.message')}</ModalBody>
        <ModalFooter>
          <Button variant="danger" onClick={handleCancelConfirm}>
            {t('actions.cancelTransfer')}
          </Button>
          <Button variant="secondary" onClick={() => setShowCancelConfirmation(false)}>
            {t('actions.continueTransfer')}
          </Button>
        </ModalFooter>
      </Modal>
    </Modal>
  );
};
