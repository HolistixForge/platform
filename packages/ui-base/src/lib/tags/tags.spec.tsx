import { render, act } from '@testing-library/react';
import { useState } from 'react';

import { TagsBar } from './tags';

// TagsBar's layout effect resets both tag lists every time it runs, so it must
// not run on a render that changed nothing. It used to depend on the `tags`
// array itself — and every caller builds that array inline
// (`resource-list.tsx`, `server-card.tsx`), so its identity is new on each
// render of the *parent*. Each parent render therefore restarted the whole
// measure-and-slice cascade.
//
// Reproducing that needs a parent that re-renders: TagsBar alone cannot show
// the defect, because its own setState re-renders only itself and leaves the
// `tags` prop referentially identical. A test that renders <TagsBar/> directly
// passes against both versions of the component and asserts nothing.
//
// The observable is the effect's own requestAnimationFrame. One cascade emits
// a bounded handful; one cascade per parent render grows with them.

const TAGS = [
  { text: 'Boosting', color: '#45AFDD' },
  { text: 'Prediction', color: '#F72585' },
];

describe('TagsBar', () => {
  it('does not restart its cascade when a parent re-renders with equal tags', async () => {
    const real = window.requestAnimationFrame;
    let frames = 0;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      frames++;
      return real(cb);
    };

    let rerender: (n: number) => void = () => undefined;
    const Parent = () => {
      const [, setN] = useState(0);
      rerender = setN;
      // A fresh array literal on every render, with unchanging contents —
      // what the real callers pass.
      return <TagsBar tags={TAGS.map((t) => ({ ...t }))} />;
    };

    try {
      render(<Parent />);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const afterMount = frames;

      // Six parent renders whose tag contents never change.
      for (let i = 1; i <= 6; i++) {
        await act(async () => {
          rerender(i);
          await new Promise((resolve) => setTimeout(resolve, 30));
        });
      }
      const afterRerenders = frames - afterMount;

      // Equal contents must cost nothing. Depending on the array reference
      // instead replayed the cascade once per parent render.
      expect(afterRerenders).toBe(0);
      expect(afterMount).toBeLessThan(20);
    } finally {
      window.requestAnimationFrame = real;
    }
  });
});

// Not covered here: which tags end up visible versus folded into the overflow
// menu. That branch reads `clientWidth`, which jsdom always reports as 0, so
// every tag measures as overflowing and the assertion would be about jsdom
// rather than about TagsBar. It belongs in the Storybook screenshot suite,
// where a real engine lays the row out.
