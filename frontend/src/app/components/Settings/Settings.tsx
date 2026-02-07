import { useTranslation } from 'react-i18next';
import HfLogo from '@app/assets/bgimages/hf-logo.svg';
import {
  Button,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  PageSection,
  Skeleton,
  Slider,
  SliderOnChangeEvent,
  Tab,
  TabTitleIcon,
  TabTitleText,
  Tabs,
  TabsProps,
  TextInput,
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core';
import { DatabaseIcon, EyeIcon, GlobeIcon } from '@patternfly/react-icons';
import * as React from 'react';
import apiClient from '@app/utils/apiClient';
import { notifyApiError, notifySuccess } from '@app/utils/notifications';
import { storageService } from '../../services/storageService';

class S3Settings {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
  defaultBucket: string;

  constructor(accessKeyId: string, secretAccessKey: string, region: string, endpoint: string, defaultBucket: string) {
    this.accessKeyId = accessKeyId ?? '';
    this.secretAccessKey = secretAccessKey ?? '';
    this.region = region ?? '';
    this.endpoint = endpoint ?? '';
    this.defaultBucket = defaultBucket ?? '';
  }
}

class HuggingFaceSettings {
  hfToken: string;

  constructor(hfToken: string) {
    this.hfToken = hfToken ?? '';
  }
}

class ProxySettings {
  httpProxy: string;
  httpsProxy: string;
  testUrl: string;

  constructor(httpProxy: string, httpsProxy: string) {
    this.httpProxy = httpProxy ?? '';
    this.httpsProxy = httpsProxy ?? '';
    this.testUrl = 'https://www.google.com';
  }
}

const SettingsManagement: React.FunctionComponent = () => {
  const { t } = useTranslation(['settings', 'translation']);

  /* Tabs Management */

  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0);
  const handleTabClick: TabsProps['onSelect'] = (_event, tabIndex) => {
    setActiveTabKey(tabIndex);
  };

  /* S3 Settings Management */

  const [s3Settings, setS3Settings] = React.useState<S3Settings>(new S3Settings('', '', '', '', ''));
  const [s3SettingsChanged, setS3SettingsChanged] = React.useState<boolean>(false);

  const [showS3SecretKey, setS3ShowSecretKey] = React.useState<boolean>(false);
  const [s3Loading, setS3Loading] = React.useState(true);

  React.useEffect(() => {
    setS3Loading(true);
    apiClient
      .get(`/settings/s3`)
      .then((response) => {
        const { settings } = response.data;
        if (settings !== undefined) {
          setS3Settings(
            new S3Settings(
              settings.accessKeyId,
              settings.secretAccessKey,
              settings.region,
              settings.endpoint,
              settings.defaultBucket,
            ),
          );
        }
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Fetch S3 settings', error);
      })
      .finally(() => {
        setS3Loading(false);
      });
  }, []);

  const handleS3Change = (value, field) => {
    setS3Settings((prevState) => ({
      ...prevState,
      [field]: value,
    }));
    setS3SettingsChanged(true);
  };

  const handleSaveS3Settings = (event) => {
    event.preventDefault();
    apiClient
      .put(`/settings/s3`, s3Settings)
      .then((_response) => {
        notifySuccess(
          t('translation:notifications.settingsSaved'),
          t('translation:notifications.settingsSavedMessage'),
        );
        setS3SettingsChanged(false);
        // Refresh storage locations to reflect new S3 configuration
        storageService.refreshLocations().catch((error) => {
          console.error('Failed to refresh storage locations after S3 config update:', error);
          // Don't show error notification - settings were saved successfully
        });
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Save S3 settings', error);
      });
  };

  const handleTestS3Connection = (event) => {
    event.preventDefault();
    apiClient
      .post(`/settings/test-s3`, s3Settings)
      .then((_response) => {
        notifySuccess(t('translation:notifications.connectionSuccess'), t('s3.testSuccess'));
      })
      .catch((error) => {
        notifyApiError('Test S3 connection', error);
      });
  };

  /* HuggingFace Settings Management */

  const [hfSettings, setHfSettings] = React.useState<HuggingFaceSettings>(new HuggingFaceSettings(''));
  const [hfSettingsChanged, setHfSettingsChanged] = React.useState<boolean>(false);

  const [showHfToken, setHfShowToken] = React.useState<boolean>(false);
  const [hfLoading, setHfLoading] = React.useState(true);

  React.useEffect(() => {
    setHfLoading(true);
    apiClient
      .get(`/settings/huggingface`)
      .then((response) => {
        const { settings } = response.data;
        if (settings !== undefined) {
          setHfSettings(new HuggingFaceSettings(settings.hfToken));
        }
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Fetch HuggingFace settings', error);
      })
      .finally(() => {
        setHfLoading(false);
      });
  }, []);

  const handleHfChange = (value, field) => {
    setHfSettings((prevState) => ({
      ...prevState,
      [field]: value,
    }));
    setHfSettingsChanged(true);
  };

  const handleSaveHfSettings = (event) => {
    event.preventDefault();
    apiClient
      .put(`/settings/huggingface`, hfSettings)
      .then((_response) => {
        notifySuccess(
          t('translation:notifications.settingsSaved'),
          t('translation:notifications.settingsSavedMessage'),
        );
        setHfSettingsChanged(false);
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Save HuggingFace settings', error);
      });
  };

  const handleTestHfConnection = (event) => {
    event.preventDefault();
    apiClient
      .post(`/settings/test-huggingface`, hfSettings)
      .then((response) => {
        notifySuccess(
          t('translation:notifications.connectionSuccess'),
          t('huggingface.testSuccess', { tokenName: response.data.accessTokenDisplayName }),
        );
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Test HuggingFace connection', error);
      });
  };

  /* Max Concurrent Transfers Management */

  const [maxConcurrentTransfers, setMaxConcurrentTransfers] = React.useState<number>(0);
  const [maxFilesPerPage, setMaxFilesPerPage] = React.useState<number>(100);

  React.useEffect(() => {
    apiClient
      .get(`/settings/max-concurrent-transfers`)
      .then((response) => {
        const { maxConcurrentTransfers } = response.data;
        if (maxConcurrentTransfers !== undefined) {
          setMaxConcurrentTransfers(maxConcurrentTransfers);
        }
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Fetch Max Concurrent Transfers settings', error);
      });
  }, []);

  React.useEffect(() => {
    apiClient
      .get(`/settings/max-files-per-page`)
      .then((response) => {
        const { maxFilesPerPage } = response.data;
        if (maxFilesPerPage !== undefined) {
          setMaxFilesPerPage(maxFilesPerPage);
        }
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Fetch Max Files Per Page settings', error);
      });
  }, []);

  const handleSaveMaxConcurrentTransfers = (event) => {
    event.preventDefault();
    apiClient
      .put(`/settings/max-concurrent-transfers`, { maxConcurrentTransfers })
      .then((_response) => {
        notifySuccess(
          t('translation:notifications.settingsSaved'),
          t('translation:notifications.settingsSavedMessage'),
        );
      })
      .catch((error) => {
        console.error(error);
        notifyApiError(t('concurrency.save'), error);
      });
  };

  const handleSaveMaxFilesPerPage = (event) => {
    event.preventDefault();
    apiClient
      .put(`/settings/max-files-per-page`, { maxFilesPerPage })
      .then((_response) => {
        notifySuccess(
          t('translation:notifications.settingsSaved'),
          t('translation:notifications.settingsSavedMessage'),
        );
      })
      .catch((error) => {
        console.error(error);
        notifyApiError(t('pagination.save'), error);
      });
  };

  /* Proxy Settings Management */

  const [proxySettings, setProxySettings] = React.useState<ProxySettings>(new ProxySettings('', ''));
  const [proxySettingsChanged, setProxySettingsChanged] = React.useState<boolean>(false);
  const [proxyLoading, setProxyLoading] = React.useState(true);

  React.useEffect(() => {
    setProxyLoading(true);
    apiClient
      .get(`/settings/proxy`)
      .then((response) => {
        const { settings } = response.data;
        if (settings !== undefined) {
          setProxySettings(new ProxySettings(settings.httpProxy, settings.httpsProxy));
        }
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Fetch proxy settings', error);
      })
      .finally(() => {
        setProxyLoading(false);
      });
  }, []);

  const handleProxyChange = (value, field) => {
    setProxySettings((prevState) => ({
      ...prevState,
      [field]: value,
    }));
    setProxySettingsChanged(true);
  };

  const handleSaveProxySettings = (event) => {
    event.preventDefault();
    apiClient
      .put(`/settings/proxy`, {
        httpProxy: proxySettings.httpProxy,
        httpsProxy: proxySettings.httpsProxy,
      })
      .then((_response) => {
        notifySuccess(t('translation:notifications.settingsSaved'), t('proxy.saved'));
        setProxySettingsChanged(false);
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Save proxy settings', error);
      });
  };

  const handleTestProxyConnection = (event) => {
    event.preventDefault();
    apiClient
      .post(`/settings/test-proxy`, {
        httpProxy: proxySettings.httpProxy,
        httpsProxy: proxySettings.httpsProxy,
        testUrl: proxySettings.testUrl,
      })
      .then((_response) => {
        notifySuccess(t('translation:notifications.connectionSuccess'), t('proxy.testSuccess'));
      })
      .catch((error) => {
        console.error(error);
        notifyApiError('Test proxy connection', error);
      });
  };

  /* Render */

  return (
    <div>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component={ContentVariants.h1}>Settings</Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick} aria-label="Settings Tabs" isBox={false} role="region">
          <Tab
            eventKey={0}
            title={
              <>
                <TabTitleIcon>
                  <DatabaseIcon />
                </TabTitleIcon>{' '}
                <TabTitleText>S3 Settings</TabTitleText>{' '}
              </>
            }
            aria-label="S3 settings"
          >
            {s3Loading ? (
              <Form className="settings-form">
                <FormGroup label="Access key" fieldId="accessKeyId-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText="Loading access key" />
                </FormGroup>
                <FormGroup label="Secret key" fieldId="secretAccessKey-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText="Loading secret key" />
                </FormGroup>
                <FormGroup label="Region" fieldId="region-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText="Loading region" />
                </FormGroup>
                <FormGroup label="Endpoint" fieldId="endpoint-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText="Loading endpoint" />
                </FormGroup>
                <FormGroup label="Default Bucket" fieldId="defaultBucket-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText="Loading default bucket" />
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText="Loading save button" />
                  </FlexItem>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText="Loading test button" />
                  </FlexItem>
                </Flex>
              </Form>
            ) : (
              <Form onSubmit={handleSaveS3Settings} className="settings-form">
                <FormGroup label="Access key" fieldId="accessKeyId">
                  <TextInput
                    value={s3Settings.accessKeyId}
                    onChange={(_event, value) => handleS3Change(value, 'accessKeyId')}
                    id="accessKeyId"
                    name="accessKeyId"
                    className="form-settings"
                    aria-describedby="accessKeyId-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="accessKeyId-helper">Your S3 access key ID for authentication</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="Secret key" fieldId="secretAccessKey">
                  <TextInputGroup className="form-settings">
                    <TextInputGroupMain
                      value={s3Settings.secretAccessKey}
                      onChange={(_event, value) => handleS3Change(value, 'secretAccessKey')}
                      id="secretAccessKey"
                      name="secretAccessKey"
                      type={showS3SecretKey ? 'text' : 'password'}
                      aria-describedby="secretAccessKey-helper"
                    />
                    <TextInputGroupUtilities>
                      <Button
                        icon={<EyeIcon />}
                        variant="plain"
                        aria-label={showS3SecretKey ? 'Hide secret key' : 'Show secret key'}
                        onClick={() => setS3ShowSecretKey(!showS3SecretKey)}
                      />
                    </TextInputGroupUtilities>
                  </TextInputGroup>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="secretAccessKey-helper">
                        Your S3 secret access key for authentication
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="Region" fieldId="region">
                  <TextInput
                    value={s3Settings.region}
                    onChange={(_event, value) => handleS3Change(value, 'region')}
                    id="region"
                    name="region"
                    className="form-settings"
                    aria-describedby="region-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="region-helper">
                        AWS region where your S3 buckets are located (e.g., us-east-1)
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="Endpoint" fieldId="endpoint">
                  <TextInput
                    value={s3Settings.endpoint}
                    onChange={(_event, value) => handleS3Change(value, 'endpoint')}
                    id="endpoint"
                    name="endpoint"
                    className="form-settings-long"
                    aria-describedby="endpoint-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="endpoint-helper">
                        S3 endpoint URL (leave empty to use AWS default)
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="Default Bucket" fieldId="defaultBucket">
                  <TextInput
                    value={s3Settings.defaultBucket}
                    onChange={(_event, value) => handleS3Change(value, 'defaultBucket')}
                    id="defaultBucket"
                    name="defaultBucket"
                    className="form-settings"
                    aria-describedby="defaultBucket-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="defaultBucket-helper">
                        Default bucket to use for storage operations
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Button type="submit" className="form-settings-submit" isDisabled={!s3SettingsChanged}>
                      Save S3 Settings
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button className="form-settings-submit" onClick={handleTestS3Connection}>
                      Test Connection
                    </Button>
                  </FlexItem>
                </Flex>
              </Form>
            )}
          </Tab>
          <Tab
            eventKey={1}
            title={
              <>
                <TabTitleIcon>
                  <img className="tab-logo" src={HfLogo} alt="HuggingFace Logo" />
                </TabTitleIcon>{' '}
                <TabTitleText>HuggingFace Settings</TabTitleText>{' '}
              </>
            }
            aria-label="HuggingFace settings"
          >
            {hfLoading ? (
              <Form className="settings-form">
                <FormGroup label="Token" fieldId="token-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText="Loading token" />
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Skeleton width="200px" height="36px" screenreaderText="Loading save button" />
                  </FlexItem>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText="Loading test button" />
                  </FlexItem>
                </Flex>
              </Form>
            ) : (
              <Form onSubmit={handleSaveHfSettings} className="settings-form">
                <FormGroup label="Token" fieldId="token">
                  <TextInputGroup className="form-settings">
                    <TextInputGroupMain
                      value={hfSettings.hfToken}
                      onChange={(_event, value) => handleHfChange(value, 'hfToken')}
                      id="hfToken"
                      name="hfToken"
                      type={showHfToken ? 'text' : 'password'}
                    />
                    <TextInputGroupUtilities>
                      <Button
                        icon={<EyeIcon />}
                        variant="plain"
                        aria-label={showHfToken ? 'Hide token' : 'Show token'}
                        onClick={() => setHfShowToken(!showHfToken)}
                      />
                    </TextInputGroupUtilities>
                  </TextInputGroup>
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Button type="submit" className="form-settings-submit" isDisabled={!hfSettingsChanged}>
                      Save HuggingFace Settings
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button className="form-settings-submit" onClick={handleTestHfConnection}>
                      Test Connection
                    </Button>
                  </FlexItem>
                </Flex>
              </Form>
            )}
          </Tab>
          <Tab
            eventKey={2}
            title={
              <>
                <TabTitleIcon>
                  <DatabaseIcon />
                </TabTitleIcon>{' '}
                <TabTitleText>Max Concurrent Transfers</TabTitleText>{' '}
              </>
            }
            aria-label="Max concurrent transfers"
          >
            <Form onSubmit={handleSaveMaxConcurrentTransfers} className="settings-form">
              <FormGroup label={'Max Concurrent Transfers: ' + maxConcurrentTransfers} fieldId="maxConcurrentTransfers">
                <Slider
                  hasTooltipOverThumb={false}
                  value={maxConcurrentTransfers}
                  min={1}
                  max={10}
                  className="form-settings-slider"
                  onChange={(_event: SliderOnChangeEvent, value: number) => setMaxConcurrentTransfers(value)}
                  aria-label="Max concurrent transfers slider"
                  aria-describedby="maxConcurrentTransfers-helper"
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem id="maxConcurrentTransfers-helper">
                      Maximum number of simultaneous file transfers (1-10)
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <Button type="submit" className="form-settings-submit">
                Save Max Concurrent Transfers
              </Button>
            </Form>
          </Tab>
          <Tab
            eventKey={3}
            title={
              <>
                <TabTitleIcon>
                  <DatabaseIcon />
                </TabTitleIcon>{' '}
                <TabTitleText>Max Files Per Page</TabTitleText>{' '}
              </>
            }
            aria-label="Max files per page"
          >
            <Form onSubmit={handleSaveMaxFilesPerPage} className="settings-form">
              <FormGroup label={'Max Files Per Page: ' + maxFilesPerPage} fieldId="maxFilesPerPage">
                <Slider
                  hasTooltipOverThumb={false}
                  value={maxFilesPerPage}
                  min={10}
                  max={1000}
                  step={10}
                  className="form-settings-slider"
                  onChange={(_event: SliderOnChangeEvent, value: number) => setMaxFilesPerPage(value)}
                  aria-label="Max files per page slider"
                  aria-describedby="maxFilesPerPage-helper"
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem id="maxFilesPerPage-helper">
                      Maximum number of files displayed per page (10-1000)
                    </HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <Button type="submit" className="form-settings-submit">
                Save Max Files Per Page
              </Button>
            </Form>
          </Tab>
          <Tab
            eventKey={4}
            title={
              <>
                <TabTitleIcon>
                  <GlobeIcon />
                </TabTitleIcon>{' '}
                <TabTitleText>Proxy Settings</TabTitleText>{' '}
              </>
            }
            aria-label="Proxy settings"
          >
            {proxyLoading ? (
              <Form className="settings-form">
                <FormGroup label="HTTP Proxy" fieldId="httpProxy-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText="Loading HTTP proxy" />
                </FormGroup>
                <FormGroup label="HTTPS Proxy" fieldId="httpsProxy-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText="Loading HTTPS proxy" />
                </FormGroup>
                <FormGroup label="Test URL" fieldId="testUrl-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText="Loading test URL" />
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Skeleton width="180px" height="36px" screenreaderText="Loading save button" />
                  </FlexItem>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText="Loading test button" />
                  </FlexItem>
                </Flex>
              </Form>
            ) : (
              <Form onSubmit={handleSaveProxySettings} className="settings-form">
                <FormGroup label="HTTP Proxy" fieldId="httpProxy">
                  <TextInput
                    value={proxySettings.httpProxy}
                    onChange={(_event, value) => handleProxyChange(value, 'httpProxy')}
                    id="httpProxy"
                    name="httpProxy"
                    placeholder="http://proxy-server:port"
                    className="form-settings-long"
                    aria-describedby="httpProxy-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="httpProxy-helper">
                        HTTP proxy server URL (e.g., http://proxy-server:8080)
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="HTTPS Proxy" fieldId="httpsProxy">
                  <TextInput
                    value={proxySettings.httpsProxy}
                    onChange={(_event, value) => handleProxyChange(value, 'httpsProxy')}
                    id="httpsProxy"
                    name="httpsProxy"
                    placeholder="https://proxy-server:port"
                    className="form-settings-long"
                    aria-describedby="httpsProxy-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="httpsProxy-helper">
                        HTTPS proxy server URL (e.g., https://proxy-server:8443)
                      </HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label="Test URL" fieldId="testUrl">
                  <TextInput
                    value={proxySettings.testUrl}
                    onChange={(_event, value) => handleProxyChange(value, 'testUrl')}
                    id="testUrl"
                    name="testUrl"
                    placeholder="https://www.google.com"
                    className="form-settings-long"
                    aria-describedby="testUrl-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="testUrl-helper">URL to test proxy connectivity</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Button type="submit" className="form-settings-submit" isDisabled={!proxySettingsChanged}>
                      Save Proxy Settings
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button className="form-settings-submit" onClick={handleTestProxyConnection}>
                      Test Connection
                    </Button>
                  </FlexItem>
                </Flex>
              </Form>
            )}
          </Tab>
        </Tabs>
      </PageSection>
    </div>
  );
};

export default SettingsManagement;
