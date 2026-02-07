import React from 'react';

interface ResponsiveTableWrapperProps {
  children: React.ReactNode;
  ariaLabel?: string;
}

export const ResponsiveTableWrapper: React.FC<ResponsiveTableWrapperProps> = ({
  children,
  ariaLabel = 'Scrollable table region',
}) => (
  <div className="s4-table-responsive" role="region" aria-label={ariaLabel} tabIndex={0}>
    {children}
  </div>
);
