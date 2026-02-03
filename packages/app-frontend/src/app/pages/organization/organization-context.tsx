import { ReactNode, useMemo, useEffect } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import {
  useApi,
  useQueryOrganizationGateway,
  useMutationStartOrganization,
} from '@holistix-forge/frontend-data';
import { ButtonBase, useAction } from '@holistix-forge/ui-base';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import { loadModules } from '@holistix-forge/module';
import { getModulesFrontend } from './modules';
import { createGatewayFetch } from './gateway-fetch';

const StartOrganizationBox = ({
  organization_id,
}: {
  organization_id: string;
}) => {
  const startOrganization = useMutationStartOrganization(organization_id);
  const action = useAction(
    () => startOrganization.mutateAsync(),
    [startOrganization]
  );

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ height: 'calc(100vh - 80px)' }}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{ gap: '8px', color: 'var(--neutral-5)' }}
      >
        <InfoCircledIcon style={{ width: '38px', height: '38px' }} />
        <p style={{ fontSize: 'var(--font-size-lg)' }}>
          Organization has been shut down due to inactivity.
        </p>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--neutral-6)',
            marginTop: '8px',
          }}
        >
          Click the button below to allocate a gateway and start the
          organization.
        </p>
      </div>
      <div
        className="flex items-center"
        style={{ gap: '8px', color: 'var(--neutral-5)', marginTop: '20px' }}
      >
        <ButtonBase {...action} text="Start Organization" className="blue" />
      </div>
    </div>
  );
};

/**
 * OrganizationContext provides:
 * - Gateway hostname management
 * - Module loading with organization-specific config
 * - ModuleProvider for child components
 */
export const OrganizationContext = ({
  organization_id,
  project_id,
  children,
}: {
  organization_id: string;
  project_id?: string;
  children: ReactNode;
}) => {
  const { ganymedeApi } = useApi();
  const { status: gatewayStatus, data: gatewayData } =
    useQueryOrganizationGateway(organization_id);

  const gateway_hostname = gatewayData?.gateway_hostname || null;

  // Set gateway hostname on GanymedeApi when available
  useEffect(() => {
    if (gateway_hostname) {
      ganymedeApi.setGatewayHostname(organization_id, gateway_hostname);
    }
  }, [gateway_hostname, organization_id, ganymedeApi]);

  // Load modules when gateway is available
  const moduleExports = useMemo(() => {
    if (!gateway_hostname) return {};

    const gatewayFetch = createGatewayFetch(ganymedeApi, gateway_hostname);

    const modules = getModulesFrontend({
      fetch: gatewayFetch,
      gateway_hostname,
      project_id,
      ganymedeApi,
    });

    return loadModules(modules);
  }, [gateway_hostname, ganymedeApi, project_id]);

  // Show loading state
  if (gatewayStatus === 'pending') {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: 'calc(100vh - 80px)' }}
      >
        <InfoCircledIcon style={{ width: '38px', height: '38px' }} />
        <p style={{ fontSize: 'var(--font-size-lg)' }}>
          Loading gateway information...
        </p>
      </div>
    );
  }

  // Show UI if gateway is not available
  if (!gateway_hostname) {
    return <StartOrganizationBox organization_id={organization_id} />;
  }

  return <ModuleProvider exports={moduleExports}>{children}</ModuleProvider>;
};
