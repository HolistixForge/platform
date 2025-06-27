import { useState, DragEvent } from 'react';
import {
  TNotionDatabase,
  TNotionProperty,
  TNotionPage,
  TNotionDatabaseProperty,
} from '../../notion-types';
import { TaskItem } from './notion-database-list';
import { TImportantProperties } from './notion-database';
import { TEventLoadKanbanColumnNode } from '../../notion-events';

import './notion-database.scss';

//

type NotionDatabaseKanbanProps = {
  database: TNotionDatabase;
  viewMode: { mode: 'kanban'; groupBy: 'status' | 'priority' };

  onUpdatePage: (
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
      return [...property.status.options];
    } else if (property.type === 'select') {
      return [...property.select.options];
    }
    return [];
  };

  const groupOptions = getGroupOptions();

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
    groupOptions.push({
      id: 'unassigned',
      name: 'Unassigned',
      color: 'gray',
      description: null,
    });
  }

  // column drag handlers

  const handleColumnDragStart = (e: DragEvent<HTMLDivElement>) => {
    const event: Partial<TEventLoadKanbanColumnNode> = {
      type: 'notion:load-kanban-column-node',
      databaseId: database.id,
      propertyId: property.id,
      optionId: e.currentTarget.id,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    e.currentTarget.classList.add('dragging');
  };

  const handleColumnDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('dragging');
  };

  //

  return (
    <div className="notion-kanban-board">
      {groupOptions.map((option) => (
        <NotionDatabaseKanbanColumn
          key={option.id}
          database={database}
          property={property}
          option={option}
          handleColumnDragStart={handleColumnDragStart}
          handleColumnDragEnd={handleColumnDragEnd}
          onUpdatePage={onUpdatePage}
          titleProperty={titleProperty}
          priorityProperty={priorityProperty}
          statusProperty={statusProperty}
        />
      ))}
    </div>
  );
};

//

export const NotionDatabaseKanbanColumn = ({
  titleProperty,
  priorityProperty,
  statusProperty,
  database,
  handleColumnDragStart,
  handleColumnDragEnd,
  onUpdatePage,
  property,
  option,
}: {
  database: TNotionDatabase;
  handleColumnDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  handleColumnDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  onUpdatePage: (
    pageId: string,
    properties: Record<string, TNotionProperty>
  ) => void;
  property: TNotionDatabaseProperty;
  option: { id: string; name: string; color: string };
} & TImportantProperties) => {
  //

  const pages =
    database.pages?.filter((page: TNotionPage) => {
      const pageProperty = page.properties[property.name];
      if (pageProperty?.type === 'status') {
        return pageProperty.status?.id === option.id;
      } else if (pageProperty?.type === 'select') {
        return pageProperty.select?.id === option.id;
      }
      return false;
    }) || [];

  const [dragOverColumn, setDragOverColumn] = useState<boolean>(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(false);

    const eventData = e.dataTransfer.getData('application/json');
    if (eventData) {
      try {
        const event = JSON.parse(eventData);
        console.log({ event });

        if (
          event.type === 'notion:load-page-node' &&
          event.databaseId === database.id &&
          event.pageId
        ) {
          const pageId = event.pageId;
          const targetOption = option;

          if (targetOption) {
            let newProperty: TNotionProperty;

            if (targetOption.id === 'unassigned') {
              // Set the property to null for unassigned items
              if (property.type === 'status') {
                newProperty = {
                  id: property.id,
                  type: 'status',
                  status: null,
                } as unknown as TNotionProperty;
              } else {
                newProperty = {
                  id: property.id,
                  type: 'select',
                  select: null,
                } as unknown as TNotionProperty;
              }
            } else {
              // Set the property to the target option
              newProperty =
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
            }

            console.log('############################# newProperty', {
              newProperty,
            });

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
    e.stopPropagation();
    setDragOverColumn(true);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(false);
  };

  //
  return (
    <div
      key={option.id}
      id={option.id}
      className={`notion-kanban-column${dragOverColumn ? ' drag-over' : ''}`}
      draggable={!!handleColumnDragStart}
      onDragStart={handleColumnDragStart}
      onDragEnd={handleColumnDragEnd}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="notion-kanban-column-header">
        <div className="notion-kanban-column-header-row">
          <div className={`task-status bg-${option.color} notion-kanban-dot`} />
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
  );
};

export default NotionDatabaseKanban;
