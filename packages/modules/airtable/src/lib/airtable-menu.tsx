import { TSpaceMenuEntries, TSpaceMenuEntry } from '@holistix/space/frontend';
import { TValidSharedDataToCopy } from '@holistix/collab/frontend';
import { TCoreEvent } from '@holistix/core-graph';
import { makeUuid } from '@holistix/shared-types';
import { FrontendDispatcher } from '@holistix/reducers/frontend';

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

  const bases: TSpaceMenuEntry[] = Array.from(
    tsd['airtable:bases']?.entries() ?? []
  ).map(([id, base]) => {
    // Create table entries for the embed submenu
    const tableEntries = base.tables.map((table) => ({
      type: 'item' as const,
      label: table.name,
      onClick: () => {
        const data: TNodeAirtableTableDataPayload = {
          baseId: base.id,
          tableId: table.id,
        };
        d.dispatch({
          type: 'core:new-node',
          nodeData: {
            id: makeUuid(),
            name: `Airtable Table ${table.name}`,
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
      },
      disabled: from !== undefined,
    }));

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
          type: 'sub-menu',
          label: 'Embed',
          disabled: from !== undefined,
          entries: tableEntries,
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
  });

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
