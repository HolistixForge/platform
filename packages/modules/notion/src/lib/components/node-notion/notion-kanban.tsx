import { useEffect, useState } from 'react';

import {
  TNotionDatabase,
  TNotionPage,
  TNotionProperty,
} from '../../notion-types';
import { NotionCard } from './notion-card';

import './notion-kanban.scss';

//

type NotionKanbanProps = {
  database: TNotionDatabase;
  onUpdatePage: (
    pageId: string,
    properties: Record<string, TNotionProperty>
  ) => void;
  onCreatePage: (properties: Record<string, TNotionProperty>) => void;
  onDeletePage: (pageId: string) => void;
  onReorderPage: (pageId: string, newPosition: number) => void;
};

//

export const NotionKanban = ({
  database,
  onUpdatePage,
  onCreatePage,
  onDeletePage,
  onReorderPage,
}: NotionKanbanProps) => {
  const [columns, setColumns] = useState<Record<string, TNotionPage[]>>({});

  // Group pages by status
  useEffect(() => {
    const grouped = database.pages.reduce((acc, page) => {
      const status = (page.properties.Status?.value as string) || 'No Status';
      if (!acc[status]) acc[status] = [];
      acc[status].push(page);
      return acc;
    }, {} as Record<string, TNotionPage[]>);
    setColumns(grouped);
  }, [database]);

  return (
    <div className="notion-kanban">
      <div className="columns">
        {Object.entries(columns).map(([status, pages]) => (
          <div key={status} className="column">
            <div className="column-header">
              <h3>{status}</h3>
            </div>
            <div className="column-content">
              {pages.map((page) => (
                <NotionCard
                  key={page.id}
                  page={page}
                  onUpdate={(properties) => onUpdatePage(page.id, properties)}
                  onDelete={() => onDeletePage(page.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
