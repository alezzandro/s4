/**
 * Validates S3 bucket names according to AWS naming rules
 *
 * Bucket names must:
 * - Be between 3 and 63 characters long
 * - Start and end with a letter or number
 * - Contain only lowercase letters, numbers, dots (.), and hyphens (-)
 * - Not contain consecutive periods
 * - Not be formatted as an IP address (e.g., 192.168.1.1)
 *
 * @param name - Bucket name to validate
 * @param existingBuckets - Optional list of existing bucket names to check for duplicates
 * @returns true if valid, false otherwise
 *
 * @example
 * ```ts
 * validateS3BucketName('my-bucket-123'); // true
 * validateS3BucketName('My-Bucket'); // false (uppercase not allowed)
 * validateS3BucketName('ab'); // false (too short)
 * validateS3BucketName('my-bucket', ['my-bucket', 'other-bucket']); // false (duplicate)
 * ```
 */
export const validateS3BucketName = (name: string, existingBuckets?: string[]): boolean => {
  // Check length (3-63 characters)
  if (name.length < 3 || name.length > 63) {
    return false;
  }

  // Check if name already exists
  if (existingBuckets && existingBuckets.includes(name)) {
    return false;
  }

  // Must start and end with a letter or number
  if (!/^[a-z0-9]/.test(name) || !/[a-z0-9]$/.test(name)) {
    return false;
  }

  // Can only contain lowercase letters, numbers, dots, and hyphens
  if (!/^[a-z0-9.-]+$/.test(name)) {
    return false;
  }

  // Cannot contain consecutive periods
  if (/\.\./.test(name)) {
    return false;
  }

  // Cannot be formatted as an IP address
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) {
    return false;
  }

  return true;
};

/**
 * Validates S3 object (file/folder) names
 *
 * Object names cannot:
 * - Be empty or contain only whitespace
 * - Contain null characters
 * - Start with ../
 * - Be . or ..
 *
 * @param name - Object name to validate
 * @param storageType - Optional storage type for type-specific validation
 * @returns true if valid, false otherwise
 *
 * @example
 * ```ts
 * validateS3ObjectName('folder/file.txt'); // true
 * validateS3ObjectName(''); // false (empty)
 * validateS3ObjectName('..'); // false (not allowed)
 * validateS3ObjectName('../file.txt'); // false (cannot start with ../)
 * ```
 */
export const validateS3ObjectName = (name: string, storageType?: 's3' | 'local'): boolean => {
  // Cannot be empty
  if (!name || name.trim().length === 0) {
    return false;
  }

  // Cannot contain null characters
  if (name.includes('\0')) {
    return false;
  }

  // Cannot start with ../
  if (name.startsWith('../')) {
    return false;
  }

  // Cannot be . or ..
  if (name === '.' || name === '..') {
    return false;
  }

  // Storage-type-specific validation (no spaces allowed in either)
  if (storageType) {
    const validCharacters =
      storageType === 's3'
        ? /^[a-zA-Z0-9!.\-_*'()/]+$/ // S3: letters, numbers, and safe special chars including /
        : /^[a-zA-Z0-9._/-]+$/; // Local/PVC: only letters, numbers, dots, underscores, hyphens, /

    if (!validCharacters.test(name)) {
      return false;
    }
  }

  return true;
};

/**
 * Gets human-readable validation rules for S3 bucket names
 *
 * @returns Array of validation rule strings
 *
 * @example
 * ```tsx
 * const rules = getBucketNameRules();
 * return (
 *   <ul>
 *     {rules.map(rule => <li key={rule}>{rule}</li>)}
 *   </ul>
 * );
 * ```
 */
export const getBucketNameRules = (): string[] => [
  'buckets:createModal.rules.length',
  'buckets:createModal.rules.characters',
  'buckets:createModal.rules.startEnd',
  'buckets:createModal.rules.noPeriods',
  'buckets:createModal.rules.noIp',
  'buckets:createModal.rules.unique',
];

/**
 * Gets human-readable validation rules for S3 object names
 *
 * @returns Array of validation rule strings
 *
 * @example
 * ```tsx
 * const rules = getObjectNameRules();
 * return (
 *   <FormHelperText>
 *     <HelperText>
 *       <HelperTextItem>
 *         <ul>
 *           {rules.map(rule => <li key={rule}>{rule}</li>)}
 *         </ul>
 *       </HelperTextItem>
 *     </HelperText>
 *   </FormHelperText>
 * );
 * ```
 */
export const getObjectNameRules = (): string[] => [
  'Object names cannot be empty',
  'Object names cannot contain null characters',
  'Object names cannot be . or ..',
  'Object names should not start with ../',
];

/**
 * Gets human-readable validation rules for folder names
 *
 * @param storageType - Storage type (s3 or local) for type-specific rules
 * @returns Array of validation rule strings
 */
export const getFolderNameRules = (storageType?: 's3' | 'local'): string[] => {
  const baseRules = [
    'Folder names cannot be empty',
    'Folder names cannot contain spaces',
    'Folder names cannot be . or ..',
  ];

  if (storageType === 's3') {
    return [...baseRules, "Folder names can contain letters, numbers, and special characters: ! . - _ * ' ( )"];
  } else if (storageType === 'local') {
    return [...baseRules, 'Folder names can only contain letters, numbers, dots (.), underscores (_), and hyphens (-)'];
  }

  return baseRules;
};
