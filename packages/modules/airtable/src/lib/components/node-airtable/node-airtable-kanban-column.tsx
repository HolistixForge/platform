import React, { useCallback } from 'react';
import { TGraphNode } from '@holistix-forge/core-graph';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { TAirtableSharedData } from '../../airtable-shared-model';
import {
  TAirtableTable,
  TAirtableField,
  TAirtableImportantProperties,
  TAirtableSingleSelectField,
} from '../../airtable-types';
import { AirtableTableKanbanColumn } from './airtable-table-kanban';
import { TAirtableEvent } from '../../airtable-events';
import {
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix-forge/whiteboard/frontend';
import { TJsonObject } from '@holistix-forge/simple-types';

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
  const sd = useLocalSharedData<TAirtableSharedData>(
    ['airtable:bases'],
    (sd) => sd
  );
  const dispatcher = useDispatcher<TAirtableEvent>();

  if (!data) {
    return (
      <NodeAirtableKanbanColumnWrap>
        <div className="node-header">
          <h3>Airtable Kanban Column</h3>
          <span className="option-id">No data</span>
        </div>
      </NodeAirtableKanbanColumnWrap>
    );
  }

  // Get base, table, and field from shared data
  const base = sd['airtable:bases'].get(data.baseId);
  const table = base?.tables.find((t: TAirtableTable) => t.id === data.tableId);
  const field = table?.fields.find(
    (f: TAirtableField) => f.id === data.fieldId
  );

  if (!base || !table || !field) {
    return (
      <NodeAirtableKanbanColumnWrap>
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
      </NodeAirtableKanbanColumnWrap>
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
      fields: fields as TJsonObject,
    });
  };

  return (
    <NodeAirtableKanbanColumnWrap>
      <AirtableTableKanbanColumn
        baseId={data.baseId}
        table={table}
        property={field}
        option={option}
        onUpdateRecord={onUpdateRecord}
        titleField={importantProperties.titleField}
        priorityField={importantProperties.priorityField}
        statusField={importantProperties.statusField}
      />
    </NodeAirtableKanbanColumnWrap>
  );
};

//

const NodeAirtableKanbanColumnWrap = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const useNodeValue = useNodeContext();
  const dispatcher = useDispatcher<TAirtableEvent>();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'airtable:delete-kanban-column-node',
      nodeId: useNodeValue.id,
    });
  }, [dispatcher, useNodeValue.id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDelete,
  });

  return (
    <div className="common-node node-airtable node-resizable node-airtable-kanban-column">
      <NodeHeader
        buttons={buttons}
        nodeType="Airtable Kanban Column"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
        visible={useNodeValue.selected}
      />
      <DisableZoomDragPan noZoom noDrag fullHeight>
        {children}
      </DisableZoomDragPan>
    </div>
  );
};
