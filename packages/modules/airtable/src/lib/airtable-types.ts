// Airtable API Types - Mirrors Notion structure but adapted for Airtable

import { TJson } from '@monorepo/simple-types';

export type TAirtableFieldType =
  | 'singleLineText'
  | 'longText'
  | 'number'
  | 'singleSelect'
  | 'multipleSelects'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phoneNumber'
  | 'currency'
  | 'percent'
  | 'duration'
  | 'rating'
  | 'multipleRecordLinks'
  | 'singleCollaborator'
  | 'multipleCollaborators'
  | 'multipleAttachments'
  | 'rollup'
  | 'formula'
  | 'createdTime'
  | 'lastModifiedTime'
  | 'autoNumber'
  | 'barcode'
  | 'button'
  | 'lookup'
  | 'multipleLookupValues'
  | 'aiText'
  | 'aiImage';

export type TAirtableFieldOption = {
  id: string;
  name: string;
  color: string;
  description?: string;
};

export type TAirtableSingleSelectField = {
  id: string;
  name: string;
  type: 'singleSelect';
  options: {
    choices: TAirtableFieldOption[];
  };
};

export type TAirtableMultipleSelectsField = {
  id: string;
  name: string;
  type: 'multipleSelects';
  options: {
    choices: TAirtableFieldOption[];
  };
};

export type TAirtableNumberField = {
  id: string;
  name: string;
  type: 'number';
  options: {
    precision: number;
    negative: boolean;
  };
};

export type TAirtableTextField = {
  id: string;
  name: string;
  type: 'singleLineText' | 'longText';
  options: {
    validatorName?: string;
  };
};

export type TAirtableDateField = {
  id: string;
  name: string;
  type: 'date';
  options: {
    dateFormat: {
      name: string;
    };
    timeFormat?: {
      name: string;
    };
  };
};

export type TAirtableCheckboxField = {
  id: string;
  name: string;
  type: 'checkbox';
  options: {
    icon: string;
    color: string;
  };
};

export type TAirtableUrlField = {
  id: string;
  name: string;
  type: 'url';
  options: {
    validatorName?: string;
  };
};

export type TAirtableEmailField = {
  id: string;
  name: string;
  type: 'email';
  options: {
    validatorName?: string;
  };
};

export type TAirtablePhoneNumberField = {
  id: string;
  name: string;
  type: 'phoneNumber';
  options: {
    validatorName?: string;
  };
};

export type TAirtableCurrencyField = {
  id: string;
  name: string;
  type: 'currency';
  options: {
    precision: number;
    symbol: string;
  };
};

export type TAirtablePercentField = {
  id: string;
  name: string;
  type: 'percent';
  options: {
    precision: number;
  };
};

export type TAirtableDurationField = {
  id: string;
  name: string;
  type: 'duration';
  options: {
    durationFormat: string;
  };
};

export type TAirtableRatingField = {
  id: string;
  name: string;
  type: 'rating';
  options: {
    max: number;
    icon: string;
  };
};

export type TAirtableMultipleRecordLinksField = {
  id: string;
  name: string;
  type: 'multipleRecordLinks';
  options: {
    linkedTableId: string;
    isReversed: boolean;
    prefersSingleRecordLink: boolean;
    inverseLinkFieldId?: string;
  };
};

export type TAirtableCollaboratorField = {
  id: string;
  name: string;
  type: 'singleCollaborator' | 'multipleCollaborators';
  options: {
    prefersSingleRecordLink: boolean;
  };
};

export type TAirtableAttachmentField = {
  id: string;
  name: string;
  type: 'multipleAttachments';
  options: {
    isReversed: boolean;
  };
};

export type TAirtableRollupField = {
  id: string;
  name: string;
  type: 'rollup';
  options: {
    recordLinkFieldId: string;
    fieldIdInLinkedTable: string;
    fieldIdInThisTable: string;
    rollupFunction: string;
  };
};

export type TAirtableFormulaField = {
  id: string;
  name: string;
  type: 'formula';
  options: {
    formula: string;
    referencedFieldIds: string[];
    isValid: boolean;
  };
};

export type TAirtableCreatedTimeField = {
  id: string;
  name: string;
  type: 'createdTime';
  options: {
    dateFormat: {
      name: string;
    };
    timeFormat?: {
      name: string;
    };
  };
};

export type TAirtableLastModifiedTimeField = {
  id: string;
  name: string;
  type: 'lastModifiedTime';
  options: {
    dateFormat: {
      name: string;
    };
    timeFormat?: {
      name: string;
    };
  };
};

export type TAirtableAutoNumberField = {
  id: string;
  name: string;
  type: 'autoNumber';
  options: {
    numberFormat: string;
  };
};

export type TAirtableBarcodeField = {
  id: string;
  name: string;
  type: 'barcode';
  options: {
    barcodeType: string;
  };
};

export type TAirtableButtonField = {
  id: string;
  name: string;
  type: 'button';
  options: {
    label: string;
    action: string;
  };
};

export type TAirtableLookupField = {
  id: string;
  name: string;
  type: 'lookup';
  options: {
    recordLinkFieldId: string;
    fieldIdInLinkedTable: string;
    fieldIdInThisTable: string;
  };
};

export type TAirtableMultipleLookupValuesField = {
  id: string;
  name: string;
  type: 'multipleLookupValues';
  options: {
    recordLinkFieldId: string;
    fieldIdInLinkedTable: string;
    fieldIdInThisTable: string;
  };
};

export type TAirtableAiTextField = {
  id: string;
  name: string;
  type: 'aiText';
  options: {
    prompt: string;
  };
};

export type TAirtableAiImageField = {
  id: string;
  name: string;
  type: 'aiImage';
  options: {
    prompt: string;
  };
};

export type TAirtableField =
  | TAirtableSingleSelectField
  | TAirtableMultipleSelectsField
  | TAirtableNumberField
  | TAirtableTextField
  | TAirtableDateField
  | TAirtableCheckboxField
  | TAirtableUrlField
  | TAirtableEmailField
  | TAirtablePhoneNumberField
  | TAirtableCurrencyField
  | TAirtablePercentField
  | TAirtableDurationField
  | TAirtableRatingField
  | TAirtableMultipleRecordLinksField
  | TAirtableCollaboratorField
  | TAirtableAttachmentField
  | TAirtableRollupField
  | TAirtableFormulaField
  | TAirtableCreatedTimeField
  | TAirtableLastModifiedTimeField
  | TAirtableAutoNumberField
  | TAirtableBarcodeField
  | TAirtableButtonField
  | TAirtableLookupField
  | TAirtableMultipleLookupValuesField
  | TAirtableAiTextField
  | TAirtableAiImageField;

// Record value types
export type TAirtableRecordValue = {
  id: string;
  createdTime: string;
  commentCount?: number;
  fields: Record<string, TJson>;
};

// Table metadata
export type TAirtableTable = {
  id: string;
  name: string;
  description?: string;
  fields: TAirtableField[];
  primaryFieldId: string;
  views: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  records: TAirtableRecordValue[];
};

// Base metadata
export type TAirtableBase = {
  AIRTABLE_API_KEY: string;
  id: string;
  name: string;
  description?: string;
  tables: TAirtableTable[];
  permissionLevel: string;
  url: string;
};

// Search result type
export type TAirtableBaseSearchResult = {
  id: string;
  name: string;
  description?: string;
  url: string;
  permissionLevel: string;
};

// View modes for UI
export type TAirtableViewMode =
  | { mode: 'list' }
  | { mode: 'kanban'; groupBy: string }
  | { mode: 'gallery'; itemPerLine: number };

// Important properties for UI
export type TAirtableImportantProperties = {
  titleField?: TAirtableField;
  priorityField?: TAirtableField;
  statusField?: TAirtableField;
};
