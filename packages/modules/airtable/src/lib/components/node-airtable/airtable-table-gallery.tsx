import { TAirtableTable, TAirtableField } from '../../airtable-types';
import { TAirtableViewMode } from './airtable-table';
import AirtableRecordCard from './AirtableRecordCard';

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
        <div
          className="airtable-gallery-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${
              viewMode.mode === 'gallery' ? viewMode.itemPerLine : 3
            }, 1fr)`,
            gap: '16px', // adjust as needed or remove if handled by CSS
          }}
        >
          {table.records.map((record) => (
            <AirtableRecordCard key={record.id} record={record} table={table} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AirtableTableGallery;
