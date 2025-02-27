export type TNotionStatus = {
  id: string;
  name: string;
  color: string;
};

export type TNotionProperty = {
  id: string;
  type: 'title' | 'rich_text' | 'number' | 'select' | 'status';
  name: string;
  value?: string | number | TNotionStatus;
};

export type TNotionPage = {
  id: string;
  title: string;
  properties: Record<string, TNotionProperty>;
  order?: number;
  lastModified: string;
};

export type TNotionDatabase = {
  id: string;
  title: string;
  properties: Record<string, TNotionProperty>;
  pages: TNotionPage[];
  lastSync: string;
};
