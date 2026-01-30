import { TCredentialType } from '@holistix-forge/types';
import {
  LockClosedIcon,
  KeyboardIcon,
  GlobeIcon,
  RocketIcon,
  ChatBubbleIcon,
  CodeIcon,
  MixIcon,
} from '@radix-ui/react-icons';

export type CredentialTypeSelectorProps = {
  types: TCredentialType[];
  selectedType: string | null;
  onSelect: (type: string) => void;
  loading?: boolean;
};

// Map module names to icons
const moduleIcons: Record<string, React.ComponentType<any>> = {
  ai: RocketIcon,
  vcs: CodeIcon,
  cloud: GlobeIcon,
  communication: ChatBubbleIcon,
  generic: KeyboardIcon,
};

const getIconForType = (type: TCredentialType) => {
  if (type.icon_url) {
    return <img src={type.icon_url} alt={type.display_name} />;
  }
  const IconComponent = moduleIcons[type.module_name || 'generic'] || MixIcon;
  return <IconComponent />;
};

export const CredentialTypeSelector = ({
  types,
  selectedType,
  onSelect,
  loading = false,
}: CredentialTypeSelectorProps) => {
  if (loading) {
    return (
      <div className="credential-type-selector credential-type-selector--loading">
        <div className="credential-type-selector__loading">
          Loading credential types...
        </div>
      </div>
    );
  }

  if (types.length === 0) {
    return (
      <div className="credential-type-selector credential-type-selector--empty">
        <div className="credential-type-selector__empty">
          <LockClosedIcon />
          <p>No credential types available.</p>
          <span>Contact your administrator to register credential types.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="credential-type-selector">
      {types.map((type) => (
        <button
          key={type.credential_type}
          type="button"
          className={`credential-type-selector__item ${
            selectedType === type.credential_type
              ? 'credential-type-selector__item--selected'
              : ''
          }`}
          onClick={() => onSelect(type.credential_type)}
          title={type.description || type.display_name}
        >
          {getIconForType(type)}
          <span>{type.display_name}</span>
        </button>
      ))}
    </div>
  );
};
