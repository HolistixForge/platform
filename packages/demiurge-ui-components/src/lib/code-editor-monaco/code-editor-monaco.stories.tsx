import type { Meta, StoryObj } from '@storybook/react';

import { editor } from 'monaco-editor';
import {
  CodeEditorMonaco,
  CodeEditorMonacoProps,
} from './code-editor-monaco-lazy';
import { cssVar } from '../css-utils/css-utils';

//

const StoryWrapper = (props: CodeEditorMonacoProps) => {
  return (
    <div style={{ width: '400px', height: '300px' }}>
      <CodeEditorMonaco {...props} />
    </div>
  );
};

//

const meta = {
  title: 'internals/Code Editor',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof CodeEditorMonaco>;

//

export default meta;

//

type Story = StoryObj<typeof CodeEditorMonaco>;

//

const th = (): editor.IStandaloneThemeData => ({
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': cssVar('--c-blue-gray-8'),
  },
});

export const Normal: Story = {
  args: {
    id: '1012482',
    code: 'print("Hello World !")',
    theme: {
      name: 'nimp',
      value: th(),
    },
    language: 'python',
  },
};
