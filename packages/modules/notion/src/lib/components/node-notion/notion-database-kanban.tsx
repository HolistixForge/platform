import { useState, DragEvent } from 'react';
import {
  TNotionDatabase,
  TNotionProperty,
  TNotionPage,
  TNotionDatabaseProperty,
} from '../../notion-types';
import { TaskItem } from './notion-database-list';
import { TImportantProperties, TViewKanban } from './notion-database';
import { TEventLoadKanbanColumnNode } from '../../notion-events';

import './notion-database.scss';

//

type NotionDatabaseKanbanProps = {
  database: TNotionDatabase;
  viewMode: TViewKanban;
  setViewMode?: (viewMode: TViewKanban) => void;

  onUpdatePage: (
    pageId: string,
    properties: Record<string, TNotionProperty>
  ) => void;
} & TImportantProperties;

//

export const NotionDatabaseKanban = ({
  database,
  viewMode,
  setViewMode,
  onUpdatePage,
  titleProperty,
  priorityProperty,
  statusProperty,
}: NotionDatabaseKanbanProps) => {
  const groupBy = viewMode.groupBy;
  const subgroupBy = viewMode.subgroupBy;

  const property = groupBy === 'status' ? statusProperty : priorityProperty;

  // Get available properties for subgrouping (select and status types)
  const getAvailableSubgroupProperties = () => {
    return Object.entries(database.properties || {}).filter(([_, prop]) => {
      return prop.type === 'select' || prop.type === 'status';
    });
  };

  const availableSubgroupProperties = getAvailableSubgroupProperties();

  // Get the selected subgroup property
  const subgroupProperty = subgroupBy
    ? database.properties?.[subgroupBy]
    : null;

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
        return pageProperty.status === null;
      } else if (pageProperty?.type === 'select') {
        return pageProperty.select === null;
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

  // Subgroup property change handler
  const handleSubgroupChange = (propertyName: string) => {
    if (setViewMode) {
      setViewMode({
        ...viewMode,
        subgroupBy: propertyName || undefined,
      } as TViewKanban);
    }
  };

  //

  return (
    <div className="notion-kanban-board">
      {/* Subgroup selector */}
      {availableSubgroupProperties.length > 0 && (
        <div className="notion-kanban-subgroup-selector">
          <label htmlFor="subgroup-select">Group by: </label>
          <select
            id="subgroup-select"
            value={subgroupBy || ''}
            onChange={(e) => handleSubgroupChange(e.target.value)}
            className="notion-subgroup-select"
          >
            <option value="">No subgrouping</option>
            {availableSubgroupProperties.map(([propName, prop]) => (
              <option key={propName} value={propName}>
                {prop.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="notion-kanban-columns-container">
        {groupOptions.map((option) => (
          <NotionDatabaseKanbanColumn
            key={option.id}
            database={database}
            property={property}
            option={option}
            subgroupProperty={subgroupProperty}
            handleColumnDragStart={handleColumnDragStart}
            handleColumnDragEnd={handleColumnDragEnd}
            onUpdatePage={onUpdatePage}
            titleProperty={titleProperty}
            priorityProperty={priorityProperty}
            statusProperty={statusProperty}
          />
        ))}
      </div>
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
  subgroupProperty,
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
  subgroupProperty?: TNotionDatabaseProperty | null;
} & TImportantProperties) => {
  //

  const pages =
    database.pages?.filter((page: TNotionPage) => {
      const pageProperty = page.properties[property.name];
      if (pageProperty?.type === 'status') {
        return (
          pageProperty.status?.id === option.id ||
          (option.id === 'unassigned' && pageProperty.status === null)
        );
      } else if (pageProperty?.type === 'select') {
        return (
          pageProperty.select?.id === option.id ||
          (option.id === 'unassigned' && pageProperty.select === null)
        );
      }
      return false;
    }) || [];

  // Group pages by subgroup property
  const getSubgroupOptions = () => {
    if (!subgroupProperty) return [];

    if (subgroupProperty.type === 'status') {
      return [...subgroupProperty.status.options];
    } else if (subgroupProperty.type === 'select') {
      return [...subgroupProperty.select.options];
    }
    return [];
  };

  const subgroupOptions = getSubgroupOptions();

  // Add unassigned subgroup if there are pages without subgroup value
  const unassignedSubgroupPages = pages.filter((page: TNotionPage) => {
    if (!subgroupProperty) return false;

    const pageSubgroupProperty = page.properties[subgroupProperty.name];
    if (pageSubgroupProperty?.type === 'status') {
      return pageSubgroupProperty.status === null;
    } else if (pageSubgroupProperty?.type === 'select') {
      return pageSubgroupProperty.select === null;
    }
    return true;
  });

  const finalSubgroupOptions = [...subgroupOptions];
  if (unassignedSubgroupPages.length > 0) {
    finalSubgroupOptions.push({
      id: 'unassigned-subgroup',
      name: 'Unassigned',
      color: 'gray',
      description: null,
    });
  }

  // Group pages by subgroup
  const groupedPages = subgroupProperty
    ? finalSubgroupOptions
        .map((subgroupOption) => {
          const subgroupPages = pages.filter((page: TNotionPage) => {
            const pageSubgroupProperty = page.properties[subgroupProperty.name];

            if (pageSubgroupProperty?.type === 'status') {
              return (
                pageSubgroupProperty.status?.id === subgroupOption.id ||
                (subgroupOption.id === 'unassigned-subgroup' &&
                  pageSubgroupProperty.status === null)
              );
            } else if (pageSubgroupProperty?.type === 'select') {
              return (
                pageSubgroupProperty.select?.id === subgroupOption.id ||
                (subgroupOption.id === 'unassigned-subgroup' &&
                  pageSubgroupProperty.select === null)
              );
            }
            return false;
          });

          return {
            subgroupOption,
            pages: subgroupPages,
          };
        })
        .filter((group) => group.pages.length > 0)
    : [{ subgroupOption: null, pages }];

  const [dragOverColumn, setDragOverColumn] = useState<boolean>(false);
  const [dragOverSubgroup, setDragOverSubgroup] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(false);
    setDragOverSubgroup(null);

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

            // If dropping into a specific subgroup, also update the subgroup property
            if (dragOverSubgroup && subgroupProperty) {
              let subgroupPropertyValue: TNotionProperty;

              if (dragOverSubgroup === 'unassigned-subgroup') {
                if (subgroupProperty.type === 'status') {
                  subgroupPropertyValue = {
                    id: subgroupProperty.id,
                    type: 'status',
                    status: null,
                  } as unknown as TNotionProperty;
                } else {
                  subgroupPropertyValue = {
                    id: subgroupProperty.id,
                    type: 'select',
                    select: null,
                  } as unknown as TNotionProperty;
                }
              } else {
                const subgroupOption = finalSubgroupOptions.find(
                  (opt) => opt.id === dragOverSubgroup
                );
                if (subgroupOption) {
                  subgroupPropertyValue =
                    subgroupProperty.type === 'status'
                      ? {
                          id: subgroupProperty.id,
                          type: 'status',
                          status: {
                            id: subgroupOption.id,
                            name: subgroupOption.name,
                            color: subgroupOption.color,
                          },
                        }
                      : {
                          id: subgroupProperty.id,
                          type: 'select',
                          select: {
                            id: subgroupOption.id,
                            name: subgroupOption.name,
                            color: subgroupOption.color,
                          },
                        };
                } else {
                  subgroupPropertyValue = newProperty; // fallback
                }
              }

              onUpdatePage?.(pageId, {
                [property.name]: newProperty,
                [subgroupProperty.name]: subgroupPropertyValue,
              });
            } else {
              onUpdatePage?.(pageId, { [property.name]: newProperty });
            }
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

  // Subgroup-specific drag handlers
  const handleSubgroupDragOver = (e: React.DragEvent, subgroupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSubgroup(subgroupId);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSubgroupDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSubgroup(null);
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
        {groupedPages.map(({ subgroupOption, pages: subgroupPages }) => (
          <div
            key={subgroupOption?.id || 'no-subgroup'}
            className={`notion-kanban-subgroup${
              dragOverSubgroup === (subgroupOption?.id || 'no-subgroup')
                ? ' drag-over'
                : ''
            }`}
            onDrop={handleDrop}
            onDragOver={(e) =>
              handleSubgroupDragOver(e, subgroupOption?.id || 'no-subgroup')
            }
            onDragLeave={handleSubgroupDragLeave}
          >
            {subgroupProperty && subgroupOption && (
              <div className="notion-kanban-subgroup-header">
                <div
                  className={`task-status bg-${subgroupOption.color} notion-kanban-subgroup-dot`}
                />
                <span className="notion-kanban-subgroup-title">
                  {subgroupOption.name}
                </span>
                <span className="notion-kanban-subgroup-count">
                  {subgroupPages.length}
                </span>
              </div>
            )}
            <div className="notion-kanban-subgroup-content">
              {subgroupPages.map((page: TNotionPage) => (
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
    </div>
  );
};

export default NotionDatabaseKanban;
