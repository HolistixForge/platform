import { useEffect, useState } from 'react';

import { useSharedData } from '@monorepo/collab-engine';

import { NotionDatabase } from './notion-database';
import { TNotionSharedData } from '../../notion-shared-model';
import { TPanel } from '@monorepo/module/frontend';
import { toUuid } from '@monorepo/simple-types';

//

export const NotionRightPanel = ({
  panel,
  closePanel,
}: {
  panel: TPanel;
  closePanel: (uuid: string) => void;
}) => {
  const databaseId = panel.data.databaseId as string;

  const sd = useSharedData<TNotionSharedData>(['notionDatabases'], (sd) => sd);

  const db = sd.notionDatabases.get(toUuid(databaseId));

  const [loaded, setLoaded] = useState(false);

  console.log('db', { databaseId, db, sd });

  useEffect(() => {
    if (!loaded && db) {
      setLoaded(true);
    }
    if (loaded && !db) {
      closePanel(panel.uuid);
    }
  }, [db]);

  if (!db) return null;

  return <NotionDatabase database={db} viewMode={{ mode: 'list' }} />;
};
