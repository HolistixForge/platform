import { Client } from '@notionhq/client';

import { ReduceArgs, Reducer, TEventPeriodic } from '@monorepo/collab-engine';
import { TEventDeleteNode, TEventNewNode } from '@monorepo/core';
import { toUuid } from '@monorepo/simple-types';

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
} from './notion-events';

import { TNotionSharedData } from './notion-shared-model';

//

type TDepsModulesExports = {
  config: {
    NOTION_API_KEY: string;
  }
}

type Ra<T> = ReduceArgs<
  TNotionSharedData,
  T,
  TEventNewNode | TEventDeleteNode,
  undefined,
  TDepsModulesExports
>;


export class NotionReducer extends Reducer<
  TNotionSharedData,
  TNotionEvent,
  never,
  undefined,
  TDepsModulesExports
> {
  private lastSync: Date = new Date(0); // Initialize to epoch

  private client: Client | null = null;

  private getNotionClient(g: Ra<{}>) {
    if (!this.client) {
      this.client = new Client({ auth: g.extraContext.config.NOTION_API_KEY });
    }
    return this.client;
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

      case 'notion:delete-page-node':
        return this._deletePageNode(g as Ra<TEventDeletePageNode>);

      case 'notion:delete-database-node':
        return this._deleteDatabaseNode(g as Ra<TEventDeleteDatabaseNode>);

      case 'periodic':
        return this._periodic(g as Ra<TEventPeriodic>);
    }
  }

  //

  databaseId(databaseId: string) {
    return `notion-database:${databaseId}`;
  }

  pageId(pageId: string) {
    return `notion-page:${pageId}`;
  }

  //

  private async _loadPageNode(g: Ra<TEventLoadPageNode>): Promise<void> {
    const database = Array.from(g.sd.notionDatabases.values()).find((d) =>
      d.pages.find((p) => p.id === g.event.pageId)
    );

    if (!database) return;

    const nodeId = this.pageId(g.event.pageId);

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: nodeId,
        name: `Notion Page ${g.event.pageId}`,
        root: false,
        type: 'notion-page',
        data: { pageId: g.event.pageId },
        connectors: [{ connectorName: 'inputs', pins: [] }],
      },
      edges: [
        {
          from: {
            node: this.databaseId(database.id),
            connectorName: 'outputs',
          },
          to: { node: nodeId, connectorName: 'inputs' },
          semanticType: 'composed_of',
        },
      ],
      origin: g.event.origin,
    });
  }

  //

  private async _initDatabase(g: Ra<TEventInitDatabase>) {
    const isOk = await this._fetchAndUpdateDatabase(g);
    if (!isOk) return;

    const { databaseId } = g.event;

    g.bep.process({
      type: 'core:new-node',
      nodeData: {
        id: this.databaseId(databaseId),
        name: `Notion Database ${databaseId}`,
        root: true,
        type: 'notion-database',
        data: { databaseId },
        connectors: [{ connectorName: 'outputs', pins: [] }],
      },
      edges: [],
      origin: g.event.origin
        ? {
          ...g.event.origin,
          position: {
            x: g.event.origin.position.x + 100,
            y: g.event.origin.position.y + 100,
          },
        }
        : undefined,
    });
  }

  //

  private async _fetchAndUpdateDatabase(
    g: Ra<{ databaseId: string }>,
  ): Promise<boolean> {

    let { databaseId } = g.event;

    const r = toUuid(databaseId);
    if (!r) return false;
    databaseId = r;
    g.event.databaseId = r;

    try {
      const notion = this.getNotionClient(g);
      // Fetch database metadata
      const dbResponse = await notion.databases.retrieve({
        database_id: databaseId,
      });

      // Fetch initial pages
      const pagesResponse = await notion.databases.query({
        database_id: databaseId,
        sorts: [{ property: 'order', direction: 'ascending' }],
      });

      if (!dbResponse || !pagesResponse) {
        return false;
      }

      // Get the existing database to compare with new pages
      const existingDatabase = g.sd.notionDatabases.get(databaseId);
      const newPages = pagesResponse.results;

      // If we had existing pages, check for deleted ones
      if (existingDatabase) {
        const newPageIds = new Set(newPages.map((page) => page.id));
        const deletedPages = existingDatabase.pages.filter(
          (oldPage) => !newPageIds.has(oldPage.id)
        );

        // Dispatch delete node events for each deleted page
        deletedPages.forEach((deletedPage) => {
          g.bep.process({
            type: 'core:delete-node',
            id: this.pageId(deletedPage.id),
          });
        });
      }

      const database = { ...dbResponse, pages: newPages };
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

    // Only sync if more than 1 minute has passed
    if (timeSinceLastSync >= 5000) {
      g.sd.notionDatabases.forEach((database) => {
        this._fetchAndUpdateDatabase(
          { ...g, event: { databaseId: database.id } },
        );
      });
      this.lastSync = now;
    }
  }

  //

  private async _updatePage(
    g: Ra<TEventUpdatePage>,
  ): Promise<void> {
    const { pageId } = g.event;

    try {
      const notion = this.getNotionClient(g);
      // Update the page in Notion
      await notion.pages.update({
        page_id: pageId,
        properties: g.event.properties,
      });

      // refetch all asynchronously
      this._fetchAndUpdateDatabase(g);
    } catch (error) {
      console.error('Failed to update page:', error);
      throw error;
    }
  }

  private async _createPage(
    g: Ra<TEventCreatePage>,
  ): Promise<void> {
    const { databaseId } = g.event;

    try {
      const notion = this.getNotionClient(g);

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

  private async _deletePage(
    g: Ra<TEventDeletePage>,
  ): Promise<void> {
    const { databaseId, pageId } = g.event;

    try {
      const notion = this.getNotionClient(g);
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

  private async _reorderPage(
    g: Ra<TEventReorderPage>,
  ): Promise<void> {
    const { databaseId, pageId, newPosition } = g.event;

    try {
      const notion = this.getNotionClient(g);
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
    const { pageId } = g.event;
    const nodeId = this.pageId(pageId);

    g.bep.process({
      type: 'core:delete-node',
      id: nodeId,
    });
  }

  private async _deleteDatabaseNode(
    g: Ra<TEventDeleteDatabaseNode>
  ): Promise<void> {
    const { databaseId } = g.event;
    const nodeId = this.databaseId(databaseId);

    // First, delete all page nodes associated with this database
    const database = g.sd.notionDatabases.get(databaseId);
    if (database) {
      database.pages.forEach((page) => {
        g.bep.process({
          type: 'core:delete-node',
          id: this.pageId(page.id),
        });
      });
    }

    // Then delete the database node itself
    g.bep.process({
      type: 'core:delete-node',
      id: nodeId,
    });

    // Remove from shared data
    g.sd.notionDatabases.delete(databaseId);
  }
}
