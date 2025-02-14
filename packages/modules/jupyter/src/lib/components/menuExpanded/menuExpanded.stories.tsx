import type { Meta, StoryObj } from '@storybook/react';

import { useTestToolbarButtons } from '@monorepo/space';

import { MenuExpanded, MenuExpandedProps } from './menuExpanded';

//

const StoryWrapper = ({
  isOpened,
  isLocked,
  ...props
}: {
  isOpened: boolean;
  isLocked: boolean;
} & Omit<MenuExpandedProps, 'toolbarButtons'>) => {
  const { buttons } = useTestToolbarButtons(isOpened, isLocked);
  return <MenuExpanded toolbarButtons={buttons} {...props} />;
};

const meta = {
  title: 'Modules/Jupyter/Components/MenuExpanded',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Vault: Story = {
  args: {
    isOpened: false,
    isLocked: false,
    nodeType: 'vault',
    nodeName: 'node_name',
    nodeInfos: ['Lorem ipsum dolor', 'sit amet adispicing'],
    variant: 'default',
  },
};

export const Scene: Story = {
  args: {
    isOpened: false,
    isLocked: false,
    nodeType: 'scene',
    nodeName: 'Node #123456',
    nodeInfos: ['( 2 000 150 , 45 )', '( 2 000 150 , 45 )'],
    variant: 'footer',
  },
};

export const Dataset: Story = {
  args: {
    isOpened: false,
    isLocked: false,
    nodeType: 'dataset',
    nodeName: 'node_name',
    nodeInfos: ['Lorem ipsum dolor', 'sit amet adispicing'],
    variant: 'default',
  },
};

export const Screening: Story = {
  args: {
    isOpened: false,
    isLocked: false,
    nodeType: 'screening',
    nodeName: 'node_name',
    nodeInfos: ['Lorem ipsum dolor', 'sit amet adispicing'],
    variant: 'default',
  },
};
