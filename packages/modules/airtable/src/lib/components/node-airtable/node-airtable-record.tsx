import React, { useCallback } from 'react';
import { TGraphNode } from '@holistix/core-graph';
import { useLocalSharedData } from '@holistix/collab/frontend';
import { useDispatcher } from '@holistix/reducers/frontend';
import { TAirtableSharedData } from '../../airtable-shared-model';
import { TAirtableRecordValue, TAirtableTable } from '../../airtable-types';
import AirtableRecordCard from './AirtableRecordCard';
import {
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix/space/frontend';
import { TAirtableEvent } from '../../airtable-events';

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
  const sd = useLocalSharedData<TAirtableSharedData>(
    ['airtable:bases'],
    (sd) => sd
  );
  const dispatcher = useDispatcher<TAirtableEvent>();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'airtable:delete-record-node',
      nodeId: useNodeValue.id,
    });
  }, [dispatcher, useNodeValue.id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDelete,
  });

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

  const base = sd['airtable:bases'].get(data.baseId);
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
        buttons={buttons}
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
