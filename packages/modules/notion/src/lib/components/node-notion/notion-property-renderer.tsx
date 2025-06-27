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

    case 'people': {
      return (
        <div className="node-notion-people">
          {property.people.length > 0 ? (
            <div className="node-notion-people-list">
              {property.people.map((person, index) => (
                <span key={index} className="node-notion-person">
                  {person.name || person.id}
                </span>
              ))}
            </div>
          ) : (
            <span className="node-notion-empty">No assignees</span>
          )}
        </div>
      );
    }

    case 'date': {
      const dateValue = property.date?.start || '';
      return (
        <input
          type="date"
          defaultValue={dateValue}
          onBlur={(e) =>
            onUpdate({
              type: 'date',
              date: e.target.value ? { start: e.target.value } : null,
            })
          }
          className="node-notion-input"
        />
      );
    }

    case 'multi_select': {
      const propertyDef =
        database.properties[
          Object.keys(database.properties).find(
            (key) => database.properties[key].id === property.id
          )!
        ];
      const options =
        propertyDef.type === 'multi_select'
          ? propertyDef.multi_select.options
          : [];
      const selectedValues = property.multi_select.map((item) => item.name);

      return (
        <div className="node-notion-multi-select">
          <select
            multiple
            value={selectedValues}
            onChange={(e) => {
              const selectedOptions = Array.from(
                e.target.selectedOptions,
                (option) => option.value
              );
              const updatedSelection = selectedOptions.map((name) => {
                const option = options.find((opt) => opt.name === name);
                return {
                  id: option?.id || '',
                  name: name,
                  color: option?.color || 'default',
                };
              });
              onUpdate({
                type: 'multi_select',
                multi_select: updatedSelection,
              });
            }}
          >
            {options.map((option) => (
              <option key={option.id} value={option.name}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
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
