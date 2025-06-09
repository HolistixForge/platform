import { TApi_Project } from '@monorepo/demiurge-types';
import { FrontendDispatcher, TYjsCollabConfig } from '@monorepo/collab-engine';
import { TJsonObject } from '@monorepo/simple-types';

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
  dispatcher: FrontendDispatcher<TJsonObject>;
  isOwner: boolean;
};

export type ProjectUser = {
  username: string;
  color: string;
  user_id: string;
};
