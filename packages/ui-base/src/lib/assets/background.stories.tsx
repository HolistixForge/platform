import type { Meta, StoryObj } from '@storybook/react';
import { CSSProperties } from 'react';

import nodePythonBg from './node-python-bg.svg';
import nodeVaultBg from './node-vault-bg.svg';
import nodeDatasetBg from './node-dataset-bg.svg';
import bgToolbar from './bg-toolbar.svg';
import bgToolbarSecondary from './bg-toolbar-secondary.svg';
import bgToolbarTertiary from './bg-toolbar-tertiary.svg';

const s1 = {
  width: '120px',
  height: '120px',
  border: 'solid 1px var(--neutral-9)',
  position: 'relative',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: '50% 50%',
  backgroundColor: 'var(--alpha-white-10)',
} as CSSProperties;

const s3 = {
  position: 'absolute',
  bottom: '-9px',
  left: 0,
  fontSize: '9px',
  color: 'var(--white)',
} as CSSProperties;

const bgs: { name: string; url: string }[] = [
  { name: 'node-python-bg.svg', url: nodePythonBg },
  { name: 'node-vault-bg.svg', url: nodeVaultBg },
  { name: 'node-dataset-bg.svg', url: nodeDatasetBg },
  { name: 'bg-toolbar.svg', url: bgToolbar },
  { name: 'bg-toolbar-secondary.svg', url: bgToolbarSecondary },
  { name: 'bg-toolbar-tertiary.svg', url: bgToolbarTertiary },
];

const AllIcon = () => {
  return (
    <div
      style={{
        width: '600px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '15px',
      }}
    >
      {bgs.map((bg) => {
        return (
          <div
            key={bg.name}
            style={{
              ...s1,
              backgroundImage: `url('${bg.url}')`,
            }}
          >
            <span style={s3}>{bg.name}</span>
          </div>
        );
      })}
    </div>
  );
};

const meta = {
  title: 'Base/Assets/Background',
  component: AllIcon,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof AllIcon>;

export default meta;

type Story = StoryObj<typeof AllIcon>;

export const Mosaic: Story = {
  args: {},
};
