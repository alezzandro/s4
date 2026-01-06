import * as React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Spinner,
  Tab,
  TabTitleText,
  Tabs,
  TextInput,
} from '@patternfly/react-core';
import { PlusCircleIcon, TimesIcon } from '@patternfly/react-icons';
import apiClient from '@app/utils/apiClient';
import { base64Encode } from '@app/utils/encoding';
import { notifyApiError, notifySuccess, notifyWarning } from '@app/utils/notifications';
import { formatBytes } from '@app/utils/format';
import { ObjectMetadata, ObjectTag } from './storageBrowserTypes';

interface FileDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bucketName: string;
  filePath: string;
  storageType: 's3' | 'local';
}

const FileDetailsModal: React.FC<FileDetailsModalProps> = ({ isOpen, onClose, bucketName, filePath, storageType }) => {
  const { t } = useTranslation('storage-browser');
  const { t: tCommon } = useTranslation('translation');
  const [activeTab, setActiveTab] = React.useState<string | number>('metadata');
  const [metadata, setMetadata] = React.useState<ObjectMetadata | null>(null);
  const [tags, setTags] = React.useState<ObjectTag[]>([]);
  const [originalTags, setOriginalTags] = React.useState<ObjectTag[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = React.useState(false);
  const [isLoadingTags, setIsLoadingTags] = React.useState(false);
  const [isSavingTags, setIsSavingTags] = React.useState(false);
  const [metadataError, setMetadataError] = React.useState<string | null>(null);
  const [tagsError, setTagsError] = React.useState<string | null>(null);

  // New tag input state
  const [newTagKey, setNewTagKey] = React.useState('');
  const [newTagValue, setNewTagValue] = React.useState('');

  // Derived state
  const fileName = filePath.split('/').pop() || filePath;
  const hasTagChanges = JSON.stringify(tags) !== JSON.stringify(originalTags);
  const isS3Storage = storageType === 's3';
  const MAX_TAGS = 10;

  const fetchMetadata = React.useCallback(async () => {
    setIsLoadingMetadata(true);
    setMetadataError(null);
    try {
      const encodedKey = base64Encode(filePath);
      const response = await apiClient.get(`/objects/metadata/${bucketName}/${encodedKey}`);
      setMetadata(response.data);
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
      setMetadataError(tCommon('common.status.error'));
      notifyApiError('Fetch metadata', error);
    } finally {
      setIsLoadingMetadata(false);
    }
  }, [bucketName, filePath, tCommon]);

  const fetchTags = React.useCallback(async () => {
    setIsLoadingTags(true);
    setTagsError(null);
    try {
      const encodedKey = base64Encode(filePath);
      const response = await apiClient.get(`/objects/tags/${bucketName}/${encodedKey}`);
      const fetchedTags = response.data.tags || [];
      setTags(fetchedTags);
      setOriginalTags(fetchedTags);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
      setTagsError(tCommon('common.status.error'));
      notifyApiError('Fetch tags', error);
    } finally {
      setIsLoadingTags(false);
    }
  }, [bucketName, filePath, tCommon]);

  // Fetch metadata when modal opens
  React.useEffect(() => {
    if (isOpen && isS3Storage) {
      fetchMetadata();
      fetchTags();
    }
    // Reset state when closing
    if (!isOpen) {
      setMetadata(null);
      setTags([]);
      setOriginalTags([]);
      setMetadataError(null);
      setTagsError(null);
      setNewTagKey('');
      setNewTagValue('');
      setActiveTab('metadata');
    }
  }, [isOpen, isS3Storage, fetchMetadata, fetchTags]);

  const handleSaveTags = async () => {
    setIsSavingTags(true);
    try {
      const encodedKey = base64Encode(filePath);
      await apiClient.put(`/objects/tags/${bucketName}/${encodedKey}`, { tags });
      setOriginalTags([...tags]);
      notifySuccess(t('fileDetails.tags.saved'), t('fileDetails.tags.savedMessage'));
    } catch (error) {
      console.error('Failed to save tags:', error);
      notifyApiError('Save tags', error);
    } finally {
      setIsSavingTags(false);
    }
  };

  const handleAddTag = () => {
    if (!newTagKey.trim()) {
      notifyWarning(tCommon('common.status.warning'), tCommon('common.validation.required'));
      return;
    }
    if (tags.length >= MAX_TAGS) {
      notifyWarning(
        tCommon('common.status.warning'),
        t('fileDetails.tags.tagCount', { count: MAX_TAGS, max: MAX_TAGS }),
      );
      return;
    }
    if (tags.some((tag) => tag.Key === newTagKey.trim())) {
      notifyWarning(tCommon('common.status.warning'), tCommon('common.validation.required'));
      return;
    }
    setTags([...tags, { Key: newTagKey.trim(), Value: newTagValue.trim() }]);
    setNewTagKey('');
    setNewTagValue('');
  };

  const handleRemoveTag = (keyToRemove: string) => {
    setTags(tags.filter((tag) => tag.Key !== keyToRemove));
  };

  const handleUpdateTagValue = (key: string, newValue: string) => {
    setTags(tags.map((tag) => (tag.Key === key ? { ...tag, Value: newValue } : tag)));
  };

  const handleClose = () => {
    onClose();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const modalTitle = t('fileDetails.title', { fileName });

  // Render for local storage (not available)
  if (!isS3Storage) {
    return (
      <Modal
        className="file-details-modal"
        isOpen={isOpen}
        onClose={handleClose}
        aria-labelledby="file-details-modal-title"
      >
        <ModalHeader labelId="file-details-modal-title" title={modalTitle} />
        <ModalBody>
          <Alert variant="info" isInline title={tCommon('common.status.info')}>
            {t('fileDetails.notAvailable')}
          </Alert>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={handleClose}>
            {tCommon('common.actions.close')}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal
      className="file-details-modal"
      isOpen={isOpen}
      onClose={handleClose}
      aria-labelledby="file-details-modal-title"
    >
      <ModalHeader labelId="file-details-modal-title" title={modalTitle} />
      <ModalBody>
        <Tabs
          activeKey={activeTab}
          onSelect={(_event, tabIndex) => setActiveTab(tabIndex)}
          aria-label={t('fileDetails.tabs.metadata')}
        >
          <Tab
            eventKey="metadata"
            title={<TabTitleText>{t('fileDetails.tabs.metadata')}</TabTitleText>}
            aria-label={t('fileDetails.tabs.metadata')}
          >
            <div className="pf-v6-u-pt-md">
              {isLoadingMetadata ? (
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.size')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Skeleton width="100px" screenreaderText={tCommon('common.status.loading')} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.lastModified')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Skeleton width="200px" screenreaderText={tCommon('common.status.loading')} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.contentType')}</DescriptionListTerm>
                    <DescriptionListDescription>
                      <Skeleton width="150px" screenreaderText={tCommon('common.status.loading')} />
                    </DescriptionListDescription>
                  </DescriptionListGroup>
                </DescriptionList>
              ) : metadataError ? (
                <Alert variant="danger" isInline title={metadataError} />
              ) : metadata ? (
                <DescriptionList>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.key')}</DescriptionListTerm>
                    <DescriptionListDescription>{metadata.key}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.size')}</DescriptionListTerm>
                    <DescriptionListDescription>{formatBytes(metadata.size)}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.lastModified')}</DescriptionListTerm>
                    <DescriptionListDescription>{formatDate(metadata.lastModified)}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.contentType')}</DescriptionListTerm>
                    <DescriptionListDescription>{metadata.contentType}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.etag')}</DescriptionListTerm>
                    <DescriptionListDescription>{metadata.etag || '-'}</DescriptionListDescription>
                  </DescriptionListGroup>
                  <DescriptionListGroup>
                    <DescriptionListTerm>{t('fileDetails.metadata.storageClass')}</DescriptionListTerm>
                    <DescriptionListDescription>{metadata.storageClass || 'STANDARD'}</DescriptionListDescription>
                  </DescriptionListGroup>
                  {metadata.metadata && Object.keys(metadata.metadata).length > 0 && (
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('fileDetails.metadata.customMetadata')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        <DescriptionList isCompact>
                          {Object.entries(metadata.metadata).map(([key, value]) => (
                            <DescriptionListGroup key={key}>
                              <DescriptionListTerm>{key}</DescriptionListTerm>
                              <DescriptionListDescription>{value}</DescriptionListDescription>
                            </DescriptionListGroup>
                          ))}
                        </DescriptionList>
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  )}
                </DescriptionList>
              ) : null}
            </div>
          </Tab>
          <Tab
            eventKey="tags"
            title={<TabTitleText>{t('fileDetails.tabs.tags')}</TabTitleText>}
            aria-label={t('fileDetails.tabs.tags')}
          >
            <div className="pf-v6-u-pt-md">
              {isLoadingTags ? (
                <div className="pf-v6-u-text-align-center">
                  <Spinner size="lg" aria-label={tCommon('common.status.loading')} />
                </div>
              ) : tagsError ? (
                <Alert variant="danger" isInline title={tagsError} />
              ) : (
                <>
                  {/* Existing tags */}
                  {tags.length === 0 ? (
                    <Alert variant="info" isInline isPlain title={t('fileDetails.tabs.tags')} className="pf-v6-u-mb-md">
                      {t('fileDetails.tags.noTags')}
                    </Alert>
                  ) : (
                    <Form className="pf-v6-u-mb-md">
                      {tags.map((tag) => (
                        <FormGroup key={tag.Key} label={tag.Key} fieldId={`tag-${tag.Key}`}>
                          <Flex>
                            <FlexItem flex={{ default: 'flex_1' }}>
                              <TextInput
                                id={`tag-${tag.Key}`}
                                value={tag.Value}
                                onChange={(_event, value) => handleUpdateTagValue(tag.Key, value)}
                                aria-label={tag.Key}
                              />
                            </FlexItem>
                            <FlexItem>
                              <Button
                                variant="plain"
                                aria-label={tCommon('common.actions.remove')}
                                onClick={() => handleRemoveTag(tag.Key)}
                                icon={<TimesIcon />}
                              />
                            </FlexItem>
                          </Flex>
                        </FormGroup>
                      ))}
                    </Form>
                  )}

                  {/* Add new tag form */}
                  {tags.length < MAX_TAGS && (
                    <Form>
                      <FormGroup label={t('fileDetails.tags.addTag')} fieldId="new-tag">
                        <Flex alignItems={{ default: 'alignItemsFlexEnd' }}>
                          <FlexItem>
                            <TextInput
                              id="new-tag-key"
                              placeholder={t('fileDetails.tags.keyPlaceholder')}
                              value={newTagKey}
                              onChange={(_event, value) => setNewTagKey(value)}
                              aria-label={t('fileDetails.tags.keyPlaceholder')}
                              style={{ width: '150px' }}
                            />
                          </FlexItem>
                          <FlexItem flex={{ default: 'flex_1' }}>
                            <TextInput
                              id="new-tag-value"
                              placeholder={t('fileDetails.tags.valuePlaceholder')}
                              value={newTagValue}
                              onChange={(_event, value) => setNewTagValue(value)}
                              aria-label={t('fileDetails.tags.valuePlaceholder')}
                            />
                          </FlexItem>
                          <FlexItem>
                            <Button
                              variant="secondary"
                              icon={<PlusCircleIcon />}
                              onClick={handleAddTag}
                              isDisabled={!newTagKey.trim()}
                            >
                              {tCommon('common.actions.add')}
                            </Button>
                          </FlexItem>
                        </Flex>
                      </FormGroup>
                    </Form>
                  )}

                  <div className="pf-v6-u-mt-md pf-v6-u-color-200">
                    {t('fileDetails.tags.tagCount', { count: tags.length, max: MAX_TAGS })}
                  </div>
                </>
              )}
            </div>
          </Tab>
        </Tabs>
      </ModalBody>
      <ModalFooter>
        {activeTab === 'tags' && (
          <Button
            variant="primary"
            onClick={handleSaveTags}
            isDisabled={!hasTagChanges || isSavingTags}
            isLoading={isSavingTags}
          >
            {isSavingTags ? t('fileDetails.tags.saving') : t('fileDetails.tags.saveTags')}
          </Button>
        )}
        <Button variant={activeTab === 'tags' && hasTagChanges ? 'secondary' : 'primary'} onClick={handleClose}>
          {activeTab === 'tags' && hasTagChanges ? tCommon('common.actions.cancel') : tCommon('common.actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default FileDetailsModal;
