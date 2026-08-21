import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Utilities that outlived Tailwind.
 *
 * Tailwind was removed in aeeaeba5 and only its utilities were reimplemented,
 * by hand, in `utilities.scss`. Anything the codebase still asks for that did
 * not make that list is now a decorative string: the class name is in the
 * markup, no rule matches it, and the element renders unstyled while every
 * review reads it as handled. `status-led` spent that whole period asking for
 * `animate-ping` — so the LED that is meant to pulse sat perfectly still, and
 * a live container looked like a stopped one in a different colour.
 *
 * A render test cannot catch this: the class is on the element either way.
 * Only the stylesheet can be asked.
 */

const utilities = readFileSync(join(__dirname, 'utilities.scss'), 'utf8');

describe('utilities.scss — classes the codebase still asks for', () => {
  it('should define the ping animation status-led is built around', () => {
    expect(utilities).toMatch(/^\.animate-ping\s*\{/m);
  });

  it('should carry the keyframes that animation names', () => {
    // Declaring the class without the keyframes is the same silence in a
    // different place: the animation resolves to nothing and never runs.
    expect(utilities).toMatch(/@keyframes\s+ping\s*\{/);
  });

  it('should pulse the way the live and host rings already pulse', () => {
    // `user-bubble.scss` animates those with the same curve and duration. Two
    // pulses that nearly match read as a rendering fault, not as a rhythm.
    expect(utilities).toMatch(
      /animation:\s*ping 1s cubic-bezier\(0, 0, 0\.2, 1\) infinite/
    );
  });
});
