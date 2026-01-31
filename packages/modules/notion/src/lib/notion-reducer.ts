import { Client } from '@notionhq/client';

import { TCoreSharedData, TGraphNode } from '@holistix-forge/core-graph';
import { makeUuid, toUuid } from '@holistix-forge/simple-types';
import {
  RequestData,
  TEventPeriodic,
  TReducersBackendExports,
} from '@holistix-forge/reducers';
import {
  TCollabBackendExports,
  ReducerWithCollab,
} from '@holistix-forge/collab';

import {
  TEventCreatePage,
  TEventDeletePage,
  TEventDeletePageNode,
  TEventDeleteDatabaseNode,
  TEventInitDatabase,
  TEventLoadPageNode,
  TEventReorderPage,
  TEventUpdatePage,
  TNotionEvent,
  TEventDeleteDatabase,
  TEventSetNodeView,
  TEventLoadKanbanColumnNode,
  TEventDeleteKanbanColumnNode,
  TEventSearchDatabases,
  TEventClearUserSearchResults,
} from './notion-events';

import { TNotionSharedData } from './notion-shared-model';
import {
  TNotionPage,
  TNotionDatabaseSearchResult,
  TNotionDatabase,
} from './notion-types';
import { TNodeNotionTaskDataPayload } from './components/node-notion/node-notion-task';
import { TNodeNotionKanbanColumnDataPayload } from './components/node-notion/node-notion-kanban-column';

//

type TRequiredExports = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

//

export class NotionReducer extends ReducerWithCollab<
  TNotionEvent | TEventPeriodic,
  TNotionSharedData & TCoreSharedData
> {
  private lastSync: Date = new Date(0); // Initialize to epoch

  private clients: Map<string, Client> = new Map();

  constructor(depsExports: TRequiredExports) {
    super(depsExports.collab.registry, 'notion');
    this.depsExports = depsExports;
  }

  private readonly depsExports: TRequiredExports;

  private getNotionClient(apiKey: string) {
    let client = this.clients.get(apiKey);
    if (!client) {
      client = new Client({ auth: apiKey });
      this.clients.set(apiKey, client);
    }
    return client;
  }

  async reduce(
    event: TNotionEvent | TEventPeriodic,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'notion:init-database':
        return this._initDatabase(event, requestData);

      case 'notion:sync-database':
        await this._fetchAndUpdateDatabase(event, requestData);
        return;

      case 'notion:update-page':
        return this._updatePage(event, requestData);

      case 'notion:create-page':
        return this._createPage(event, requestData);

      case 'notion:delete-page':
        return this._deletePage(event, requestData);

      case 'notion:reorder-page':
        return this._reorderPage(event, requestData);

      case 'notion:load-page-node':
        return this._loadPageNode(event, requestData);

      case 'notion:load-kanban-column-node':
        return this._loadKanbanColumnNode(event, requestData);

      case 'notion:delete-kanban-column-node':
        return this._deleteKanbanColumnNode(event, requestData);

      case 'notion:delete-page-node':
        return this._deletePageNode(event, requestData);

      case 'notion:delete-database-node':
        return this._deleteDatabaseNode(event, requestData);

      case 'notion:delete-database':
        return this._deleteDatabase(event, requestData);

      case 'notion:set-node-view':
        return this._setNodeView(event, requestData);

      case 'notion:search-databases':
        return this._searchDatabases(event, requestData);

      case 'notion:clear-user-search-results':
        return this._clearUserSearchResults(event, requestData);

      case 'reducers:periodic':
        return this._periodic(event, requestData);
    }
  }

  //

  private async _loadPageNode(
    event: TEventLoadPageNode,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const database = (
      Array.from(
        collab.sharedData['notion:databases'].values()
      ) as TNotionDatabase[]
    ).find((d: TNotionDatabase) =>
      d.pages.find((p: TNotionPage) => p.id === event.pageId)
    );

    if (!database) return;

    const data: TNodeNotionTaskDataPayload = {
      pageId: event.pageId,
      databaseId: event.databaseId,
    };

    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id: makeUuid(),
          name: `Notion Page ${event.pageId}`,
          root: true,
          type: 'notion-page',
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

  private async _initDatabase(
    event: TEventInitDatabase,
    requestData: RequestData
  ) {
    await this._fetchAndUpdateDatabase(event, requestData);
  }

  //

  private async _fetchAndUpdateDatabase(
    event: {
      databaseId: string;
      NOTION_API_KEY?: string;
    },
    requestData: RequestData
  ): Promise<boolean> {
    const collab = this.getCollab(requestData);
    let { databaseId } = event;

    const r = toUuid(databaseId);
    if (!r) return false;
    databaseId = r;
    event.databaseId = r;

    const apiKey =
      event.NOTION_API_KEY ||
      collab.sharedData['notion:databases'].get(databaseId)?.NOTION_API_KEY ||
      '';

    try {
      const notion = this.getNotionClient(apiKey);
      // Fetch database metadata
      const dbResponse = await notion.databases.retrieve({
        database_id: databaseId,
      });

      // Fetch initial pages
      const pagesResponse = await notion.databases.query({
        database_id: databaseId,
        // sorts: [{ property: 'order', direction: 'ascending' }],
      });

      if (!dbResponse || !pagesResponse) {
        return false;
      }

      // Get the existing database to compare with new pages
      const existingDatabase =
        collab.sharedData['notion:databases'].get(databaseId);
      const newPages = pagesResponse.results as TNotionPage[];

      // If we had existing pages, check for deleted ones
      if (existingDatabase) {
        const newPageIds = new Set(newPages.map((page) => page.id));
        const deletedPages = existingDatabase.pages.filter(
          (oldPage: TNotionPage) => !newPageIds.has(oldPage.id)
        );

        // Dispatch delete node events for each deleted page
        collab.sharedData['core-graph:nodes'].forEach((node: TGraphNode) => {
          if (
            node.type === 'notion-page' &&
            deletedPages.some(
              (deletedPage: TNotionPage) => deletedPage.id === node.data?.pageId
            )
          ) {
            this.depsExports.reducers.processEvent(
              {
                type: 'core:delete-node',
                id: node.id,
              },
              requestData
            );
          }
        });
      }

      const database: TNotionDatabase = {
        ...dbResponse,
        pages: newPages,
        NOTION_API_KEY: apiKey,
      } as unknown as TNotionDatabase;

      collab.sharedData['notion:databases'].set(databaseId, database);
    } catch (error) {
      console.error('Failed to fetch and update database:', error);
      return false;
    }

    return true;
  }

  //

  private async _periodic(
    event: TEventPeriodic,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const now = new Date();
    const timeSinceLastSync = now.getTime() - this.lastSync.getTime();

    // Only sync if more than some time has passed
    if (timeSinceLastSync >= 5000) {
      collab.sharedData['notion:databases'].forEach(
        (database: TNotionDatabase) => {
          this._fetchAndUpdateDatabase(
            { databaseId: database.id },
            requestData
          );
        }
      );
      this.lastSync = now;
    }
  }

  //

  private async _updatePage(
    event: TEventUpdatePage,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const { pageId } = event;
    const apiKey =
      collab.sharedData['notion:databases'].get(event.databaseId)
        ?.NOTION_API_KEY || '';

    try {
      const notion = this.getNotionClient(apiKey);
      // Update the page in Notion

      const o = {
        page_id: pageId,
        properties: event.properties,
      };

      await notion.pages.update(o);

      // refetch all asynchronously
      this._fetchAndUpdateDatabase(
        { databaseId: event.databaseId },
        requestData
      );
    } catch (error) {
      console.error('Failed to update page:', error);
      throw error;
    }
  }

  private async _createPage(
    event: TEventCreatePage,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const { databaseId } = event;
    const apiKey =
      collab.sharedData['notion:databases'].get(event.databaseId)
        ?.NOTION_API_KEY || '';

    try {
      const notion = this.getNotionClient(apiKey);

      // Create page in Notion
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {},
      });

      // refetch all
      this._fetchAndUpdateDatabase(
        { databaseId: event.databaseId },
        requestData
      );
    } catch (error) {
      console.error('Failed to create page:', error);
      throw error;
    }
  }

  private async _deletePage(
    event: TEventDeletePage,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const { databaseId, pageId } = event;
    const apiKey =
      collab.sharedData['notion:databases'].get(event.databaseId)
        ?.NOTION_API_KEY || '';

    try {
      const notion = this.getNotionClient(apiKey);
      // Archive the page in Notion (Notion doesn't support true deletion)
      await notion.pages.update({
        page_id: pageId,
        archived: true,
      });

      // Update local state
      const database = collab.sharedData['notion:databases'].get(databaseId);
      if (database) {
        database.pages = database.pages.filter(
          (p: TNotionPage) => p.id !== pageId
        );
        collab.sharedData['notion:databases'].set(databaseId, database);
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
      throw error;
    }
  }

  private async _reorderPage(
    event: TEventReorderPage,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const { databaseId, pageId, newPosition } = event;
    const apiKey =
      collab.sharedData['notion:databases'].get(event.databaseId)
        ?.NOTION_API_KEY || '';
    try {
      const notion = this.getNotionClient(apiKey);
      const database = collab.sharedData['notion:databases'].get(databaseId);
      if (!database) throw new Error('Database not found');

      // Find current position
      const currentIndex = database.pages.findIndex(
        (p: TNotionPage) => p.id === pageId
      );
      if (currentIndex === -1) throw new Error('Page not found');

      // Update order in Notion
      await notion.pages.update({
        page_id: pageId,
        properties: {
          order: { number: newPosition },
        },
      });

      // refetch all
      this._fetchAndUpdateDatabase({ databaseId }, requestData);
    } catch (error) {
      console.error('Failed to reorder page:', error);
      throw error;
    }
  }

  private async _deletePageNode(
    event: TEventDeletePageNode,
    requestData: RequestData
  ): Promise<void> {
    const { nodeId } = event;

    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: nodeId,
      },
      requestData
    );
  }

  private async _deleteDatabaseNode(
    event: TEventDeleteDatabaseNode,
    requestData: RequestData
  ): Promise<void> {
    const { nodeId } = event;
    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: nodeId,
      },
      requestData
    );
  }

  //

  private async _deleteDatabase(
    event: TEventDeleteDatabase,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const { databaseId } = event;

    // First, delete all nodes associated with this database
    const database = collab.sharedData['notion:databases'].get(databaseId);
    if (database) {
      const pagesIds = database.pages.map((page: TNotionPage) => page.id);
      collab.sharedData['core-graph:nodes'].forEach((node: TGraphNode) => {
        if (
          node.type === 'notion-page' &&
          pagesIds.includes((node.data as TNodeNotionTaskDataPayload).pageId)
        ) {
          this.depsExports.reducers.processEvent(
            {
              type: 'core:delete-node',
              id: node.id,
            },
            requestData
          );
        } else if (
          node.type === 'notion-database' &&
          node.data?.databaseId === databaseId
        ) {
          this.depsExports.reducers.processEvent(
            {
              type: 'core:delete-node',
              id: node.id,
            },
            requestData
          );
        }
      });
      // Remove from shared data
      collab.sharedData['notion:databases'].delete(databaseId);
    }
  }

  //

  private async _setNodeView(
    event: TEventSetNodeView,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const { nodeId, viewId, viewMode } = event;
    collab.sharedData['notion:node-views'].set(`${nodeId}-${viewId}`, {
      type: 'database',
      databaseId: nodeId,
      nodeId,
      viewId,
      viewMode,
    });
  }

  //

  private async _loadKanbanColumnNode(
    event: TEventLoadKanbanColumnNode,
    requestData: RequestData
  ): Promise<void> {
    const { databaseId, propertyId, optionId } = event;

    const data: TNodeNotionKanbanColumnDataPayload = {
      databaseId,
      propertyId,
      optionId,
    };

    this.depsExports.reducers.processEvent(
      {
        type: 'core:new-node',
        nodeData: {
          id: makeUuid(),
          name: `Notion Kanban Column`,
          root: true,
          type: 'notion-kanban-column',
          data: data,
          connectors: [],
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
    const { nodeId } = event;
    this.depsExports.reducers.processEvent(
      {
        type: 'core:delete-node',
        id: nodeId,
      },
      requestData
    );
  }

  private async _searchDatabases(
    event: TEventSearchDatabases,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    try {
      const notion = this.getNotionClient(event.NOTION_API_KEY || '');
      const response = await notion.search({
        filter: { property: 'object', value: 'database' },
        query: event.query || '',
      });

      // Store search results for this specific user
      const searchResults = response.results as TNotionDatabaseSearchResult[];
      collab.sharedData['notion:database-search-results'].set(
        event.userId,
        searchResults
      );
    } catch (error) {
      console.error('Failed to search databases:', error);
    }
  }

  private async _clearUserSearchResults(
    event: TEventClearUserSearchResults,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    collab.sharedData['notion:database-search-results'].delete(event.userId);
  }
}
