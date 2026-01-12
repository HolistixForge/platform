/**
 * CredentialShareDialog Component
 *
 * A dialog that allows users to share/assign their credentials
 * to organizations or projects for use by team members.
 */

import { useState } from 'react';
import {
  Cross2Icon,
  Share1Icon,
  PersonIcon,
  CubeIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { TCredentialShare } from '@holistix-forge/types';
import './credentials.scss';

export type Organization = {
  organization_id: string;
  name: string;
};

export type Project = {
  project_id: string;
  name: string;
  organization_id: string;
};

export type CredentialShareDialogProps = {
  credentialName: string;
  credentialId: string;
  shares: TCredentialShare[];
  organizations: Organization[];
  projects: Project[];
  onShare: (data: {
    share_scope: 'organization' | 'project';
    organization_id?: string;
    project_id?: string;
  }) => Promise<void>;
  onRevoke: (shareId: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
};

export const CredentialShareDialog = ({
  credentialName,
  shares,
  organizations,
  projects,
  onShare,
  onRevoke,
  onClose,
  isLoading = false,
}: CredentialShareDialogProps) => {
  const [shareScope, setShareScope] = useState<'organization' | 'project'>(
    'organization'
  );
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const activeShares = shares.filter((s) => s.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const data: {
      share_scope: 'organization' | 'project';
      organization_id?: string;
      project_id?: string;
    } = { share_scope: shareScope };

    if (shareScope === 'organization') {
      if (!selectedOrgId) return;
      data.organization_id = selectedOrgId;
    } else {
      if (!selectedProjectId) return;
      data.project_id = selectedProjectId;
    }

    setSubmitting(true);
    try {
      await onShare(data);
      // Reset selection after successful share
      setSelectedOrgId('');
      setSelectedProjectId('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (revoking) return;
    setRevoking(shareId);
    try {
      await onRevoke(shareId);
    } finally {
      setRevoking(null);
    }
  };

  const getOrgName = (orgId: string | null) =>
    organizations.find((o) => o.organization_id === orgId)?.name || 'Unknown';

  const getProjectName = (projectId: string | null) =>
    projects.find((p) => p.project_id === projectId)?.name || 'Unknown';

  // Filter out already shared orgs/projects
  const availableOrgs = organizations.filter(
    (org) =>
      !activeShares.some(
        (s) =>
          s.share_scope === 'organization' &&
          s.organization_id === org.organization_id
      )
  );

  const availableProjects = projects.filter(
    (proj) =>
      !activeShares.some(
        (s) => s.share_scope === 'project' && s.project_id === proj.project_id
      )
  );

  return (
    <div className="credential-share-overlay" onClick={onClose}>
      <div
        className="credential-share-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="credential-share-dialog__header">
          <div className="credential-share-dialog__header-title">
            <Share1Icon />
            <h3>Share Credential</h3>
          </div>
          <button
            className="credential-share-dialog__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Cross2Icon />
          </button>
        </div>

        <p className="credential-share-dialog__description">
          Share <strong>"{credentialName}"</strong> with your organizations or
          projects. Members will be able to use this credential for
          integrations.
        </p>

        {/* Current Shares */}
        {activeShares.length > 0 && (
          <div className="credential-share-dialog__current">
            <h4>Currently Shared With</h4>
            <ul className="credential-share-list">
              {activeShares.map((share) => (
                <li key={share.share_id} className="credential-share-item">
                  <div className="credential-share-item__icon">
                    {share.share_scope === 'organization' ? (
                      <PersonIcon />
                    ) : (
                      <CubeIcon />
                    )}
                  </div>
                  <div className="credential-share-item__info">
                    <span className="credential-share-item__name">
                      {share.share_scope === 'organization'
                        ? getOrgName(share.organization_id)
                        : getProjectName(share.project_id)}
                    </span>
                    <span className="credential-share-item__type">
                      {share.share_scope === 'organization'
                        ? 'Organization'
                        : 'Project'}
                    </span>
                  </div>
                  <button
                    className="credential-share-item__revoke"
                    onClick={() => handleRevoke(share.share_id)}
                    disabled={revoking === share.share_id}
                    aria-label="Revoke share"
                  >
                    {revoking === share.share_id ? (
                      <span className="spinner-small" />
                    ) : (
                      <TrashIcon />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add New Share */}
        <form className="credential-share-dialog__form" onSubmit={handleSubmit}>
          <h4>Add New Share</h4>

          <div className="credential-share-dialog__scope-toggle">
            <button
              type="button"
              className={`scope-btn ${
                shareScope === 'organization' ? 'scope-btn--active' : ''
              }`}
              onClick={() => setShareScope('organization')}
            >
              <PersonIcon />
              Organization
            </button>
            <button
              type="button"
              className={`scope-btn ${
                shareScope === 'project' ? 'scope-btn--active' : ''
              }`}
              onClick={() => setShareScope('project')}
            >
              <CubeIcon />
              Project
            </button>
          </div>

          {shareScope === 'organization' ? (
            <div className="credential-share-dialog__select-wrapper">
              {availableOrgs.length === 0 ? (
                <p className="credential-share-dialog__no-items">
                  {organizations.length === 0
                    ? 'You are not a member of any organization.'
                    : 'Already shared with all your organizations.'}
                </p>
              ) : (
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="credential-share-dialog__select"
                  disabled={isLoading}
                >
                  <option value="">Select an organization...</option>
                  {availableOrgs.map((org) => (
                    <option
                      key={org.organization_id}
                      value={org.organization_id}
                    >
                      {org.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="credential-share-dialog__select-wrapper">
              {availableProjects.length === 0 ? (
                <p className="credential-share-dialog__no-items">
                  {projects.length === 0
                    ? 'You are not a member of any project.'
                    : 'Already shared with all your projects.'}
                </p>
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="credential-share-dialog__select"
                  disabled={isLoading}
                >
                  <option value="">Select a project...</option>
                  {availableProjects.map((proj) => (
                    <option key={proj.project_id} value={proj.project_id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="credential-share-dialog__actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-btn"
              disabled={
                submitting ||
                (shareScope === 'organization'
                  ? !selectedOrgId || availableOrgs.length === 0
                  : !selectedProjectId || availableProjects.length === 0)
              }
            >
              {submitting ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
