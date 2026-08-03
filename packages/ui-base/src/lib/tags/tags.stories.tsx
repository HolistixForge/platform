import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Tag, TagsBar, TagsBarProps } from './tags';

/** Fixed colors — `randomColor()` would make the snapshots flaky. */
const baseTags: Tag[] = [
  { text: 'python', color: '#7AC0FF' },
  { text: 'dataset', color: '#FFB86C' },
  { text: 'ml', color: '#A5F3B0' },
];

const manyTags: Tag[] = [
  ...baseTags,
  { text: 'production', color: '#FF7AC0' },
  { text: 'archived', color: '#C0A5FF' },
  { text: 'needs-review', color: '#FFE066' },
  { text: 'experimental', color: '#7AFFE0' },
];

/** `TagsBar` is uncontrolled from the outside: keep the list in the story. */
const Wrap = ({
  tags: initial = [],
  editable,
}: TagsBarProps & { editable?: boolean }) => {
  const [tags, setTags] = useState<Tag[]>(initial);

  const props: TagsBarProps = {
    tags,
    addTag: (tag) => setTags((prev) => [...prev, tag]),
  };

  if (editable) {
    props.editTag = (index, newText) =>
      setTags((prev) =>
        prev.map((t, i) => (i === index ? { ...t, text: newText } : t))
      );
  }

  return (
    <div style={{ width: '320px' }}>
      <TagsBar {...props} />
    </div>
  );
};

const meta = {
  title: 'Basics/Tags',
  component: Wrap,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Wrap>;

export default meta;

type Story = StoryObj<typeof Wrap>;

export const Normal: Story = {
  args: { tags: baseTags },
};

/** No tag yet: only the `+` button is shown. */
export const Empty: Story = {
  args: { tags: [] },
};

/** Click a tag to rename it inline. */
export const Editable: Story = {
  args: { tags: baseTags, editable: true },
};

/** More tags than the bar can fit — the overflow collapses behind `...`. */
export const Overflowing: Story = {
  args: { tags: manyTags },
};
