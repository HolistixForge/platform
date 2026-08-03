import type { Meta, StoryObj } from '@storybook/react';
import { expect } from '@storybook/test';

/**
 * Bare, unstyled form controls.
 *
 * Nothing here carries a class on purpose: the point is to show what the
 * elements look like with only `reset.scss` applied. When Tailwind was removed
 * in aeeaeba5 its preflight went with it, and every one of these fell back to
 * User-Agent styling — a beveled `2px outset` box with a black label — which
 * is what put grey squares around "Copy", "New Tab" and the card kebab menus
 * all over the app.
 */
const BareControls = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '24px',
      fontSize: 'var(--font-size-lg)',
      color: 'var(--white)',
    }}
  >
    <button>Bare button</button>
    <input defaultValue="Bare input" />
    <select>
      <option>Bare select</option>
    </select>
    <textarea defaultValue="Bare textarea" rows={1} />
  </div>
);

const meta = {
  title: 'Basics/Reset',
  component: BareControls,
} satisfies Meta<typeof BareControls>;

export default meta;

type Story = StoryObj<typeof BareControls>;

const UA_BEVELS = ['outset', 'inset', 'groove', 'ridge'];

export const FormControls: Story = {
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector('div');
    if (!row) throw new Error('story did not render');
    const inherited = getComputedStyle(row);

    const controls = canvasElement.querySelectorAll<HTMLElement>(
      'button, input, select, textarea'
    );
    expect(controls.length).toBe(4);

    for (const control of Array.from(controls)) {
      const style = getComputedStyle(control);

      // The bevel is the visible symptom — a raised grey square.
      expect(UA_BEVELS).not.toContain(style.borderTopStyle);
      expect(style.borderTopWidth).toBe('0px');

      // ButtonFace / ButtonText: a light box with an unreadable dark label.
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(style.color).toBe(inherited.color);

      // UA controls opt out of the document's type scale (13.33px in Chrome).
      expect(style.fontSize).toBe(inherited.fontSize);
    }
  },
};
