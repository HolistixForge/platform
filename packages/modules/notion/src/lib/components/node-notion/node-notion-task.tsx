import {
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix-forge/whiteboard/frontend';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import { TGraphNode } from '@holistix-forge/core-graph';
import { TNotionSharedData } from '../../notion-shared-model';
import { useCallback } from 'react';
import { TEventUpdatePage, TNotionEvent } from '../../notion-events';

import './node-notion-task.scss';
import {
  TNotionDatabase,
  TNotionDatabaseSelectProperty,
  TNotionDatabaseStatusProperty,
  TNotionPage,
  TNotionRichText,
  TNotionSelect,
  TNotionStatus,
  TNotionTitle,
} from '../../notion-types';
import { NotionPropertyRenderer } from './notion-property-renderer';
import { getCoverImageUrl } from './notion-database-list';
import { useDatabaseMainProperties } from './notion-database';

//

export type TNodeNotionTaskDataPayload = {
  pageId: string;
  databaseId: string;
};

export const NodeNotionTask = ({
  node,
}: {
  node: TGraphNode<TNodeNotionTaskDataPayload>;
}) => {
  const pageId = node.data!.pageId as string;
  const dispatcher = useDispatcher<TNotionEvent>();

  const o: { database: TNotionDatabase; page: TNotionPage } =
    useLocalSharedData<TNotionSharedData>(['notion:databases'], (sd) => {
      const database = sd['notion:databases'].get(node.data!.databaseId);
      const page = database?.pages.find((p) => p.id === pageId);
      return { database, page };
    });

  const { database, page } = o;

  const { titleProperty, priorityProperty, statusProperty } =
    useDatabaseMainProperties(database);

  const useNodeValue = useNodeContext();

  const handleDeletePage = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'notion:delete-page-node',
      nodeId: node.id,
    });
  }, [dispatcher, node.id]);

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

  const title = titleProperty
    ? (page.properties[titleProperty.name] as TNotionTitle)
    : undefined;

  const status = statusProperty
    ? (page.properties[statusProperty.name] as TNotionStatus)
    : undefined;

  const priority = priorityProperty
    ? (page.properties[priorityProperty.name] as TNotionSelect)
    : undefined;

  const description = page.properties.Description as
    | TNotionRichText
    | undefined;

  const coverImageUrl = getCoverImageUrl(page.cover);

  /*
  console.log({
    title,
    status,
    priority,
    description,
    titleProperty,
    statusProperty,
    priorityProperty,
  });
  */

  const statusOptions = statusProperty
    ? (statusProperty as TNotionDatabaseStatusProperty).status.options
    : [];

  const priorityOptions = priorityProperty
    ? (priorityProperty as TNotionDatabaseSelectProperty).select.options
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
    <div
      className={`node-notion-task${coverImageUrl ? ' has-cover' : ''}`}
      style={{ position: 'relative' }}
    >
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
            {coverImageUrl && (
              <div
                className="task-item-cover"
                style={{
                  backgroundImage: `url(${coverImageUrl})`,
                  backgroundSize: 'cover',
                  //backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  height: '170px',
                }}
              />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <input
                className="node-notion-task-title"
                style={{ fontSize: '16px' }}
                defaultValue={title?.title?.[0]?.text?.content || '[Untitled]'}
                onBlur={(e) =>
                  handlePropertyUpdate('title', {
                    type: 'title',
                    title: [{ text: { content: e.target.value } }],
                  })
                }
              />

              <p className="task-item-description">
                {description?.rich_text?.[0]?.text?.content ||
                  '[No description]'}
              </p>

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
                className={`node-notion-task-status bg-${priority?.select?.color}`}
                value={priority?.select?.name || 'No Priority'}
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
                    key === titleProperty?.name ||
                    key === statusProperty?.name ||
                    key === priorityProperty?.name ||
                    key === 'Description'
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
          </div>
        )}
      </DisableZoomDragPan>
    </div>
  );
};
