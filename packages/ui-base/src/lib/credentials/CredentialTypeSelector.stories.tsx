import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import {
  CredentialTypeSelector,
  CredentialTypeSelectorProps,
} from './CredentialTypeSelector';
import { mockCredentialTypes } from './credentials-mocks';

import './credentials.scss';

/**
 * The selector is controlled — the wrapper keeps the selection local so the
 * story stays interactive in the Storybook canvas.
 */
const Wrap = ({
  selectedType: initial,
  ...props
}: CredentialTypeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<string | null>(initial);
  return (
    <div style={{ width: '560px' }}>
      <CredentialTypeSelector
        {...props}
        selectedType={selectedType}
        onSelect={setSelectedType}
      />
    </div>
  );
};

const meta = {
  title: 'Base/Resource/Credentials/CredentialTypeSelector',
  component: Wrap,
  parameters: { layout: 'centered' },
  args: {
    types: mockCredentialTypes,
    selectedType: null,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof Wrap>;

export default meta;

type Story = StoryObj<typeof Wrap>;

export const Normal: Story = {};

export const WithSelection: Story = {
  args: {
    selectedType: 'github_token',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

/** No credential type registered on the backend. */
export const Empty: Story = {
  args: {
    types: [],
  },
};
