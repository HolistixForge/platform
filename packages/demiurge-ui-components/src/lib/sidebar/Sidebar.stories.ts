import type { Meta, StoryObj } from '@storybook/react';

import { Sidebar } from './Sidebar';
import { icons } from '../assets/icons';

const meta = {
  title: 'UI/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof Sidebar>;

export const Normal: Story = {
  args: {
    items: [
      { title: 'planet', Icon: icons.Planet },
      { title: 'solar system', Icon: icons.SolarSystem },
      { title: 'galaxy', Icon: icons.Galaxy },
      { title: 'notetook', Icon: icons.NodeMother },
      { title: 'tree', Icon: icons.Tree },
      { title: 'biome', Icon: icons.Biome },
      { title: 'seed', Icon: icons.Seed },
      { title: 'artefact', Icon: icons.Artefact },
      { title: 'agora', Icon: icons.Agora },
      { title: 'authorizations', Icon: icons.Key },
    ],
  },
};
