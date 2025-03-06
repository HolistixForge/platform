import { TNotionProperty, TNotionDatabase } from '../../notion-types';

interface NotionPropertyRendererProps {
  property: TNotionProperty;
  database: TNotionDatabase;
  onUpdate: (value: any) => void;
}

export const NotionPropertyRenderer = ({
  property,
  database,
  onUpdate,
}: NotionPropertyRendererProps) => {
  switch (property.type) {
    case 'rich_text':
      return (
        <input
          type="text"
          defaultValue={property.rich_text[0]?.plain_text || ''}
          onBlur={(e) =>
            onUpdate({
              type: 'rich_text',
              rich_text: [{ text: { content: e.target.value } }],
            })
          }
          className="node-notion-input"
        />
      );

    case 'number':
      return (
        <input
          type="number"
          defaultValue={property.number || ''}
          onBlur={(e) =>
            onUpdate({
              type: 'number',
              number: parseFloat(e.target.value),
            })
          }
          className="node-notion-input"
        />
      );

    case 'select': {
      const propertyDef =
        database.properties[
          Object.keys(database.properties).find(
            (key) => database.properties[key].id === property.id
          )!
        ];
      const options =
        propertyDef.type === 'select' ? propertyDef.select.options : [];

      return (
        <select
          value={property.select?.name || ''}
          onChange={(e) =>
            onUpdate({
              type: 'select',
              select: {
                name: e.target.value,
              },
            })
          }
          className="node-notion-select"
        >
          <option value="">Select an option...</option>
          {options.map((option) => (
            <option key={option.id} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
      );
    }

    case 'status': {
      const propertyDef =
        database.properties[
          Object.keys(database.properties).find(
            (key) => database.properties[key].id === property.id
          )!
        ];
      const options =
        propertyDef.type === 'status' ? propertyDef.status.options : [];

      return (
        <select
          value={property.status?.name || ''}
          onChange={(e) =>
            onUpdate({
              type: 'status',
              status: {
                name: e.target.value,
              },
            })
          }
          className="node-notion-select"
        >
          <option value="">Select status...</option>
          {options.map((option) => (
            <option key={option.id} value={option.name}>
              {option.name}
            </option>
          ))}
        </select>
      );
    }

    case 'relation':
      return (
        <div className="node-notion-relation">
          {property.relation.length} related items
        </div>
      );

    case 'unique_id':
      return (
        <div className="node-notion-unique-id">
          {property.unique_id.prefix}-{property.unique_id.number}
        </div>
      );

    default:
      return (
        <div>
          Unsupported property type: {property.type}
          <pre>{JSON.stringify(property, null, 2)}</pre>
        </div>
      );
  }
};
