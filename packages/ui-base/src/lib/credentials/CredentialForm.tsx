import { useState, FormEvent } from 'react';
import {
  TCredentialType,
  TCreateCredentialRequest,
} from '@holistix-forge/types';
import { TextFieldset } from '../form/form-fields/text-fieldset';
import { CredentialTypeSelector } from './CredentialTypeSelector';

export type CredentialFormProps = {
  types: TCredentialType[];
  initialType?: string;
  onSubmit: (data: TCreateCredentialRequest) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export const CredentialForm = ({
  types,
  initialType,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CredentialFormProps) => {
  const [selectedType, setSelectedType] = useState<string | null>(
    initialType || null
  );
  const [name, setName] = useState('');
  const [value, setValue] = useState('');

  const selectedTypeInfo = types.find(
    (t) => t.credential_type === selectedType
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedType || !name.trim() || !value.trim()) return;

    onSubmit({
      credential_type: selectedType,
      name: name.trim(),
      value: value.trim(),
    });
  };

  const isValid = selectedType && name.trim() && value.trim();

  return (
    <form className="credential-form" onSubmit={handleSubmit}>
      <div className="credential-form__header">
        <h3>Add New Credential</h3>
        <p>Store your API keys and tokens securely encrypted.</p>
      </div>

      <div className="credential-form__fields">
        <fieldset className="Fieldset">
          <label className="Label required">Credential Type *</label>
          <CredentialTypeSelector
            types={types}
            selectedType={selectedType}
            onSelect={setSelectedType}
          />
        </fieldset>

        {selectedTypeInfo && (
          <>
            <TextFieldset
              label="Name"
              name="credential-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`e.g., My ${selectedTypeInfo.display_name}`}
              required
            />

            <TextFieldset
              label={selectedTypeInfo.display_name}
              name="credential-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                selectedTypeInfo.description || 'Enter your API key or token'
              }
              type="password"
              required
            />

            {selectedTypeInfo.description && (
              <p
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--color-text-faint)',
                  margin: '0',
                }}
              >
                {selectedTypeInfo.description}
              </p>
            )}
          </>
        )}
      </div>

      <div className="credential-form__actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="submit-btn"
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Credential'}
        </button>
      </div>
    </form>
  );
};
