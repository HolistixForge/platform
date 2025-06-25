import { DragEvent } from 'react';
import {
  TNotionDatabase,
  TNotionPage,
  TNotionTitle,
  TNotionStatus,
  TNotionSelect,
  TNotionRichText,
  TNotionCover,
} from '../../notion-types';
import { TImportantProperties } from './notion-database';

import './notion-database.scss';

//

export const TaskItem = ({
  page,
  titleProperty,
  priorityProperty,
  statusProperty,
  database,
}: { page: TNotionPage; database: TNotionDatabase } & TImportantProperties) => {
  //

  const title = titleProperty
    ? (page.properties[titleProperty.name] as TNotionTitle)
    : undefined;

  const status = statusProperty
    ? (page.properties[statusProperty.name] as TNotionStatus)
    : undefined;

  const priority = priorityProperty
    ? (page.properties[priorityProperty.name] as TNotionSelect)
    : undefined;

  const description = page.properties.Description as
    | TNotionRichText
    | undefined;

  // Get cover image URL if available
  const getCoverImageUrl = (cover: TNotionCover): string | null => {
    if (!cover) return null;
    if (cover.type === 'external') return cover.external.url;
    if (cover.type === 'file') return cover.file.url;
    return null;
  };

  const coverImageUrl = getCoverImageUrl(page.cover);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    const event = {
      databaseId: database.id,
      pageId: page.id,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('dragging');
  };

  /*
  console.log({
    properties: page.properties,
    priorityProperty,
    titleProperty,
    statusProperty,
    title,
    status,
    priority,
    description,
    coverImageUrl,
  });
  */

  return (
    <div
      className={`task-item${coverImageUrl ? ' has-cover' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {coverImageUrl && (
        <div
          className="task-item-cover"
          style={{
            backgroundImage: `url(${coverImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      <div className="task-item-header">
        <h4 className="task-item-title">
          {title?.title?.[0]?.text?.content || '[Untitled]'}
        </h4>

        <p className="task-item-description">
          {description?.rich_text?.[0]?.text?.content || '[No description]'}
        </p>
      </div>
      <div className="task-item-meta">
        {status?.status && (
          <span className={`task-status bg-${status.status.color}`}>
            {status.status.name}
          </span>
        )}
        {priority?.select && (
          <span className={`task-status bg-${priority.select.color}`}>
            {priority.select.name}
          </span>
        )}
      </div>
    </div>
  );
};

//

export const NotionDatabaseList = ({
  database,
  titleProperty,
  priorityProperty,
  statusProperty,
}: {
  database: TNotionDatabase;
} & TImportantProperties) => {
  return (
    <div className="notion-database-list">
      {database?.pages?.map((page) => (
        <TaskItem
          key={page.id}
          page={page}
          database={database}
          titleProperty={titleProperty}
          priorityProperty={priorityProperty}
          statusProperty={statusProperty}
        />
      ))}
    </div>
  );
};

export default NotionDatabaseList;
