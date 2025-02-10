import type { Meta, StoryObj } from '@storybook/react';
import { useMemo } from 'react';

import {
  CollaborativeContext,
  TCollaborativeChunk,
  TValidSharedData,
  SharedTypes,
  useSharedData,
  useDispatcher,
  Dispatcher,
  SharedMap,
} from '@monorepo/collab-engine';
import { Logger } from '@monorepo/log';

import { SpaceReducer, defaultGraphView } from '../../space-reducer';
import { Space_loadData, TSpaceSharedData } from '../../space-shared-model';
import { TSpaceEvent } from '../../space-events';
import { TGraphView } from '../../space-types';
import { graph1 } from '../local-test/graphs-data/graph-1';

//

Logger.setPriority(7);

//

const loadStoryData = (sd: TSpaceSharedData) => {
  const graphViews = sd.graphViews;
  const g: TGraphView = defaultGraphView();
  g.graph.nodes = graph1.nodes;
  g.graph.edges = graph1.edges;
  graphViews.set('graph-1', g);
};

//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => {
      const sd = Space_loadData(st);
      loadStoryData(sd);
      return sd;
    },
    reducers: (sd: TValidSharedData) => [new SpaceReducer()],
  },
];

//

const StoryWrapper = () => {
  const dispatcher = useMemo(() => {
    return new Dispatcher({});
  }, []);

  return (
    <CollaborativeContext
      id={'story'}
      collabChunks={chunks}
      config={{
        type: 'none',
      }}
      dispatcher={dispatcher}
      user={{
        username: 'John Doe',
        color: '#ffa500',
      }}
    >
      <Space />
    </CollaborativeContext>
  );
};

//

const Space = () => {
  const graphViews: SharedMap<TGraphView> = useSharedData<TSpaceSharedData>(
    ['graphViews'],
    (sd) => sd.graphViews
  );
  const dispatcher = useDispatcher<TSpaceEvent>();

  return <div></div>;
};

//

const meta = {
  title: 'Modules/Space/Demo',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Default: Story = {
  args: {},
};
