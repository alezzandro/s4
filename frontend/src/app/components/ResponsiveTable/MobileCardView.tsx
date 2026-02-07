import React from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  Label,
  Skeleton,
} from '@patternfly/react-core';

export interface CardField {
  /** Label for the field */
  label: string;
  /** Value to display */
  value: React.ReactNode;
  /** Optional: hide this field */
  hidden?: boolean;
}

export interface MobileCardItem {
  /** Unique identifier for the item */
  id: string;
  /** Primary title/name to display */
  title: React.ReactNode;
  /** Optional icon to show next to title */
  icon?: React.ReactNode;
  /** Optional label/badge (e.g., "S3", "PVC", "Folder") */
  label?: {
    text: string;
    color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'grey' | 'teal' | 'orangered' | 'yellow';
    icon?: React.ReactNode;
  };
  /** Fields to display in the card body */
  fields: CardField[];
  /** Actions component (buttons, dropdown, etc.) */
  actions?: React.ReactNode;
  /** Whether this item is selectable */
  selectable?: boolean;
  /** Whether this item is currently selected */
  isSelected?: boolean;
  /** Callback when selection changes */
  onSelect?: (isSelected: boolean) => void;
  /** Click handler for the card/title */
  onClick?: () => void;
  /** Whether this item is disabled */
  isDisabled?: boolean;
}

export interface MobileCardViewProps {
  /** Items to display as cards */
  items: MobileCardItem[];
  /** Aria label for the card list */
  ariaLabel?: string;
  /** Show loading skeleton */
  isLoading?: boolean;
  /** Number of skeleton cards to show when loading */
  skeletonCount?: number;
}

const SkeletonCard: React.FC = () => (
  <Card component="div" className="s4-mobile-card">
    <CardHeader>
      <CardTitle>
        <Skeleton width="70%" screenreaderText="Loading item" />
      </CardTitle>
    </CardHeader>
    <CardBody>
      <Flex direction={{ default: 'column' }} gap={{ default: 'gapSm' }}>
        <FlexItem>
          <Skeleton width="50%" screenreaderText="Loading field" />
        </FlexItem>
        <FlexItem>
          <Skeleton width="40%" screenreaderText="Loading field" />
        </FlexItem>
      </Flex>
    </CardBody>
  </Card>
);

export const MobileCardView: React.FC<MobileCardViewProps> = ({
  items,
  ariaLabel = 'Items list',
  isLoading = false,
  skeletonCount = 3,
}) => {
  if (isLoading) {
    return (
      <div className="s4-mobile-card-list" role="list" aria-label={ariaLabel} aria-busy="true">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="s4-mobile-card-list" role="list" aria-label={ariaLabel}>
      {items.map((item) => (
        <Card
          key={item.id}
          component="div"
          className={`s4-mobile-card${item.isSelected ? ' s4-mobile-card--selected' : ''}${item.isDisabled ? ' s4-mobile-card--disabled' : ''}`}
          role="listitem"
          isClickable={!item.isDisabled && (!!item.onClick || (!!item.selectable && !!item.actions))}
          isSelectable={!!item.selectable}
          isSelected={item.isSelected}
        >
          <CardHeader
            actions={item.actions ? { actions: <>{item.actions}</> } : undefined}
            selectableActions={
              item.selectable
                ? {
                    selectableActionId: `select-${item.id}`,
                    selectableActionAriaLabelledby: `card-title-${item.id}`,
                    isChecked: item.isSelected,
                    onChange: (_event, checked) => item.onSelect?.(checked),
                  }
                : undefined
            }
          >
            <CardTitle id={`card-title-${item.id}`}>
              <Flex alignItems={{ default: 'alignItemsCenter' }} gap={{ default: 'gapSm' }}>
                {item.icon && <FlexItem>{item.icon}</FlexItem>}
                <FlexItem>
                  {item.onClick && !item.isDisabled ? (
                    <button
                      className="pf-v6-c-button pf-m-link pf-m-inline s4-mobile-card-title-button"
                      onClick={item.onClick}
                      type="button"
                    >
                      {item.title}
                    </button>
                  ) : (
                    <span className={item.isDisabled ? 'pf-v6-u-color-400' : ''}>{item.title}</span>
                  )}
                </FlexItem>
                {item.label && (
                  <FlexItem>
                    <Label color={item.label.color || 'grey'} icon={item.label.icon}>
                      {item.label.text}
                    </Label>
                  </FlexItem>
                )}
              </Flex>
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Flex direction={{ default: 'column' }} gap={{ default: 'gapXs' }}>
              {item.fields
                .filter((field) => !field.hidden)
                .map((field, index) => (
                  <FlexItem key={index}>
                    <Flex gap={{ default: 'gapSm' }}>
                      <FlexItem>
                        <Content component={ContentVariants.small} className="pf-v6-u-color-200">
                          {field.label}:
                        </Content>
                      </FlexItem>
                      <FlexItem>
                        <Content component={ContentVariants.small}>{field.value}</Content>
                      </FlexItem>
                    </Flex>
                  </FlexItem>
                ))}
            </Flex>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};
