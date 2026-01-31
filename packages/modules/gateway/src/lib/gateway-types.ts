import { SharedMap } from '@holistix-forge/collab-engine';

export type TGatewayMeta = {
  projectActivity: {
    last_activity: string;
    project_cleanup_time: string;
    disable_project_cleanup: boolean;
  };
};

export type TGatewaySharedData = {
  'gateway:gateway': SharedMap<TGatewayMeta>;
};
