import { ButtonBase, ButtonBaseProps } from './buttonBase';
import type { Meta, StoryObj } from '@storybook/react';
import { useAction } from './useAction';
import { CopyIcon, PlusCircledIcon } from '@radix-ui/react-icons';

const ButtonWrap = (props: Partial<ButtonBaseProps>) => {
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

  return (
    <ButtonBase {...action} {...props}>
      {props.text || props.Icon ? null : 'Lorem'}
    </ButtonBase>
  );
};

const buttonStyle: (Partial<ButtonBaseProps> & { storyName: string })[] = [
  { storyName: 'normal' },
  { storyName: 'red', className: 'red' },
  { storyName: 'blue', className: 'blue' },
  { storyName: 'submit', className: 'submit' },
];

const buttonVariants: (Partial<ButtonBaseProps> & { storyName: string })[] = [
  { storyName: 'small', className: 'small' },
  { storyName: 'hover', className: 'testhover' },
  { storyName: 'disabled', disabled: true },
  {
    storyName: 'tooltip',

    _testTooltip: true,
  },
  {
    storyName: 'success',
    successMessage: (
      <span>
        Copied to clipboard <CopyIcon />
      </span>
    ),
    _testTooltip: true,
  },
  {
    storyName: 'loading',
    loading: true,
  },
  {
    storyName: 'errors',
    errors: {
      global: 'Error: lorem ipsum dolor sit amet consectetur adispicing elit',
    },
  },
  {
    storyName: 'text icon',
    Icon: PlusCircledIcon,
    text: 'Add',
  },
  {
    storyName: 'icon',
    Icon: PlusCircledIcon,
  },
];

//
const columnWidth = '160px';
const lineHeight = '130px';

const Story = () => (
  <table style={{ width: '100%', textAlign: 'center' }}>
    <thead>
      <tr>
        <th style={{ width: columnWidth, textAlign: 'center' }}></th>
        {buttonVariants.map((variant) => (
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
      {buttonStyle.map((style) => (
        <tr
          key={style.storyName}
          style={{ height: lineHeight, textAlign: 'center' }}
        >
          <td
            style={{
              width: columnWidth,
              height: lineHeight,
              textAlign: 'center',
            }}
          >
            {style.storyName}
          </td>
          {buttonVariants.map((variant) => (
            <td
              key={`${style.storyName}_${variant.storyName}`}
              style={{
                width: columnWidth,
                height: lineHeight,
                textAlign: 'center',
              }}
            >
              <ButtonWrap
                {...variant}
                {...style}
                className={`${style.className || ''} ${variant.className || ''}`}
              />
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
  title: 'Basics/Buttons',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Story>;

export const Primary: Story = {
  args: {},
};
