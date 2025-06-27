export type TNotionText = {
  type: 'text';
  text: {
    content: string;
    link: string | null;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href: string | null;
};

export type TNotionRichText = {
  id: string;
  type: 'rich_text';
  rich_text: TNotionText[];
};

export type TNotionStatus = {
  id: string;
  type: 'status';
  status: {
    id: string;
    name: string;
    color: string;
  };
};

export type TNotionSelect = {
  id: string;
  type: 'select';
  select: {
    id: string;
    name: string;
    color: string;
  };
};

export type TNotionNumber = {
  id: string;
  type: 'number';
  number: number;
};

export type TNotionUniqueId = {
  id: string;
  type: 'unique_id';
  unique_id: {
    prefix: string;
    number: number;
  };
};

export type TNotionTitle = {
  id: string;
  type: 'title';
  title: TNotionText[];
};

export type TNotionRelation = {
  id: string;
  type: 'relation';
  relation: any[]; // The relation array can contain related items
  has_more: boolean;
};

export type TNotionPeople = {
  id: string;
  type: 'people';
  people: Array<{
    object: 'user';
    id: string;
    name?: string;
    avatar_url?: string;
    type?: 'person' | 'bot';
    person?: {
      email: string;
    };
    bot?: Record<string, any>;
  }>;
};

export type TNotionDate = {
  id: string;
  type: 'date';
  date: {
    start: string;
    end: string | null;
    time_zone: string | null;
  } | null;
};

export type TNotionMultiSelect = {
  id: string;
  type: 'multi_select';
  multi_select: Array<{
    id: string;
    name: string;
    color: string;
  }>;
};

export type TNotionProperty =
  | TNotionRichText
  | TNotionStatus
  | TNotionSelect
  | TNotionNumber
  | TNotionUniqueId
  | TNotionTitle
  | TNotionRelation
  | TNotionPeople
  | TNotionDate
  | TNotionMultiSelect;

export type TNotionCover = {
  type: 'external';
  external: {
    url: string;
  };
} | {
  type: 'file';
  file: {
    url: string;
    expiry_time: string;
  };
} | null;

export type TNotionPage = {
  object: 'page';
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: {
    object: 'user';
    id: string;
  };
  last_edited_by: {
    object: 'user';
    id: string;
  };
  cover: TNotionCover;
  icon: null | any; // Could be expanded based on actual icon structure
  parent: {
    type: string;
    database_id: string;
  };
  archived: boolean;
  in_trash: boolean;
  properties: Record<string, TNotionProperty>;
  url: string;
  public_url: string | null;
};

type TNotionDatabasePropertyBase = {
  id: string;
  name: string;
  type: string;
};

type TNotionDatabaseRichTextProperty = TNotionDatabasePropertyBase & {
  type: 'rich_text';
  rich_text: Record<string, never>; // Empty object in the example
};

export type TNotionDatabaseStatusProperty = TNotionDatabasePropertyBase & {
  type: 'status';
  status: {
    options: Array<{
      id: string;
      name: string;
      color: string;
      description: string | null;
    }>;
    groups: Array<{
      id: string;
      name: string;
      color: string;
      option_ids: string[];
    }>;
  };
};

export type TNotionDatabaseSelectProperty = TNotionDatabasePropertyBase & {
  type: 'select';
  select: {
    options: Array<{
      id: string;
      name: string;
      color: string;
      description: string | null;
    }>;
  };
};

export type TNotionDatabaseNumberProperty = TNotionDatabasePropertyBase & {
  type: 'number';
  number: {
    format: string;
  };
};

export type TNotionDatabaseUniqueIdProperty = TNotionDatabasePropertyBase & {
  type: 'unique_id';
  unique_id: {
    prefix: string;
  };
};

export type TNotionDatabaseTitleProperty = TNotionDatabasePropertyBase & {
  type: 'title';
  title: Record<string, never>; // Empty object in the example
};

export type TNotionDatabaseRelationProperty = TNotionDatabasePropertyBase & {
  type: 'relation';
  relation: {
    database_id: string;
    type: 'dual_property';
    dual_property: {
      synced_property_name: string;
      synced_property_id: string;
    };
  };
};

export type TNotionDatabasePeopleProperty = TNotionDatabasePropertyBase & {
  type: 'people';
  people: Record<string, never>; // Empty object in the example
};

export type TNotionDatabaseDateProperty = TNotionDatabasePropertyBase & {
  type: 'date';
  date: Record<string, never>; // Empty object in the example
};

export type TNotionDatabaseMultiSelectProperty = TNotionDatabasePropertyBase & {
  type: 'multi_select';
  multi_select: {
    options: Array<{
      id: string;
      name: string;
      color: string;
      description: string | null;
    }>;
  };
};

export type TNotionDatabaseProperty =
  | TNotionDatabaseRichTextProperty
  | TNotionDatabaseStatusProperty
  | TNotionDatabaseSelectProperty
  | TNotionDatabaseNumberProperty
  | TNotionDatabaseUniqueIdProperty
  | TNotionDatabaseTitleProperty
  | TNotionDatabaseRelationProperty
  | TNotionDatabasePeopleProperty
  | TNotionDatabaseDateProperty
  | TNotionDatabaseMultiSelectProperty;

export type TNotionDatabase = {
  object: 'database';
  id: string;
  cover: null | any;
  icon: null | any;
  created_time: string;
  created_by: {
    object: 'user';
    id: string;
  };
  last_edited_by: {
    object: 'user';
    id: string;
  };
  last_edited_time: string;
  title: TNotionText[];
  description: any[];
  is_inline: boolean;
  properties: Record<string, TNotionDatabaseProperty>;
  parent: {
    type: string;
    workspace: boolean;
  };
  url: string;
  public_url: string | null;
  archived: boolean;
  in_trash: boolean;
  request_id: string;
  pages: TNotionPage[];
};
