import * as React from 'react';
import '@patternfly/react-core/dist/styles/base.css';
import { BrowserRouter as Router } from 'react-router-dom';
import { AppLayout } from '@app/components/AppLayout/AppLayout';
import { AppRoutes } from '@app/routes';
import '@app/app.css';
import { AuthProvider } from '@app/components/AuthContext/AuthContext';
import { AuthGate } from '@app/components/AuthGate/AuthGate';

/**
 * Normalizes a path prefix to ensure it has a leading slash and no trailing slash.
 * Returns undefined if input is empty or only slashes (for default React Router behavior).
 */
const normalizeBasename = (prefix: string | undefined): string | undefined => {
  if (!prefix) return undefined;

  // Remove all leading and trailing slashes
  const trimmed = prefix.replace(/^\/+|\/+$/g, '');

  // If nothing left after trimming, return undefined for root deployment
  if (!trimmed) return undefined;

  // Add leading slash, no trailing slash
  return `/${trimmed}`;
};

// Get basename from data attribute (injected by backend at runtime, CSP-safe)
const nbPrefix = document.documentElement.dataset.nbPrefix;
console.log('data-nb-prefix:', nbPrefix);
const basename = normalizeBasename(nbPrefix);
console.log('Router basename:', basename);

const App: React.FunctionComponent = () => (
  <AuthProvider>
    <Router basename={basename}>
      <AuthGate>
        <AppLayout>
          <AppRoutes />
        </AppLayout>
      </AuthGate>
    </Router>
  </AuthProvider>
);

export default App;
