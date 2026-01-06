import {
  Alert,
  Button,
  Form,
  FormGroup,
  List,
  ListItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Radio,
} from '@patternfly/react-core';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflictingFiles: string[];
  nonConflictingFiles: string[];
  onResolve: (resolution: 'overwrite' | 'skip' | 'rename') => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  conflictingFiles,
  nonConflictingFiles,
  onResolve,
  onCancel,
}) => {
  const { t } = useTranslation('transfer');
  const [resolution, setResolution] = React.useState<'overwrite' | 'skip' | 'rename'>('skip');

  const handleResolve = () => {
    onResolve(resolution);
  };

  // Get action text for summary
  const getActionText = (res: 'overwrite' | 'skip' | 'rename'): string => {
    switch (res) {
      case 'skip':
        return t('conflicts.resolution.skip').toLowerCase();
      case 'overwrite':
        return t('conflicts.resolution.overwrite').toLowerCase();
      case 'rename':
        return t('conflicts.resolution.rename').toLowerCase();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} variant="medium" aria-labelledby="conflict-resolution-modal-title">
      <ModalHeader labelId="conflict-resolution-modal-title" title={t('conflicts.title')} />
      <ModalBody>
        {/* Non-conflicting files info */}
        {nonConflictingFiles.length > 0 && (
          <Alert variant="info" isInline title={t('conflicts.nonConflicting.title')} className="pf-u-margin-bottom-md">
            <p>{t('conflicts.nonConflicting.message', { count: nonConflictingFiles.length })}</p>
          </Alert>
        )}

        {/* Conflict info */}
        <Alert variant="warning" isInline title={t('conflicts.conflicting.title')} className="pf-u-margin-bottom-md">
          <p>{t('conflicts.conflicting.message', { count: conflictingFiles.length })}</p>
        </Alert>

        {/* Resolution options */}
        <Form>
          <FormGroup label={t('conflicts.resolution.label')}>
            <Radio
              id="skip"
              name="resolution"
              label={t('conflicts.resolution.skip')}
              description={t('conflicts.resolution.skipDescription')}
              isChecked={resolution === 'skip'}
              onChange={() => setResolution('skip')}
            />
            <Radio
              id="overwrite"
              name="resolution"
              label={t('conflicts.resolution.overwrite')}
              description={t('conflicts.resolution.overwriteDescription')}
              isChecked={resolution === 'overwrite'}
              onChange={() => setResolution('overwrite')}
            />
            <Radio
              id="rename"
              name="resolution"
              label={t('conflicts.resolution.rename')}
              description={t('conflicts.resolution.renameDescription')}
              isChecked={resolution === 'rename'}
              onChange={() => setResolution('rename')}
            />
          </FormGroup>
        </Form>

        {/* Conflict list (show first 25) */}
        {conflictingFiles.length > 0 && (
          <div className="pf-u-margin-top-md">
            <h4>{t('conflicts.fileList.title')}</h4>
            {conflictingFiles.length > 25 && (
              <small className="pf-u-text-subtle">
                {t('conflicts.fileList.showingFirst', { count: conflictingFiles.length })}
              </small>
            )}
            <List isPlain>
              {conflictingFiles.slice(0, 25).map((file) => (
                <ListItem key={file}>
                  <ExclamationTriangleIcon className="pf-u-icon-warning" />
                  {file}
                </ListItem>
              ))}
            </List>
          </div>
        )}

        {/* Summary */}
        <div className="conflict-summary">
          <h5>{t('conflicts.summary.title')}</h5>
          <p>• {t('conflicts.summary.autoCopy', { count: nonConflictingFiles.length })}</p>
          <p>
            • {t('conflicts.summary.willBe', { count: conflictingFiles.length, action: getActionText(resolution) })}
          </p>
          <p>
            •{' '}
            {t('conflicts.summary.total', {
              count: nonConflictingFiles.length + (resolution === 'skip' ? 0 : conflictingFiles.length),
            })}
          </p>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button key="apply" variant="primary" onClick={handleResolve}>
          {t('actions.apply')}
        </Button>
        <Button key="cancel" variant="link" onClick={onCancel}>
          {t('actions.cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
