import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import apiClient, { clearAuthToken, getAuthToken, setAuthToken } from '@app/utils/apiClient';
import Emitter from '@app/utils/emitter';
import { notifySuccess } from '@app/utils/notifications';

/**
 * Authentication mode types
 */
export type AuthMode = 'none' | 'simple';

/**
 * User information from authentication
 */
export interface AuthUser {
  id: string;
  username: string;
  roles: string[];
}

/**
 * Auth context type definition
 */
interface AuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  authMode: AuthMode;
  user: AuthUser | null;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component that wraps the application
 * Manages authentication state and provides auth functions
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check authentication status on mount
   * Determines if auth is required and validates existing token
   */
  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First, check what auth mode the server is using
      const infoResponse = await apiClient.get('/auth/info');
      const { authMode: serverAuthMode, authRequired } = infoResponse.data;

      setAuthMode(serverAuthMode);

      // If auth is not required, user is considered authenticated
      if (!authRequired) {
        setIsAuthenticated(true);
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Auth is required - check if we have a valid token
      const token = getAuthToken();
      if (!token) {
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Validate the token by calling /auth/me
      try {
        const meResponse = await apiClient.get('/auth/me');
        setIsAuthenticated(true);
        setUser(meResponse.data.user);
      } catch {
        // Token is invalid or expired
        clearAuthToken();
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      // Server error or network issue
      console.error('Error checking auth status:', err);
      setError('connectionError');
      // Assume auth is required if we can't reach the server
      setAuthMode('simple');
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login with username and password
   * Returns true on success, false on failure
   */
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await apiClient.post('/auth/login', {
        username,
        password,
      });

      const { token, user: userData } = response.data;

      // Store the token
      setAuthToken(token);

      // Update state
      setIsAuthenticated(true);
      setUser(userData);

      return true;
    } catch (err) {
      // Handle login errors
      const axiosError = err as { response?: { status?: number } };
      setError(axiosError.response?.status === 401 ? 'invalidCredentials' : 'loginFailed');

      return false;
    }
  }, []);

  /**
   * Logout the current user
   */
  const logout = useCallback(() => {
    // Notify backend before clearing token so Bearer header is included
    apiClient.post('/auth/logout').catch(() => {
      // Ignore errors on logout
    });

    // Clear the token
    clearAuthToken();

    // Reset state
    setIsAuthenticated(false);
    setUser(null);
    setError(null);

    notifySuccess('Logged Out', 'You have been logged out successfully.');
  }, []);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Listen for unauthorized events from apiClient
  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setUser(null);
      setError('sessionExpired');
    };

    Emitter.on('auth:unauthorized', handleUnauthorized);

    return () => {
      Emitter.off('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    authMode,
    user,
    error,
    login,
    logout,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to access auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
