import { TSpaceMenuEntries, TSpaceMenuEntry } from '@monorepo/module/frontend';
import {
  FrontendDispatcher,
  TValidSharedDataToCopy,
} from '@monorepo/collab-engine';
import { TCoreEvent } from '@monorepo/core';
import { makeUuid } from '@monorepo/simple-types';

import { NewAirtableBaseForm } from './components/forms/new-base';
import { TAirtableSharedData } from './airtable-shared-model';
import { TAirtableEvent } from './airtable-events';
import { TNodeAirtableTableDataPayload } from './components/node-airtable/node-airtable-table';

//

export const airtableMenuEntries: TSpaceMenuEntries = ({
  from,
  viewId,
  position,
  renderForm,
  renderPanel,
  sharedData,
  dispatcher,
}) => {
  const tsd = sharedData as TValidSharedDataToCopy<TAirtableSharedData>;
  const d = dispatcher as FrontendDispatcher<TAirtableEvent | TCoreEvent>;

  const bases: TSpaceMenuEntry[] = Array.from(tsd.airtableBases.entries()).map(
    ([id, base]) => {
      return {
        label: base.name,
        type: 'sub-menu',
        entries: [
          {
            type: 'item',
            label: 'Open',
            onClick: () => {
              renderPanel({
                type: 'airtable-base',
                uuid: makeUuid(),
                data: {
                  baseId: base.id,
                },
              });
            },
          },
          {
            type: 'item',
            label: 'Embed',
            onClick: () => {
              // For Airtable, we'll embed the first table by default
              // In a full implementation, you might want to show a table selector
              const firstTable = base.tables[0];
              if (firstTable) {
                const data: TNodeAirtableTableDataPayload = {
                  baseId: base.id,
                  tableId: firstTable.id,
                };
                d.dispatch({
                  type: 'core:new-node',
                  nodeData: {
                    id: makeUuid(),
                    name: `Airtable Table ${firstTable.name}`,
                    root: true,
                    type: 'airtable-table',
                    data,
                    connectors: [{ connectorName: 'outputs', pins: [] }],
                  },
                  edges: [],
                  origin: {
                    viewId,
                    position: position(),
                  },
                });
              }
            },
            disabled: from !== undefined,
          },
          {
            type: 'item',
            label: 'Delete',
            onClick: () => {
              d.dispatch({ type: 'airtable:delete-base', baseId: base.id });
            },
          },
        ],
      };
    }
  );

  return [
    {
      type: 'sub-menu',
      label: 'Airtable',
      entries: [
        {
          type: 'item',
          label: 'New Base',
          disabled: from !== undefined,
          onClick: () => {
            renderForm(
              <NewAirtableBaseForm
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
        ...bases,
      ],
    },
  ];
};
