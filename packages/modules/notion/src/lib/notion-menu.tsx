import { TSpaceMenuEntries, TSpaceMenuEntry } from '@holistix-forge/whiteboard/frontend';
import { TValidSharedDataToCopy } from '@holistix-forge/collab/frontend';
import { TCoreEvent } from '@holistix-forge/core-graph';
import { makeUuid } from '@holistix-forge/simple-types';
import { FrontendDispatcher } from '@holistix-forge/reducers/frontend';

import { NewNotionDatabaseForm } from './components/forms/new-database';
import { TNotionSharedData } from './notion-shared-model';
import { TNotionEvent } from './notion-events';
import { TNodeNotionDatabaseDataPayload } from './components/node-notion/node-notion-database';

//

export const notionMenuEntries: TSpaceMenuEntries = ({
  from,
  viewId,
  position,
  renderForm,
  renderPanel,
  sharedData,
  dispatcher,
}) => {
  const tsd = sharedData as TValidSharedDataToCopy<TNotionSharedData>;
  const d = dispatcher as FrontendDispatcher<TNotionEvent | TCoreEvent>;

  const databases: TSpaceMenuEntry[] = Array.from(
    tsd['notion:databases']?.entries() || []
  ).map(([id, db]) => {
    const title = db.title?.[0]?.plain_text;
    return {
      label: title,
      type: 'sub-menu',
      entries: [
        {
          type: 'item',
          label: 'Open',
          onClick: () => {
            renderPanel({
              type: 'notion-database',
              uuid: makeUuid(),
              data: {
                databaseId: db.id,
              },
            });
          },
        },
        {
          type: 'item',
          label: 'Embed',
          onClick: () => {
            const data: TNodeNotionDatabaseDataPayload = {
              databaseId: db.id,
            };
            d.dispatch({
              type: 'core:new-node',
              nodeData: {
                id: makeUuid(),
                name: `Notion Database ${db.title?.[0]?.plain_text}`,
                root: true,
                type: 'notion-database',
                data,
                connectors: [{ connectorName: 'outputs', pins: [] }],
              },
              edges: [],
              origin: {
                viewId,
                position: position(),
              },
            });
          },
          disabled: from !== undefined,
        },
        {
          type: 'item',
          label: 'Delete',
          onClick: () => {
            d.dispatch({ type: 'notion:delete-database', databaseId: db.id });
          },
        },
      ],
    };
  });

  return [
    {
      type: 'sub-menu',
      label: 'Notion',
      entries: [
        {
          type: 'item',
          label: 'New Database',
          disabled: from !== undefined,
          onClick: () => {
            renderForm(
              <NewNotionDatabaseForm
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
                renderPanel={renderPanel}
              />
            );
          },
        },
        {
          type: 'separator',
        },
        ...databases,
      ],
    },
  ];
};
