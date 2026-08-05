import { TCredentialSummary, TCredentialType } from '@holistix-forge/types';
import { PlusIcon, KeyboardIcon } from '@radix-ui/react-icons';
import { CredentialCard } from './CredentialCard';
import './credentials.scss';

export type CredentialsListProps = {
  credentials: TCredentialSummary[];
  credentialTypes: TCredentialType[];
  onAdd: () => void;
  onEdit: (credential: TCredentialSummary) => void;
  onDelete: (credential: TCredentialSummary) => void;
  onShare: (credential: TCredentialSummary) => void;
  loading?: boolean;
};

export const CredentialsList = ({
  credentials,
  credentialTypes,
  onAdd,
  onEdit,
  onDelete,
  onShare,
  loading = false,
}: CredentialsListProps) => {
  const getCredentialType = (typeName: string) =>
    credentialTypes.find((t) => t.credential_type === typeName);

  if (loading) {
    return (
      <div className="credentials-wallet">
        <div className="credentials-wallet__header">
          <h2>Credentials Wallet</h2>
        </div>
        <div className="credentials-wallet__empty">
          <p>Loading credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="credentials-wallet">
      <div className="credentials-wallet__header">
        <h2>Credentials Wallet</h2>
        <button
          onClick={onAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'var(--color-accent)',
            color: 'var(--color-text-on-color)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <PlusIcon />
          Add Credential
        </button>
      </div>

      {credentials.length === 0 ? (
        <div className="credentials-wallet__empty">
          <KeyboardIcon />
          <p>
            No credentials stored yet.
            <br />
            Add your API keys and tokens to integrate with third-party services.
          </p>
          <button
            onClick={onAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'var(--color-accent)',
              color: 'var(--color-text-on-color)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <PlusIcon />
            Add Your First Credential
          </button>
        </div>
      ) : (
        <div className="credentials-list">
          {credentials.map((credential) => (
            <CredentialCard
              key={credential.credential_id}
              credential={credential}
              credentialType={getCredentialType(credential.credential_type)}
              onEdit={() => onEdit(credential)}
              onDelete={() => onDelete(credential)}
              onShare={() => onShare(credential)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
