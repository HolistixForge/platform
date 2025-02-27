import { TNotionPage, TNotionProperty } from '../../notion-types';

import './notion-card.scss';

type NotionCardProps = {
  page: TNotionPage;
  onUpdate: (properties: Record<string, TNotionProperty>) => void;
  onDelete: () => void;
};

export const NotionCard = ({ page, onUpdate, onDelete }: NotionCardProps) => {
  return (
    <div className="notion-card">
      <div className="card-header">
        <h4>{page.title}</h4>
        <button className="delete-button" onClick={onDelete}>
          ×
        </button>
      </div>
      <div className="card-content">
        {Object.entries(page.properties).map(([key, prop]) => (
          <div key={key} className="property">
            <span className="property-name">{prop.name}:</span>
            <span className="property-value">{prop.value?.toString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
