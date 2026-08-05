import { ReactNode, useMemo, useEffect } from 'react';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import { loadModules, TModule } from '@holistix-forge/module';
import { useApi } from '../api-context';
import { useQueryOrganizationGateway } from '../queries';
import { OrganizationProvider } from '../contexts/organization-context';
import { createModuleConfigs } from './modules-config';

/**
 * ModuleDataProvider - Complete data infrastructure for an organization
 *
 * This component is the heart of the data layer. It:
 * 1. Fetches gateway hostname for the organization
 * 2. Creates module configurations
 * 3. Loads modules (passed by app-frontend)
 * 4. Provides OrganizationProvider context
 * 5. Provides ModuleProvider with loaded module exports
 *
 * This separates data concerns (module loading, gateway management)
 * from UI concerns (loading spinners, error messages), making the
 * architecture cleaner and more testable.
 *
 * @example
 * ```tsx
 * <ModuleDataProvider
 *   organization_id="org-123"
 *   modules={[{ module: collabFrontend, config: {} }, ...]}
 *   loadingUI={<Spinner />}
 *   unavailableUI={(org_id) => <GatewayStartButton org_id={org_id} />}
 * >
 *   <YourApp />
 * </ModuleDataProvider>
 * ```
 */
export const ModuleDataProvider = ({
  organization_id,
  modules,
  children,
  loadingUI,
  unavailableUI,
  userInfo,
}: {
  /** Organization ID to load modules for */
  organization_id: string;
  /** Module definitions (imported by app-frontend to avoid circular deps) */
  modules: {
    module: TModule<never, object>;
    configKey?: 'collab' | 'reducers';
  }[];
  /** Children that will receive module exports */
  children: ReactNode;
  /** Optional custom loading UI */
  loadingUI?: ReactNode;
  /** Optional custom UI when gateway is unavailable */
  unavailableUI?: (organization_id: string) => ReactNode;
  /** User info from useCurrentUser hook (required for collab awareness) */
  userInfo: { user_id: string; username: string };
}) => {
  const { ganymedeApi } = useApi();
  const { status, data } = useQueryOrganizationGateway(organization_id);

  const gateway_hostname = data?.gateway_hostname || null;

  // Set gateway hostname on API client for fetchGateway() calls
  useEffect(() => {
    if (gateway_hostname) {
      ganymedeApi.setGatewayHostname(organization_id, gateway_hostname);
    }
  }, [gateway_hostname, organization_id, ganymedeApi]);

  // Identify the module set by name+order rather than by array identity.
  const moduleSignature = modules
    .map(({ module, configKey }) => `${module.name}@${configKey ?? ''}`)
    .join(',');

  // Create module configs and load modules when gateway is available
  // Memoized to avoid reloading unless gateway changes
  const moduleExports = useMemo(() => {
    if (!gateway_hostname) return {};

    // Create configs
    const configs = createModuleConfigs({
      organization_id,
      gateway_hostname,
      ganymedeApi,
      userInfo,
    });

    // Apply configs to modules
    const modulesWithConfig = modules.map(({ module, configKey }) => ({
      module,
      config:
        configKey === 'collab'
          ? configs.collabConfig
          : configKey === 'reducers'
          ? { fetch: configs.gatewayFetch }
          : {},
    }));

    return loadModules(modulesWithConfig);
    // Depend on the *values* that matter, not on the identity of `userInfo`
    // and `modules`. Callers build both inline, so keying the memo on their
    // references re-ran `loadModules` on every render: each pass produced a
    // fresh set of module exports, which gave the whiteboard a new node
    // component type and remounted every node in the project on every render.
  }, [
    gateway_hostname,
    organization_id,
    ganymedeApi,
    userInfo.user_id,
    userInfo.username,
    moduleSignature,
  ]);

  // Loading state - waiting for gateway info
  if (status === 'pending') {
    return <>{loadingUI || <DefaultLoadingUI />}</>;
  }

  // Gateway unavailable - show custom UI or default
  if (!gateway_hostname) {
    return (
      <>
        {unavailableUI ? (
          unavailableUI(organization_id)
        ) : (
          <DefaultUnavailableUI organization_id={organization_id} />
        )}
      </>
    );
  }

  // Provide organization context + module exports
  return (
    <OrganizationProvider organization_id={organization_id}>
      <ModuleProvider exports={moduleExports}>{children}</ModuleProvider>
    </OrganizationProvider>
  );
};

/**
 * Default loading UI
 * Can be overridden with loadingUI prop
 */
const DefaultLoadingUI = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'var(--color-text-muted)',
    }}
  >
    Loading gateway information...
  </div>
);

/**
 * Default unavailable UI
 * Can be overridden with unavailableUI prop
 */
const DefaultUnavailableUI = ({
  organization_id,
}: {
  organization_id: string;
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      color: 'var(--color-text-muted)',
    }}
  >
    <p>Gateway unavailable for organization: {organization_id}</p>
    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
      The organization may be shut down or the gateway is not allocated.
    </p>
  </div>
);
