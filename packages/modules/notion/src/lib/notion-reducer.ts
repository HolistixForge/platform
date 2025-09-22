import { Client } from '@notionhq/client';

import { ReduceArgs, Reducer, TEventPeriodic } from '@monorepo/collab-engine';
import {
  TCoreSharedData,
  TEventDeleteNode,
  TEventNewNode,
} from '@monorepo/core';
import { makeUuid, toUuid } from '@monorepo/simple-types';

import {
  TEventCreatePage,
  TEventDeletePage,
  TEventDeletePageNode,
  TEventDeleteDatabaseNode,
  TEventInitDatabase,
  TEventLoadPageNode,
  TEventReorderPage,
  TEventSyncDatabase,
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
import { TNotionPage, TNotionDatabaseSearchResult } from './notion-types';
import { TNodeNotionTaskDataPayload } from './components/node-notion/node-notion-task';
import { TNodeNotionKanbanColumnDataPayload } from './components/node-notion/node-notion-kanban-column';

//

type Ra<T> = ReduceArgs<
  TNotionSharedData & TCoreSharedData,
  T,
  TEventNewNode | TEventDeleteNode,
  undefined,
  undefined
>;

export class NotionReducer extends Reducer<
  TNotionSharedData & TCoreSharedData,
  TNotionEvent,
  never,
  undefined,
  undefined
> {
  private lastSync: Date = new Date(0); // Initialize to epoch

  private clients: Map<string, Client> = new Map();

  private getNotionClient(g: Ra<unknown>, apiKey: string) {
    let client = this.clients.get(apiKey);
    if (!client) {
      client = new Client({ auth: apiKey });
      this.clients.set(apiKey, client);
    }
    return client;
  }

  async reduce(g: Ra<TNotionEvent | TEventPeriodic>): Promise<void> {
    switch (g.event.type) {
      case 'notion:init-database':
        return this._initDatabase(g as Ra<TEventInitDatabase>);

      case 'notion:sync-database':
        await this._fetchAndUpdateDatabase(g as Ra<TEventSyncDatabase>);
        return;

      case 'notion:update-page':
        return this._updatePage(g as Ra<TEventUpdatePage>);

      case 'notion:create-page':
        return this._createPage(g as Ra<TEventCreatePage>);

      case 'notion:delete-page':
        return this._deletePage(g as Ra<TEventDeletePage>);

      case 'notion:reorder-page':
        return this._reorderPage(g as Ra<TEventReorderPage>);

      case 'notion:load-page-node':
        return this._loadPageNode(g as Ra<TEventLoadPageNode>);

      case 'notion:load-kanban-column-node':
        return this._loadKanbanColumnNode(g as Ra<TEventLoadKanbanColumnNode>);

      case 'notion:delete-kanban-column-node':
        return this._deleteKanbanColumnNode(
          g as Ra<TEventDeleteKanbanColumnNode>
        );

      case 'notion:delete-page-node':
        return this._deletePageNode(g as Ra<TEventDeletePageNode>);

      case 'notion:delete-database-node':
        return this._deleteDatabaseNode(g as Ra<TEventDeleteDatabaseNode>);

      case 'notion:delete-database':
        return this._deleteDatabase(g as Ra<TEventDeleteDatabase>);

      case 'notion:set-node-view':
        return this._setNodeView(g as Ra<TEventSetNodeView>);

      case 'notion:search-databases':
        return this._searchDatabases(g as Ra<TEventSearchDatabases>);

      case 'notion:clear-user-search-results':
        return this._clearUserSearchResults(
          g as Ra<TEventClearUserSearchResults>
        );

      case 'periodic':
        return this._periodic(g as Ra<TEventPeriodic>);
    }
  }

  //

  private async _loadPageNode(g: Ra<TEventLoadPageNode>): Promise<void> {
    const database = Array.from(g.sd.notionDatabases.values()).find((d) =>
      d.pages.find((p) => p.id === g.event.pageId)
    );

    if (!database) return;

    const data: TNodeNotionTaskDataPayload = {
      pageId: g.event.pageId,
      databaseId: g.event.databaseId,
    };

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: makeUuid(),
        name: `Notion Page ${g.event.pageId}`,
        root: true,
        type: 'notion-page',
        data: data,
        connectors: [{ connectorName: 'inputs', pins: [] }],
      },
      edges: [],
      origin: g.event.origin,
    });
  }

  //

  private async _initDatabase(g: Ra<TEventInitDatabase>) {
    await this._fetchAndUpdateDatabase(g);
  }

  //

  private async _fetchAndUpdateDatabase(
    g: Ra<{ databaseId: string; NOTION_API_KEY?: string }>
  ): Promise<boolean> {
    let { databaseId } = g.event;

    const r = toUuid(databaseId);
    if (!r) return false;
    databaseId = r;
    g.event.databaseId = r;

    const apiKey =
      g.event.NOTION_API_KEY ||
      g.sd.notionDatabases.get(databaseId)?.NOTION_API_KEY ||
      '';

    try {
      const notion = this.getNotionClient(g, apiKey);
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
      const existingDatabase = g.sd.notionDatabases.get(databaseId);
      const newPages = pagesResponse.results as TNotionPage[];

      // If we had existing pages, check for deleted ones
      if (existingDatabase) {
        const newPageIds = new Set(newPages.map((page) => page.id));
        const deletedPages = existingDatabase.pages.filter(
          (oldPage) => !newPageIds.has(oldPage.id)
        );

        // Dispatch delete node events for each deleted page
        g.sd.nodes.forEach((node) => {
          if (
            node.type === 'notion-page' &&
            deletedPages.some(
              (deletedPage) => deletedPage.id === node.data?.pageId
            )
          ) {
            g.bep.process({
              type: 'core:delete-node',
              id: node.id,
            });
          }
        });
      }

      const database = {
        ...dbResponse,
        pages: newPages,
        NOTION_API_KEY: apiKey,
      };
      g.sd.notionDatabases.set(databaseId, database as any);
    } catch (error) {
      console.error('Failed to fetch and update database:', error);
      return false;
    }

    return true;
  }

  //

  private async _periodic(g: Ra<TEventPeriodic>): Promise<void> {
    const now = new Date();
    const timeSinceLastSync = now.getTime() - this.lastSync.getTime();

    // Only sync if more than some time has passed
    if (timeSinceLastSync >= 5000) {
      g.sd.notionDatabases.forEach((database) => {
        this._fetchAndUpdateDatabase({
          ...g,
          event: { databaseId: database.id },
        });
      });
      this.lastSync = now;
    }
  }

  //

  private async _updatePage(g: Ra<TEventUpdatePage>): Promise<void> {
    const { pageId } = g.event;
    const apiKey =
      g.sd.notionDatabases.get(g.event.databaseId)?.NOTION_API_KEY || '';

    try {
      const notion = this.getNotionClient(g, apiKey);
      // Update the page in Notion

      const o = {
        page_id: pageId,
        properties: g.event.properties,
      };

      await notion.pages.update(o);

      // refetch all asynchronously
      this._fetchAndUpdateDatabase(g);
    } catch (error) {
      console.error('Failed to update page:', error);
      throw error;
    }
  }

  private async _createPage(g: Ra<TEventCreatePage>): Promise<void> {
    const { databaseId } = g.event;
    const apiKey =
      g.sd.notionDatabases.get(g.event.databaseId)?.NOTION_API_KEY || '';

    try {
      const notion = this.getNotionClient(g, apiKey);

      // Create page in Notion
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {},
      });

      // refetch all
      this._fetchAndUpdateDatabase(g);
    } catch (error) {
      console.error('Failed to create page:', error);
      throw error;
    }
  }

  private async _deletePage(g: Ra<TEventDeletePage>): Promise<void> {
    const { databaseId, pageId } = g.event;
    const apiKey =
      g.sd.notionDatabases.get(g.event.databaseId)?.NOTION_API_KEY || '';

    try {
      const notion = this.getNotionClient(g, apiKey);
      // Archive the page in Notion (Notion doesn't support true deletion)
      await notion.pages.update({
        page_id: pageId,
        archived: true,
      });

      // Update local state
      const database = g.sd.notionDatabases.get(databaseId);
      if (database) {
        database.pages = database.pages.filter((p) => p.id !== pageId);
        g.sd.notionDatabases.set(databaseId, database);
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
      throw error;
    }
  }

  private async _reorderPage(g: Ra<TEventReorderPage>): Promise<void> {
    const { databaseId, pageId, newPosition } = g.event;
    const apiKey =
      g.sd.notionDatabases.get(g.event.databaseId)?.NOTION_API_KEY || '';
    try {
      const notion = this.getNotionClient(g, apiKey);
      const database = g.sd.notionDatabases.get(databaseId);
      if (!database) throw new Error('Database not found');

      // Find current position
      const currentIndex = database.pages.findIndex((p) => p.id === pageId);
      if (currentIndex === -1) throw new Error('Page not found');

      // Update order in Notion
      await notion.pages.update({
        page_id: pageId,
        properties: {
          order: { number: newPosition },
        },
      });

      // refetch all
      this._fetchAndUpdateDatabase(g);
    } catch (error) {
      console.error('Failed to reorder page:', error);
      throw error;
    }
  }

  private async _deletePageNode(g: Ra<TEventDeletePageNode>): Promise<void> {
    const { nodeId } = g.event;

    g.bep.process({
      type: 'core:delete-node',
      id: nodeId,
    });
  }

  private async _deleteDatabaseNode(
    g: Ra<TEventDeleteDatabaseNode>
  ): Promise<void> {
    const { nodeId } = g.event;
    g.bep.process({
      type: 'core:delete-node',
      id: nodeId,
    });
  }

  //

  private async _deleteDatabase(g: Ra<TEventDeleteDatabase>): Promise<void> {
    const { databaseId } = g.event;

    // First, delete all nodes associated with this database
    const database = g.sd.notionDatabases.get(databaseId);
    if (database) {
      const pagesIds = database.pages.map((page) => page.id);
      g.sd.nodes.forEach((node) => {
        if (
          node.type === 'notion-page' &&
          pagesIds.includes((node.data as TNodeNotionTaskDataPayload).pageId)
        ) {
          g.bep.process({
            type: 'core:delete-node',
            id: node.id,
          });
        } else if (
          node.type === 'notion-database' &&
          node.data?.databaseId === databaseId
        ) {
          g.bep.process({
            type: 'core:delete-node',
            id: node.id,
          });
        }
      });
      // Remove from shared data
      g.sd.notionDatabases.delete(databaseId);
    }
  }

  //

  private async _setNodeView(g: Ra<TEventSetNodeView>): Promise<void> {
    const { nodeId, viewId, viewMode } = g.event;
    g.sd.notionNodeViews.set(`${nodeId}-${viewId}`, {
      type: 'database',
      databaseId: nodeId,
      nodeId,
      viewId,
      viewMode,
    });
  }

  //

  private async _loadKanbanColumnNode(
    g: Ra<TEventLoadKanbanColumnNode>
  ): Promise<void> {
    const { databaseId, propertyId, optionId } = g.event;

    const data: TNodeNotionKanbanColumnDataPayload = {
      databaseId,
      propertyId,
      optionId,
    };

    g.bep.process({
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
      origin: g.event.origin,
    });
  }

  //

  private async _deleteKanbanColumnNode(
    g: Ra<TEventDeleteKanbanColumnNode>
  ): Promise<void> {
    const { nodeId } = g.event;
    g.bep.process({
      type: 'core:delete-node',
      id: nodeId,
    });
  }

  private async _searchDatabases(g: Ra<TEventSearchDatabases>): Promise<void> {
    try {
      const notion = this.getNotionClient(g, g.event.NOTION_API_KEY || '');
      const response = await notion.search({
        filter: { property: 'object', value: 'database' },
        query: g.event.query || '',
      });

      // Store search results for this specific user
      const searchResults = response.results as TNotionDatabaseSearchResult[];
      g.sd.notionDatabaseSearchResults.set(g.event.userId, searchResults);
    } catch (error) {
      console.error('Failed to search databases:', error);
    }
  }

  private async _clearUserSearchResults(
    g: Ra<TEventClearUserSearchResults>
  ): Promise<void> {
    g.sd.notionDatabaseSearchResults.delete(g.event.userId);
  }
}
