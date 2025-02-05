import type { Meta, StoryObj } from '@storybook/react';
import { useAction } from './useAction';
import { CopyIcon } from '@radix-ui/react-icons';
import { ResourceButtons, ResourceButtonsProps } from './resource-buttons';

//

const ButtonWrap = (
  props: ResourceButtonsProps & {
    storyName: string;
    hover?: boolean;
  },
) => {
  const action = useAction(
    () => {
      return new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          if (Math.random() > 0.5) reject(new Error('Lorem ipsum dolor sit'));
          else resolve();
        }, 2000);
      });
    },
    [],
    {
      tooltip: <span>Do something</span>,
      errorLatchTime: 5000,
      successMessage: (
        <span>
          Copied to clipboard <CopyIcon />
        </span>
      ),
    },
  );

  return <ResourceButtons {...action} {...props} />;
};

//

const types: ResourceButtonsProps['type'][] = [
  'play',
  'stop',
  'pause',
  'enter',
  'host',
  'cloud',
  'share',
  'docker',
  'delete',
];

const variants: (Partial<ResourceButtonsProps> & {
  storyName: string;
  hover?: boolean;
})[] = [
  { storyName: 'normal' },
  { storyName: 'hover', hover: true },
  { storyName: 'disabled', disabled: true },
  { storyName: 'loading', loading: true },
  //
  { storyName: 'small', size: 'small' },
  { storyName: 'small hover', size: 'small', hover: true },
  { storyName: 'small disabled', size: 'small', disabled: true },
  { storyName: 'small loading', size: 'small', loading: true },
];

//
const columnWidth = '160px';
const lineHeight = '130px';

const Story = () => (
  <table style={{ width: '100%', textAlign: 'center' }}>
    <thead>
      <tr>
        <th style={{ width: columnWidth, textAlign: 'center' }}></th>
        {variants.map((variant) => (
          <th
            key={variant.storyName}
            style={{ width: columnWidth, textAlign: 'center' }}
          >
            {variant.storyName}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {types.map((type) => (
        <tr key={type} style={{ height: lineHeight, textAlign: 'center' }}>
          <td
            style={{
              width: columnWidth,
              height: lineHeight,
              textAlign: 'center',
            }}
          >
            {type}
          </td>
          {variants.map((variant) => (
            <td
              key={`${type}_${variant.storyName}`}
              style={{
                width: columnWidth,
                height: lineHeight,
                textAlign: 'center',
              }}
            >
              <ButtonWrap type={type} {...variant} hover={variant.hover} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

//

const meta: Meta<typeof Story> = {
  component: Story,
  title: 'Basics/ResourceButtons',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Story>;

export const Primary: Story = {
  args: {},
};
