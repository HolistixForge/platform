import { ReactNode, useMemo, useEffect } from 'react';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { useApi, useQueryOrganizationGateway } from '@holistix/frontend-data';
import { ModuleProvider } from '@holistix/module/frontend';
import { loadModules } from '@holistix/module';
import { getModulesFrontend } from './modules';
import { createGatewayFetch } from './gateway-fetch';

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
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
        <InfoCircledIcon className="w-[38px] h-[38px]" />
        <p className="text-lg">
          Gateway is not available. Start a project to continue.
        </p>
      </div>
    );
  }

  return <ModuleProvider exports={moduleExports}>{children}</ModuleProvider>;
};
