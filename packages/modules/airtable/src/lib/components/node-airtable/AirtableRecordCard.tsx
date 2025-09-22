import React, { DragEvent } from 'react';
import {
  TAirtableTable,
  TAirtableRecordValue,
  TAirtableField,
} from '../../airtable-types';
import { TEventLoadRecordNode } from '../../airtable-events';
import { detectNameField } from '../../utils/field-detection';

interface AirtableRecordCardProps {
  baseId: string;
  record: TAirtableRecordValue;
  table: TAirtableTable;
  fieldsToShow?: TAirtableField[];
  draggable?: boolean;
}

const AirtableRecordCard: React.FC<AirtableRecordCardProps> = ({
  baseId,
  record,
  table,
  fieldsToShow,
  draggable = false,
}) => {
  // Detect the best name/title field using field detection
  const nameField = detectNameField(table.fields);
  const title =
    nameField && record.fields[nameField.name]
      ? String(record.fields[nameField.name])
      : 'Unnamed';

  // Exclude detected name field from display
  const excluded: string[] = [];
  if (nameField) {
    excluded.push(nameField.name);
  }
  const displayFields =
    fieldsToShow ||
    table.fields.filter((f) => !excluded.includes(f.name)).slice(0, 3);

  // Try to find the first attachment image to use as background
  const backgroundImageUrl = (() => {
    for (const field of table.fields) {
      if (field.type === 'multipleAttachments') {
        const attachments = record.fields[field.name] as unknown;
        if (Array.isArray(attachments) && attachments.length > 0) {
          const first = attachments[0] as {
            url?: string;
            thumbnails?: {
              full?: { url: string };
              large?: { url: string };
            };
          };
          const imageUrl =
            first?.url ||
            first?.thumbnails?.full?.url ||
            first?.thumbnails?.large?.url;

          if (imageUrl) {
            return imageUrl;
          }
          // Continue to next field if no valid image found
        }
      }
    }
    return undefined;
  })();

  // Drag handlers
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (!draggable) return;

    const event: Partial<TEventLoadRecordNode> = {
      type: 'airtable:load-record-node',
      recordId: record.id,
      baseId: baseId,
      tableId: table.id,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(event));
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
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
      <div
        className="gallery-card-content"
        style={
          backgroundImageUrl
            ? {
                backgroundImage: `url(${backgroundImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                position: 'relative',
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                borderRadius: '8px',
                overflow: 'hidden',
                padding: '12px',
              }
            : undefined
        }
      >
        {backgroundImageUrl ? (
          <div
            className="gallery-card-overlay"
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              zIndex: 0,
            }}
          />
        ) : null}
        <div style={{ position: 'relative', zIndex: 1 }}>
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
    </div>
  );
};

export default AirtableRecordCard;
