import { ReduceArgs, Reducer, TEventPeriodic } from '@monorepo/collab-engine';
import {
  TCoreSharedData,
  TEventDeleteNode,
  TEventNewNode,
} from '@monorepo/core';
import { makeUuid, TJson } from '@monorepo/simple-types';

import {
  TEventCreateRecord,
  TEventDeleteRecord,
  TEventDeleteRecordNode,
  TEventDeleteTableNode,
  TEventInitBase,
  TEventLoadRecordNode,
  TEventLoadTableNode,
  TEventReorderRecord,
  TEventSyncBase,
  TEventUpdateRecord,
  TAirtableEvent,
  TEventDeleteBase,
  TEventSetNodeView,
  TEventLoadKanbanColumnNode,
  TEventDeleteKanbanColumnNode,
  TEventSearchBases,
  TEventClearUserSearchResults,
} from './airtable-events';

import { TAirtableSharedData } from './airtable-shared-model';
import {
  TAirtableBase,
  TAirtableBaseSearchResult,
  TAirtableRecordValue,
  TAirtableTable,
} from './airtable-types';
import { TNodeAirtableRecordDataPayload } from './components/node-airtable/node-airtable-record';
import { TNodeAirtableKanbanColumnDataPayload } from './components/node-airtable/node-airtable-kanban-column';
import { TNodeAirtableTableDataPayload } from './components/node-airtable/node-airtable-table';

//

type TDepsModulesExports = {
  config: {
    AIRTABLE_API_KEY: string;
  };
};

type Ra<T> = ReduceArgs<
  TAirtableSharedData & TCoreSharedData,
  T,
  TEventNewNode | TEventDeleteNode,
  undefined,
  TDepsModulesExports
>;

export class AirtableReducer extends Reducer<
  TAirtableSharedData & TCoreSharedData,
  TAirtableEvent,
  never,
  undefined,
  TDepsModulesExports
> {
  private lastSync: Date = new Date(0); // Initialize to epoch

  private async makeAirtableRequest(
    g: Ra<unknown>,
    endpoint: string,
    options: RequestInit = {}
  ) {
    const apiKey = g.extraContext.config.AIRTABLE_API_KEY;
    const baseUrl = 'https://api.airtable.com/v0';

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Airtable API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  async reduce(g: Ra<TAirtableEvent | TEventPeriodic>): Promise<void> {
    switch (g.event.type) {
      case 'airtable:init-base':
        return this._initBase(g as Ra<TEventInitBase>);

      case 'airtable:sync-base':
        await this._fetchAndUpdateBase(g as Ra<TEventSyncBase>);
        return;

      case 'airtable:update-record':
        return this._updateRecord(g as Ra<TEventUpdateRecord>);

      case 'airtable:create-record':
        return this._createRecord(g as Ra<TEventCreateRecord>);

      case 'airtable:delete-record':
        return this._deleteRecord(g as Ra<TEventDeleteRecord>);

      case 'airtable:reorder-record':
        return this._reorderRecord(g as Ra<TEventReorderRecord>);

      case 'airtable:load-record-node':
        return this._loadRecordNode(g as Ra<TEventLoadRecordNode>);

      case 'airtable:load-table-node':
        return this._loadTableNode(g as Ra<TEventLoadTableNode>);

      case 'airtable:load-kanban-column-node':
        return this._loadKanbanColumnNode(g as Ra<TEventLoadKanbanColumnNode>);

      case 'airtable:delete-kanban-column-node':
        return this._deleteKanbanColumnNode(
          g as Ra<TEventDeleteKanbanColumnNode>
        );

      case 'airtable:delete-record-node':
        return this._deleteRecordNode(g as Ra<TEventDeleteRecordNode>);

      case 'airtable:delete-table-node':
        return this._deleteTableNode(g as Ra<TEventDeleteTableNode>);

      case 'airtable:delete-base':
        return this._deleteBase(g as Ra<TEventDeleteBase>);

      case 'airtable:set-node-view':
        return this._setNodeView(g as Ra<TEventSetNodeView>);

      case 'airtable:search-bases':
        return this._searchBases(g as Ra<TEventSearchBases>);

      case 'airtable:clear-user-search-results':
        return this._clearUserSearchResults(
          g as Ra<TEventClearUserSearchResults>
        );

      case 'periodic':
        return this._periodic(g as Ra<TEventPeriodic>);
    }
  }

  //

  private async _loadRecordNode(g: Ra<TEventLoadRecordNode>): Promise<void> {
    const base = Array.from(g.sd.airtableBases.values()).find((d) =>
      d.tables.find((t) => t.records.find((r) => r.id === g.event.recordId))
    );

    if (!base) return;

    const data: TNodeAirtableRecordDataPayload = {
      recordId: g.event.recordId,
      baseId: g.event.baseId,
      tableId: g.event.tableId,
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: makeUuid(),
        name: `Airtable Record ${g.event.recordId}`,
        root: true,
        type: 'airtable-record',
        data: data,
        connectors: [{ connectorName: 'inputs', pins: [] }],
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  private async _loadTableNode(g: Ra<TEventLoadTableNode>): Promise<void> {
    const { baseId, tableId } = g.event;
    const base = g.sd.airtableBases.get(baseId);

    if (!base) return;

    const table = base.tables.find((t) => t.id === tableId);
    if (!table) return;

    const data: TNodeAirtableTableDataPayload = {
      baseId: g.event.baseId,
      tableId: g.event.tableId,
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: makeUuid(),
        name: `Airtable Table ${table.name}`,
        root: true,
        type: 'airtable-table',
        data: data,
        connectors: [{ connectorName: 'inputs', pins: [] }],
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  //

  private async _initBase(g: Ra<TEventInitBase>) {
    await this._fetchAndUpdateBase(g);
  }

  //

  private async _fetchAndUpdateBase(
    g: Ra<{ baseId: string }>
  ): Promise<boolean> {
    const { baseId } = g.event;

    try {
      // Fetch all bases and find the one we're interested in
      const basesResponse = await this.makeAirtableRequest(g, '/meta/bases');
      const baseResponse = basesResponse.bases?.find(
        (base: { id: string }) => base.id === baseId
      );

      if (!baseResponse) {
        console.error(`Base ${baseId} not found or not accessible`);
        return false;
      }

      // Fetch tables for this base
      const tablesResponse = await this.makeAirtableRequest(
        g,
        `/meta/bases/${baseId}/tables`
      );

      if (!baseResponse || !tablesResponse) {
        return false;
      }

      // Get the existing base to compare with new data
      const existingBase = g.sd.airtableBases.get(baseId);
      const newTables = tablesResponse.tables || [];

      // Fetch records for each table
      const tablesWithRecords = await Promise.all(
        newTables.map(
          async (table: {
            id: string;
            name: string;
            description?: string;
            fields: unknown[];
            primaryFieldId: string;
            views: unknown[];
          }) => {
            try {
              const recordsResponse = await this.makeAirtableRequest(
                g,
                `/${baseId}/${table.id}`
              );
              return {
                ...table,
                records: recordsResponse.records || [],
              };
            } catch (error) {
              console.error(
                `Failed to fetch records for table ${table.id}:`,
                error
              );
              return {
                ...table,
                records: [],
              };
            }
          }
        )
      );

      const updatedBase: TAirtableBase = {
        id: baseId,
        name: baseResponse.name,
        description: baseResponse.description,
        tables: tablesWithRecords,
        permissionLevel: baseResponse.permissionLevel,
        url: baseResponse.url,
      };

      // If we had existing data, check for deleted records and tables
      if (existingBase) {
        // Check for deleted tables
        const newTableIds = new Set(
          tablesWithRecords.map((t: TAirtableTable) => t.id)
        );
        const deletedTables = existingBase.tables.filter(
          (oldTable) => !newTableIds.has(oldTable.id)
        );

        // Delete nodes for deleted tables
        g.sd.nodes.forEach((node) => {
          if (node.type === 'airtable-table') {
            const nodeData = node.data as TNodeAirtableTableDataPayload;
            if (deletedTables.find((t) => t.id === nodeData.tableId)) {
              g.bep.process({
                type: 'core:delete-node',
                id: node.id,
              });
            }
          }
        });

        // Check for deleted and updated records in remaining tables
        existingBase.tables.forEach((oldTable) => {
          const newTable = tablesWithRecords.find(
            (t: TAirtableTable) => t.id === oldTable.id
          );
          if (newTable) {
            const newRecordIds = new Set(
              newTable.records.map((r: TAirtableRecordValue) => r.id)
            );
            const deletedRecords = oldTable.records.filter(
              (oldRecord) => !newRecordIds.has(oldRecord.id)
            );

            // Dispatch delete node events for each deleted record
            g.sd.nodes.forEach((node) => {
              if (node.type === 'airtable-record') {
                const nodeData = node.data as TNodeAirtableRecordDataPayload;
                if (deletedRecords.find((r) => r.id === nodeData.recordId)) {
                  g.bep.process({
                    type: 'core:delete-node',
                    id: node.id,
                  });
                }
              }
            });
          }
        });
      }

      g.sd.airtableBases.set(baseId, updatedBase);
      return true;
    } catch (error) {
      console.error('Failed to fetch Airtable base:', error);
      return false;
    }
  }

  //

  private async _periodic(g: Ra<TEventPeriodic>): Promise<void> {
    const now = new Date();
    const timeSinceLastSync = now.getTime() - this.lastSync.getTime();

    // Only sync if more than some time has passed
    if (timeSinceLastSync >= 5000) {
      await this._syncAllBases(g);
    }
  }

  /**
   * Syncs all Airtable bases to detect external changes
   * This can be called manually or automatically via periodic sync
   */
  private async _syncAllBases(g: Ra<unknown>): Promise<void> {
    const now = new Date();

    // Sync all bases in parallel for better performance
    const syncPromises = Array.from(g.sd.airtableBases.values()).map(
      async (base) => {
        try {
          await this._fetchAndUpdateBase({
            ...g,
            event: { baseId: base.id },
          });
        } catch (error) {
          console.error(`Failed to sync Airtable base ${base.id}:`, error);
        }
      }
    );

    // Wait for all syncs to complete
    await Promise.allSettled(syncPromises);
    this.lastSync = now;
  }

  //

  private async _updateRecord(g: Ra<TEventUpdateRecord>): Promise<void> {
    try {
      const { baseId, tableId, recordId, fields } = g.event;

      await this.makeAirtableRequest(g, `/${baseId}/${tableId}/${recordId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      });

      // Update local state immediately for responsive UI
      const base = g.sd.airtableBases.get(baseId);
      if (base) {
        const table = base.tables.find((t) => t.id === tableId);
        if (table) {
          const record = table.records.find((r) => r.id === recordId);
          if (record) {
            record.fields = {
              ...(record.fields as object),
              ...fields,
            } as Record<string, TJson>;
          }
        }
      }

      // Trigger a full sync to ensure consistency with external changes
      setTimeout(() => {
        this._fetchAndUpdateBase({
          ...g,
          event: { baseId },
        });
      }, 1000); // Small delay to avoid rate limiting
    } catch (error) {
      console.error('Failed to update Airtable record:', error);
    }
  }

  //

  private async _createRecord(g: Ra<TEventCreateRecord>): Promise<void> {
    try {
      const { baseId, tableId, fields } = g.event;

      const response = await this.makeAirtableRequest(
        g,
        `/${baseId}/${tableId}`,
        {
          method: 'POST',
          body: JSON.stringify({ fields }),
        }
      );

      // Trigger a full sync to ensure consistency with external changes
      setTimeout(() => {
        this._fetchAndUpdateBase({
          ...g,
          event: { baseId },
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to create Airtable record:', error);
    }
  }

  //

  private async _deleteRecord(g: Ra<TEventDeleteRecord>): Promise<void> {
    try {
      const { baseId, tableId, recordId } = g.event;

      await this.makeAirtableRequest(g, `/${baseId}/${tableId}/${recordId}`, {
        method: 'DELETE',
      });

      // Check if any kanban column nodes need to be deleted due to this record deletion
      g.sd.nodes.forEach((node) => {
        if (node.type === 'airtable-kanban-column') {
          const nodeData = node.data as TNodeAirtableKanbanColumnDataPayload;
          if (nodeData.baseId === baseId && nodeData.tableId === tableId) {
            // Check if this kanban column still has records after the deletion
            const base = g.sd.airtableBases.get(baseId);
            if (base) {
              const table = base.tables.find((t) => t.id === tableId);
              if (table) {
                const columnRecords = table.records.filter(
                  (r: TAirtableRecordValue) => {
                    const fields = r.fields as Record<string, unknown>;
                    const fieldValue = fields[nodeData.fieldId];
                    return fieldValue === nodeData.optionId;
                  }
                );

                if (columnRecords.length === 0) {
                  g.bep.process({
                    type: 'core:delete-node',
                    id: node.id,
                  });
                }
              }
            }
          }
        }
      });

      // Trigger a full sync to ensure consistency with external changes
      setTimeout(() => {
        this._fetchAndUpdateBase({
          ...g,
          event: { baseId },
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to delete Airtable record:', error);
      throw error;
    }
  }

  //

  private async _reorderRecord(g: Ra<TEventReorderRecord>): Promise<void> {
    // Airtable doesn't have built-in ordering, so we'll implement this
    // by updating a custom order field if it exists
    try {
      const { baseId, tableId, recordId, newPosition } = g.event;

      // Find the table and check if it has an order field
      const base = g.sd.airtableBases.get(baseId);
      if (base) {
        const table = base.tables.find((t) => t.id === tableId);
        if (table) {
          const orderField = table.fields.find(
            (f) =>
              f.name.toLowerCase().includes('order') ||
              f.name.toLowerCase().includes('position')
          );

          if (orderField) {
            await this.makeAirtableRequest(
              g,
              `/${baseId}/${tableId}/${recordId}`,
              {
                method: 'PATCH',
                body: JSON.stringify({
                  fields: { [orderField.id]: newPosition },
                }),
              }
            );

            // Update local state
            const record = table.records.find((r) => r.id === recordId);
            if (record) {
              (record.fields as Record<string, unknown>)[orderField.id] =
                newPosition;
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to reorder Airtable record:', error);
    }
  }

  //

  private async _deleteRecordNode(
    g: Ra<TEventDeleteRecordNode>
  ): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
  }

  //

  private async _deleteTableNode(g: Ra<TEventDeleteTableNode>): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
  }

  //

  private async _deleteBase(g: Ra<TEventDeleteBase>): Promise<void> {
    try {
      const { baseId } = g.event;

      // Remove from local state
      g.sd.airtableBases.delete(baseId);

      // Delete all related nodes
      g.sd.nodes.forEach((node) => {
        if (
          node.type === 'airtable-table' ||
          node.type === 'airtable-record' ||
          node.type === 'airtable-kanban-column'
        ) {
          const nodeData = node.data as { baseId: string };
          if (nodeData.baseId === baseId) {
            g.bep.process({
              type: 'core:delete-node',
              id: node.id,
            });
          }
        }
      });

      // Clear related node views
      const nodeViewsToDelete: string[] = [];
      g.sd.airtableNodeViews.forEach((view, id) => {
        if (view.baseId === baseId) {
          nodeViewsToDelete.push(id);
        }
      });

      nodeViewsToDelete.forEach((id) => {
        g.sd.airtableNodeViews.delete(id);
      });
    } catch (error) {
      console.error('Failed to delete Airtable base:', error);
    }
  }

  //

  private async _setNodeView(g: Ra<TEventSetNodeView>): Promise<void> {
    const { nodeId, viewId, viewMode } = g.event;

    g.sd.airtableNodeViews.set(`${nodeId}-${viewId}`, {
      type: 'table',
      baseId: '', // Will be set by the node component
      tableId: '', // Will be set by the node component
      nodeId,
      viewId,
      viewMode,
    });
  }

  //

  private async _loadKanbanColumnNode(
    g: Ra<TEventLoadKanbanColumnNode>
  ): Promise<void> {
    const { baseId, tableId, fieldId, optionId } = g.event;

    const data: TNodeAirtableKanbanColumnDataPayload = {
      baseId,
      tableId,
      fieldId,
      optionId,
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: makeUuid(),
        name: `Airtable Kanban Column ${optionId}`,
        root: true,
        type: 'airtable-kanban-column',
        data: data,
        connectors: [{ connectorName: 'inputs', pins: [] }],
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  //

  private async _deleteKanbanColumnNode(
    g: Ra<TEventDeleteKanbanColumnNode>
  ): Promise<void> {
    g.bep.process({
      type: 'core:delete-node',
      id: g.event.nodeId,
    });
  }

  //

  private async _searchBases(g: Ra<TEventSearchBases>): Promise<void> {
    try {
      const { query, userId } = g.event;

      // Search user's bases
      const response = await this.makeAirtableRequest(g, '/meta/bases');

      if (response.bases) {
        let filteredBases = response.bases;

        if (query) {
          filteredBases = response.bases.filter(
            (base: { name: string; description?: string }) =>
              base.name.toLowerCase().includes(query.toLowerCase()) ||
              (base.description &&
                base.description.toLowerCase().includes(query.toLowerCase()))
          );
        }

        const searchResults: TAirtableBaseSearchResult[] = filteredBases.map(
          (base: {
            id: string;
            name: string;
            description?: string;
            url: string;
            permissionLevel: string;
          }) => ({
            id: base.id,
            name: base.name,
            description: base.description,
            url: base.url,
            permissionLevel: base.permissionLevel,
          })
        );

        g.sd.airtableBaseSearchResults.set(userId, searchResults);
      }
    } catch (error) {
      console.error('Failed to search Airtable bases:', error);
    }
  }

  //

  private async _clearUserSearchResults(
    g: Ra<TEventClearUserSearchResults>
  ): Promise<void> {
    const { userId } = g.event;
    g.sd.airtableBaseSearchResults.delete(userId);
  }
}
