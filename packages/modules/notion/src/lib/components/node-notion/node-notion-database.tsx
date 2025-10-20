import {
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@monorepo/space/frontend';
import { useLocalSharedData } from '@monorepo/collab/frontend';
import { useDispatcher } from '@monorepo/reducers/frontend';
import { TGraphNode } from '@monorepo/core-graph';
import { useCallback } from 'react';

import { TNotionSharedData } from '../../notion-shared-model';
import { TNotionDatabase } from '../../notion-types';
import { NotionDatabase, TNotionViewMode } from './notion-database';
import { TNotionEvent } from '../../notion-events';

import './node-notion-database.scss';

//

export type TNodeNotionDatabaseDataPayload = {
  databaseId: string;
};

export const NodeNotionDatabase = ({
  node,
}: {
  node: TGraphNode<TNodeNotionDatabaseDataPayload>;
}) => {
  const databaseId = node.data!.databaseId;

  const useNodeValue = useNodeContext();
  const dispatcher = useDispatcher<TNotionEvent>();

  const database: TNotionDatabase = useLocalSharedData<TNotionSharedData>(
    ['notion:databases'],
    (sd) => sd['notion:databases'].get(databaseId)
  );

  const viewMode: TNotionViewMode = useLocalSharedData<TNotionSharedData>(
    ['notion:node-views'],
    (sd) =>
      Array.from(sd['notion:node-views'].values()).find(
        (v) => v.nodeId === node.id && v.viewId === useNodeValue.viewId
      )?.viewMode || {
        mode: 'kanban',
        groupBy: 'status',
      }
  );

  const setViewMode = useCallback(
    (viewMode: TNotionViewMode) => {
      dispatcher.dispatch({
        type: 'notion:set-node-view',
        nodeId: node.id,
        viewId: useNodeValue.viewId,
        viewMode,
      });
    },
    [dispatcher, node.id, useNodeValue.viewId]
  );

  const handleDeleteDatabase = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'notion:delete-database-node',
      nodeId: node.id,
    });
  }, [dispatcher, node.id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDeleteDatabase,
  });

  if (!database) return <div>Database not found</div>;

  return (
    <div className="common-node node-notion node-resizable">
      <NodeHeader
        buttons={buttons}
        nodeType="notion-database"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
        visible={useNodeValue.selected}
      />
      <DisableZoomDragPan noZoom noDrag fullHeight>
        <NotionDatabase
          database={database}
          onUpdatePage={(pageId, properties) => {
            dispatcher.dispatch({
              type: 'notion:update-page',
              databaseId,
              pageId,
              properties,
            });
          }}
          onCreatePage={(properties) => {
            dispatcher.dispatch({
              type: 'notion:create-page',
              databaseId,
              properties,
            });
          }}
          onDeletePage={(pageId) => {
            dispatcher.dispatch({
              type: 'notion:delete-page',
              databaseId,
              pageId,
            });
          }}
          onReorderPage={(pageId, newPosition) => {
            dispatcher.dispatch({
              type: 'notion:reorder-page',
              databaseId,
              pageId,
              newPosition,
            });
          }}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </DisableZoomDragPan>
    </div>
  );
};
