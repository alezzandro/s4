import logoReverse from '@app/assets/bgimages/s4-icon.svg';
import logoStd from '@app/assets/bgimages/s4-icon.svg';
import { IAppRoute, IAppRouteGroup, routes } from '@app/routes';
import {
  Alert,
  AlertActionCloseButton,
  AlertGroup,
  AlertProps,
  Brand,
  Button,
  ButtonVariant,
  Content,
  ContentVariants,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Flex,
  FlexItem,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  MenuToggle,
  MenuToggleElement,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  NavExpandable,
  NavItem,
  NavList,
  NotificationBadge,
  NotificationBadgeVariant,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerHeader,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader,
  Page,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Popover,
  SkipToContent,
  ToggleGroup,
  ToggleGroupItem,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { BarsIcon, EllipsisVIcon, QuestionCircleIcon, SearchIcon, SignOutAltIcon } from '@patternfly/react-icons';
import MoonIcon from '@patternfly/react-icons/dist/esm/icons/moon-icon';
import SunIcon from '@patternfly/react-icons/dist/esm/icons/sun-icon';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supportedLngs } from '../../../i18n/config';
import apiClient from '@app/utils/apiClient';
import Emitter, { EventMap } from '../../utils/emitter';
import { useAuth } from '@app/components/AuthContext/AuthContext';
import { useModal } from '@app/hooks';
import forkLogo from '../../assets/bgimages/fork.svg';
import forkLogoWhite from '../../assets/bgimages/fork-white.svg';
import githubLogo from '../../assets/bgimages/github-mark.svg';
import githubLogoWhite from '../../assets/bgimages/github-mark-white.svg';
import starLogo from '../../assets/bgimages/star.svg';
import starLogoWhite from '../../assets/bgimages/star-white.svg';

interface IAppLayout {
  children: React.ReactNode;
}

const AppLayout: React.FunctionComponent<IAppLayout> = ({ children }) => {
  // Auth
  const { isAuthenticated, authMode, logout } = useAuth();
  const _navigate = useNavigate();

  // Theme
  const [isDarkTheme, setIsDarkTheme] = React.useState(false);

  // Language dropdown
  const [isLanguageDropdownOpen, setLanguageDropdownOpen] = React.useState(false);

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = savedTheme === 'dark';
    setIsDarkTheme(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add('pf-v6-theme-dark');
    }
  }, []);

  const handleLanguageChange = (_event: React.MouseEvent | undefined, value: string | number | undefined) => {
    if (typeof value === 'string') {
      i18n.changeLanguage(value);
    }
    setLanguageDropdownOpen(false);
  };

  const handleThemeToggle = (checked: boolean) => {
    setIsDarkTheme(checked);
    if (checked) {
      document.documentElement.classList.add('pf-v6-theme-dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('pf-v6-theme-dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Logout handler
  const handleLogout = () => {
    logout();
    // AuthGate will automatically show login page after logout
  };

  // Git
  const [repoStars, setRepoStars] = React.useState<number | null>(null);
  const [repoForks, setRepoForks] = React.useState<number | null>(null);

  //i18n
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage || 'en';
  const currentLngDisplay = supportedLngs[currentLanguage] || supportedLngs['en'];

  // Fetch GitHub stars and forks
  React.useEffect(() => {
    fetch('https://api.github.com/repos/rh-aiservices-bu/s4')
      .then((response) => response.json())
      .then((data) => {
        setRepoStars(data.stargazers_count);
        setRepoForks(data.forks_count);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch GitHub stars:', error);
      });
  }, []);

  // Notifications
  interface NotificationProps {
    title: string;
    srTitle: string;
    variant: 'custom' | 'success' | 'danger' | 'warning' | 'info';
    key: React.Key;
    timestamp: string;
    description: string;
    isNotificationRead: boolean;
  }

  const maxDisplayedAlerts = 3;
  const alertTimeout = 8000;

  const [isDrawerExpanded, setDrawerExpanded] = React.useState(false);
  const [openDropdownKey, setOpenDropdownKey] = React.useState<React.Key | null>(null);
  const [overflowMessage, setOverflowMessage] = React.useState<string>('');
  const [maxDisplayed, _setMaxDisplayed] = React.useState(maxDisplayedAlerts);
  const [alerts, setAlerts] = React.useState<React.ReactElement<AlertProps>[]>([]);
  const [notifications, setNotifications] = React.useState<NotificationProps[]>([]);

  React.useEffect(() => {
    const handleNotification = (data: EventMap['notification']) => {
      addNewNotification(data.variant, data.title, data.description);
    };

    Emitter.on('notification', handleNotification);

    // Clean up the subscription when the component unmounts
    return () => {
      Emitter.off('notification', handleNotification);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // addNewNotification is not memoized; event subscription should only run once on mount

  React.useEffect(() => {
    setOverflowMessage(buildOverflowMessage());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxDisplayed, notifications, alerts]); // buildOverflowMessage uses these values directly

  const addNewNotification = (variant: NotificationProps['variant'], inputTitle, description) => {
    const key = getUniqueId();
    const timestamp = getTimeCreated();

    // Extract message from description if possible
    let errorDescription: string = '';
    try {
      const errorPrefix = 'OpenAI API error: Error code: ';
      if (typeof description === 'string' && description.startsWith(errorPrefix)) {
        const jsonPart = description.substring(description.indexOf('{'));
        const jsonString = jsonPart // JSON cleaning
          .replace(/'/g, '"')
          .replace(/None/g, 'null')
          .replace(/True/g, 'true')
          .replace(/False/g, 'false');
        const errorObj = JSON.parse(jsonString);
        if (errorObj && errorObj.message) {
          errorDescription = `${errorObj.message}`;
        }
      }
    } catch (e) {
      console.error('Could not parse error description:', e);
    }

    const variantFormatted = variant.charAt(0).toUpperCase() + variant.slice(1);
    let title = '';
    if (inputTitle !== '') {
      title = errorDescription
        ? variantFormatted + ' - ' + inputTitle + ': ' + errorDescription
        : variantFormatted + ' - ' + inputTitle;
    } else {
      title = variantFormatted;
    }
    const srTitle = variantFormatted + ' alert';

    setNotifications((prevNotifications) => [
      { title, srTitle, variant, key, timestamp, description, isNotificationRead: false },
      ...prevNotifications,
    ]);

    if (!isDrawerExpanded) {
      setAlerts((prevAlerts) => [
        <Alert
          variant={variant}
          title={title}
          timeout={alertTimeout}
          onTimeout={() => removeAlert(key)}
          isLiveRegion
          actionClose={
            <AlertActionCloseButton title={title} variantLabel={`${variant} alert`} onClose={() => removeAlert(key)} />
          }
          key={key}
          id={key.toString()}
        >
          <p>{description}</p>
        </Alert>,
        ...prevAlerts,
      ]);
    }
  };

  const removeNotification = (key: React.Key) => {
    setNotifications((prevNotifications) => prevNotifications.filter((notification) => notification.key !== key));
  };

  const removeAllNotifications = () => {
    setNotifications([]);
  };

  const isNotificationRead = (key: React.Key) =>
    notifications.find((notification) => notification.key === key)?.isNotificationRead;

  const markNotificationRead = (key: React.Key) => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.key === key ? { ...notification, isNotificationRead: true } : notification,
      ),
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) => ({ ...notification, isNotificationRead: true })),
    );
  };

  const getUnreadNotificationsNumber = () =>
    notifications.filter((notification) => notification.isNotificationRead === false).length;

  const containsUnreadAlertNotification = () =>
    notifications.filter(
      (notification) => notification.isNotificationRead === false && notification.variant === 'danger',
    ).length > 0;

  const getNotificationBadgeVariant = () => {
    if (getUnreadNotificationsNumber() === 0) {
      return NotificationBadgeVariant.read;
    }
    if (containsUnreadAlertNotification()) {
      return NotificationBadgeVariant.attention;
    }
    return NotificationBadgeVariant.unread;
  };

  const onNotificationBadgeClick = () => {
    removeAllAlerts();
    setDrawerExpanded(!isDrawerExpanded);
  };

  const onDropdownToggle = (id: React.Key) => {
    if (id && openDropdownKey !== id) {
      setOpenDropdownKey(id);
      return;
    }
    setOpenDropdownKey(null);
  };

  const onDropdownSelect = () => {
    setOpenDropdownKey(null);
  };

  const buildOverflowMessage = () => {
    const overflow = alerts.length - maxDisplayed;
    if (overflow > 0 && maxDisplayed > 0) {
      return t('notifications_drawer.overflowMessage', { count: overflow });
    }
    return '';
  };

  const getUniqueId = () => uuidv4();

  const getTimeCreated = () => {
    const dateCreated = new Date();
    return (
      dateCreated.toDateString() +
      ' at ' +
      ('00' + dateCreated.getHours().toString()).slice(-2) +
      ':' +
      ('00' + dateCreated.getMinutes().toString()).slice(-2)
    );
  };

  const removeAlert = (key: React.Key) => {
    setAlerts((prevAlerts) => prevAlerts.filter((alert) => alert.props.id !== key.toString()));
  };

  const removeAllAlerts = () => {
    setAlerts([]);
  };

  const onAlertGroupOverflowClick = () => {
    removeAllAlerts();
    setDrawerExpanded(true);
  };

  const notificationBadge = (
    <ToolbarItem>
      <NotificationBadge
        variant={getNotificationBadgeVariant()}
        onClick={onNotificationBadgeClick}
        aria-label="Notifications"
      ></NotificationBadge>
    </ToolbarItem>
  );

  const notificationDrawerActions = (
    <>
      <DropdownItem key="markAllRead" onClick={markAllNotificationsRead}>
        {t('notifications_drawer.markAllRead')}
      </DropdownItem>
      <DropdownItem key="clearAll" onClick={removeAllNotifications}>
        {t('notifications_drawer.clearAll')}
      </DropdownItem>
    </>
  );
  const notificationDrawerDropdownItems = (key: React.Key) => [
    <DropdownItem key={`markRead-${key}`} onClick={() => markNotificationRead(key)}>
      {t('notifications_drawer.markAsRead')}
    </DropdownItem>,
    <DropdownItem key={`clear-${key}`} onClick={() => removeNotification(key)}>
      {t('notifications_drawer.clear')}
    </DropdownItem>,
  ];

  const notificationDrawer = (
    <NotificationDrawer>
      <NotificationDrawerHeader count={getUnreadNotificationsNumber()} onClose={(_event) => setDrawerExpanded(false)}>
        <Dropdown
          id="notification-drawer-0"
          isOpen={openDropdownKey === 'dropdown-toggle-id-0'}
          onSelect={onDropdownSelect}
          popperProps={{ position: 'right' }}
          onOpenChange={(isOpen: boolean) => !isOpen && setOpenDropdownKey(null)}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              isExpanded={openDropdownKey === 'dropdown-toggle-id-0'}
              variant="plain"
              onClick={() => onDropdownToggle('dropdown-toggle-id-0')}
              aria-label={t('notifications_drawer.actions')}
              icon={<EllipsisVIcon />}
            />
          )}
        >
          <DropdownList>{notificationDrawerActions}</DropdownList>
        </Dropdown>
      </NotificationDrawerHeader>
      <NotificationDrawerBody>
        {notifications.length !== 0 && (
          <NotificationDrawerList>
            {notifications.map(({ key, variant, title, srTitle, description, timestamp }, index) => (
              <NotificationDrawerListItem
                key={key}
                variant={variant}
                isRead={isNotificationRead(key)}
                onClick={() => markNotificationRead(key)}
              >
                <NotificationDrawerListItemHeader variant={variant} title={title} srTitle={srTitle}>
                  <Dropdown
                    id={key.toString()}
                    isOpen={openDropdownKey === key}
                    onSelect={onDropdownSelect}
                    popperProps={{ position: 'right' }}
                    onOpenChange={(isOpen: boolean) => !isOpen && setOpenDropdownKey(null)}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        ref={toggleRef}
                        isExpanded={openDropdownKey === key}
                        variant="plain"
                        onClick={() => onDropdownToggle(key)}
                        aria-label={`Notification ${index + 1} actions`}
                      >
                        <EllipsisVIcon aria-hidden="true" />
                      </MenuToggle>
                    )}
                  >
                    <DropdownList>{notificationDrawerDropdownItems(key)}</DropdownList>
                  </Dropdown>
                </NotificationDrawerListItemHeader>
                <NotificationDrawerListItemBody timestamp={timestamp}> {description} </NotificationDrawerListItemBody>
              </NotificationDrawerListItem>
            ))}
          </NotificationDrawerList>
        )}
        {notifications.length === 0 && (
          <EmptyState
            headingLevel="h2"
            titleText={t('notifications_drawer.noNotifications')}
            icon={SearchIcon}
            variant={EmptyStateVariant.full}
          >
            <EmptyStateBody>{t('notifications_drawer.noNotificationsBody')}</EmptyStateBody>
          </EmptyState>
        )}
      </NotificationDrawerBody>
    </NotificationDrawer>
  );

  // Navigation
  const location = useLocation();

  const renderNavItem = (route: IAppRoute, index: number) => {
    const navTarget = route.navPath ?? route.path;
    const isCurrentPage = route.path.split('/')[1] === location.pathname.split('/')[1];
    return (
      <NavItem
        key={`${route.label}-${index}`}
        id={`${route.label}-${index}`}
        isActive={isCurrentPage}
        className="navitem-flex"
      >
        <NavLink
          to={navTarget}
          className={navTarget !== '#' ? '' : 'disabled-link'}
          aria-current={isCurrentPage ? 'page' : undefined}
        >
          {t(route.label as string)}
        </NavLink>
      </NavItem>
    );
  };

  const renderNavGroup = (group: IAppRouteGroup, groupIndex: number) => (
    <NavExpandable
      key={`${group.label}-${groupIndex}`}
      id={`${group.label}-${groupIndex}`}
      title={t(group.label)}
      isActive={group.routes.some((route) => route.path === location.pathname)}
      isExpanded={group.isExpanded}
    >
      {group.routes.map((route, idx) => route.label && renderNavItem(route, idx))}
    </NavExpandable>
  );

  const Navigation = (
    <Nav id="nav-first-simple">
      <NavList id="nav-list-first-simple">
        {routes.map((route, idx) => {
          if ('path' in route) {
            // This route is an IAppRoute because it has a 'path' property
            return route.label && renderNavItem(route, idx);
          } else if ('routes' in route) {
            // This route is an IAppRouteGroup because it has a 'routes' property
            return route.label && renderNavGroup(route, idx);
          }
          return null;
        })}
      </NavList>
    </Nav>
  );

  const Sidebar = (
    <PageSidebar>
      <PageSidebarBody isFilled className="pf-u-flex-column pf-u-full-height">
        {Navigation}
        <aside role="complementary" className="pf-u-margin-top-auto pf-u-padding-md pf-u-text-center">
          <Content component={ContentVariants.small}>
            {t('ui.footer.appBy')}&nbsp;
            <a href="http://red.ht/cai-team" target="_blank" rel="noreferrer">
              red.ht/cai team
            </a>
            <br />
            {t('ui.footer.version', { version: process.env.APP_VERSION })}
            <br />
            <Flex direction={{ default: 'column' }} alignItems={{ default: 'alignItemsCenter' }}>
              <FlexItem className="pf-u-margin-bottom-none">
                <Flex direction={{ default: 'row' }} alignItems={{ default: 'alignItemsCenter' }}>
                  <FlexItem>
                    <Content
                      component={ContentVariants.a}
                      href="https://github.com/rh-aiservices-bu/s4"
                      target="_blank"
                      className="footer-github-link"
                    >
                      <img
                        src={isDarkTheme ? githubLogoWhite : githubLogo}
                        alt={'GitHub logo'}
                        className="pf-u-icon-height-md"
                      />
                      {t('app_header.sourceOnGithub')}
                    </Content>
                  </FlexItem>
                </Flex>
              </FlexItem>
              <FlexItem>
                <Flex direction={{ default: 'row' }}>
                  <FlexItem className="pf-u-align-baseline-middle">
                    {repoStars !== null && (
                      <>
                        <img
                          src={isDarkTheme ? starLogoWhite : starLogo}
                          alt=""
                          className="pf-u-icon-height-sm"
                          aria-hidden="true"
                        />
                        <span className="pf-v6-screen-reader">{t('ui.footer.stars')}</span>
                      </>
                    )}
                    {repoStars !== null ? `${repoStars}` : ''}
                  </FlexItem>
                  <FlexItem>
                    {repoForks !== null && (
                      <>
                        <img
                          src={isDarkTheme ? forkLogoWhite : forkLogo}
                          alt=""
                          className="pf-u-icon-height-sm"
                          aria-hidden="true"
                        />
                        <span className="pf-v6-screen-reader">{t('ui.footer.forks')}</span>
                      </>
                    )}
                    {repoForks !== null ? `${repoForks}` : ''}
                  </FlexItem>
                </Flex>
              </FlexItem>
            </Flex>
          </Content>
        </aside>
      </PageSidebarBody>
    </PageSidebar>
  );

  // Header
  const headerTools = (
    <Toolbar isFullHeight>
      <ToolbarContent>
        <ToolbarGroup align={{ default: 'alignEnd' }} className="s4-header-toolbar-group">
          <ToolbarItem>
            <ToggleGroup aria-label="Dark theme toggle group">
              <ToggleGroupItem
                aria-label={t('theme.light')}
                icon={<SunIcon />}
                isSelected={!isDarkTheme}
                onClick={() => handleThemeToggle(false)}
              />
              <ToggleGroupItem
                aria-label={t('theme.dark')}
                icon={<MoonIcon />}
                isSelected={isDarkTheme}
                onClick={() => handleThemeToggle(true)}
              />
            </ToggleGroup>
          </ToolbarItem>
          <ToolbarItem>
            <Dropdown
              isOpen={isLanguageDropdownOpen}
              onSelect={handleLanguageChange}
              onOpenChange={(isOpen) => setLanguageDropdownOpen(isOpen)}
              popperProps={{ position: 'right' }}
              shouldFocusToggleOnSelect
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  isExpanded={isLanguageDropdownOpen}
                >
                  {currentLngDisplay.flag} {currentLngDisplay.name}
                </MenuToggle>
              )}
            >
              <DropdownList>
                {Object.entries(supportedLngs).map(([lngCode, lngName]) => (
                  <DropdownItem key={lngCode} value={lngCode}>
                    {lngName.flag} {lngName.name}
                  </DropdownItem>
                ))}
              </DropdownList>
            </Dropdown>
          </ToolbarItem>
          {notificationBadge}
          <ToolbarItem>
            <Popover
              aria-label="Help"
              position="right"
              headerContent={t('app_header.help.header')}
              bodyContent={
                <Content>
                  S4 - {t('app_header.help.body')}
                  <br />
                  {t('app_header.version', { version: process.env.APP_VERSION })}
                </Content>
              }
              footerContent={
                <Content component={ContentVariants.small}>
                  {t('app_header.sourceCode')}{' '}
                  <a href="https://github.com/rh-aiservices-bu/s4" target="_blank" rel="noreferrer">
                    github.com/rh-aiservices-bu/s4
                  </a>
                </Content>
              }
            >
              <Button aria-label="Help" variant={ButtonVariant.plain} icon={<QuestionCircleIcon />} />
            </Popover>
          </ToolbarItem>
          {authMode !== 'none' && isAuthenticated && (
            <ToolbarItem>
              <Button
                aria-label={t('auth.logOut')}
                variant={ButtonVariant.plain}
                icon={<SignOutAltIcon />}
                onClick={handleLogout}
                className="s4-touch-friendly"
              />
            </ToolbarItem>
          )}
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );

  const Header = (
    <Masthead role="banner" aria-label="page masthead">
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton id="page-nav-toggle" variant="plain" aria-label={t('accessibility.dashboardNavigation')}>
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        <MastheadBrand data-codemods>
          <MastheadLogo data-codemods className="pf-u-width-auto">
            <Flex
              direction={{ default: 'row' }}
              alignItems={{ default: 'alignItemsCenter' }}
              flexWrap={{ default: 'nowrap' }}
            >
              <Brand src={!isDarkTheme ? logoStd : logoReverse} alt="S4 Logo" heights={{ default: '40px' }} />
              <Content component={ContentVariants.h2} className="title-text pf-u-margin-left-md">
                {t('app_header.help.body')}
                <span className="speed-lines" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </Content>
            </Flex>
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>{headerTools}</MastheadContent>
    </Masthead>
  );

  const pageId = 'primary-app-container';

  const PageSkipToContent = (
    <SkipToContent
      onClick={(event) => {
        event.preventDefault();
        const primaryContentContainer = document.getElementById(pageId);
        if (primaryContentContainer) {
          primaryContentContainer.focus();
        }
      }}
      href={`#${pageId}`}
    >
      {t('accessibility.skipToContent')}
    </SkipToContent>
  );

  const disclaimerModal = useModal();

  // Load disclaimer status at startup by calling the backend API
  React.useEffect(() => {
    apiClient
      .get(`/disclaimer`)
      .then((response) => {
        if (response.data.disclaimer.status === 'accepted') {
          // Disclaimer already accepted
        } else {
          disclaimerModal.open();
        }
      })
      .catch((error) => {
        console.error('Failed to load disclaimer status:', error);
        disclaimerModal.open();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount; disclaimerModal.open is stable

  // Save disclaimer status to the backend API
  const saveDisclaimerStatus = () => {
    apiClient
      .put(`/disclaimer`, { status: 'accepted' })
      .then(() => {
        disclaimerModal.close();
      })
      .catch((error) => {
        console.error('Failed to save disclaimer status:', error);
        disclaimerModal.close();
      });
  };

  return (
    <Page
      mainContainerId={pageId}
      masthead={Header}
      sidebar={Sidebar}
      skipToContent={PageSkipToContent}
      notificationDrawer={notificationDrawer}
      isNotificationDrawerExpanded={isDrawerExpanded}
      isManagedSidebar
    >
      {children}
      <AlertGroup isToast isLiveRegion onOverflowClick={onAlertGroupOverflowClick} overflowMessage={overflowMessage}>
        {alerts.slice(0, maxDisplayed)}
      </AlertGroup>
      <Modal
        className="standard-modal"
        isOpen={disclaimerModal.isOpen}
        onClose={disclaimerModal.close}
        aria-labelledby="disclaimer-modal-title"
      >
        <ModalHeader labelId="disclaimer-modal-title" title={t('disclaimer.title')} titleIconVariant="info" />
        <ModalBody>
          <Content component={ContentVariants.p}>
            {t('disclaimer.message')}
            <br />
            {t('disclaimer.moreDetails').split('{link}')[0]}
            <a href="https://github.com/rh-aiservices-bu/s4/blob/main/LICENSE" target="_blank" rel="noreferrer">
              {t('disclaimer.licenseLink')}
            </a>
            {t('disclaimer.moreDetails').split('{link}')[1] || ''}
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="accept" variant="primary" onClick={saveDisclaimerStatus}>
            {t('disclaimer.accept')}
          </Button>
        </ModalFooter>
      </Modal>
    </Page>
  );
};

export { AppLayout };
