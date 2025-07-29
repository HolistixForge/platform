import React, { DragEvent } from 'react';
import {
  TAirtableTable,
  TAirtableRecordValue,
  TAirtableField,
} from '../../airtable-types';
import { TEventLoadRecordNode } from '../../airtable-events';

interface AirtableRecordCardProps {
  record: TAirtableRecordValue;
  table: TAirtableTable;
  fieldsToShow?: TAirtableField[];
  draggable?: boolean;
}

const AirtableRecordCard: React.FC<AirtableRecordCardProps> = ({
  record,
  table,
  fieldsToShow,
  draggable = false,
}) => {
  // Title: name, Name, or id
  const title = record.fields.name
    ? String(record.fields.name)
    : record.fields.Name
    ? String(record.fields.Name)
    : record.id;

  // Exclude 'name' and 'Name' fields from display
  const excluded = ['name', 'Name'];
  const displayFields =
    fieldsToShow ||
    table.fields.filter((f) => !excluded.includes(f.name)).slice(0, 3);

  // Drag handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (!draggable) return;

    const event: Partial<TEventLoadRecordNode> = {
      type: 'airtable:load-record-node',
      recordId: record.id,
      baseId: table.id, // Using table.id as baseId for now
      tableId: table.id,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e: DragEvent<HTMLDivElement>) => {
    if (!draggable) return;
    e.currentTarget.classList.remove('dragging');
  };

  return (
    <div
      className="airtable-gallery-card"
      draggable={draggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="gallery-card-header">
        <h4 className="gallery-card-title">{title}</h4>
      </div>
      <div className="gallery-card-content">
        {displayFields.map((field) => (
          <div key={field.id} className="gallery-field">
            <span className="field-label">{field.name}:</span>
            <span className="field-value">
              {record.fields[field.name] !== undefined
                ? String(record.fields[field.name])
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AirtableRecordCard;
