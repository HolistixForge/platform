import React from 'react';
import {
  TAirtableTable,
  TAirtableField,
  TAirtableRecordValue,
} from '../../airtable-types';

interface AirtableTableKanbanProps {
  table: TAirtableTable;
  groupByField: TAirtableField;
}

export const AirtableTableKanban: React.FC<AirtableTableKanbanProps> = ({
  table,
  groupByField,
}) => {
  // Group records by the specified field
  const groupedRecords = new Map<string, TAirtableRecordValue[]>();

  table.records.forEach((record: TAirtableRecordValue) => {
    const groupValue = record.fields[groupByField.id];
    const groupKey = groupValue ? String(groupValue) : 'No Value';

    if (!groupedRecords.has(groupKey)) {
      groupedRecords.set(groupKey, []);
    }
    const records = groupedRecords.get(groupKey);
    if (records) {
      records.push(record);
    }
  });

  return (
    <div className="airtable-table-kanban">
      <div className="kanban-header">
        <h3>Kanban View - Grouped by {groupByField.name}</h3>
      </div>
      <div className="kanban-columns">
        {Array.from(groupedRecords.entries()).map(([groupKey, records]) => (
          <div key={groupKey} className="kanban-column">
            <div className="column-header">
              <h4>{groupKey}</h4>
              <span className="record-count">{records.length}</span>
            </div>
            <div className="column-content">
              {records.map((record: TAirtableRecordValue) => (
                <div key={record.id} className="kanban-card">
                  <div className="card-content">
                    {table.fields.slice(0, 3).map((field: TAirtableField) => (
                      <div key={field.id} className="card-field">
                        <span className="field-name">{field.name}:</span>
                        <span className="field-value">
                          {record.fields[field.id]
                            ? String(record.fields[field.id])
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AirtableTableKanban;
