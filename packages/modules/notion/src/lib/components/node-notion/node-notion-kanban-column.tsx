import { useSharedDataDirect } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { TGraphNode } from '@holistix-forge/core-graph';
import {
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix-forge/space/frontend';
import { useCallback } from 'react';
import { TNotionEvent } from '../../notion-events';
import { NotionDatabaseKanbanColumn } from './notion-database-kanban';
import { TNotionSharedData } from '../../notion-shared-model';
import { useDatabaseMainProperties } from './notion-database';

//

export type TNodeNotionKanbanColumnDataPayload = {
  databaseId: string;
  propertyId: string;
  optionId: string;
};

//

export const NodeNotionKanbanColumn = ({
  node,
}: {
  node: TGraphNode<TNodeNotionKanbanColumnDataPayload>;
}) => {
  const useNodeValue = useNodeContext();
  const databaseId = node.data!.databaseId;
  const propertyId = node.data!.propertyId;
  const optionId = node.data!.optionId;

  const dispatcher = useDispatcher<TNotionEvent>();

  const handleDeletePage = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'notion:delete-kanban-column-node',
      nodeId: node.id,
    });
  }, [dispatcher, node.id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDeletePage,
  });

  const sd = useSharedDataDirect<TNotionSharedData>();
  const database = sd['notion:databases'].get(databaseId)!;

  const { titleProperty, priorityProperty, statusProperty } =
    useDatabaseMainProperties(database);

  const property = Object.values(database?.properties || {}).find(
    (p) => p.id === propertyId
  );

  const option = Object.values(
    property?.type === 'select'
      ? property?.select?.options
      : property?.type === 'status'
      ? property?.status?.options
      : {}
  ).find((o) => o.id === optionId);

  return (
    <div className="common-node node-background notion-kanban node-notion-kanban-column node-resizable notion-kanban-board">
      <NodeHeader
        buttons={buttons}
        nodeType="notion-kanban-column"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
        visible={useNodeValue.selected}
      />
      <DisableZoomDragPan noDrag>
        {property && option ? (
          <NotionDatabaseKanbanColumn
            onUpdatePage={() => {
              console.log('onUpdatePage');
            }}
            database={database}
            property={property}
            option={option}
            titleProperty={titleProperty}
            priorityProperty={priorityProperty}
            statusProperty={statusProperty}
          />
        ) : (
          <pre>{JSON.stringify(node.data, null, 2)}</pre>
        )}
      </DisableZoomDragPan>
    </div>
  );
};
