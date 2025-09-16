import React from 'react';
import { TGraphNode } from '@monorepo/module';
import { useSharedData } from '@monorepo/collab-engine';
import { TAirtableSharedData } from '../../airtable-shared-model';
import { TAirtableRecordValue, TAirtableTable } from '../../airtable-types';
import AirtableRecordCard from './AirtableRecordCard';
import { NodeHeader, useNodeContext } from '@monorepo/space/frontend';

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
  const useNodeValue = useNodeContext();
  const sd = useSharedData<TAirtableSharedData>(['airtableBases'], (sd) => sd);

  if (!data) {
    return (
      <div className="node-airtable-record">
        <div className="node-header">
          <h3>Airtable Record</h3>
          <span className="option-id">No data</span>
        </div>
      </div>
    );
  }

  const base = sd.airtableBases.get(data.baseId);
  const table = base?.tables.find((t: TAirtableTable) => t.id === data.tableId);
  const record = table?.records.find(
    (r: TAirtableRecordValue) => r.id === data.recordId
  );

  if (!record) {
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
    <div className="common-node node-airtable node-resizable node-airtable-record">
      <NodeHeader
        buttons={[]}
        nodeType="Airtable Record"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
        visible={useNodeValue.selected}
      />
      <AirtableRecordCard baseId={data.baseId} record={record} table={table} />
    </div>
  );
};
