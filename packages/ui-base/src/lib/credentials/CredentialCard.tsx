import { TCredentialSummary, TCredentialType } from '@holistix-forge/types';
import {
  Pencil1Icon,
  TrashIcon,
  Share1Icon,
  KeyboardIcon,
} from '@radix-ui/react-icons';

export type CredentialCardProps = {
  credential: TCredentialSummary;
  credentialType?: TCredentialType;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
};

export const CredentialCard = ({
  credential,
  credentialType,
  onEdit,
  onDelete,
  onShare,
}: CredentialCardProps) => {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="credential-card">
      <div className="credential-card__icon">
        {credentialType?.icon_url ? (
          <img
            src={credentialType.icon_url}
            alt={credentialType.display_name}
          />
        ) : (
          <KeyboardIcon />
        )}
      </div>

      <div className="credential-card__info">
        <h3>{credential.name}</h3>
        <div className="credential-card__info-meta">
          <span className="badge">
            {credentialType?.display_name || credential.credential_type}
          </span>
          {credential.is_shared && (
            <span className="badge shared-badge">Shared</span>
          )}
          <span>Last used: {formatDate(credential.last_used_at)}</span>
        </div>
      </div>

      <div className="credential-card__actions">
        {onShare && !credential.is_shared && (
          <button
            onClick={onShare}
            title="Share credential"
            aria-label="Share credential"
          >
            <Share1Icon />
          </button>
        )}
        {onEdit && !credential.is_shared && (
          <button
            onClick={onEdit}
            title="Edit credential"
            aria-label="Edit credential"
          >
            <Pencil1Icon />
          </button>
        )}
        {onDelete && !credential.is_shared && (
          <button
            onClick={onDelete}
            title="Delete credential"
            aria-label="Delete credential"
            className="delete"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
};
