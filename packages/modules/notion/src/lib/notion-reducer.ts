import { Client } from '@notionhq/client';

import { ReduceArgs, Reducer, TEventPeriodic } from '@monorepo/collab-engine';
import { TEventNewNode } from '@monorepo/core';
import { toUuid } from '@monorepo/simple-types';

import {
  TEventCreatePage,
  TEventDeletePage,
  TEventInitDatabase,
  TEventLoadPageNode,
  TEventReorderPage,
  TEventSyncDatabase,
  TEventUpdatePage,
  TNotionEvent,
} from './notion-events';

import { TNotionSharedData } from './notion-shared-model';

//

type Ra<T> = ReduceArgs<TNotionSharedData, T, TEventNewNode, TExtraArgs>;

type TExtraArgs = {
  notionApiKey: string;
};

export class NotionReducer extends Reducer<
  TNotionSharedData,
  TNotionEvent,
  never,
  TExtraArgs
> {
  private lastSync: Date = new Date(0); // Initialize to epoch

  private getNotionClient(apiKey: string) {
    return new Client({ auth: apiKey });
  }

  async reduce(g: Ra<TNotionEvent | TEventPeriodic>): Promise<void> {
    const notion = this.getNotionClient(g.extraArgs.notionApiKey);

    switch (g.event.type) {
      case 'notion:init-database':
        return this._initDatabase(g as Ra<TEventInitDatabase>, notion);

      case 'notion:sync-database':
        await this._fetchAndUpdateDatabase(g as Ra<TEventSyncDatabase>, notion);
        return;

      case 'notion:update-page':
        return this._updatePage(g as Ra<TEventUpdatePage>, notion);

      case 'notion:create-page':
        return this._createPage(g as Ra<TEventCreatePage>, notion);

      case 'notion:delete-page':
        return this._deletePage(g as Ra<TEventDeletePage>, notion);

      case 'notion:reorder-page':
        return this._reorderPage(g as Ra<TEventReorderPage>, notion);

      case 'notion:load-page-node':
        return this._loadPageNode(g as Ra<TEventLoadPageNode>);

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

    g.dispatcher.dispatch({
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
        /*
        {
          from: {
            node: this.databaseId(database.id),
            connectorName: 'outputs',
          },
          to: { node: nodeId, connectorName: 'inputs' },
          type: 'composed_of',
        },
        */
      ],
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

  private async _initDatabase(g: Ra<TEventInitDatabase>, notion: Client) {
    const isOk = await this._fetchAndUpdateDatabase(g, notion);
    if (!isOk) return;

    const { databaseId } = g.event;

    g.dispatcher.dispatch({
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
    notion: Client
  ): Promise<boolean> {
    let { databaseId } = g.event;

    const r = toUuid(databaseId);
    if (!r) return false;
    databaseId = r;
    g.event.databaseId = r;

    try {
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

      const database = { ...dbResponse, pages: pagesResponse.results };

      g.sd.notionDatabases.set(databaseId, database as any);
    } catch (error) {
      console.error('Failed to fetch and update database:', error);
      throw error;
    }

    return true;
  }

  //

  private async _periodic(g: Ra<TEventPeriodic>): Promise<void> {
    const now = new Date();
    const timeSinceLastSync = now.getTime() - this.lastSync.getTime();

    // Only sync if more than 1 minute has passed
    if (timeSinceLastSync >= 60000) {
      g.sd.notionDatabases.forEach((database) => {
        this._fetchAndUpdateDatabase(
          { ...g, event: { databaseId: database.id } },
          this.getNotionClient(g.extraArgs.notionApiKey)
        );
      });
      this.lastSync = now;
    }
  }

  //

  private async _updatePage(
    g: Ra<TEventUpdatePage>,
    notion: Client
  ): Promise<void> {
    const { pageId } = g.event;

    try {
      // Update the page in Notion
      await notion.pages.update({
        page_id: pageId,
        properties: {},
      });

      // refetch all
      this._fetchAndUpdateDatabase(g, notion);
    } catch (error) {
      console.error('Failed to update page:', error);
      throw error;
    }
  }

  private async _createPage(
    g: Ra<TEventCreatePage>,
    notion: Client
  ): Promise<void> {
    const { databaseId } = g.event;

    try {
      // Create page in Notion
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {},
      });

      // refetch all
      this._fetchAndUpdateDatabase(g, notion);
    } catch (error) {
      console.error('Failed to create page:', error);
      throw error;
    }
  }

  private async _deletePage(
    g: Ra<TEventDeletePage>,
    notion: Client
  ): Promise<void> {
    const { databaseId, pageId } = g.event;

    try {
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
    notion: Client
  ): Promise<void> {
    const { databaseId, pageId, newPosition } = g.event;

    try {
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
      this._fetchAndUpdateDatabase(g, notion);
    } catch (error) {
      console.error('Failed to reorder page:', error);
      throw error;
    }
  }
}
