import './airtable-table.scss';
import { TAirtableTable, TAirtableField } from '../../airtable-types';
import React, { useCallback, useEffect, useMemo } from 'react';
import { TGraphNode } from '@holistix-forge/core-graph';
import {
  TValidSharedDataToCopy,
  useLocalSharedData,
} from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';
import {
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix-forge/space/frontend';
import { TAirtableSharedData } from '../../airtable-shared-model';
import AirtableTableKanban from './airtable-table-kanban';
import AirtableTableGallery from './airtable-table-gallery';
import AirtableTableList from './airtable-table-list';
import { TAirtableEvent } from '../../airtable-events';
import {
  detectStatusField,
  detectPriorityField,
} from '../../utils/field-detection';
import { TJsonObject } from '@holistix-forge/simple-types';

//

//

const Logo = () => (
  <svg
    className="airtable-logo"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 2L2 7L12 12L22 7L12 2Z"
      stroke="#FF6B35"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 17L12 22L22 17"
      stroke="#FF6B35"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 12L12 17L22 12"
      stroke="#FF6B35"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

//

export type TViewKanban = {
  mode: 'kanban';
  groupBy: string;
  subgroupBy?: string;
};

export type TAirtableViewMode =
  | { mode: 'list' }
  | { mode: 'kanban'; groupBy: string; subgroupBy?: string }
  | { mode: 'gallery'; itemPerLine: number };

//

export type TAirtableImportantProperties = {
  titleField?: TAirtableField;
  priorityField?: TAirtableField;
  statusField?: TAirtableField;
};

//

export type TNodeAirtableTableDataPayload = {
  baseId: string;
  tableId: string;
};

interface AirtableTableProps {
  node: TGraphNode<TNodeAirtableTableDataPayload>;
}

export const NodeAirtableTable: React.FC<AirtableTableProps> = ({ node }) => {
  const useNodeValue = useNodeContext();
  const dispatcher = useDispatcher<TAirtableEvent>();

  const sd: TValidSharedDataToCopy<TAirtableSharedData> =
    useLocalSharedData<TAirtableSharedData>(
      ['airtable:bases', 'airtable:node-views'],
      (sd) => sd
    );

  const base = sd['airtable:bases'].get(node.data?.baseId || '');
  const table = base?.tables.find(
    (t: TAirtableTable) => t.id === node.data?.tableId
  );

  const vm = sd['airtable:node-views'].get(`${node.id}-${useNodeValue.viewId}`);

  const rawViewMode: TAirtableViewMode = useMemo(
    () =>
      vm?.viewMode || {
        mode: 'kanban',
        groupBy: 'status',
      },
    [vm?.viewMode]
  );

  const handleViewModeChange = useCallback(
    (newMode: TAirtableViewMode) => {
      dispatcher.dispatch({
        type: 'airtable:set-node-view',
        nodeId: node.id,
        viewId: useNodeValue.viewId,
        viewMode: newMode,
      });
    },
    [dispatcher, node.id, useNodeValue.viewId]
  );

  // Find important fields for the view components
  const titleField = table?.fields.find(
    (field: TAirtableField) =>
      field.type === 'singleLineText' || field.type === 'longText'
  );

  const statusField = table?.fields
    ? detectStatusField(table.fields)
    : undefined;
  const priorityField = table?.fields
    ? detectPriorityField(table.fields)
    : undefined;

  // Determine if current view mode is valid based on available fields
  const isValidKanbanView = useCallback(
    (mode: TAirtableViewMode): boolean => {
      if (mode.mode !== 'kanban') return true;

      if (mode.groupBy === 'status' && !statusField) return false;
      if (mode.groupBy === 'priority' && !priorityField) return false;

      return true;
    },
    [statusField, priorityField]
  );

  // Use validated view mode - fallback to list if kanban uses non-existent field
  const viewMode: TAirtableViewMode = isValidKanbanView(rawViewMode)
    ? rawViewMode
    : { mode: 'list' };

  // If we had to change the view mode due to invalid kanban, dispatch the change
  useEffect(() => {
    const shouldUpdateViewMode = !isValidKanbanView(rawViewMode);
    if (shouldUpdateViewMode) {
      handleViewModeChange({ mode: 'list' });
    }
  }, [rawViewMode, isValidKanbanView, handleViewModeChange]);

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'airtable:delete-table-node',
      nodeId: node.id,
    });
  }, [dispatcher, node.id]);

  const buttons = useNodeHeaderButtons({
    onDelete: handleDelete,
  });

  if (!table) {
    return (
      <div className="airtable-table">
        <div className="table-header">
          <h3>Loading table...</h3>
        </div>
      </div>
    );
  }

  const renderViewContent = () => {
    if (!base) {
      return <div>No base found</div>;
    }

    switch (viewMode.mode) {
      case 'list':
        return <AirtableTableList table={table} />;

      case 'kanban': {
        return (
          <AirtableTableKanban
            baseId={base.id}
            table={table}
            viewMode={viewMode}
            setViewMode={handleViewModeChange}
            onUpdateRecord={(recordId, fields) => {
              dispatcher.dispatch({
                type: 'airtable:update-record',
                baseId: base.id,
                tableId: table.id,
                recordId,
                fields: fields as TJsonObject,
              });
            }}
            titleField={titleField}
            priorityField={priorityField as TAirtableField}
            statusField={statusField as TAirtableField}
          />
        );
      }

      case 'gallery':
        return (
          <AirtableTableGallery
            baseId={base.id}
            table={table}
            titleField={titleField}
            priorityField={priorityField as TAirtableField}
            statusField={statusField as TAirtableField}
            viewMode={viewMode}
          />
        );

      default:
        return <div>Unknown view mode</div>;
    }
  };

  return (
    <div className="common-node node-airtable node-resizable">
      <NodeHeader
        buttons={buttons}
        nodeType="Airtable Table"
        id={useNodeValue.id}
        isOpened={useNodeValue.isOpened}
        open={useNodeValue.open}
        visible={useNodeValue.selected}
      />
      <DisableZoomDragPan noZoom noDrag fullHeight>
        <div className="airtable-table">
          <div className="airtable-table-header">
            <Logo />
            <h2 className="airtable-h2">{table.name}</h2>
            <div className="airtable-view-switcher">
              <button
                className={viewMode.mode === 'list' ? 'active' : ''}
                onClick={() => handleViewModeChange({ mode: 'list' })}
              >
                List
              </button>
              {statusField && (
                <button
                  className={
                    viewMode.mode === 'kanban' && viewMode.groupBy === 'status'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    handleViewModeChange({
                      mode: 'kanban',
                      groupBy: 'status',
                    })
                  }
                >
                  Kanban (Status)
                </button>
              )}
              {priorityField && (
                <button
                  className={
                    viewMode.mode === 'kanban' &&
                    viewMode.groupBy === 'priority'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    handleViewModeChange({
                      mode: 'kanban',
                      groupBy: 'priority',
                    })
                  }
                >
                  Kanban (Priority)
                </button>
              )}
              <button
                className={viewMode.mode === 'gallery' ? 'active' : ''}
                onClick={() =>
                  handleViewModeChange({ mode: 'gallery', itemPerLine: 3 })
                }
              >
                Gallery
              </button>
            </div>
          </div>

          <div className="table-content">{renderViewContent()}</div>
        </div>
      </DisableZoomDragPan>
    </div>
  );
};

export default NodeAirtableTable;
