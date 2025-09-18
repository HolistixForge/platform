import { useState } from 'react';
import {
  TAirtableField,
  TAirtableRecordValue,
  TAirtableTable,
} from '../../airtable-types';

type AirtableTableListProps = {
  table: TAirtableTable;
};

const renderFieldContent = (
  field: TAirtableField,
  value: unknown
): React.ReactNode => {
  if (!value) return '';

  if (field.type === 'singleLineText' || field.type === 'longText') {
    return String(value);
  }

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

  if (field.type === 'singleSelect') {
    return (value as { name?: string }).name || String(value);
  }

  if (field.type === 'multipleSelects' && Array.isArray(value)) {
    return value
      .map((item: unknown) => (item as { name?: string }).name || String(item))
      .join(', ');
  }

  if (field.type === 'checkbox') {
    return value ? '✓' : '✗';
  }

  if (
    field.type === 'number' ||
    field.type === 'currency' ||
    field.type === 'percent'
  ) {
    return String(value);
  }

  if (
    field.type === 'date' ||
    field.type === 'createdTime' ||
    field.type === 'lastModifiedTime'
  ) {
    return new Date(value as string).toLocaleDateString();
  }

  if (field.type === 'url') {
    return (
      <a href={value as string} target="_blank" rel="noopener noreferrer">
        {value as string}
      </a>
    );
  }

  if (field.type === 'email') {
    return <a href={`mailto:${value as string}`}>{value as string}</a>;
  }

  if (field.type === 'phoneNumber') {
    return <a href={`tel:${value as string}`}>{value as string}</a>;
  }

  if (field.type === 'rating') {
    return `${value}★`;
  }

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

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} item(s)` : '';
  }

  if (field.type === 'aiText') return (value as any).value;

  if (typeof value === 'object') {
    return (
      <pre style={{ fontSize: '12px', margin: 0, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify({ field, value }, null, 2)}
      </pre>
    );
  }

  return String(value);
};

const AirtableTableList = ({ table }: AirtableTableListProps) => {
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(
    new Set()
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
};

export default AirtableTableList;
