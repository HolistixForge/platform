import React from 'react';
import { TGraphNode } from '@monorepo/module';

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

  return (
    <div className="node-airtable-kanban-column">
      <div className="node-header">
        <h3>Airtable Kanban Column</h3>
        <span className="option-id">{data.optionId}</span>
      </div>
      <div className="node-content">
        <p>Base: {data.baseId}</p>
        <p>Table: {data.tableId}</p>
        <p>Field: {data.fieldId}</p>
      </div>
    </div>
  );
};
