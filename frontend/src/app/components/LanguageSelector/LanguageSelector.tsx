import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';
import { supportedLngs } from '../../../i18n/config';

const LanguageSelector: React.FunctionComponent = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = i18n.resolvedLanguage || 'en';
  const currentLngDisplay = supportedLngs[currentLanguage] || supportedLngs['en'];

  const handleSelect = (_event: React.MouseEvent | undefined, value: string | number | undefined) => {
    if (typeof value === 'string') {
      i18n.changeLanguage(value);
    }
    setIsOpen(false);
  };

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={handleSelect}
      onOpenChange={(open) => setIsOpen(open)}
      popperProps={{ position: 'right' }}
      shouldFocusToggleOnSelect
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)} isExpanded={isOpen}>
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
  );
};

export default LanguageSelector;
