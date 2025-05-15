import type { Meta, StoryObj } from '@storybook/react';

import { useTestBoolean } from '@monorepo/ui-base';
import { sleep } from '@monorepo/simple-types';
import { MockSpace } from '@monorepo/space/frontend';
import { nodeViewDefaultStatus } from '@monorepo/space';

import { NodeYoutubeInternal, NodeYoutubeInternalProps } from './node-video';

//

const Youtube = ({ data }: { data: { videoId: string } }) => {
  const { videoId } = data;

  const src = `https://www.youtube.com/embed/${videoId}`;

  return (
    <div style={{ height: '100%' }}>
      <iframe
        style={{ width: '100%', height: '100%' }}
        src={src}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
};

//
//

const StoryWrapper = (
  props: Pick<NodeYoutubeInternalProps, 'id' | 'youtubeId' | 'filterOut'> & {
    expanded: boolean;
    selected: boolean;
  }
) => {
  //
  const { is: isOpened, set: open, unset: close } = useTestBoolean(true);
  const {
    is: isExpanded,
    set: expand,
    unset: reduce,
  } = useTestBoolean(props.expanded);

  return (
    <MockSpace selected={props.selected} isOpened={isOpened}>
      <NodeYoutubeInternal
        expand={expand}
        reduce={reduce}
        viewStatus={{
          ...nodeViewDefaultStatus(),
          mode: isExpanded ? 'EXPANDED' : 'REDUCED',
        }}
        Youtube={Youtube}
        onDelete={() => sleep()}
        isOpened={isOpened}
        open={open}
        close={close}
        {...props}
      />
    </MockSpace>
  );
};

//
//

const meta = {
  title: 'Nodes/Video',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
    color: {
      control: {
        type: 'color',
      },
    },
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Primary: Story = {
  args: {
    id: 'node-1',
    youtubeId: 'P8JEm4d6Wu4',
    selected: true,
    expanded: true,
  },
};
