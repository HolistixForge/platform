import { TApi_Project } from '@holistix/types';

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
      organization_id: string;
    }
  | {
      status: 'ready';
      data: ProjectData;
    };

export type ProjectData = {
  project: TApi_Project;
  organization_id: string;
  isOwner: boolean;
};

export type ProjectUser = {
  username: string;
  color: string;
  user_id: string;
};
