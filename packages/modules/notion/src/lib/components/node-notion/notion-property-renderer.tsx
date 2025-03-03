import { TNotionProperty } from '../../notion-types';

interface NotionPropertyRendererProps {
  property: TNotionProperty;
  onUpdate: (value: any) => void;
}

export const NotionPropertyRenderer = ({
  property,
  onUpdate,
}: NotionPropertyRendererProps) => {
  switch (property.type) {
    case 'rich_text':
      return (
        <input
          type="text"
          value={property.rich_text[0]?.plain_text || ''}
          onChange={(e) =>
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
          value={property.number || ''}
          onChange={(e) =>
            onUpdate({
              type: 'number',
              number: parseFloat(e.target.value),
            })
          }
          className="node-notion-input"
        />
      );

    case 'select':
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
          {/* You'll need to add options based on available select options */}
        </select>
      );

    case 'status':
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
          <option value="Not started">Not Started</option>
          <option value="In progress">In Progress</option>
          <option value="Done">Done</option>
        </select>
      );

    case 'relation':
      return (
        <div className="node-notion-relation">
          {property.relation.length} related items
        </div>
      );

    default:
      return <div>Unsupported property type: {property.type}</div>;
  }
};
