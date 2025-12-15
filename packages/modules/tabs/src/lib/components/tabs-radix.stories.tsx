import type { Meta, StoryObj } from '@storybook/react';

import { PanelProps } from './tabs-radix';
import { TabsRadixLogic } from './tabs-radix-logic';
import { FC } from 'react';
import { TreeElement } from '../tree';

//
//

type Payload = { type: string };

const TestPanel: FC<PanelProps & Payload> = ({ tabPath, type }) => {
  return `${type} ${tabPath.join(' --- ')}`;
};

//
//

const tabsTree: TreeElement<Payload> = {
  payload: { type: 'group' },
  title: 'root',
  children: [
    {
      title: 'a',
      payload: { type: 'group' },
      children: [
        {
          title: 'a-a',
          payload: { type: 'group' },
          children: [
            { title: 'a-a-a', payload: { type: 'view' }, children: [] },
          ],
        },
        {
          title: 'a-b',
          payload: { type: 'group' },
          children: [
            { title: 'a-b-a', payload: { type: 'view' }, children: [] },
          ],
        },
        {
          title: 'a-c',
          payload: { type: 'group' },
          children: [
            { title: 'a-c-a', payload: { type: 'view' }, children: [] },
          ],
        },
      ],
    },
    {
      title: 'b',
      payload: { type: 'group' },
      children: [
        {
          title: 'b-a',
          payload: { type: 'group' },
          children: [
            { title: 'b-a-a', payload: { type: 'view' }, children: [] },
          ],
        },
      ],
    },
  ],
};

const overflowTree: TreeElement<Payload> = {
  payload: { type: 'group' },
  title: 'root',
  children: Array.from({ length: 18 }).map((_, i) => ({
    title: `tab-${i + 1}-very-long-name`,
    payload: { type: 'group' },
    children: [
      { title: `panel-${i + 1}`, payload: { type: 'view' }, children: [] },
    ],
  })),
};

//
//

const StoryWrapper = () => {
  const newTab = (): Payload => ({ type: 'view' });
  const newGroup = (): Payload => ({ type: 'group' });

  return (
    <div style={{ width: '600px', height: '400px' }}>
      <TabsRadixLogic<Payload>
        initialTree={tabsTree}
        PanelComponent={TestPanel}
        newTabPayload={newTab}
        convertToGroupPayload={newGroup}
        maxRow={5}
      />
    </div>
  );
};

const MobileOverflowWrapper = () => {
  const newTab = (): Payload => ({ type: 'view' });
  const newGroup = (): Payload => ({ type: 'group' });

  return (
    <div style={{ width: '320px', height: '400px' }}>
      <TabsRadixLogic<Payload>
        initialTree={overflowTree}
        PanelComponent={TestPanel}
        newTabPayload={newTab}
        convertToGroupPayload={newGroup}
        maxRow={2}
      />
    </div>
  );
};

//
//

const meta = {
  title: 'Modules/Tabs/Components/Tabs',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

//

export default meta;

//

type Story = StoryObj<typeof StoryWrapper>;

//

export const Normal: Story = {
  args: {},
};

export const MobileOverflow: Story = {
  render: () => <MobileOverflowWrapper />,
};
