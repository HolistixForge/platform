import './airtable-table.scss';
import {
  TAirtableTable,
  TAirtableField,
  TAirtableRecordValue,
} from '../../airtable-types';
import React, { useCallback, useState } from 'react';
import { TGraphNode } from '@monorepo/module';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import {
  DisableZoomDragPan,
  NodeHeader,
  useNodeContext,
  useNodeHeaderButtons,
} from '@monorepo/space/frontend';
import { TAirtableSharedData } from '../../airtable-shared-model';
import AirtableTableKanban from './airtable-table-kanban';
import AirtableTableGallery from './airtable-table-gallery';
import { TAirtableEvent } from '../../airtable-events';

//

/**
 * Renders field content based on field type and value
 */
const renderFieldContent = (
  field: TAirtableField,
  value: unknown
): React.ReactNode => {
  if (!value) {
    return '';
  }

  // Handle text fields
  if (field.type === 'singleLineText' || field.type === 'longText') {
    return String(value);
  }

  // Handle attachment fields with thumbnails
  if (field.type === 'multipleAttachments' && Array.isArray(value)) {
    const firstAttachment = value[0] as {
      thumbnails?: { large: { url: string } };
      filename?: string;
    };
    if (firstAttachment?.thumbnails && firstAttachment.thumbnails.large.url) {
      return (
        <img
          src={firstAttachment.thumbnails.large.url}
          alt={firstAttachment.filename || ''}
          style={{ maxWidth: '50px', maxHeight: '50px', objectFit: 'cover' }}
        />
      );
    }
    return value.length > 0 ? `${value.length} attachment(s)` : '';
  }

  // Handle single select fields
  if (field.type === 'singleSelect') {
    return (value as { name?: string }).name || String(value);
  }

  // Handle multiple select fields
  if (field.type === 'multipleSelects' && Array.isArray(value)) {
    return value
      .map((item: unknown) => (item as { name?: string }).name || String(item))
      .join(', ');
  }

  // Handle checkbox fields
  if (field.type === 'checkbox') {
    return value ? '✓' : '✗';
  }

  // Handle number fields
  if (
    field.type === 'number' ||
    field.type === 'currency' ||
    field.type === 'percent'
  ) {
    return String(value);
  }

  // Handle date fields
  if (
    field.type === 'date' ||
    field.type === 'createdTime' ||
    field.type === 'lastModifiedTime'
  ) {
    return new Date(value as string).toLocaleDateString();
  }

  // Handle URL fields
  if (field.type === 'url') {
    return (
      <a href={value as string} target="_blank" rel="noopener noreferrer">
        {value as string}
      </a>
    );
  }

  // Handle email fields
  if (field.type === 'email') {
    return <a href={`mailto:${value as string}`}>{value as string}</a>;
  }

  // Handle phone number fields
  if (field.type === 'phoneNumber') {
    return <a href={`tel:${value as string}`}>{value as string}</a>;
  }

  // Handle rating fields
  if (field.type === 'rating') {
    return `${value}★`;
  }

  // Handle collaborator fields
  if (
    field.type === 'singleCollaborator' ||
    field.type === 'multipleCollaborators'
  ) {
    if (Array.isArray(value)) {
      return value
        .map(
          (collaborator: unknown) =>
            (collaborator as { name?: string; email?: string }).name ||
            (collaborator as { name?: string; email?: string }).email
        )
        .join(', ');
    }
    return (
      (value as { name?: string; email?: string }).name ||
      (value as { name?: string; email?: string }).email ||
      String(value)
    );
  }

  // Handle record links
  if (field.type === 'multipleRecordLinks') {
    if (Array.isArray(value)) {
      return value
        .map(
          (link: unknown) =>
            (link as { title?: string; id?: string }).title ||
            (link as { title?: string; id?: string }).id
        )
        .join(', ');
    }
    return (
      (value as { title?: string; id?: string }).title ||
      (value as { title?: string; id?: string }).id ||
      String(value)
    );
  }

  // Handle arrays (fallback for any array type)
  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} item(s)` : '';
  }

  // Handle objects (fallback for complex types)
  if (typeof value === 'object') {
    return (
      <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  // Fallback for any other type
  return String(value);
};

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
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(
    new Set()
  );

  const useNodeValue = useNodeContext();
  const dispatcher = useDispatcher<TAirtableEvent>();

  const sd = useSharedData<TAirtableSharedData>(['airtableBases'], (sd) => sd);

  const base = sd.airtableBases.get(node.data?.baseId || '');
  const table = base?.tables.find(
    (t: TAirtableTable) => t.id === node.data?.tableId
  );

  const handleRecordSelect = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  const viewMode: TAirtableViewMode = useSharedData<TAirtableSharedData>(
    ['airtableNodeViews'],
    (sd) =>
      Array.from(sd.airtableNodeViews.values()).find(
        (v) => v.nodeId === node.id && v.viewId === useNodeValue.viewId
      )?.viewMode || {
        mode: 'kanban',
        groupBy: 'status',
      }
  );

  const handleViewModeChange = (newMode: TAirtableViewMode) => {
    dispatcher.dispatch({
      type: 'airtable:set-node-view',
      nodeId: node.id,
      viewId: useNodeValue.viewId,
      viewMode: newMode,
    });
  };

  // Find important fields for the view components
  const titleField = table?.fields.find(
    (field: TAirtableField) =>
      field.type === 'singleLineText' || field.type === 'longText'
  );

  const statusField = table?.fields.find(
    (field: TAirtableField) =>
      field.type === 'singleSelect' &&
      field.name.toLowerCase().includes('status')
  );

  const priorityField = table?.fields.find(
    (field: TAirtableField) =>
      field.type === 'singleSelect' &&
      (field.name.toLowerCase().includes('priority') ||
        field.name.toLowerCase().includes('importance'))
  );

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
    switch (viewMode.mode) {
      case 'list':
        return (
          <div className="list-view">
            <table>
              <thead>
                <tr>
                  {table.fields.map((field: TAirtableField) => (
                    <th key={field.id}>{field.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.records.map((record: TAirtableRecordValue) => (
                  <tr
                    key={record.id}
                    className={selectedRecords.has(record.id) ? 'selected' : ''}
                    onClick={() => handleRecordSelect(record.id)}
                  >
                    {table.fields.map((field: TAirtableField) => (
                      <td key={field.id}>
                        {renderFieldContent(field, record.fields[field.name])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'kanban': {
        return (
          <AirtableTableKanban
            baseId={base.id}
            table={table}
            viewMode={viewMode}
            setViewMode={handleViewModeChange}
            onUpdateRecord={(recordId, fields) => {
              console.log('update record', recordId, fields);
            }}
            titleField={titleField}
            priorityField={priorityField}
            statusField={statusField}
          />
        );
      }

      case 'gallery':
        return (
          <AirtableTableGallery
            baseId={base.id}
            table={table}
            titleField={titleField}
            priorityField={priorityField}
            statusField={statusField}
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
              <button
                className={
                  viewMode.mode === 'kanban' && viewMode.groupBy === 'priority'
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
