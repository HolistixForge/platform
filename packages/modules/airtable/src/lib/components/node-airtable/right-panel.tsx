import React, { useEffect, useState } from 'react';

import {
  TValidSharedDataToCopy,
  useLocalSharedData,
} from '@holistix-forge/collab/frontend';
import { TPanel } from '@holistix-forge/whiteboard/frontend';
import { TAirtableSharedData } from '../../airtable-shared-model';
import { AirtableBaseTableList } from './airtable-base-table-list';

import './airtable-right-panel.scss';

interface AirtableRightPanelProps {
  panel: TPanel;
  closePanel: (uuid: string) => void;
}

export const AirtableRightPanel: React.FC<AirtableRightPanelProps> = ({
  panel,
  closePanel,
}) => {
  const baseId = panel.data.baseId as string;

  const sd: TValidSharedDataToCopy<TAirtableSharedData> =
    useLocalSharedData<TAirtableSharedData>(['airtable:bases'], (sd) => sd);

  const base = sd['airtable:bases'].get(baseId);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded && base) {
      setLoaded(true);
    }
    if (loaded && !base) {
      closePanel(panel.uuid);
    }
  }, [base, loaded, closePanel, panel.uuid]);

  if (!base) return null;

  return (
    <div className="airtable-right-panel">
      <div className="airtable-header">
        <div className="airtable-logo">
          <span role="img" aria-label="">
            📊
          </span>
        </div>
        <h2 className="airtable-h2">{base.name}</h2>
        <div className="airtable-meta">
          <span className="airtable-count">{base.tables.length} tables</span>
          <span className="airtable-permission">{base.permissionLevel}</span>
        </div>
      </div>

      {base.description && (
        <div className="airtable-description">
          <p>{base.description}</p>
        </div>
      )}

      <AirtableBaseTableList base={base} tables={base.tables} />
    </div>
  );
};
