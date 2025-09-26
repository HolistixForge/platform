import { useState, DragEvent } from 'react';
import {
  TAirtableTable,
  TAirtableField,
  TAirtableRecordValue,
  TAirtableImportantProperties,
} from '../../airtable-types';
import AirtableRecordCard from './AirtableRecordCard';
import { TEventLoadKanbanColumnNode } from '../../airtable-events';
import { TViewKanban } from './node-airtable-table';

// Props interface
type AirtableTableKanbanProps = {
  baseId: string;
  table: TAirtableTable;
  viewMode: TViewKanban;
  setViewMode?: (viewMode: TViewKanban) => void;
  onUpdateRecord: (recordId: string, fields: Record<string, unknown>) => void;
} & TAirtableImportantProperties;

export const AirtableTableKanban = ({
  baseId,
  table,
  viewMode,
  setViewMode,
  onUpdateRecord,
  titleField,
  priorityField,
  statusField,
}: AirtableTableKanbanProps) => {
  const groupBy = viewMode.groupBy;
  const subgroupBy = viewMode.subgroupBy;

  // Determine the property to group by
  const property = groupBy === 'status' ? statusField : priorityField;

  // Get available properties for subgrouping (singleSelect and multipleSelects types)
  const getAvailableSubgroupProperties = () => {
    return (table.fields || []).filter((field) => {
      return (
        (field.type === 'singleSelect' || field.type === 'multipleSelects') &&
        (groupBy !== 'status' || field.name !== statusField?.name) &&
        (groupBy !== 'priority' || field.name !== priorityField?.name)
      );
    });
  };

  const availableSubgroupProperties = getAvailableSubgroupProperties();

  // Get the selected subgroup property
  const subgroupProperty = subgroupBy
    ? table.fields.find((field) => field.name === subgroupBy)
    : null;

  if (!property) {
    return (
      <div>
        Cannot group by {viewMode.groupBy} - property not found or not supported
      </div>
    );
  }

  const getGroupOptions = () => {
    if (property.type === 'singleSelect') {
      return [...property.options.choices];
    }
    return [];
  };

  const groupOptions = getGroupOptions();

  // Add unassigned option if there are records without a value
  const unassignedRecords =
    table.records?.filter((record: TAirtableRecordValue) => {
      const recordProperty = record.fields[property.name];
      return (
        recordProperty === null ||
        recordProperty === undefined ||
        recordProperty === ''
      );
    }) || [];

  const finalGroupOptions = [...groupOptions];
  if (unassignedRecords.length > 0) {
    finalGroupOptions.push({
      id: 'unassigned',
      name: 'Unassigned',
      color: 'gray',
      description: undefined,
    });
  }

  // Subgroup property change handler
  const handleSubgroupChange = (propertyName: string) => {
    if (setViewMode) {
      setViewMode({
        ...viewMode,
        subgroupBy: propertyName || undefined,
      } as TViewKanban);
    }
  };

  return (
    <div className="airtable-kanban-board">
      {/* Subgroup selector */}
      {availableSubgroupProperties.length > 0 && (
        <div className="airtable-kanban-subgroup-selector">
          <label htmlFor="subgroup-select">Group by: </label>
          <select
            id="subgroup-select"
            value={subgroupBy || ''}
            onChange={(e) => handleSubgroupChange(e.target.value)}
            className="airtable-subgroup-select"
          >
            <option value="">No subgrouping</option>
            {availableSubgroupProperties.map((field) => (
              <option key={field.name} value={field.name}>
                {field.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="airtable-kanban-columns-container">
        {finalGroupOptions.map((option) => (
          <AirtableTableKanbanColumn
            key={option.id}
            table={table}
            property={property}
            option={option}
            subgroupProperty={subgroupProperty}
            draggable={true}
            onUpdateRecord={onUpdateRecord}
            baseId={baseId}
            titleField={titleField}
            priorityField={priorityField}
            statusField={statusField}
          />
        ))}
      </div>
    </div>
  );
};

export const AirtableTableKanbanColumn = ({
  baseId,
  titleField,
  priorityField,
  statusField,
  draggable = false,
  table,
  onUpdateRecord,
  property,
  option,
  subgroupProperty,
}: {
  baseId: string;
  table: TAirtableTable;
  draggable?: boolean;
  onUpdateRecord: (recordId: string, fields: Record<string, unknown>) => void;
  property: TAirtableField;
  option: { id: string; name: string; color: string };
  subgroupProperty?: TAirtableField | null;
} & TAirtableImportantProperties) => {
  // Filter records for this column
  const records =
    table.records?.filter((record: TAirtableRecordValue) => {
      const recordProperty = record.fields[property.name];
      if (option.id === 'unassigned') {
        return (
          recordProperty === null ||
          recordProperty === undefined ||
          recordProperty === ''
        );
      }
      return String(recordProperty) === option.name;
    }) || [];

  // Get subgroup options
  const getSubgroupOptions = () => {
    if (!subgroupProperty || subgroupProperty.type !== 'singleSelect')
      return [];

    return [...subgroupProperty.options.choices];
  };

  const subgroupOptions = getSubgroupOptions();

  // Add unassigned subgroup if there are records without subgroup value
  const unassignedSubgroupRecords = records.filter(
    (record: TAirtableRecordValue) => {
      if (!subgroupProperty) return false;

      const recordSubgroupProperty = record.fields[subgroupProperty.name];
      return (
        recordSubgroupProperty === null ||
        recordSubgroupProperty === undefined ||
        recordSubgroupProperty === ''
      );
    }
  );

  const finalSubgroupOptions = [...subgroupOptions];
  if (unassignedSubgroupRecords.length > 0) {
    finalSubgroupOptions.push({
      id: 'unassigned-subgroup',
      name: 'Unassigned',
      color: 'gray',
      description: undefined,
    });
  }

  // Group records by subgroup
  const groupedRecords = subgroupProperty
    ? finalSubgroupOptions
        .map((subgroupOption) => {
          const subgroupRecords = records.filter(
            (record: TAirtableRecordValue) => {
              const recordSubgroupProperty =
                record.fields[subgroupProperty.name];

              if (subgroupOption.id === 'unassigned-subgroup') {
                return (
                  recordSubgroupProperty === null ||
                  recordSubgroupProperty === undefined ||
                  recordSubgroupProperty === ''
                );
              }
              return String(recordSubgroupProperty) === subgroupOption.name;
            }
          );

          return {
            subgroupOption,
            records: subgroupRecords,
          };
        })
        .filter((group) => group.records.length > 0)
    : [{ subgroupOption: null, records }];

  const [draggingColumn, setDraggingColumn] = useState<boolean>(false);

  // Column drag handlers
  const handleColumnDragStart = (e: DragEvent<HTMLDivElement>) => {
    const event: Partial<TEventLoadKanbanColumnNode> = {
      type: 'airtable:load-kanban-column-node',
      baseId: baseId,
      tableId: table.id,
      fieldId: property.id,
      optionId: e.currentTarget.id,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    setDraggingColumn(true);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleColumnDragEnd = (e: DragEvent<HTMLDivElement>) => {
    setDraggingColumn(false);
  };

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

        if (
          event.type === 'airtable:load-record-node' &&
          event.tableId === table.id &&
          event.recordId
        ) {
          const recordId = event.recordId;
          const targetOption = option;

          if (targetOption) {
            let newPropertyValue: unknown;

            if (targetOption.id === 'unassigned') {
              // Set the property to null for unassigned items
              newPropertyValue = null;
            } else {
              // Set the property to the target option
              newPropertyValue = targetOption.name;
            }

            // If dropping into a specific subgroup, also update the subgroup property
            if (dragOverSubgroup && subgroupProperty) {
              let subgroupPropertyValue: unknown;

              if (dragOverSubgroup === 'unassigned-subgroup') {
                subgroupPropertyValue = null;
              } else {
                const subgroupOption = finalSubgroupOptions.find(
                  (opt) => opt.id === dragOverSubgroup
                );
                if (subgroupOption) {
                  subgroupPropertyValue = subgroupOption.name;
                } else {
                  subgroupPropertyValue = newPropertyValue; // fallback
                }
              }

              onUpdateRecord?.(recordId, {
                [property.name]: newPropertyValue,
                [subgroupProperty.name]: subgroupPropertyValue,
              });
            } else {
              onUpdateRecord?.(recordId, { [property.name]: newPropertyValue });
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

  return (
    <div
      key={option.id}
      id={option.id}
      className={`airtable-kanban-column${dragOverColumn ? ' drag-over' : ''} ${
        draggingColumn ? 'dragging' : ''
      }`}
      draggable={draggable}
      onDragStart={handleColumnDragStart}
      onDragEnd={handleColumnDragEnd}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div
        className="airtable-kanban-column-header"
        style={{ cursor: draggable ? 'grab' : 'default' }}
      >
        <div className="airtable-kanban-column-header-row">
          <div
            className={`task-status bg-${option.color} airtable-kanban-dot`}
          />
          <h3 className="airtable-kanban-title">{option.name}</h3>
        </div>
        <div className="airtable-kanban-count">
          {records.length} {records.length === 1 ? 'item' : 'items'}
        </div>
      </div>
      <div className="airtable-kanban-column-content">
        {groupedRecords.map(({ subgroupOption, records: subgroupRecords }) => (
          <div
            key={subgroupOption?.id || 'no-subgroup'}
            className={`airtable-kanban-subgroup${
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
              <div className="airtable-kanban-subgroup-header">
                <div
                  className={`task-status bg-${subgroupOption.color} airtable-kanban-subgroup-dot`}
                />
                <span className="airtable-kanban-subgroup-title">
                  {subgroupOption.name}
                </span>
                <span className="airtable-kanban-subgroup-count">
                  {subgroupRecords.length}
                </span>
              </div>
            )}
            <div className="airtable-kanban-subgroup-content">
              {subgroupRecords.map((record: TAirtableRecordValue) => (
                <AirtableRecordCard
                  baseId={baseId}
                  key={record.id}
                  record={record}
                  table={table}
                  draggable={true}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AirtableTableKanban;
