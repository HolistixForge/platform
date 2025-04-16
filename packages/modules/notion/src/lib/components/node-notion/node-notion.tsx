import {
  DisableZoomDragPan,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TGraphNode } from '@monorepo/core';
import { useCallback } from 'react';

import { TNotionSharedData } from '../../notion-shared-model';
import { NotionKanban } from './notion-database';
import { TNotionEvent } from '../../notion-events';

import './node-notion.scss';

//

export const NodeNotion = ({ node }: { node: TGraphNode }) => {
  const databaseId = node.data!.databaseId as string;
  const useNodeValue = useNodeContext();
  const dispatcher = useDispatcher<TNotionEvent>();

  const database = useSharedData<TNotionSharedData>(['notionDatabases'], (sd) =>
    sd.notionDatabases.get(databaseId)
  );

  const handleDeleteDatabase = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'notion:delete-database-node',
      databaseId,
    });
  }, [dispatcher, databaseId]);

  const buttons = useMakeButton({
    filterOut: useNodeValue.filterOut,
    onDelete: handleDeleteDatabase,
  });

  if (!database) return <div>Database not found</div>;

  return (
    <div className="node-notion">
      <NodeHeader
        buttons={buttons}
        nodeType="notion-database"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
        visible={useNodeValue.selected}
      />
      <DisableZoomDragPan noZoom noDrag>
        <NotionKanban
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
        />
      </DisableZoomDragPan>
    </div>
  );
};
