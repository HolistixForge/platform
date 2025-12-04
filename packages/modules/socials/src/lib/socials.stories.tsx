import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { SharedTypes } from '@holistix-forge/collab-engine';
import { EPriority, Logger } from '@holistix-forge/log';
import { TCoreSharedData } from '@holistix-forge/core-graph';
import { TSpaceSharedData, defaultGraphView } from '@holistix-forge/space';
import { STORY_VIEW_ID, StoryDemiurgeSpace } from '@holistix-forge/space/stories';
import { StoryApiContext } from '@holistix-forge/frontend-data';
import { TCollabBackendExports } from '@holistix-forge/collab';

//
import { loadModules, TModule } from '@holistix-forge/module';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@holistix-forge/core-graph';
import { moduleBackend as collabBackend } from '@holistix-forge/collab';
import { moduleFrontend as collabFrontend } from '@holistix-forge/collab/frontend';
import {
  moduleBackend as reducersBackend,
  TReducersBackendExports,
} from '@holistix-forge/reducers';
import {
  moduleFrontend as reducersFrontend,
  linkDispatchToProcessEvent,
  TReducersFrontendExports,
} from '@holistix-forge/reducers/frontend';
import { moduleBackend as spaceBackend } from '@holistix-forge/space';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/space/frontend';
//
import { moduleBackend as socialsBackend } from '../';
import { moduleFrontend as socialsFrontend } from '../frontend';

//

Logger.setPriority(EPriority.Debug);

const collabConfig = {
  type: 'none',
  room_id: 'space-story',
  simulateUsers: true,
  user: { username: 'test', color: 'red' },
};

const modulesBackend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabBackend,
    config: collabConfig,
  },
  { module: reducersBackend, config: {} },
  {
    module: {
      name: 'gateway',
      version: '0.0.1',
      description: 'Gateway module',
      dependencies: ['collab', 'reducers'],
      load: ({ moduleExports }) => {
        moduleExports({ project_id: 'test' });
      },
    },
    config: {},
  },
  { module: coreBackend, config: {} },
  {
    module: {
      name: 'gateway',
      version: '0.0.1',
      description: 'Gateway module',
      dependencies: ['collab', 'reducers'],
      load: () => {
        //
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  { module: socialsBackend, config: {} },
  {
    module: {
      name: 'story-init',
      version: '0.0.1',
      description: 'Story init module',
      dependencies: ['collab'],
      load: ({
        depsExports,
      }: {
        depsExports: {
          collab: TCollabBackendExports<TSpaceSharedData & TCoreSharedData>;
        };
      }) => {
        loadStoryData(
          depsExports.collab.collab.sharedData,
          depsExports.collab.collab.sharedTypes
        );
      },
    },
    config: {},
  },
];

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabConfig,
  },
  { module: reducersFrontend, config: {} },
  {
    module: {
      name: 'gateway',
      version: '0.0.1',
      description: 'Gateway module',
      dependencies: [],
      load: () => {
        //
      },
    },
    config: {},
  },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  { module: socialsFrontend, config: {} },
];

const loadStoryData = (
  sd: TSpaceSharedData & TCoreSharedData,
  sharedTypes: SharedTypes
) => {
  sharedTypes.transaction(async () => {
    const graphViews = sd['space:graphViews'];
    const gv = defaultGraphView();

    sd['core-graph:nodes'].set('node-1', {
      id: 'node-1',
      type: 'youtube',
      data: {
        youtubeId: 'y6120QOlsfU',
      },
      name: 'Node 1',
      root: true,
      connectors: [],
    });

    sd['core-graph:nodes'].set('node-2', {
      id: 'node-2',
      type: 'text-editor',
      data: {},
      name: 'Node 2',
      root: true,
      connectors: [],
    });

    sd['core-graph:nodes'].set('node-3', {
      id: 'node-3',
      type: 'iframe',
      data: {
        src: 'https://www.demiurge.co',
      },
      name: 'Node 3',
      root: true,
      connectors: [],
    });

    //

    gv.graph.nodes.push({
      id: 'node-2',
      type: 'text-editor',
      position: {
        x: 0,
        y: 0,
      },
      size: {
        width: 400,
        height: 300,
      },
      status: {
        mode: 'EXPANDED',
        forceOpened: true,
        forceClosed: false,
        isFiltered: false,
        rank: 0,
        maxRank: 0,
      },
    });

    gv.graph.nodes.push({
      id: 'node-1',
      type: 'youtube',
      position: {
        x: 500,
        y: 500,
      },
      size: {
        width: 400,
        height: 300,
      },
      status: {
        mode: 'EXPANDED',
        forceOpened: true,
        forceClosed: false,
        isFiltered: false,
        rank: 0,
        maxRank: 0,
      },
    });

    gv.graph.nodes.push({
      id: 'node-3',
      type: 'iframe',
      position: {
        x: -100,
        y: 600,
      },
      size: {
        width: 400,
        height: 300,
      },
      status: {
        mode: 'EXPANDED',
        forceOpened: true,
        forceClosed: false,
        isFiltered: false,
        rank: 0,
        maxRank: 0,
      },
    });

    graphViews.set(STORY_VIEW_ID, gv);
  });
};

//

const Story = () => {
  const { frontendModules } = useMemo(() => {
    const backendModules = loadModules(modulesBackend);
    const frontendModules = loadModules(modulesFrontend);

    linkDispatchToProcessEvent(
      backendModules as { reducers: TReducersBackendExports },
      frontendModules as { reducers: TReducersFrontendExports }
    );

    return { backendModules, frontendModules };
  }, []);

  return (
    <StoryApiContext>
      <ModuleProvider exports={frontendModules}>
        <div style={{ height: '100vh', width: '100vw' }}>
          <StoryDemiurgeSpace />
        </div>
      </ModuleProvider>
    </StoryApiContext>
  );
};

//

const meta = {
  title: 'Modules/Socials/Main',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof Story>;

export default meta;

export const Default: StoryObj<typeof Story> = {
  args: {},
};
