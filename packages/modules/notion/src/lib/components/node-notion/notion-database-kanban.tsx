import { useState } from 'react';
import {
  TNotionDatabase,
  TNotionProperty,
  TNotionPage,
} from '../../notion-types';
import { TaskItem } from './notion-database-list';
import { TImportantProperties } from './notion-database';

import './notion-database.scss';

//

type NotionDatabaseKanbanProps = {
  database: TNotionDatabase;
  viewMode: { mode: 'kanban'; groupBy: 'status' | 'priority' };

  onUpdatePage?: (
    pageId: string,
    properties: Record<string, TNotionProperty>
  ) => void;
} & TImportantProperties;

//

export const NotionDatabaseKanban = ({
  database,
  viewMode,
  onUpdatePage,
  titleProperty,
  priorityProperty,
  statusProperty,
}: NotionDatabaseKanbanProps) => {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const groupBy = viewMode.groupBy;

  const property = groupBy === 'status' ? statusProperty : priorityProperty;

  if (!property) {
    return (
      <div>
        Cannot group by {viewMode.groupBy} - property not found or not supported
      </div>
    );
  }

  const getGroupOptions = () => {
    if (property.type === 'status') {
      return property.status.options;
    } else if (property.type === 'select') {
      return property.select.options;
    }
    return [];
  };

  const groupOptions = getGroupOptions();

  const groupedPages = groupOptions.map((option) => ({
    option,
    pages:
      database.pages?.filter((page: TNotionPage) => {
        const pageProperty = page.properties[property.name];
        if (pageProperty?.type === 'status') {
          return pageProperty.status?.id === option.id;
        } else if (pageProperty?.type === 'select') {
          return pageProperty.select?.id === option.id;
        }
        return false;
      }) || [],
  }));

  const unassignedPages =
    database.pages?.filter((page: TNotionPage) => {
      const pageProperty = page.properties[property.name];
      if (pageProperty?.type === 'status') {
        return !pageProperty.status;
      } else if (pageProperty?.type === 'select') {
        return !pageProperty.select;
      }
      return true;
    }) || [];

  if (unassignedPages.length > 0) {
    groupedPages.push({
      option: {
        id: 'unassigned',
        name: 'Unassigned',
        color: 'gray',
        description: null,
      },
      pages: unassignedPages,
    });
  }

  const handleDrop = (e: React.DragEvent, targetOptionId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const eventData = e.dataTransfer.getData('application/json');
    console.log('handleDrop', { eventData });
    if (eventData) {
      try {
        const event = JSON.parse(eventData);
        if (event.databaseId === database.id && event.pageId) {
          const pageId = event.pageId;
          const targetOption =
            groupOptions.find((opt) => opt.id === targetOptionId) ||
            (targetOptionId === 'unassigned' ? null : undefined);
          if (targetOption) {
            const newProperty: TNotionProperty =
              property.type === 'status'
                ? {
                    id: property.id,
                    type: 'status',
                    status: {
                      id: targetOption.id,
                      name: targetOption.name,
                      color: targetOption.color,
                    },
                  }
                : {
                    id: property.id,
                    type: 'select',
                    select: {
                      id: targetOption.id,
                      name: targetOption.name,
                      color: targetOption.color,
                    },
                  };
            onUpdatePage?.(pageId, { [property.name]: newProperty });
          }
        }
      } catch (error) {
        console.error('Error parsing drag event:', error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  return (
    <div className="notion-kanban-board">
      {groupedPages.map(({ option, pages }) => (
        <div
          key={option.id}
          className={`notion-kanban-column${
            dragOverColumn === option.id ? ' drag-over' : ''
          }`}
          onDrop={(e) => handleDrop(e, option.id)}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, option.id)}
          onDragLeave={handleDragLeave}
        >
          <div className="notion-kanban-column-header">
            <div className="notion-kanban-column-header-row">
              <div
                className={`task-status bg-${option.color} notion-kanban-dot`}
              />
              <h3 className="notion-kanban-title">{option.name}</h3>
            </div>
            <div className="notion-kanban-count">
              {pages.length} {pages.length === 1 ? 'item' : 'items'}
            </div>
          </div>
          <div className="notion-kanban-column-content">
            {pages.map((page: TNotionPage) => (
              <TaskItem
                key={page.id}
                page={page}
                database={database}
                titleProperty={titleProperty}
                priorityProperty={priorityProperty}
                statusProperty={statusProperty}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotionDatabaseKanban;
