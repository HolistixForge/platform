import { TCredentialType } from '@holistix-forge/types';
import { KeyboardIcon } from '@radix-ui/react-icons';

export type CredentialTypeSelectorProps = {
  types: TCredentialType[];
  selectedType: string | null;
  onSelect: (type: string) => void;
};

export const CredentialTypeSelector = ({
  types,
  selectedType,
  onSelect,
}: CredentialTypeSelectorProps) => {
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
        >
          {type.icon_url ? (
            <img src={type.icon_url} alt={type.display_name} />
          ) : (
            <KeyboardIcon />
          )}
          <span>{type.display_name}</span>
        </button>
      ))}
    </div>
  );
};
