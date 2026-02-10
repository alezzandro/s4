import React, { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm, LoginPage } from '@patternfly/react-core';
import { useAuth } from '@app/components/AuthContext/AuthContext';
import LanguageSelector from '@app/components/LanguageSelector/LanguageSelector';

// Import the S4 logo
import logo from '@app/assets/bgimages/s4-icon.svg';

/**
 * Login page component
 * Renders a PatternFly login form with S4 branding
 */
const Login: React.FC = () => {
  const { t } = useTranslation('login');
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameValidated, setUsernameValidated] = useState<'default' | 'error'>('default');
  const [passwordValidated, setPasswordValidated] = useState<'default' | 'error'>('default');

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameValidated('default');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordValidated('default');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // Validate inputs
    let isValid = true;

    if (!username.trim()) {
      setUsernameValidated('error');
      isValid = false;
    }

    if (!password) {
      setPasswordValidated('error');
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    setIsLoading(true);

    const success = await login(username.trim(), password);

    setIsLoading(false);

    if (success) {
      // Navigation will happen automatically via AuthGate re-render
      // after isAuthenticated becomes true
      // Navigate to browse page
      navigate('/browse');
    }
  };

  const loginForm = (
    <LoginForm
      showHelperText={!!authError}
      helperText={authError ? t(`errors.${authError}`) : undefined}
      helperTextIcon={undefined}
      usernameLabel={t('form.username')}
      usernameValue={username}
      onChangeUsername={(_event, value) => handleUsernameChange(value)}
      isValidUsername={usernameValidated !== 'error'}
      passwordLabel={t('form.password')}
      passwordValue={password}
      onChangePassword={(_event, value) => handlePasswordChange(value)}
      isShowPasswordEnabled
      showPasswordAriaLabel={t('form.showPassword')}
      hidePasswordAriaLabel={t('form.hidePassword')}
      isValidPassword={passwordValidated !== 'error'}
      onLoginButtonClick={handleSubmit}
      loginButtonLabel={isLoading ? t('form.loggingIn') : t('form.logIn')}
      isLoginButtonDisabled={isLoading}
    />
  );

  return (
    <LoginPage
      brandImgSrc={logo}
      brandImgAlt={t('brandAlt')}
      backgroundImgSrc=""
      headerUtilities={<LanguageSelector />}
      loginTitle={t('title')}
      loginSubtitle={t('subtitle')}
      textContent=""
    >
      {loginForm}
    </LoginPage>
  );
};

export default React.memo(Login);
