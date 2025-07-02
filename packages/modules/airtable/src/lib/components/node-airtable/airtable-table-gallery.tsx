import { TAirtableTable, TAirtableField } from '../../airtable-types';
import { TAirtableViewMode } from './airtable-table';

type AirtableTableGalleryProps = {
  table: TAirtableTable;
  titleField?: TAirtableField;
  priorityField?: TAirtableField;
  statusField?: TAirtableField;
  viewMode: TAirtableViewMode;
};

const AirtableTableGallery = (props: AirtableTableGalleryProps) => {
  const { table, viewMode } = props;

  return (
    <div className="airtable-table-gallery">
      <div className="airtable-gallery-header">
        <h3>Gallery View - {table.name}</h3>
        <p>
          Items per line:{' '}
          {viewMode.mode === 'gallery' ? viewMode.itemPerLine : 3}
        </p>
      </div>
      <div className="airtable-gallery-content">
        <div className="airtable-gallery-grid">
          {table.records.map((record) => (
            <div key={record.id} className="airtable-gallery-card">
              <div className="gallery-card-header">
                <h4>{record.id}</h4>
              </div>
              <div className="gallery-card-content">
                {Object.entries(record.fields)
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <div key={key} className="gallery-field">
                      <span className="field-label">{key}:</span>
                      <span className="field-value">{String(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AirtableTableGallery;
