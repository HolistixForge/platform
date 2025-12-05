import {
  Reducer,
  RequestData,
  TEventPeriodic,
  TReducersBackendExports,
} from '@holistix-forge/reducers';
import { makeUuid } from '@holistix-forge/simple-types';
import { TCollabBackendExports } from '@holistix-forge/collab';
import { TCoreSharedData } from '@holistix-forge/core-graph';

import {
  TEventCreateRecord,
  TEventDeleteRecord,
  TEventDeleteRecordNode,
  TEventDeleteTableNode,
  TEventInitBase,
  TEventLoadRecordNode,
  TEventLoadTableNode,
  TEventReorderRecord,
  TEventUpdateRecord,
  TAirtableEvent,
  TEventDeleteBase,
  TEventSetNodeView,
  TEventLoadKanbanColumnNode,
  TEventDeleteKanbanColumnNode,
  TEventSearchBases,
  TEventClearUserSearchResults,
} from './airtable-events';
import {
  TAirtableBase,
  TAirtableBaseSearchResult,
  TAirtableRecordValue,
  TAirtableTable,
} from './airtable-types';
import { TNodeAirtableRecordDataPayload } from './components/node-airtable/node-airtable-record';
import { TNodeAirtableKanbanColumnDataPayload } from './components/node-airtable/node-airtable-kanban-column';
import { TNodeAirtableTableDataPayload } from './components/node-airtable/node-airtable-table';
import { TAirtableSharedData } from './airtable-shared-model';

type TRequiredExports = {
  collab: TCollabBackendExports<TAirtableSharedData & TCoreSharedData>;
  reducers: TReducersBackendExports;
};

//

export class AirtableReducer extends Reducer<TAirtableEvent> {
  private lastSync: Date = new Date(0); // Initialize to epoch

  private async makeAirtableRequest(
    endpoint: string,
    apiKey: string,
    options: RequestInit = {}
  ) {
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

  constructor(private readonly exports: TRequiredExports) {
    super();
    this.exports = exports;
  }

  override async reduce(
    event: TAirtableEvent | TEventPeriodic,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'airtable:init-base':
        return this._initBase(event, requestData);

      case 'airtable:update-record':
        return this._updateRecord(event, requestData);

      case 'airtable:create-record':
        return this._createRecord(event, requestData);

      case 'airtable:delete-record':
        return this._deleteRecord(event, requestData);

      case 'airtable:reorder-record':
        return this._reorderRecord(event);

      case 'airtable:load-record-node':
        return this._loadRecordNode(event, requestData);

      case 'airtable:load-table-node':
        return this._loadTableNode(event, requestData);

      case 'airtable:load-kanban-column-node':
        return this._loadKanbanColumnNode(event, requestData);

      case 'airtable:delete-kanban-column-node':
        return this._deleteKanbanColumnNode(event, requestData);

      case 'airtable:delete-record-node':
        return this._deleteRecordNode(event, requestData);

      case 'airtable:delete-table-node':
        return this._deleteTableNode(event, requestData);

      case 'airtable:delete-base':
        return this._deleteBase(event, requestData);

      case 'airtable:set-node-view':
        return this._setNodeView(event);

      case 'airtable:search-bases':
        return this._searchBases(event);

      case 'airtable:clear-user-search-results':
        return this._clearUserSearchResults(event);

      case 'reducers:periodic':
        return this._periodic(event, requestData);
    }
  }

  //

  private async _loadRecordNode(
    event: TEventLoadRecordNode,
    requestData: RequestData
  ): Promise<void> {
    const base = Array.from(
      this.exports.collab.collab.sharedData['airtable:bases'].values()
    ).find((d) =>
      d.tables.find((t) => t.records.find((r) => r.id === event.recordId))
    );

    if (!base) return;

    const data: TNodeAirtableRecordDataPayload = {
      recordId: event.recordId,
      baseId: event.baseId,
      tableId: event.tableId,
    };

    this.exports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id: makeUuid(),
          name: `Airtable Record ${event.recordId}`,
          root: true,
          type: 'airtable-record',
          data: data,
          connectors: [{ connectorName: 'inputs', pins: [] }],
        },
        edges: [],
        origin: event.origin,
      },
      requestData
    );
  }

  private async _loadTableNode(
    event: TEventLoadTableNode,
    requestData: RequestData
  ): Promise<void> {
    const { baseId, tableId } = event;
    const base =
      this.exports.collab.collab.sharedData['airtable:bases'].get(baseId);

    if (!base) return;

    const table = base.tables.find((t) => t.id === tableId);
    if (!table) return;

    const data: TNodeAirtableTableDataPayload = {
      baseId: event.baseId,
      tableId: event.tableId,
    };

    this.exports.reducers.processEvent(
      {
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
        origin: event.origin,
      },
      requestData
    );
  }

  //

  private async _initBase(event: TEventInitBase, requestData: RequestData) {
    await this._fetchAndUpdateBase(event, requestData);
  }

  //

  private async _fetchAndUpdateBase(
    event: {
      baseId: string;
      AIRTABLE_API_KEY?: string;
    },
    requestData: RequestData
  ): Promise<boolean> {
    const { baseId } = event;

    const apiKey =
      event.AIRTABLE_API_KEY ||
      this.exports.collab.collab.sharedData['airtable:bases'].get(baseId)
        ?.AIRTABLE_API_KEY ||
      '';

    try {
      // Fetch all bases and find the one we're interested in
      const basesResponse = await this.makeAirtableRequest(
        '/meta/bases',
        apiKey
      );
      const baseResponse = basesResponse.bases?.find(
        (base: { id: string }) => base.id === baseId
      );

      if (!baseResponse) {
        console.error(`Base ${baseId} not found or not accessible`);
        return false;
      }

      // Fetch tables for this base
      const tablesResponse = await this.makeAirtableRequest(
        `/meta/bases/${baseId}/tables`,
        apiKey
      );

      if (!baseResponse || !tablesResponse) {
        return false;
      }

      // Get the existing base to compare with new data
      const existingBase =
        this.exports.collab.collab.sharedData['airtable:bases'].get(baseId);
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
                `/${baseId}/${table.id}`,
                apiKey
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
        AIRTABLE_API_KEY: apiKey,
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
        this.exports.collab.collab.sharedData['core-graph:nodes'].forEach(
          (node) => {
            if (node.type === 'airtable-table') {
              const nodeData = node.data as TNodeAirtableTableDataPayload;
              if (deletedTables.find((t) => t.id === nodeData.tableId)) {
                this.exports.reducers.processEvent(
                  {
                    type: 'core:delete-node',
                    id: node.id,
                  },
                  requestData
                );
              }
            }
          }
        );

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
            this.exports.collab.collab.sharedData['core-graph:nodes'].forEach(
              (node) => {
                if (node.type === 'airtable-record') {
                  const nodeData = node.data as TNodeAirtableRecordDataPayload;
                  if (deletedRecords.find((r) => r.id === nodeData.recordId)) {
                    this.exports.reducers.processEvent(
                      {
                        type: 'core:delete-node',
                        id: node.id,
                      },
                      requestData
                    );
                  }
                }
              }
            );
          }
        });
      }

      this.exports.collab.collab.sharedData['airtable:bases'].set(
        baseId,
        updatedBase
      );
      return true;
    } catch (error) {
      console.error('Failed to fetch Airtable base:', error);
      return false;
    }
  }

  //

  private async _periodic(
    event: TEventPeriodic,
    requestData: RequestData
  ): Promise<void> {
    const now = new Date();
    const timeSinceLastSync = now.getTime() - this.lastSync.getTime();

    // Only sync if more than some time has passed
    if (timeSinceLastSync >= 5000) {
      await this._syncAllBases(event, requestData);
    }
  }

  /**
   * Syncs all Airtable bases to detect external changes
   * This can be called manually or automatically via periodic sync
   */
  private async _syncAllBases(
    event: unknown,
    requestData: RequestData
  ): Promise<void> {
    const now = new Date();

    // Sync all bases in parallel for better performance
    const syncPromises = Array.from(
      this.exports.collab.collab.sharedData['airtable:bases'].values()
    ).map(async (base) => {
      try {
        await this._fetchAndUpdateBase(
          { baseId: base.id, AIRTABLE_API_KEY: base.AIRTABLE_API_KEY },
          requestData
        );
      } catch (error) {
        console.error(`Failed to sync Airtable base ${base.id}:`, error);
      }
    });

    // Wait for all syncs to complete
    await Promise.allSettled(syncPromises);
    this.lastSync = now;
  }

  //

  private async _updateRecord(
    event: TEventUpdateRecord,
    requestData: RequestData
  ): Promise<void> {
    try {
      const { baseId, tableId, recordId, fields } = event;

      await this.makeAirtableRequest(
        `/${baseId}/${tableId}/${recordId}`,
        this.exports.collab.collab.sharedData['airtable:bases'].get(baseId)
          ?.AIRTABLE_API_KEY || '',
        {
          method: 'PATCH',
          body: JSON.stringify({ fields }),
        }
      );

      // Trigger a full sync to ensure consistency with external changes
      setTimeout(() => {
        this._fetchAndUpdateBase({ baseId }, requestData);
      }, 1000); // Small delay to avoid rate limiting
    } catch (error) {
      console.error('Failed to update Airtable record:', error);
    }
  }

  //

  private async _createRecord(
    event: TEventCreateRecord,
    requestData: RequestData
  ): Promise<void> {
    try {
      const { baseId, tableId, fields } = event;

      await this.makeAirtableRequest(
        `/${baseId}/${tableId}`,
        this.exports.collab.collab.sharedData['airtable:bases'].get(baseId)
          ?.AIRTABLE_API_KEY || '',
        {
          method: 'POST',
          body: JSON.stringify({ fields }),
        }
      );

      // Trigger a full sync to ensure consistency with external changes
      setTimeout(() => {
        this._fetchAndUpdateBase({ baseId }, requestData);
      }, 1000);
    } catch (error) {
      console.error('Failed to create Airtable record:', error);
    }
  }

  //

  private async _deleteRecord(
    event: TEventDeleteRecord,
    requestData: RequestData
  ): Promise<void> {
    try {
      const { baseId, tableId, recordId } = event;

      await this.makeAirtableRequest(
        `/${baseId}/${tableId}/${recordId}`,
        this.exports.collab.collab.sharedData['airtable:bases'].get(baseId)
          ?.AIRTABLE_API_KEY || '',
        {
          method: 'DELETE',
        }
      );

      // Check if any kanban column nodes need to be deleted due to this record deletion
      this.exports.collab.collab.sharedData['core-graph:nodes'].forEach(
        (node) => {
          if (node.type === 'airtable-kanban-column') {
            const nodeData = node.data as TNodeAirtableKanbanColumnDataPayload;
            if (nodeData.baseId === baseId && nodeData.tableId === tableId) {
              // Check if this kanban column still has records after the deletion
              const base =
                this.exports.collab.collab.sharedData['airtable:bases'].get(
                  baseId
                );
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
                    this.exports.reducers.processEvent(
                      {
                        type: 'core:delete-node',
                        id: node.id,
                      },
                      requestData
                    );
                  }
                }
              }
            }
          }
        }
      );

      // Trigger a full sync to ensure consistency with external changes
      setTimeout(() => {
        this._fetchAndUpdateBase({ baseId }, requestData);
      }, 1000);
    } catch (error) {
      console.error('Failed to delete Airtable record:', error);
      throw error;
    }
  }

  //

  private async _reorderRecord(event: TEventReorderRecord): Promise<void> {
    // Airtable doesn't have built-in ordering, so we'll implement this
    // by updating a custom order field if it exists
    try {
      const { baseId, tableId, recordId, newPosition } = event;

      // Find the table and check if it has an order field
      const base =
        this.exports.collab.collab.sharedData['airtable:bases'].get(baseId);
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
              `/${baseId}/${tableId}/${recordId}`,
              this.exports.collab.collab.sharedData['airtable:bases'].get(
                baseId
              )?.AIRTABLE_API_KEY || '',
              {
                method: 'PATCH',
                body: JSON.stringify({
                  fields: { [orderField.id]: newPosition },
                }),
              }
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to reorder Airtable record:', error);
    }
  }

  //

  private async _deleteRecordNode(
    event: TEventDeleteRecordNode,
    requestData: RequestData
  ): Promise<void> {
    this.exports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
  }

  //

  private async _deleteTableNode(
    event: TEventDeleteTableNode,
    requestData: RequestData
  ): Promise<void> {
    this.exports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
  }

  //

  private async _deleteBase(
    event: TEventDeleteBase,
    requestData: RequestData
  ): Promise<void> {
    try {
      const { baseId } = event;

      // Remove from local state
      this.exports.collab.collab.sharedData['airtable:bases'].delete(baseId);

      const nodeDeleted: string[] = [];

      // Delete all related nodes
      this.exports.collab.collab.sharedData['core-graph:nodes'].forEach(
        (node) => {
          if (
            node.type === 'airtable-table' ||
            node.type === 'airtable-record' ||
            node.type === 'airtable-kanban-column'
          ) {
            const nodeData = node.data as { baseId: string };
            if (nodeData.baseId === baseId) {
              this.exports.reducers.processEvent(
                {
                  type: 'core:delete-node',
                  id: node.id,
                },
                requestData
              );
              nodeDeleted.push(node.id);
            }
          }
        }
      );

      // Clear related node views
      const nodeViewsToDelete: string[] = [];

      this.exports.collab.collab.sharedData['airtable:node-views'].forEach(
        (view, id) => {
          if (nodeDeleted.includes(view.nodeId)) {
            nodeViewsToDelete.push(id);
          }
        }
      );

      nodeViewsToDelete.forEach((id) => {
        this.exports.collab.collab.sharedData['airtable:node-views'].delete(id);
      });
    } catch (error) {
      console.error('Failed to delete Airtable base:', error);
    }
  }

  //

  private async _setNodeView(event: TEventSetNodeView): Promise<void> {
    const { nodeId, viewId, viewMode } = event;

    this.exports.collab.collab.sharedData['airtable:node-views'].set(
      `${nodeId}-${viewId}`,
      {
        nodeId,
        viewId,
        viewMode,
      }
    );
  }

  //

  private async _loadKanbanColumnNode(
    event: TEventLoadKanbanColumnNode,
    requestData: RequestData
  ): Promise<void> {
    const { baseId, tableId, fieldId, optionId } = event;

    const data: TNodeAirtableKanbanColumnDataPayload = {
      baseId,
      tableId,
      fieldId,
      optionId,
    };

    this.exports.reducers.processEvent(
      {
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
        origin: event.origin,
      },
      requestData
    );
  }

  //

  private async _deleteKanbanColumnNode(
    event: TEventDeleteKanbanColumnNode,
    requestData: RequestData
  ): Promise<void> {
    this.exports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: event.nodeId,
      },
      requestData
    );
  }

  //

  private async _searchBases(event: TEventSearchBases): Promise<void> {
    try {
      const { query, userId } = event;

      // Search user's bases
      const response = await this.makeAirtableRequest(
        '/meta/bases',
        event.AIRTABLE_API_KEY
      );

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

        this.exports.collab.collab.sharedData[
          'airtable:base-search-results'
        ].set(userId, searchResults);
      }
    } catch (error) {
      console.error('Failed to search Airtable bases:', error);
    }
  }

  //

  private async _clearUserSearchResults(
    event: TEventClearUserSearchResults
  ): Promise<void> {
    const { userId } = event;
    this.exports.collab.collab.sharedData[
      'airtable:base-search-results'
    ].delete(userId);
  }
}
