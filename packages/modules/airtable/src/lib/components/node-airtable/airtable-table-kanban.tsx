import React from 'react';
import {
  TAirtableTable,
  TAirtableField,
  TAirtableRecordValue,
} from '../../airtable-types';
import AirtableRecordCard from './AirtableRecordCard';

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
    const groupValue = record.fields[groupByField.name];
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
                <AirtableRecordCard
                  key={record.id}
                  record={record}
                  table={table}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AirtableTableKanban;
