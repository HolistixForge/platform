import { DragEvent } from 'react';
import { TAirtableBase, TAirtableTable } from '../../airtable-types';
import { TEventLoadTableNode } from '../../airtable-events';

import './airtable-base-table-list.scss';

//

export const TableItem = ({
  table,
  base,
}: {
  table: TAirtableTable;
  base: TAirtableBase;
}) => {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    const event: Partial<TEventLoadTableNode> = {
      type: 'airtable:load-table-node',
      baseId: base.id,
      tableId: table.id,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('dragging');
  };

  // Get primary field for display
  const primaryField = table.fields.find(
    (field) => field.id === table.primaryFieldId
  );

  // Get some sample records for preview
  const sampleRecords = table.records.slice(0, 3);

  // Determine table status for styling
  const hasRecords = table.records.length > 0;
  const isManyFields = table.fields.length > 10;
  const tableStatusClass = hasRecords ? 'has-records' : 'empty-table';
  const tableClass = `table-item ${tableStatusClass} ${
    isManyFields ? 'many-fields' : ''
  }`;

  return (
    <div
      className={tableClass}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="table-item-header">
        <h4 className="table-item-title">{table.name}</h4>
        <div className="table-item-meta">
          <span className="table-count">{table.records.length} records</span>
          <span className="table-fields">{table.fields.length} fields</span>
        </div>
      </div>

      <div className="table-item-content">
        <div className="table-primary-field">
          <span className="field-label">Primary:</span>
          <span className="field-name">{primaryField?.name || 'Unknown'}</span>
        </div>

        {sampleRecords.length > 0 && (
          <div className="table-sample-records">
            <span className="sample-label">Sample records:</span>
            <div className="sample-list">
              {sampleRecords.map((record) => {
                const primaryValue =
                  record.fields[primaryField?.name || ''] || 'Untitled';
                return (
                  <div key={record.id} className="sample-record">
                    {String(primaryValue).substring(0, 30)}
                    {String(primaryValue).length > 30 ? '...' : ''}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="table-item-footer">
        <div className="table-views">
          {table.views?.map((view) => (
            <span key={view.id} className="view-badge">
              {view.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

//

export const AirtableBaseTableList = ({
  base,
  tables,
}: {
  base: TAirtableBase;
  tables: TAirtableTable[];
}) => {
  return (
    <div className="airtable-table-list">
      {tables.map((table) => (
        <TableItem key={table.id} table={table} base={base} />
      ))}
    </div>
  );
};

export default AirtableBaseTableList;
