import { TNotionDatabase } from '../../notion-types';
import { TImportantProperties } from './notion-database';
import { TaskItem } from './notion-database-list';

import './notion-database.scss';

//

export const NotionDatabaseGallery = ({
  database,
  viewMode,
  titleProperty,
  priorityProperty,
  statusProperty,
}: {
  database: TNotionDatabase;
  viewMode: { mode: 'gallery'; itemPerLine: number };
} & TImportantProperties) => {
  const itemPerLine = viewMode.itemPerLine;
  return (
    <div className={`notion-gallery notion-gallery-cols-${itemPerLine}`}>
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

export default NotionDatabaseGallery;
