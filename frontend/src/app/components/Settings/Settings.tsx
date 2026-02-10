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
import { PAGE_SIZE_PRESETS, snapToNearestPreset } from '@app/utils/paginationPresets';

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
        notifyApiError(t('s3.save'), error);
      })
      .finally(() => {
        setS3Loading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        notifyApiError(t('s3.save'), error);
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
        notifyApiError(t('s3.test'), error);
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
        notifyApiError(t('huggingface.save'), error);
      })
      .finally(() => {
        setHfLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        notifyApiError(t('huggingface.save'), error);
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
        notifyApiError(t('huggingface.test'), error);
      });
  };

  /* Max Concurrent Transfers Management */

  const [maxConcurrentTransfers, setMaxConcurrentTransfers] = React.useState<number>(0);
  const [maxFilesPerPage, setMaxFilesPerPage] = React.useState<number>(100);

  // Build customSteps for the pagination slider — evenly-spaced percentage ticks
  const paginationSteps = React.useMemo(
    () =>
      PAGE_SIZE_PRESETS.map((preset, index) => ({
        value: (index / (PAGE_SIZE_PRESETS.length - 1)) * 100,
        label: String(preset),
      })),
    [],
  );

  const presetToSliderPercent = React.useCallback((preset: number): number => {
    const idx = PAGE_SIZE_PRESETS.indexOf(preset as (typeof PAGE_SIZE_PRESETS)[number]);
    if (idx === -1) return 0;
    return (idx / (PAGE_SIZE_PRESETS.length - 1)) * 100;
  }, []);

  const sliderPercentToPreset = React.useCallback((percent: number): number => {
    const idx = Math.round((percent / 100) * (PAGE_SIZE_PRESETS.length - 1));
    return PAGE_SIZE_PRESETS[Math.min(Math.max(idx, 0), PAGE_SIZE_PRESETS.length - 1)];
  }, []);

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
        notifyApiError(t('concurrency.save'), error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    apiClient
      .get(`/settings/max-files-per-page`)
      .then((response) => {
        const { maxFilesPerPage } = response.data;
        if (maxFilesPerPage !== undefined) {
          setMaxFilesPerPage(snapToNearestPreset(maxFilesPerPage));
        }
      })
      .catch((error) => {
        console.error(error);
        notifyApiError(t('pagination.save'), error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        notifyApiError(t('proxy.save'), error);
      })
      .finally(() => {
        setProxyLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        notifyApiError(t('proxy.save'), error);
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
        notifyApiError(t('proxy.test'), error);
      });
  };

  /* Render */

  return (
    <div>
      <PageSection hasBodyWrapper={false}>
        <Content>
          <Content component={ContentVariants.h1}>{t('title')}</Content>
        </Content>
      </PageSection>
      <PageSection hasBodyWrapper={false}>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick} aria-label={t('title')} isBox={false} role="region">
          <Tab
            eventKey={0}
            title={
              <>
                <TabTitleIcon>
                  <DatabaseIcon />
                </TabTitleIcon>{' '}
                <TabTitleText>{t('tabs.s3')}</TabTitleText>{' '}
              </>
            }
            aria-label={t('tabs.s3')}
          >
            {s3Loading ? (
              <Form className="settings-form">
                <FormGroup label={t('s3.accessKey.label')} fieldId="accessKeyId-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <FormGroup label={t('s3.secretKey.label')} fieldId="secretAccessKey-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <FormGroup label={t('s3.region.label')} fieldId="region-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <FormGroup label={t('s3.endpoint.label')} fieldId="endpoint-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <FormGroup label={t('s3.defaultBucket.label')} fieldId="defaultBucket-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                  </FlexItem>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                  </FlexItem>
                </Flex>
              </Form>
            ) : (
              <Form onSubmit={handleSaveS3Settings} className="settings-form">
                <FormGroup label={t('s3.accessKey.label')} fieldId="accessKeyId">
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
                      <HelperTextItem id="accessKeyId-helper">{t('s3.accessKey.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label={t('s3.secretKey.label')} fieldId="secretAccessKey">
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
                        aria-label={showS3SecretKey ? t('s3.secretKey.hide') : t('s3.secretKey.show')}
                        onClick={() => setS3ShowSecretKey(!showS3SecretKey)}
                      />
                    </TextInputGroupUtilities>
                  </TextInputGroup>
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="secretAccessKey-helper">{t('s3.secretKey.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label={t('s3.region.label')} fieldId="region">
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
                      <HelperTextItem id="region-helper">{t('s3.region.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label={t('s3.endpoint.label')} fieldId="endpoint">
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
                      <HelperTextItem id="endpoint-helper">{t('s3.endpoint.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label={t('s3.defaultBucket.label')} fieldId="defaultBucket">
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
                      <HelperTextItem id="defaultBucket-helper">{t('s3.defaultBucket.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Button type="submit" className="form-settings-submit" isDisabled={!s3SettingsChanged}>
                      {t('s3.save')}
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button className="form-settings-submit" onClick={handleTestS3Connection}>
                      {t('s3.test')}
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
                <TabTitleText>{t('tabs.huggingface')}</TabTitleText>{' '}
              </>
            }
            aria-label={t('tabs.huggingface')}
          >
            {hfLoading ? (
              <Form className="settings-form">
                <FormGroup label={t('huggingface.token.label')} fieldId="token-skeleton">
                  <Skeleton width="25%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Skeleton width="200px" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                  </FlexItem>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                  </FlexItem>
                </Flex>
              </Form>
            ) : (
              <Form onSubmit={handleSaveHfSettings} className="settings-form">
                <FormGroup label={t('huggingface.token.label')} fieldId="token">
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
                        aria-label={showHfToken ? t('huggingface.token.hide') : t('huggingface.token.show')}
                        onClick={() => setHfShowToken(!showHfToken)}
                      />
                    </TextInputGroupUtilities>
                  </TextInputGroup>
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Button type="submit" className="form-settings-submit" isDisabled={!hfSettingsChanged}>
                      {t('huggingface.save')}
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button className="form-settings-submit" onClick={handleTestHfConnection}>
                      {t('huggingface.test')}
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
                <TabTitleText>{t('tabs.concurrency')}</TabTitleText>{' '}
              </>
            }
            aria-label={t('tabs.concurrency')}
          >
            <Form onSubmit={handleSaveMaxConcurrentTransfers} className="settings-form">
              <FormGroup
                label={t('concurrency.label', { value: maxConcurrentTransfers })}
                fieldId="maxConcurrentTransfers"
              >
                <Slider
                  hasTooltipOverThumb={false}
                  value={maxConcurrentTransfers}
                  min={1}
                  max={10}
                  className="form-settings-slider"
                  onChange={(_event: SliderOnChangeEvent, value: number) => setMaxConcurrentTransfers(value)}
                  aria-label={t('tabs.concurrency')}
                  aria-describedby="maxConcurrentTransfers-helper"
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem id="maxConcurrentTransfers-helper">{t('concurrency.helper')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <Button type="submit" className="form-settings-submit">
                {t('concurrency.save')}
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
                <TabTitleText>{t('tabs.pagination')}</TabTitleText>{' '}
              </>
            }
            aria-label={t('tabs.pagination')}
          >
            <Form onSubmit={handleSaveMaxFilesPerPage} className="settings-form">
              <FormGroup label={t('pagination.label', { value: maxFilesPerPage })} fieldId="maxFilesPerPage">
                <Slider
                  hasTooltipOverThumb={false}
                  value={presetToSliderPercent(maxFilesPerPage)}
                  customSteps={paginationSteps}
                  className="form-settings-slider"
                  onChange={(_event: SliderOnChangeEvent, value: number) =>
                    setMaxFilesPerPage(sliderPercentToPreset(value))
                  }
                  aria-label={t('tabs.pagination')}
                  aria-describedby="maxFilesPerPage-helper"
                />
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem id="maxFilesPerPage-helper">{t('pagination.helper')}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              </FormGroup>
              <Button type="submit" className="form-settings-submit">
                {t('pagination.save')}
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
                <TabTitleText>{t('tabs.proxy')}</TabTitleText>{' '}
              </>
            }
            aria-label={t('tabs.proxy')}
          >
            {proxyLoading ? (
              <Form className="settings-form">
                <FormGroup label={t('proxy.httpProxy.label')} fieldId="httpProxy-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <FormGroup label={t('proxy.httpsProxy.label')} fieldId="httpsProxy-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <FormGroup label={t('proxy.testUrl.label')} fieldId="testUrl-skeleton">
                  <Skeleton width="50%" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Skeleton width="180px" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                  </FlexItem>
                  <FlexItem>
                    <Skeleton width="150px" height="36px" screenreaderText={t('translation:common.actions.loading')} />
                  </FlexItem>
                </Flex>
              </Form>
            ) : (
              <Form onSubmit={handleSaveProxySettings} className="settings-form">
                <FormGroup label={t('proxy.httpProxy.label')} fieldId="httpProxy">
                  <TextInput
                    value={proxySettings.httpProxy}
                    onChange={(_event, value) => handleProxyChange(value, 'httpProxy')}
                    id="httpProxy"
                    name="httpProxy"
                    placeholder={t('proxy.httpProxy.placeholder')}
                    className="form-settings-long"
                    aria-describedby="httpProxy-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="httpProxy-helper">{t('proxy.httpProxy.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label={t('proxy.httpsProxy.label')} fieldId="httpsProxy">
                  <TextInput
                    value={proxySettings.httpsProxy}
                    onChange={(_event, value) => handleProxyChange(value, 'httpsProxy')}
                    id="httpsProxy"
                    name="httpsProxy"
                    placeholder={t('proxy.httpsProxy.placeholder')}
                    className="form-settings-long"
                    aria-describedby="httpsProxy-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="httpsProxy-helper">{t('proxy.httpsProxy.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <FormGroup label={t('proxy.testUrl.label')} fieldId="testUrl">
                  <TextInput
                    value={proxySettings.testUrl}
                    onChange={(_event, value) => handleProxyChange(value, 'testUrl')}
                    id="testUrl"
                    name="testUrl"
                    placeholder={t('proxy.testUrl.placeholder')}
                    className="form-settings-long"
                    aria-describedby="testUrl-helper"
                  />
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem id="testUrl-helper">{t('proxy.testUrl.helper')}</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                </FormGroup>
                <Flex>
                  <FlexItem>
                    <Button type="submit" className="form-settings-submit" isDisabled={!proxySettingsChanged}>
                      {t('proxy.save')}
                    </Button>
                  </FlexItem>
                  <FlexItem>
                    <Button className="form-settings-submit" onClick={handleTestProxyConnection}>
                      {t('proxy.test')}
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
