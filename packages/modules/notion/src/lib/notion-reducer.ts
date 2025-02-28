import { Client } from '@notionhq/client';

import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TEventNewNode } from '@monorepo/core';

import {
  TEventCreatePage,
  TEventDeletePage,
  TEventInitDatabase,
  TEventReorderPage,
  TEventSyncDatabase,
  TEventUpdatePage,
  TNotionEvent,
} from './notion-events';
import {
  TNotionDatabase,
  TNotionPage,
  TNotionProperty,
  TNotionStatus,
} from './notion-types';
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
  private getNotionClient(apiKey: string) {
    return new Client({ auth: apiKey });
  }

  async reduce(g: Ra<TNotionEvent>): Promise<void> {
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
    }
  }

  //

  private async _initDatabase(g: Ra<TEventInitDatabase>, notion: Client) {
    const isOk = await this._fetchAndUpdateDatabase(g, notion);
    if (!isOk) return;

    const { databaseId } = g.event;
    g.dispatcher.dispatch({
      type: 'core:new-node',
      nodeData: {
        id: databaseId,
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
    g: Ra<TEventSyncDatabase | TEventInitDatabase>,
    notion: Client
  ): Promise<boolean> {
    const { databaseId } = g.event;

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

      const database = this.transformDatabaseResponse(
        dbResponse,
        pagesResponse
      );

      g.sd.notionDatabases.set(databaseId, database);
    } catch (error) {
      console.error('Failed to fetch and update database:', error);
      throw error;
    }

    return true;
  }

  //

  private async _updatePage(
    g: Ra<TEventUpdatePage>,
    notion: Client
  ): Promise<void> {
    const { databaseId, pageId, properties } = g.event;

    try {
      // Update the page in Notion
      await notion.pages.update({
        page_id: pageId,
        properties: this._transformPropertiesToNotion(properties),
      });

      // Update local state
      const database = g.sd.notionDatabases.get(databaseId);
      if (database) {
        const pageIndex = database.pages.findIndex((p) => p.id === pageId);
        if (pageIndex >= 0) {
          database.pages[pageIndex] = {
            ...database.pages[pageIndex],
            properties,
            lastModified: new Date().toISOString(),
          };
          g.sd.notionDatabases.set(databaseId, database);
        }
      }
    } catch (error) {
      console.error('Failed to update page:', error);
      throw error;
    }
  }

  private async _createPage(
    g: Ra<TEventCreatePage>,
    notion: Client
  ): Promise<void> {
    const { databaseId, properties } = g.event;

    try {
      // Create page in Notion
      const response = await notion.pages.create({
        parent: { database_id: databaseId },
        properties: this._transformPropertiesToNotion(properties),
      });

      // Update local state
      const database = g.sd.notionDatabases.get(databaseId);
      if (database) {
        const newPage: TNotionPage = {
          id: response.id,
          title: (properties.Name?.value as string) || 'Untitled',
          properties,
          lastModified: new Date().toISOString(),
        };
        database.pages.push(newPage);
        g.sd.notionDatabases.set(databaseId, database);
      }
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

      // Update local state
      const page = database.pages[currentIndex];
      database.pages.splice(currentIndex, 1);
      database.pages.splice(newPosition, 0, {
        ...page,
        order: newPosition,
        lastModified: new Date().toISOString(),
      });

      // Update order numbers for affected pages
      database.pages.forEach((p, i) => {
        p.order = i;
      });

      g.sd.notionDatabases.set(databaseId, database);
    } catch (error) {
      console.error('Failed to reorder page:', error);
      throw error;
    }
  }

  // Helper methods for data transformation
  private _transformProperties(
    notionProperties: any
  ): Record<string, TNotionProperty> {
    const properties: Record<string, TNotionProperty> = {};

    for (const [key, prop] of Object.entries(notionProperties)) {
      const property = prop as any;
      properties[key] = {
        id: property.id,
        type: property.type,
        name: key,
        value: this._extractPropertyValue(property),
      };
    }

    return properties;
  }

  private _transformPage(notionPage: any): TNotionPage {
    return {
      id: notionPage.id,
      title: notionPage.properties.Name?.title[0]?.plain_text || 'Untitled',
      properties: this._transformProperties(notionPage.properties),
      order: notionPage.properties.order?.number,
      lastModified: notionPage.last_edited_time,
    };
  }

  private _transformPropertiesToNotion(
    properties: Record<string, TNotionProperty>
  ): any {
    const notionProperties: any = {};

    for (const [key, prop] of Object.entries(properties)) {
      switch (prop.type) {
        case 'title':
          notionProperties[key] = {
            title: [{ text: { content: prop.value as string } }],
          };
          break;
        case 'rich_text':
          notionProperties[key] = {
            rich_text: [{ text: { content: prop.value as string } }],
          };
          break;
        case 'number':
          notionProperties[key] = {
            number: prop.value as number,
          };
          break;
        case 'select':
          notionProperties[key] = {
            select: { name: prop.value as string },
          };
          break;
        case 'status':
          notionProperties[key] = {
            status: { name: (prop.value as TNotionStatus).name },
          };
          break;
      }
    }

    return notionProperties;
  }

  private _extractPropertyValue(
    property: any
  ): string | number | TNotionStatus | null {
    switch (property.type) {
      case 'title':
        return property.title[0]?.plain_text || '';
      case 'rich_text':
        return property.rich_text[0]?.plain_text || '';
      case 'number':
        return property.number || 0;
      case 'select':
        return property.select?.name || '';
      case 'status':
        return property.status
          ? {
              id: property.status.id,
              name: property.status.name,
              color: property.status.color,
            }
          : null;
      default:
        return '';
    }
  }

  //

  transformDatabaseResponse(
    dbResponse: any,
    pagesResponse: any
  ): TNotionDatabase {
    const databaseId = dbResponse.id;
    const properties = this._transformProperties(dbResponse.properties);
    const pages = pagesResponse.results.map((page: any) => {
      if (page) {
        const tp = this._transformPage(page);
        return tp;
      }
      return null;
    });

    return {
      id: databaseId,
      title: dbResponse.title?.[0]?.plain_text || 'Untitled',
      properties,
      pages,
      lastSync: new Date().toISOString(),
    };
  }
}
