import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { SharedTypes } from '@holistix-forge/collab-engine';
import { EPriority, Logger } from '@holistix-forge/log';
import { TCoreSharedData } from '@holistix-forge/core-graph';
import {
  TWhiteboardSharedData,
  defaultGraphView,
} from '@holistix-forge/whiteboard';
import {
  STORY_VIEW_ID,
  StoryWhiteboard,
} from '@holistix-forge/whiteboard/stories';
import { StoryApiContext } from '@holistix-forge/frontend-data';
import {
  TCollabBackendExports,
  createLocalCollabRegistry,
} from '@holistix-forge/collab';

//
import { loadModules, TModule } from '@holistix-forge/module';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@holistix-forge/core-graph';
import { moduleBackend as collabBackend } from '@holistix-forge/collab';
import {
  moduleFrontend as collabFrontend,
  CollabProjectProvider,
} from '@holistix-forge/collab/frontend';
import {
  moduleBackend as reducersBackend,
  TReducersBackendExports,
} from '@holistix-forge/reducers';
import {
  moduleFrontend as reducersFrontend,
  linkDispatchToProcessEvent,
  TReducersFrontendExports,
} from '@holistix-forge/reducers/frontend';
import { moduleBackend as spaceBackend } from '@holistix-forge/whiteboard';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/whiteboard/frontend';
//
import { moduleBackend as socialsBackend } from '../';
import { moduleFrontend as socialsFrontend } from '../frontend';

//

Logger.setPriority(EPriority.Debug);

const collabConfig = {
  type: 'none' as const,
  room_id: 'whiteboard-story',
  simulateUsers: true,
  user: { user_id: 'story-user', username: 'test', color: 'red' },
};

// The frontend collab module takes the registry config; the backend still takes
// the plain one. Wrapping rather than replacing keeps both honest, and the
// factory hands back the same local document for every project — a story has
// exactly one.
const collabFrontendConfig = {
  type: 'registry' as const,
  createConfigForProject: () => collabConfig,
};

// The backend collab module re-exports whatever registry it is handed, and
// core-graph reads it during its own load. Handing it nothing is what killed
// these stories.
const collabBackendConfig = {
  registry: createLocalCollabRegistry(collabConfig),
};

const modulesBackend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabBackend,
    config: collabBackendConfig,
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
          collab: TCollabBackendExports;
        };
      }) => {
        const collab =
          depsExports.collab.registry.getCollabForProject('story-project');
        loadStoryData(
          collab.sharedData as TWhiteboardSharedData & TCoreSharedData,
          collab.sharedTypes
        );
      },
    },
    config: {},
  },
];

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabFrontendConfig,
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
  sd: TWhiteboardSharedData & TCoreSharedData,
  sharedTypes: SharedTypes
) => {
  sharedTypes.transaction(async () => {
    const graphViews = sd['whiteboard:graphViews'];
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
        // A page served from the story itself, not google.com. Google sets
        // X-Frame-Options, so the browser refused the frame and the story
        // showed an error where the iframe node should be — and it needed the
        // network to show even that.
        src:
          'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            '<body style="margin:0;background:#1c1c3d;color:#fff;' +
              'font:14px system-ui;display:flex;align-items:center;' +
              'justify-content:center;height:100%">Framed page</body>'
          ),
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
      <CollabProjectProvider project_id="story-project">
        <ModuleProvider exports={frontendModules}>
          <div style={{ height: '100vh', width: '100vw' }}>
            <StoryWhiteboard />
          </div>
        </ModuleProvider>
      </CollabProjectProvider>
    </StoryApiContext>
  );
};

//

const meta = {
  title: 'Modules/Socials/Views/Main',
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
