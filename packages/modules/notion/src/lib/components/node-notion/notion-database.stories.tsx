import React, { useState } from 'react';
import type { StoryObj } from '@storybook/react';
import { NotionDatabase, TNotionViewMode } from './notion-database';
import exampleData1 from '../../test/example-1.json';
import exampleData2 from '../../test/example-2.json';

export default {
  title: 'Modules/Notion/Components/NotionDatabase',
  component: NotionDatabase,
  argTypes: {
    database: {
      control: 'select',
      options: ['example1', 'example2'],
      mapping: {
        example1: {
          ...exampleData1.dbResponse,
          pages: exampleData1.pagesResponse.results,
        },
        example2: {
          ...exampleData2.dbResponse,
          pages: exampleData2.pagesResponse.results,
        },
      },
    },
  },
};

export const Default: StoryObj<typeof NotionDatabase> = {
  render: (args) => {
    const [viewMode, setViewMode] = useState<TNotionViewMode>({ mode: 'list' });
    return (
      <NotionDatabase
        database={args.database}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onUpdatePage={(pageId, properties) => {
          console.log('onUpdatePage', pageId, properties);
        }}
        onCreatePage={() => {}}
        onDeletePage={() => {}}
        onReorderPage={() => {}}
      />
    );
  },
  args: {
    database: 'example1' as any,
  },
};
