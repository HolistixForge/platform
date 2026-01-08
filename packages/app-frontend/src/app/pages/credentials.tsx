import { useState } from 'react';
import {
  useQueryCredentials,
  useQueryCredentialTypes,
  useMutationCreateCredential,
  useMutationDeleteCredential,
} from '@holistix-forge/frontend-data';
import {
  CredentialsList,
  CredentialForm,
  DialogControlled,
} from '@holistix-forge/ui-base';
import {
  TCredentialSummary,
  TCreateCredentialRequest,
} from '@holistix-forge/types';
import { HeaderLogic } from '../header/header-logic';

type CredentialsPageView = 'list' | 'add' | 'edit';

export const CredentialsPage = () => {
  const [view, setView] = useState<CredentialsPageView>('list');
  const [selectedCredential, setSelectedCredential] =
    useState<TCredentialSummary | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [credentialToDelete, setCredentialToDelete] =
    useState<TCredentialSummary | null>(null);

  // Queries
  const {
    data: credentials,
    isLoading: credentialsLoading,
    refetch: refetchCredentials,
  } = useQueryCredentials({ include_shared: true });
  const { data: credentialTypes, isLoading: typesLoading } =
    useQueryCredentialTypes();

  // Mutations
  const createMutation = useMutationCreateCredential();
  const deleteMutation = useMutationDeleteCredential();

  const handleAdd = () => {
    setSelectedCredential(null);
    setView('add');
  };

  const handleEdit = (credential: TCredentialSummary) => {
    setSelectedCredential(credential);
    setView('edit');
  };

  const handleDelete = (credential: TCredentialSummary) => {
    setCredentialToDelete(credential);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (credentialToDelete) {
      await deleteMutation.mutateAsync(credentialToDelete.credential_id);
      setDeleteDialogOpen(false);
      setCredentialToDelete(null);
      refetchCredentials();
    }
  };

  const handleShare = (credential: TCredentialSummary) => {
    // TODO: Implement sharing UI in Phase 2
    console.log('Share credential:', credential.credential_id);
    alert('Sharing functionality will be available in a future update.');
  };

  const handleCancel = () => {
    setView('list');
    setSelectedCredential(null);
  };

  const handleSubmit = async (data: TCreateCredentialRequest) => {
    await createMutation.mutateAsync(data);
    setView('list');
    refetchCredentials();
  };

  const isLoading = credentialsLoading || typesLoading;

  return (
    <>
      <HeaderLogic />
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          padding: '2rem 1rem',
        }}
      >
        {view === 'list' && (
          <CredentialsList
            credentials={credentials || []}
            credentialTypes={credentialTypes || []}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onShare={handleShare}
            loading={isLoading}
          />
        )}

        {(view === 'add' || view === 'edit') && (
          <CredentialForm
            types={credentialTypes || []}
            initialType={selectedCredential?.credential_type}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={createMutation.isPending}
          />
        )}

        <DialogControlled
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Credential"
          description={`Are you sure you want to delete "${credentialToDelete?.name}"? This action cannot be undone.`}
          content={
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <button
                onClick={() => setDeleteDialogOpen(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  border: '1px solid var(--c-border, rgba(255, 255, 255, 0.2))',
                  borderRadius: '6px',
                  color: 'var(--c-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--c-danger, #ef4444)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: deleteMutation.isPending ? 0.7 : 1,
                }}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          }
        />
      </div>
    </>
  );
};
