import { SharedMap } from '@holistix-forge/collab-engine';

export type TGatewayMeta = {
  projectActivity: {
    last_activity: string;
    gateway_shutdown: string;
    disable_gateway_shutdown: boolean;
  };
};

export type TGatewaySharedData = {
  'gateway:gateway': SharedMap<TGatewayMeta>;
};
