import type { Meta, StoryObj } from '@storybook/react';
import { CSSProperties } from 'react';

const s1 = {
  width: '120px',
  height: '120px',
  border: 'solid 1px var(--c-gray-9)',
  position: 'relative',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: '50% 50%',
  backgroundColor: 'var(--ca-white-1)',
} as CSSProperties;

const s3 = {
  position: 'absolute',
  bottom: '-9px',
  left: 0,
  fontSize: '9px',
  color: 'var(--c-white-1)',
} as CSSProperties;

const bgs = [
  'node-python-bg.svg',
  'node-vault-bg.svg',
  'node-dataset-bg.svg',
  'bg-toolbar.svg',
  'bg-toolbar-secondary.svg',
  'bg-toolbar-tertiary.svg',
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
      {bgs.map((k) => {
        return (
          <div
            key={k}
            style={{
              ...s1,
              backgroundImage: `url('${k}')`,
            }}
          >
            <span style={s3}>{k}</span>
          </div>
        );
      })}
    </div>
  );
};

const meta = {
  title: 'icons/background',
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
