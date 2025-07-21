import React from 'react';
import {
  TAirtableTable,
  TAirtableRecordValue,
  TAirtableField,
} from '../../airtable-types';

interface AirtableRecordCardProps {
  record: TAirtableRecordValue;
  table: TAirtableTable;
  fieldsToShow?: TAirtableField[];
}

const AirtableRecordCard: React.FC<AirtableRecordCardProps> = ({
  record,
  table,
  fieldsToShow,
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

  return (
    <div className="airtable-gallery-card">
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
