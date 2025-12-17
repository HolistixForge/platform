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
    <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
      <div className="flex flex-col items-center gap-2 text-slate-400 text-center">
        <InfoCircledIcon className="w-[38px] h-[38px]" />
        <p className="text-lg">
          Organization has been shut down due to inactivity.
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Click the button below to allocate a gateway and start the
          organization.
        </p>
      </div>
      <div className="flex items-center gap-2 text-slate-400 mt-5">
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
  children,
}: {
  organization_id: string;
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
    });

    return loadModules(modules);
  }, [gateway_hostname, ganymedeApi]);

  // Show loading state
  if (gatewayStatus === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
        <InfoCircledIcon className="w-[38px] h-[38px]" />
        <p className="text-lg">Loading gateway information...</p>
      </div>
    );
  }

  // Show UI if gateway is not available
  if (!gateway_hostname) {
    return <StartOrganizationBox organization_id={organization_id} />;
  }

  return <ModuleProvider exports={moduleExports}>{children}</ModuleProvider>;
};
