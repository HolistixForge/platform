import React from 'react';
import { TGraphNode } from '@monorepo/module';

export type TNodeAirtableRecordDataPayload = {
  recordId: string;
  baseId: string;
  tableId: string;
};

export type TNodeAirtableRecordData =
  TGraphNode<TNodeAirtableRecordDataPayload>;

interface NodeAirtableRecordProps {
  node: TNodeAirtableRecordData;
}

export const NodeAirtableRecord: React.FC<NodeAirtableRecordProps> = ({
  node,
}) => {
  const data = node.data;

  if (!data) {
    return (
      <div className="node-airtable-record">
        <div className="node-header">
          <h3>Airtable Record</h3>
          <span className="record-id">No data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="node-airtable-record">
      <div className="node-header">
        <h3>Airtable Record</h3>
        <span className="record-id">{data.recordId}</span>
      </div>
      <div className="node-content">
        <p>Base: {data.baseId}</p>
        <p>Table: {data.tableId}</p>
      </div>
    </div>
  );
};
