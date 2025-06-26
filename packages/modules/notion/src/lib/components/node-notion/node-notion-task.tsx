import {
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@monorepo/space/frontend';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TGraphNode } from '@monorepo/module';
import { TNotionSharedData } from '../../notion-shared-model';
import { useCallback } from 'react';
import { TEventUpdatePage, TNotionEvent } from '../../notion-events';

import './node-notion-task.scss';
import {
  TNotionDatabase,
  TNotionPage,
  TNotionSelect,
  TNotionStatus,
  TNotionTitle,
} from '../../notion-types';
import { NotionPropertyRenderer } from './notion-property-renderer';

//

export type TNodeNotionDataPayload = {
  pageId: string;
  databaseId: string;
};

export const NodeNotionTask = ({
  node,
}: {
  node: TGraphNode<TNodeNotionDataPayload>;
}) => {
  const pageId = node.data!.pageId as string;
  const dispatcher = useDispatcher<TNotionEvent>();

  //const [isEditing, setIsEditing] = useState(false);

  const o: { database: TNotionDatabase; page: TNotionPage } =
    useSharedData<TNotionSharedData>(['notionDatabases'], (sd) => {
      const database = sd.notionDatabases.get(node.data!.databaseId);
      const page = database?.pages.find((p) => p.id === pageId);
      return { database, page };
    });

  const { database, page } = o;

  const useNodeValue = useNodeContext();

  const handleDeletePage = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'notion:delete-page-node',
      pageId,
    });
  }, [dispatcher, pageId]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDeletePage,
  });

  const handlePropertyUpdate = useCallback(
    async (key: string, value: any) => {
      if (!database || !page) return;

      const event: TEventUpdatePage = {
        type: 'notion:update-page',
        databaseId: database.id,
        pageId: page.id,
        properties: {
          [key]: value,
        },
      };

      dispatcher.dispatch(event);
    },
    [database, page, dispatcher]
  );

  const title = page.properties.Name as TNotionTitle;
  const status = page.properties.Status as TNotionStatus | undefined;
  const pl = page.properties['Priority Level'] as TNotionSelect | undefined;

  const statusOptions =
    database?.properties.Status?.type === 'status'
      ? database.properties.Status.status.options
      : [];

  const priorityOptions =
    database?.properties['Priority Level']?.type === 'select'
      ? database.properties['Priority Level'].select.options
      : [];

  /*
  console.log({
    title,
    status,
    pl,
    priorities: database.properties['Priority Level'],
  });
  */

  return (
    <div className="node-notion-task">
      <NodeHeader
        buttons={buttons}
        nodeType="notion-task"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
        visible={useNodeValue.selected}
      />
      <DisableZoomDragPan noDrag>
        {page && database && (
          <div className="node-background node-notion-task-content">
            <input
              className="node-notion-task-title"
              style={{ fontSize: '16px' }}
              defaultValue={title?.title?.[0]?.text?.content}
              onBlur={(e) =>
                handlePropertyUpdate('title', {
                  type: 'title',
                  title: [{ text: { content: e.target.value } }],
                })
              }
            />

            <select
              className={`node-notion-task-status bg-${status?.status?.color}`}
              value={status?.status?.name || 'No Status'}
              onChange={(e) =>
                handlePropertyUpdate('Status', {
                  type: 'status',
                  status: {
                    name: e.target.value,
                  },
                })
              }
            >
              <option value="">Select status...</option>
              {statusOptions.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
              <option value="No Status" disabled>
                No Status
              </option>
            </select>

            <select
              className={`node-notion-task-status bg-${pl?.select?.color}`}
              value={pl?.select?.name || 'No Priority'}
              onChange={(e) =>
                handlePropertyUpdate('Priority Level', {
                  type: 'select',
                  select: {
                    name: e.target.value,
                  },
                })
              }
            >
              <option value="">Select priority...</option>
              {priorityOptions.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
                </option>
              ))}
              <option value="No Priority" disabled>
                No Priority
              </option>
            </select>

            <div className="node-notion-task-properties">
              {Object.entries(page.properties).map(([key, prop]) => {
                if (
                  key === 'Name' ||
                  key === 'Status' ||
                  key === 'Priority Level'
                )
                  return null;

                return (
                  <div key={key} className="node-notion-task-property">
                    <span className="node-notion-task-property-label">
                      {key}
                    </span>
                    <NotionPropertyRenderer
                      property={prop}
                      database={database}
                      onUpdate={(value) => handlePropertyUpdate(key, value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DisableZoomDragPan>
    </div>
  );
};
