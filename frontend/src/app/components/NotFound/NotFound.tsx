import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@patternfly/react-icons';
import { Button, EmptyState, EmptyStateBody, EmptyStateFooter, PageSection } from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';

const NotFound: React.FunctionComponent = () => {
  const { t } = useTranslation('errors');

  function GoHomeBtn() {
    const navigate = useNavigate();
    function handleClick() {
      navigate('/');
    }
    return <Button onClick={handleClick}>{t('notFound.goHome')}</Button>;
  }

  return (
    <PageSection hasBodyWrapper={false}>
      <EmptyState headingLevel="h1" icon={ExclamationTriangleIcon} titleText={t('notFound.title')} variant="full">
        <EmptyStateBody>{t('notFound.message')}</EmptyStateBody>
        <EmptyStateFooter>
          <GoHomeBtn />
        </EmptyStateFooter>
      </EmptyState>
    </PageSection>
  );
};

const NotFoundMemoized = React.memo(NotFound);
export { NotFoundMemoized as NotFound };
