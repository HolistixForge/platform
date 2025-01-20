import type { Meta, StoryObj } from '@storybook/react';

import { icons } from './icons';
import { CSSProperties, FC, HTMLAttributes } from 'react';

const s1 = {
  width: '120px',
  height: '120px',
  border: 'solid 1px var(--c-gray-9)',
  display: 'flex' /* Use flexbox for centering */,
  justifyContent: 'center' /* Center horizontally */,
  alignItems: 'center' /* Center vertically */,
  position: 'relative',
  backgroundColor: 'var(--ca-white-1)',
} as CSSProperties;

const s3 = {
  position: 'absolute',
  bottom: '-3px',
  left: 0,
  fontSize: '11px',
  color: 'var(--c-white-1)',
} as CSSProperties;

const AllIcon = () => {
  return (
    <div
      style={{
        width: '850px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '15px',
      }}
    >
      {Object.keys(icons).map((k) => {
        const Icon = (
          icons as { [key: string]: FC<HTMLAttributes<SVGElement>> }
        )[k];
        return (
          <div key={k} style={s1}>
            <Icon
              style={{
                fill:
                  k === 'Reply' || k === 'Branch'
                    ? 'var(--c-white-1)'
                    : undefined,
                width: '100px',
                height: '100px',
                border: 'dashed 1px red',
              }}
            />
            <span style={s3}>{k}</span>
          </div>
        );
      })}
    </div>
  );
};

const meta = {
  title: 'icons/all',
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
