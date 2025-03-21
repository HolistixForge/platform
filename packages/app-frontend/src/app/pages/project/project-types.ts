import { TApi_Project } from '@monorepo/demiurge-types';
import { TYjsCollabConfig } from '@monorepo/collab-engine';
import { Dispatcher } from '@monorepo/collab-engine';

export type ProjectState =
  | {
      status: 'loading';
      progress: number;
    }
  | {
      status: 'error';
      error: string;
    }
  | {
      status: 'not_started';
      project_id: string;
    }
  | {
      status: 'ready';
      data: ProjectData;
    };

export type ProjectData = {
  project: TApi_Project;
  collabConfig: TYjsCollabConfig;
  yjsDocId: string;
  dispatcher: Dispatcher<any, any>;
  gatewayFQDN: string;
  isOwner: boolean;
};

export type ProjectUser = {
  username: string;
  color: string;
};
