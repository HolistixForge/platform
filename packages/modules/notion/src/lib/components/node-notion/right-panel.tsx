import { useEffect, useState } from 'react';

import { useLocalSharedData } from '@holistix/collab/frontend';

import { NotionDatabase } from './notion-database';
import { TNotionSharedData } from '../../notion-shared-model';
import { TPanel } from '@holistix/space/frontend';
import { toUuid } from '@holistix/shared-types';

//

export const NotionRightPanel = ({
  panel,
  closePanel,
}: {
  panel: TPanel;
  closePanel: (uuid: string) => void;
}) => {
  const databaseId = panel.data.databaseId as string;

  const sd = useLocalSharedData<TNotionSharedData>(
    ['notion:databases'],
    (sd) => sd
  );

  const db = sd['notion:databases'].get(toUuid(databaseId));

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded && db) {
      setLoaded(true);
    }
    if (loaded && !db) {
      closePanel(panel.uuid);
    }
  }, [db, loaded, closePanel, panel.uuid]);

  if (!db) return null;

  return (
    <NotionDatabase
      database={db}
      viewMode={{ mode: 'list' }}
      onUpdatePage={() => {
        /* */
      }}
    />
  );
};
