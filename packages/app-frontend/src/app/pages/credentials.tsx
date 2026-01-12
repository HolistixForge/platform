import { useState } from 'react';
import {
  useQueryCredentials,
  useQueryCredentialTypes,
  useQueryCredentialShares,
  useMutationCreateCredential,
  useMutationDeleteCredential,
  useMutationShareCredential,
  useMutationRevokeCredentialShare,
  useQueryUserOrganizations,
  useQueryUserProjects,
} from '@holistix-forge/frontend-data';
import {
  CredentialsList,
  CredentialForm,
  CredentialShareDialog,
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
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [credentialToShare, setCredentialToShare] =
    useState<TCredentialSummary | null>(null);

  // Queries
  const {
    data: credentials,
    isLoading: credentialsLoading,
    refetch: refetchCredentials,
  } = useQueryCredentials({ include_shared: true });
  const { data: credentialTypes, isLoading: typesLoading } =
    useQueryCredentialTypes();
  const { data: organizations, isLoading: orgsLoading } =
    useQueryUserOrganizations();
  const { data: projects, isLoading: projectsLoading } = useQueryUserProjects();
  const { data: currentShares, refetch: refetchShares } =
    useQueryCredentialShares(credentialToShare?.credential_id || null);

  // Mutations
  const createMutation = useMutationCreateCredential();
  const deleteMutation = useMutationDeleteCredential();
  const shareMutation = useMutationShareCredential(
    credentialToShare?.credential_id || ''
  );
  const revokeMutation = useMutationRevokeCredentialShare(
    credentialToShare?.credential_id || ''
  );

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
    setCredentialToShare(credential);
    setShareDialogOpen(true);
  };

  const handleShareSubmit = async (data: {
    share_scope: 'organization' | 'project';
    organization_id?: string;
    project_id?: string;
  }) => {
    await shareMutation.mutateAsync(data);
    refetchShares();
    refetchCredentials();
  };

  const handleRevokeShare = async (shareId: string) => {
    await revokeMutation.mutateAsync(shareId);
    refetchShares();
    refetchCredentials();
  };

  const closeShareDialog = () => {
    setShareDialogOpen(false);
    setCredentialToShare(null);
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

  // Transform organizations and projects to the expected format
  const orgsForDialog = (organizations || []).map((org) => ({
    organization_id: org.organization_id,
    name: org.name,
  }));

  const projectsForDialog = (projects || []).map((proj) => ({
    project_id: proj.project_id,
    name: proj.name,
    organization_id: proj.organization_id,
  }));

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

        {/* Delete Confirmation Dialog */}
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

        {/* Share Dialog */}
        {shareDialogOpen && credentialToShare && (
          <CredentialShareDialog
            credentialId={credentialToShare.credential_id}
            credentialName={credentialToShare.name}
            shares={currentShares || []}
            organizations={orgsForDialog}
            projects={projectsForDialog}
            onShare={handleShareSubmit}
            onRevoke={handleRevokeShare}
            onClose={closeShareDialog}
            isLoading={orgsLoading || projectsLoading}
          />
        )}
      </div>
    </>
  );
};
