import React from 'react';
import { TGraphNode } from '@monorepo/module';
import { useSharedData, useDispatcher } from '@monorepo/collab-engine';
import { TAirtableSharedData } from '../../airtable-shared-model';
import {
  TAirtableTable,
  TAirtableField,
  TAirtableImportantProperties,
  TAirtableSingleSelectField,
} from '../../airtable-types';
import { AirtableTableKanbanColumn } from './airtable-table-kanban';
import { TAirtableEvent } from '../../airtable-events';

export type TNodeAirtableKanbanColumnDataPayload = {
  baseId: string;
  tableId: string;
  fieldId: string;
  optionId: string;
};

export type TNodeAirtableKanbanColumnData =
  TGraphNode<TNodeAirtableKanbanColumnDataPayload>;

interface NodeAirtableKanbanColumnProps {
  node: TNodeAirtableKanbanColumnData;
}

export const NodeAirtableKanbanColumn: React.FC<
  NodeAirtableKanbanColumnProps
> = ({ node }) => {
  const data = node.data;

  // Access shared data to get base, table, and field information
  const sd = useSharedData<TAirtableSharedData>(['airtableBases'], (sd) => sd);
  const dispatcher = useDispatcher<TAirtableEvent>();

  if (!data) {
    return (
      <div className="node-airtable-kanban-column">
        <div className="node-header">
          <h3>Airtable Kanban Column</h3>
          <span className="option-id">No data</span>
        </div>
      </div>
    );
  }

  // Get base, table, and field from shared data
  const base = sd.airtableBases.get(data.baseId);
  const table = base?.tables.find((t: TAirtableTable) => t.id === data.tableId);
  const field = table?.fields.find(
    (f: TAirtableField) => f.id === data.fieldId
  );

  if (!base || !table || !field) {
    return (
      <div className="node-airtable-kanban-column">
        <div className="node-header">
          <h3>Airtable Kanban Column</h3>
          <span className="option-id">Data not found</span>
        </div>
        <div className="node-content">
          <p>Base: {data.baseId}</p>
          <p>Table: {data.tableId}</p>
          <p>Field: {data.fieldId}</p>
          <p>Option: {data.optionId}</p>
        </div>
      </div>
    );
  }

  // Create the option object from the node data
  let option = {
    id: data.optionId,
    name: data.optionId, // Default to optionId
    color: 'blue', // Default color
  };

  // If the field is a singleSelect field, try to find the actual option details
  if (field.type === 'singleSelect') {
    const singleSelectField = field as TAirtableSingleSelectField;
    const foundOption = singleSelectField.options.choices.find(
      (choice) => choice.id === data.optionId
    );
    if (foundOption) {
      option = {
        id: foundOption.id,
        name: foundOption.name,
        color: foundOption.color,
      };
    }
  }

  // Create important properties (we'll use the field as both status and priority for now)
  const importantProperties: TAirtableImportantProperties = {
    statusField: field,
    priorityField: field,
  };

  // Proper onUpdateRecord function using dispatcher
  const onUpdateRecord = (
    recordId: string,
    fields: Record<string, unknown>
  ) => {
    dispatcher.dispatch({
      type: 'airtable:update-record',
      baseId: data.baseId,
      tableId: data.tableId,
      recordId,
      fields,
    });
  };

  return (
    <div className="node-airtable-kanban-column">
      <AirtableTableKanbanColumn
        baseId={data.baseId}
        table={table}
        property={field}
        option={option}
        onUpdateRecord={onUpdateRecord}
        titleField={importantProperties.titleField}
        priorityField={importantProperties.priorityField}
        statusField={importantProperties.statusField}
        // Note: Not providing handleColumnDragStart and handleColumnDragEnd as requested
      />
    </div>
  );
};
