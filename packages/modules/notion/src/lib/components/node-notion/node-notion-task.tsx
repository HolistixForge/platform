import {
  DisablePanSelect,
  InputsAndOutputs,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TGraphNode } from '@monorepo/core';
import { TNotionSharedData } from '../../notion-shared-model';
import { useCallback } from 'react';
import { TEventUpdatePage } from '../../notion-events';

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

export const NodeNotionTask = ({ node }: { node: TGraphNode }) => {
  const pageId = node.data!.pageId as string;
  const dispatcher = useDispatcher<TEventUpdatePage>();

  //const [isEditing, setIsEditing] = useState(false);

  const o: { database: TNotionDatabase; page: TNotionPage } =
    useSharedData<TNotionSharedData>(['notionDatabases'], (sd) => {
      const database = Array.from(sd.notionDatabases.values()).find((db) =>
        db.pages.some((p) => p.id === pageId)
      );
      const page = database?.pages.find((p) => p.id === pageId);
      return { database, page };
    });

  const { database, page } = o;

  const useNodeValue = useNodeContext();
  const buttons = useMakeButton(useNodeValue);

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

  return (
    <div className="node-notion">
      <InputsAndOutputs id={useNodeValue.id} />
      <NodeHeader
        buttons={buttons}
        nodeType="notion-task"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
      />
      <DisablePanSelect>
        {page && database && (
          <div className="node-notion-content">
            <input
              className="node-notion-title"
              value={title.title[0].text.content}
              onChange={(e) =>
                handlePropertyUpdate('title', {
                  type: 'title',
                  title: [{ text: { content: e.target.value } }],
                })
              }
            />

            <select
              className="node-notion-status"
              value={status?.status?.name || 'Not started'}
              onChange={(e) =>
                handlePropertyUpdate('Status', {
                  type: 'status',
                  status: {
                    name: e.target.value,
                  },
                })
              }
              style={{
                backgroundColor: getColorForOption(
                  status?.status?.color || 'default'
                ),
                color: getTextColorForOption(
                  status?.status?.color || 'default'
                ),
              }}
            >
              <option value="Not started">Not Started</option>
              <option value="In progress">In Progress</option>
              <option value="Done">Done</option>
            </select>

            {pl?.select && (
              <div
                className="node-notion-priority"
                style={{
                  backgroundColor: getColorForOption(pl.select.color),
                  color: getTextColorForOption(pl.select.color),
                }}
              >
                {pl.select.name}
              </div>
            )}

            <div className="node-notion-properties">
              {Object.entries(page.properties).map(([key, prop]) => {
                if (
                  key === 'title' ||
                  key === 'Status' ||
                  key === 'Priority Level'
                )
                  return null;

                return (
                  <div key={key} className="node-notion-property">
                    <span className="node-notion-property-label">{key}</span>
                    <NotionPropertyRenderer
                      property={prop}
                      onUpdate={(value) => handlePropertyUpdate(key, value)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DisablePanSelect>
    </div>
  );
};

//

const getColorForOption = (color: string): string => {
  const colorMap: Record<string, string> = {
    default: '#37352F',
    gray: '#787774',
    brown: '#9F6B53',
    orange: '#D9730D',
    yellow: '#CB912F',
    green: '#448361',
    blue: '#337EA9',
    purple: '#9065B0',
    pink: '#C14C8A',
    red: '#D44C47',
  };
  return colorMap[color] || colorMap.default;
};

const getTextColorForOption = (color: string): string => {
  const darkColors = ['default', 'gray', 'brown'];
  return darkColors.includes(color) ? '#ffffff' : '#ffffff';
};
