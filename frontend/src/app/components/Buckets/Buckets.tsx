import * as React from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '@app/utils/apiClient';
import {
  Button,
  Card,
  Content,
  ContentVariants,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  FormSelect,
  FormSelectOption,
  HelperText,
  HelperTextItem,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  Popover,
  Skeleton,
  TextInput,
  Tooltip,
} from '@patternfly/react-core';
import { Table, Tbody, Td, Th, ThProps, Thead, Tr } from '@patternfly/react-table';
import {
  AngleLeftIcon,
  AngleRightIcon,
  CloudIcon,
  CubesIcon,
  DatabaseIcon,
  FolderIcon,
  QuestionCircleIcon,
  SearchIcon,
  SyncIcon,
  TrashIcon,
} from '@patternfly/react-icons';
import { useNavigate } from 'react-router-dom';
import { notifyApiError, notifySuccess, notifyWarning } from '@app/utils/notifications';
import { getBucketNameRules, validateS3BucketName } from '@app/utils/validation';
import { useModal, useStorageLocations } from '@app/hooks';
import { MobileCardItem, MobileCardView, ResponsiveTableWrapper } from '@app/components/ResponsiveTable';

class Bucket {
  Name: string;
  CreationDate: string;

  constructor(name: string, creationDate: string) {
    this.Name = name;
    this.CreationDate = creationDate;
  }
}

class Owner {
  DisplayName: string;
  ID: string;

  constructor(displayName: string, id: string) {
    this.DisplayName = displayName;
    this.ID = id;
  }
}

class BucketsList {
  buckets: Bucket[];
  owner: Owner;

  constructor(buckets: Bucket[], owner: Owner) {
    this.buckets = buckets;
    this.owner = owner;
  }
}

const Buckets: React.FunctionComponent = () => {
  const { t } = useTranslation('buckets');
  const navigate = useNavigate();

  // New bucket handling
  const [newBucketName, setNewBucketName] = React.useState('');
  const [newBucketNameRulesVisibility, setNewBucketNameRulesVisibility] = React.useState(false);

  // Create bucket modal handling
  const createBucketModal = useModal();

  const handleNewBucketCreate = () => {
    if (!validateBucketName(newBucketName)) {
      notifyWarning(t('validation.invalidName'), t('validation.invalidNameMessage', { bucketName: newBucketName }));
      return;
    } else {
      apiClient
        .post(`/buckets`, {
          bucketName: newBucketName,
        })
        .then((_response) => {
          notifySuccess(t('createModal.success'), t('createModal.successMessage', { bucketName: newBucketName }));
          // Refresh both locations and bucket details (force refresh to update cache)
          Promise.all([refreshLocations(), loadBucketDetails()])
            .then(() => {
              setNewBucketName('');
              createBucketModal.close();
            })
            .catch((error) => {
              notifyApiError('Refresh storage locations', error);
            });
        })
        .catch((error) => {
          notifyApiError('Create bucket', error);
          createBucketModal.close();
        });
    }
  };

  const handleNewBucketCancel = () => {
    setNewBucketName('');
    createBucketModal.close();
  };

  // Delete bucket handling
  const deleteBucketModal = useModal();
  const [selectedBucket, setSelectedBucket] = React.useState('');
  const [bucketToDelete, setBucketToDelete] = React.useState('');

  const handleDeleteBucketClick = (name: string) => (_event: React.MouseEvent<HTMLButtonElement>) => {
    setSelectedBucket(name);
    deleteBucketModal.open();
  };

  const validateBucketToDelete = (): boolean => {
    if (bucketToDelete !== selectedBucket) {
      return false;
    } else {
      return true;
    }
  };

  const handleDeleteBucketConfirm = () => {
    if (!validateBucketToDelete()) {
      return;
    } else {
      apiClient
        .delete(`/buckets/${selectedBucket}`)
        .then((_response) => {
          notifySuccess(t('deleteModal.success'), t('deleteModal.successMessage', { bucketName: selectedBucket }));
          // Refresh both locations and bucket details (force refresh to update cache)
          Promise.all([refreshLocations(), loadBucketDetails()])
            .then(() => {
              setBucketToDelete('');
              deleteBucketModal.close();
            })
            .catch((error) => {
              notifyApiError('Refresh storage locations', error);
            });
        })
        .catch((error) => {
          notifyApiError('Delete bucket', error);
        });
    }
  };

  const handleDeleteBucketCancel = () => {
    setBucketToDelete('');
    deleteBucketModal.close();
  };

  // Storage locations handling (S3 + PVC)
  const [searchBucketText, setSearchBucketText] = React.useState('');
  // Suppress notifications - Buckets page is where users go to CREATE buckets,
  // so they don't need a notification saying there are no buckets
  const {
    locations,
    loading: _locationsLoading,
    refreshLocations,
  } = useStorageLocations({
    suppressNotifications: true,
  });
  const [bucketsList, setBucketsList] = React.useState<BucketsList | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isLoadingBuckets, setIsLoadingBuckets] = React.useState(true);

  // Pagination state
  const [bucketsPerPage, setBucketsPerPage] = React.useState(25);
  const [currentPage, setCurrentPage] = React.useState(1);

  // Validate bucket name using centralized validation utility
  const validateBucketName = React.useCallback(
    (name: string): boolean => {
      const existingBucketNames = bucketsList?.buckets.map((bucket) => bucket.Name) || [];
      return validateS3BucketName(name, existingBucketNames);
    },
    [bucketsList],
  );

  React.useEffect(() => {
    // Only show validation error after 3+ characters
    const hasValidationError = newBucketName.length >= 3 && !validateBucketName(newBucketName);
    setNewBucketNameRulesVisibility(hasValidationError);
  }, [newBucketName, validateBucketName]);

  // Manual refresh handler
  const handleRefreshLocations = async () => {
    setIsRefreshing(true);
    try {
      // Refresh both storage locations and bucket details
      await Promise.all([refreshLocations(), loadBucketDetails()]);

      notifySuccess(t('refresh.success'), t('refresh.successMessage'));
    } catch (error: unknown) {
      notifyApiError('Refresh storage locations', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load S3 bucket details for creation date and owner
  const loadBucketDetails = async () => {
    try {
      const response = await apiClient.get(`/buckets`);
      const { owner, buckets } = response.data;
      const newBucketsState = new BucketsList(
        buckets.map((bucket: { Name: string; CreationDate: string }) => new Bucket(bucket.Name, bucket.CreationDate)),
        new Owner(owner.DisplayName, owner.ID),
      );
      setBucketsList(newBucketsState);
    } catch (error) {
      console.error('Failed to load bucket details:', error);
      // Don't show notification here as it's not critical and locations already handle errors
    }
  };

  const columnNames = {
    name: 'Name',
    type: 'Type',
    status: 'Status',
    creation_date: 'Creation Date',
    owner: 'Owner',
  };

  // Map locations to rows for display
  interface LocationRow {
    id: string;
    name: string;
    type: 's3' | 'local';
    available: boolean;
    creation_date?: string;
    owner?: string;
  }

  const rows: LocationRow[] = locations.map((location) => ({
    id: location.id,
    name: location.name,
    type: location.type,
    available: location.available,
    creation_date:
      location.type === 's3' ? bucketsList?.buckets.find((b) => b.Name === location.id)?.CreationDate : undefined,
    owner: location.type === 's3' ? bucketsList?.owner.DisplayName : undefined,
  }));

  const filteredRows = rows.filter(
    (row) =>
      Object.entries(row)
        .map(([_, value]) => value)
        .some((val) => val.toString().toLowerCase().includes(searchBucketText.toLowerCase())), // Search all fields with the search text
  );

  // Index of the currently sorted column
  const [activeSortIndex, setActiveSortIndex] = React.useState<number | null>(null);

  // Sort direction of the currently sorted column
  const [activeSortDirection, setActiveSortDirection] = React.useState<'asc' | 'desc' | null>(null);

  // Since OnSort specifies sorted columns by index, we need sortable values for our object by column index.
  const getSortableRowValues = (row: LocationRow): (string | number | boolean)[] => {
    const { name, type, available, creation_date, owner } = row;
    return [name, type, available ? 1 : 0, creation_date || '', owner || ''];
  };

  let sortedRows = filteredRows;
  if (activeSortIndex !== null) {
    sortedRows = rows.sort((a, b) => {
      const aValue = getSortableRowValues(a)[activeSortIndex as number];
      const bValue = getSortableRowValues(b)[activeSortIndex as number];
      if (typeof aValue === 'number') {
        // Numeric sort
        if (activeSortDirection === 'asc') {
          return (aValue as number) - (bValue as number);
        }
        return (bValue as number) - (aValue as number);
      } else {
        // String sort
        if (activeSortDirection === 'asc') {
          return (aValue as string).localeCompare(bValue as string);
        }
        return (bValue as string).localeCompare(aValue as string);
      }
    });
  }

  // Pagination logic
  const totalItems = sortedRows.length;
  const totalPages = Math.ceil(totalItems / bucketsPerPage);
  const startIndex = (currentPage - 1) * bucketsPerPage;
  const endIndex = Math.min(startIndex + bucketsPerPage, totalItems);
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  // Map rows to mobile card items
  const mobileCardItems: MobileCardItem[] = paginatedRows.map((row) => ({
    id: row.id,
    title: row.name,
    icon: row.type === 's3' ? <DatabaseIcon /> : <FolderIcon />,
    label: {
      text: row.type === 's3' ? 'S3' : 'PVC',
      color: row.type === 's3' ? 'blue' : 'green',
      icon: row.type === 's3' ? <CloudIcon /> : <FolderIcon />,
    },
    fields: [
      {
        label: 'Status',
        value: row.available ? 'Available' : <Label color="red">Unavailable</Label>,
      },
      {
        label: 'Created',
        value: row.creation_date || '-',
      },
      {
        label: 'Owner',
        value: row.owner || '-',
      },
    ],
    actions: row.type === 's3' && (
      <Button
        variant="danger"
        size="sm"
        onClick={handleDeleteBucketClick(row.name)}
        isDisabled={!row.available}
        aria-label={`Delete bucket ${row.name}`}
      >
        <TrashIcon />
      </Button>
    ),
    onClick: row.available ? () => navigate(`/browse/${row.id}`) : undefined,
    isDisabled: !row.available,
  }));

  // Reset to page 1 when search changes or page size changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchBucketText, bucketsPerPage]);

  // Ensure current page is valid when total pages changes
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const getSortParams = (columnIndex: number): ThProps['sort'] => ({
    sortBy: {
      index: activeSortIndex as number,
      direction: activeSortDirection as 'asc' | 'desc',
      defaultDirection: 'asc', // starting sort direction when first sorting a column. Defaults to 'asc'
    },
    onSort: (_event, index, direction) => {
      setActiveSortIndex(index);
      setActiveSortDirection(direction);
    },
    columnIndex,
  });

  // Load S3 bucket details at startup
  React.useEffect(() => {
    const initLoad = async () => {
      setIsLoadingBuckets(true);
      try {
        await loadBucketDetails();
      } finally {
        setIsLoadingBuckets(false);
      }
    };
    void initLoad();
  }, []);

  return (
    <div className="buckets-list">
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component={ContentVariants.h1}>Storage Management</Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Flex>
          <FlexItem>
            <TextInput
              value={searchBucketText}
              type="search"
              onChange={(_event, searchText) => setSearchBucketText(searchText)}
              aria-label="search text input"
              placeholder="Search storage locations"
              customIcon={<SearchIcon />}
              className="buckets-list-filter-search"
            />
          </FlexItem>
          <FlexItem>
            <FormSelect
              value={bucketsPerPage.toString()}
              aria-label="Items per page"
              onChange={(_e, value) => {
                setBucketsPerPage(parseInt(value, 10));
              }}
              ouiaId="PageSizeSelect"
              className="page-size-select"
            >
              {[10, 25, 50, 100].map((size) => (
                <FormSelectOption key={size} value={size.toString()} label={`${size} per page`} />
              ))}
            </FormSelect>
          </FlexItem>
          <FlexItem>
            <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Button
                  variant="plain"
                  aria-label="Previous page"
                  isDisabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  <AngleLeftIcon />
                </Button>
              </FlexItem>
              <FlexItem>
                <Content component={ContentVariants.small}>
                  {totalItems > 0 ? `Showing ${startIndex + 1}-${endIndex} of ${totalItems}` : 'No items'}
                </Content>
              </FlexItem>
              <FlexItem>
                <Button
                  variant="plain"
                  aria-label="Next page"
                  isDisabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  <AngleRightIcon />
                </Button>
              </FlexItem>
            </Flex>
          </FlexItem>
          <FlexItem flex={{ default: 'flex_1' }}></FlexItem>
          <FlexItem>
            <Button
              variant="secondary"
              onClick={handleRefreshLocations}
              isLoading={isRefreshing}
              isDisabled={isLoadingBuckets || isRefreshing}
              icon={<SyncIcon />}
              aria-label="Refresh storage locations"
            >
              Refresh
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="primary" onClick={createBucketModal.open} ouiaId="ShowCreateProjectModal">
              Create S3 Bucket
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Card component="div">
          {isLoadingBuckets ? (
            <>
              {/* Table view for loading (desktop) */}
              <div className="s4-table-view">
                <ResponsiveTableWrapper ariaLabel="Loading storage locations table">
                  <Table aria-label="Loading storage locations" isStickyHeader>
                    <Thead>
                      <Tr>
                        <Th width={15}>{columnNames.name}</Th>
                        <Th width={10}>{columnNames.type}</Th>
                        <Th width={10} className="s4-hide-below-sm">
                          {columnNames.status}
                        </Th>
                        <Th width={10} className="s4-hide-below-md">
                          {columnNames.creation_date}
                        </Th>
                        <Th width={10} className="s4-hide-below-md">
                          {columnNames.owner}
                        </Th>
                        <Th width={10} screenReaderText="Actions" />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {[1, 2, 3].map((i) => (
                        <Tr key={i} className="bucket-row">
                          <Td className="bucket-column">
                            <Skeleton width="60%" screenreaderText="Loading name" />
                          </Td>
                          <Td className="bucket-column">
                            <Skeleton width="50px" screenreaderText="Loading type" />
                          </Td>
                          <Td className="bucket-column s4-hide-below-sm">
                            <Skeleton width="80px" screenreaderText="Loading status" />
                          </Td>
                          <Td className="bucket-column s4-hide-below-md">
                            <Skeleton width="100px" screenreaderText="Loading date" />
                          </Td>
                          <Td className="bucket-column s4-hide-below-md">
                            <Skeleton width="80px" screenreaderText="Loading owner" />
                          </Td>
                          <Td className="bucket-column align-right">
                            <Skeleton width="40px" screenreaderText="Loading actions" />
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </ResponsiveTableWrapper>
              </div>
              {/* Card view for loading (mobile) */}
              <div className="s4-card-view">
                <MobileCardView items={[]} isLoading={true} skeletonCount={3} ariaLabel="Loading storage locations" />
              </div>
            </>
          ) : sortedRows.length === 0 ? (
            <EmptyState headingLevel="h4" icon={CubesIcon} titleText="No buckets found">
              <EmptyStateBody>Create your first bucket to get started.</EmptyStateBody>
              <EmptyStateFooter>
                <Button variant="primary" onClick={createBucketModal.open}>
                  Create bucket
                </Button>
              </EmptyStateFooter>
            </EmptyState>
          ) : (
            <>
              {/* Table view (desktop) */}
              <div className="s4-table-view">
                <ResponsiveTableWrapper ariaLabel="Storage locations list table">
                  <Table aria-label="Storage locations list" isStickyHeader>
                    <Thead>
                      <Tr>
                        <Th sort={getSortParams(0)} width={15}>
                          {columnNames.name}
                        </Th>
                        <Th width={10}>{columnNames.type}</Th>
                        <Th width={10} className="s4-hide-below-sm">
                          {columnNames.status}
                        </Th>
                        <Th width={10} className="s4-hide-below-md">
                          {columnNames.creation_date}
                        </Th>
                        <Th width={10} className="s4-hide-below-md">
                          {columnNames.owner}
                        </Th>
                        <Th width={10} screenReaderText="Actions" />
                      </Tr>
                    </Thead>
                    <Tbody>
                      {paginatedRows.map((row, rowIndex) => (
                        <Tr key={rowIndex} className="bucket-row">
                          <Td className="bucket-column">
                            <Button
                              variant="link"
                              onClick={() => {
                                navigate(`/browse/${row.id}`);
                              }}
                              isDisabled={!row.available}
                            >
                              {row.type === 's3' ? <DatabaseIcon /> : <FolderIcon />}
                              &nbsp;{row.name}
                            </Button>
                          </Td>
                          <Td className="bucket-column">
                            {row.type === 's3' ? (
                              <Label color="blue" icon={<CloudIcon />}>
                                S3
                              </Label>
                            ) : (
                              <Label color="green" icon={<FolderIcon />}>
                                PVC
                              </Label>
                            )}
                          </Td>
                          <Td className="bucket-column s4-hide-below-sm">
                            {!row.available && (
                              <Tooltip content="Storage location is not accessible">
                                <Label color="red">Unavailable</Label>
                              </Tooltip>
                            )}
                          </Td>
                          <Td className="bucket-column s4-hide-below-md">{row.creation_date || '-'}</Td>
                          <Td className="bucket-column s4-hide-below-md">{row.owner || '-'}</Td>
                          <Td className="bucket-column align-right">
                            {row.type === 's3' && (
                              <Button
                                variant="danger"
                                onClick={handleDeleteBucketClick(row.name)}
                                isDisabled={!row.available}
                                aria-label={`Delete bucket ${row.name}`}
                              >
                                <TrashIcon />
                              </Button>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </ResponsiveTableWrapper>
              </div>
              {/* Card view (mobile) */}
              <div className="s4-card-view">
                <MobileCardView items={mobileCardItems} ariaLabel="Storage locations list" />
              </div>
            </>
          )}
        </Card>
      </PageSection>
      <Modal
        className="standard-modal"
        isOpen={createBucketModal.isOpen}
        onClose={createBucketModal.close}
        ouiaId="CreateBucketModal"
        aria-labelledby="create-bucket-modal-title"
      >
        <ModalHeader labelId="create-bucket-modal-title" title="Create a new bucket" />
        <ModalBody>
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              if (newBucketName.length > 2 && validateBucketName(newBucketName)) {
                handleNewBucketCreate();
              }
            }}
          >
            <FormGroup label="Bucket name" isRequired fieldId="bucket-name">
              <TextInput
                isRequired
                type="text"
                id="bucket-name"
                name="bucket-name"
                aria-describedby="bucket-name-helper"
                placeholder="Enter at least 3 characters"
                value={newBucketName}
                onChange={(_event, newBucketName) => setNewBucketName(newBucketName)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (newBucketName.length > 2 && validateBucketName(newBucketName)) {
                      handleNewBucketCreate();
                    }
                  }
                }}
                validated={newBucketName.length >= 3 && !validateBucketName(newBucketName) ? 'error' : 'default'}
              />
              <FormHelperText>
                <HelperText id="bucket-name-helper">
                  {newBucketNameRulesVisibility ? (
                    <HelperTextItem variant="error">
                      Invalid bucket name{' '}
                      <Popover
                        headerContent="Bucket naming rules"
                        bodyContent={
                          <ul>
                            {getBucketNameRules().map((rule, index) => (
                              <li key={index}>{rule}</li>
                            ))}
                          </ul>
                        }
                      >
                        <Button variant="plain" aria-label="Naming rules" style={{ padding: 0 }}>
                          <QuestionCircleIcon />
                        </Button>
                      </Popover>
                    </HelperTextItem>
                  ) : null}
                </HelperText>
              </FormHelperText>
            </FormGroup>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button
            key="create"
            variant="primary"
            onClick={handleNewBucketCreate}
            isDisabled={newBucketName.length < 3 || newBucketNameRulesVisibility}
          >
            Create
          </Button>
          <Button key="cancel" variant="link" onClick={handleNewBucketCancel}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
      <Modal
        className="standard-modal"
        isOpen={deleteBucketModal.isOpen}
        onClose={deleteBucketModal.close}
        aria-labelledby="delete-bucket-modal-title"
      >
        <ModalHeader labelId="delete-bucket-modal-title" title="Delete bucket?" titleIconVariant="warning" />
        <ModalBody>
          <Content>
            <Content component={ContentVariants.p}>This action cannot be undone.</Content>
            <Content component={ContentVariants.p} id="delete-confirmation-instructions">
              Type <strong>{selectedBucket}</strong> to confirm deletion.
            </Content>
          </Content>
          <TextInput
            id="delete-modal-input"
            aria-label="Confirm bucket deletion"
            aria-describedby="delete-confirmation-instructions"
            value={bucketToDelete}
            onChange={(_event, bucketToDelete) => setBucketToDelete(bucketToDelete)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (validateBucketToDelete()) {
                  handleDeleteBucketConfirm();
                }
              }
            }}
            validated={bucketToDelete.length > 0 && !validateBucketToDelete() ? 'error' : 'default'}
          />
        </ModalBody>
        <ModalFooter>
          <Button
            key="confirm"
            variant="danger"
            onClick={handleDeleteBucketConfirm}
            isDisabled={!validateBucketToDelete()}
          >
            Delete bucket
          </Button>
          <Button key="cancel" variant="secondary" onClick={handleDeleteBucketCancel}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default Buckets;
