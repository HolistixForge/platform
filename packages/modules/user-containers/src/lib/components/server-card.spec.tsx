import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { TF_User } from '@holistix-forge/types';

import { UserContainerCardInternal } from './server-card';
import {
  makeStoryArgs,
  runningOnPlatformStory,
  runningOnAppleStory,
  runningOnSharedKernelStory,
  runningLocallyStory,
  StoryArgs,
} from './server-card-stories';

/**
 * The card's box is a set of numbers with a reason, and the reason lives in
 * another package: they are the "add resource" card's dimensions
 * (ui-views/mvp-ui-view/components/server-stack.tsx), which is what this card
 * sits beside in the grid. Nothing links the two files, so the only thing
 * keeping them in step is a test that states the numbers out loud.
 */

const renderCard = () =>
  render(
    <Tooltip.Provider>
      <UserContainerCardInternal {...makeStoryArgs()} runners={new Map()} />
    </Tooltip.Provider>
  );

describe('UserContainerCardInternal — box', () => {
  it('should be as wide as the add-resource card it sits beside', () => {
    // Act
    const { container } = renderCard();

    // Assert - the grid's column arithmetic in server-stack.tsx is written
    // against this 400 as well; changing it here alone miscounts the columns
    expect(container.firstElementChild).toHaveStyle({ width: '400px' });
  });

  it('should be at least as tall as the add-resource card', () => {
    // Act
    const { container } = renderCard();

    // Assert - without a floor, a card with no exposed services was shorter
    // than the dashed card next to it and the row never lined up
    expect(container.firstElementChild).toHaveStyle({ minHeight: '202px' });
  });

  it('should not cap its height', () => {
    // Act
    const { container } = renderCard();

    // Assert - a container exposing several services is taller than 202, and
    // clipping it would hide the links that are the reason to look at the card
    expect((container.firstElementChild as HTMLElement).style.height).toBe('');
    expect((container.firstElementChild as HTMLElement).style.maxHeight).toBe(
      ''
    );
  });

  it('should share the dashed card corner radius', () => {
    // Act
    const { container } = renderCard();

    // Assert
    expect(container.firstElementChild).toHaveStyle({ borderRadius: '8px' });
  });
});

/**
 * What isolated the container, on the card.
 *
 * The broker refuses to start without a stated runtime so that an absent
 * isolation can never be reached by omission. That rule only holds as far as
 * the value travels: two engines now ship with different guarantees, and a
 * card that looks the same either way puts the user back in the dark the rule
 * was written to keep them out of.
 */

const renderWith = (args: StoryArgs) =>
  render(
    <Tooltip.Provider>
      <UserContainerCardInternal {...args} runners={new Map()} />
    </Tooltip.Provider>
  );

describe('UserContainerCardInternal — isolation', () => {
  it('should say the container has its own kernel', () => {
    // Act
    const { getByText } = renderWith(runningOnPlatformStory());

    // Assert
    expect(getByText(/Own kernel/)).toBeInTheDocument();
  });

  it('should name the engine and runtime that ran it', () => {
    // Act - the platform will have two versions, so "platform" is not an answer
    const { getByText } = renderWith(runningOnPlatformStory());

    // Assert
    expect(getByText(/docker · kata/)).toBeInTheDocument();
  });

  it('should say plainly when the host kernel is shared', () => {
    // Act - reachable by stating BROKER_RUNTIME=runc, which is a choice
    const { getByText, queryByText } = renderWith(runningOnSharedKernelStory());

    // Assert
    expect(getByText(/Shares the host kernel/)).toBeInTheDocument();
    expect(queryByText(/Own kernel/)).not.toBeInTheDocument();
  });

  it('should list what a deployment gave up', () => {
    // Act - two microVMs are not the same guarantee, and "own kernel" alone
    // would flatten that difference back out
    const { getByText } = renderWith(runningOnAppleStory());

    // Assert
    expect(getByText(/5 controls given up/)).toBeInTheDocument();
    expect(getByText(/no-new-privileges/)).toBeInTheDocument();
  });

  it('should not claim anything for a runner that reported nothing', () => {
    // Act - a local placement, or a container that has not started. Silence is
    // right: there is no claim to correct
    const { queryByText } = renderWith(makeStoryArgs());

    // Assert
    expect(queryByText(/Own kernel/)).not.toBeInTheDocument();
    expect(queryByText(/Shares the host kernel/)).not.toBeInTheDocument();
    expect(queryByText(/Isolation not reported/)).not.toBeInTheDocument();
  });

  it('should say unknown rather than assume safe when the broker was silent', () => {
    // Act - an older broker that sends host and runtime but no verdict. The
    // safe-looking default is the one that costs something when it is wrong
    const args = runningOnPlatformStory();
    args.container.runner = { id: 'platform', host: 'h1', runtime: 'kata' };
    const { getByText, queryByText } = renderWith(args);

    // Assert
    expect(getByText(/Isolation not reported/)).toBeInTheDocument();
    expect(queryByText(/Own kernel/)).not.toBeInTheDocument();
  });
});

/**
 * The image badge.
 *
 * Descriptions come from the image catalogue and are sentences — "Minimal
 * Ubuntu 24.04 container exposing only a web-based terminal" is a real one.
 * The badge had a fixed 18px height and said nothing about overflow, so that
 * text wrapped to two lines and rendered *outside* the coloured box. The
 * catalogue's own entries are the normal case, not an edge one, so the
 * assertion uses one of them.
 */
describe('UserContainerCardInternal — image badge', () => {
  const LONG =
    'Minimal Ubuntu 24.04 container exposing only a web-based terminal';

  const renderWithDescription = (description: string) => {
    const args = makeStoryArgs();
    args.image = {
      imageId: '1',
      imageName: 'ttyd ubuntu',
      description,
    };
    return render(
      <Tooltip.Provider>
        <UserContainerCardInternal {...args} runners={new Map()} />
      </Tooltip.Provider>
    );
  };

  it('should keep a sentence-length description on one line', () => {
    const { getByText } = renderWithDescription(LONG);
    const badge = getByText(LONG);

    expect(badge).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(badge).toHaveStyle({ overflow: 'hidden' });
    expect(badge).toHaveStyle({ textOverflow: 'ellipsis' });
  });

  it('should be able to shrink inside the flex row it sits in', () => {
    // Without this a flex item will not go below its content width, and the
    // ellipsis never engages however the overflow is declared.
    const { getByText } = renderWithDescription(LONG);
    expect(getByText(LONG)).toHaveStyle({ minWidth: '0px' });
  });

  it('should offer the whole description, and the image, on hover', () => {
    const { getByText } = renderWithDescription(LONG);
    expect(getByText(LONG)).toHaveAttribute('title', `ttyd ubuntu — ${LONG}`);
  });

  it('should still show a short description in full', () => {
    const { getByText } = renderWithDescription('jupyterlab pytorch');
    expect(getByText('jupyterlab pytorch')).toBeInTheDocument();
  });

  it('should not render a badge for an image with no description', () => {
    const args = makeStoryArgs();
    args.image = { imageId: '1', imageName: 'ttyd ubuntu' };
    const { queryByTitle } = render(
      <Tooltip.Provider>
        <UserContainerCardInternal {...args} runners={new Map()} />
      </Tooltip.Provider>
    );

    // Guarded on the image alone it rendered an empty 18px coloured box whose
    // only content was a hover title, which reads as a rendering fault.
    expect(queryByTitle(/ttyd ubuntu/)).not.toBeInTheDocument();
  });
});

/**
 * Choosing where a service runs is the card's one destructive-ish control, and
 * it spent this branch inert: the wrapper carried the `onClick` while the
 * button inside it opened with an unconditional `e.stopPropagation()`, so the
 * event died before it left the button. Nothing looked wrong — the buttons
 * render, they highlight, they have a tooltip — and clicking them did nothing.
 *
 * A rendering test cannot see that. Only firing the click can.
 */
describe('UserContainerCardInternal — choosing a runner', () => {
  const RUNNERS = new Map([
    ['local', { label: 'This machine', icon: () => null }],
    ['platform', { label: 'Holistix', icon: () => null }],
  ]) as never;

  /** `makeStoryArgs` starts on no runner, so `on` says which one is chosen. */
  const renderPicker = (on = 'none') => {
    const picked: string[] = [];
    const args = makeStoryArgs();
    args.container = { ...args.container, runner: { id: on } };
    args.onSelectRunner = async (id: string) => {
      picked.push(id);
    };
    const r = render(
      <Tooltip.Provider>
        <UserContainerCardInternal {...args} runners={RUNNERS} />
      </Tooltip.Provider>
    );
    return { ...r, picked };
  };

  it('tells the card which runner was clicked', () => {
    const { getByLabelText, picked } = renderPicker();

    fireEvent.click(getByLabelText('Move to This machine'));

    expect(picked).toEqual(['local']);
  });

  it('offers the active runner as a restart rather than a move', () => {
    const { getByLabelText, picked } = renderPicker('platform');

    fireEvent.click(getByLabelText('Restart on Holistix'));

    expect(picked).toEqual(['platform']);
  });

  it('says which runner is chosen in a form that is not an opacity', () => {
    const { getByLabelText } = renderPicker('platform');

    expect(getByLabelText('Restart on Holistix')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(getByLabelText('Move to This machine')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('does not nest one button inside another', () => {
    // Invalid HTML, and how the click came to be swallowed in the first place.
    const { container } = renderPicker();

    expect(container.querySelector('button button')).toBeNull();
  });
});

/**
 * The command to paste for a local placement.
 *
 * It is one unbroken word to a browser — no space survives inside
 * `--add-host=…` or a base64 `SETTINGS=…` — and several hundred characters
 * long. A `<pre>` defaults to `white-space: pre`, so it drew that line at its
 * natural width and, with nothing clipping it, ran off the card and across the
 * board.
 *
 * It *looked* handled: the element carried `whitespace-pre-wrap break-all
 * bg-black/40 …`. Tailwind was removed from this workspace and only a
 * hand-written subset of utilities replaced it, so every one of those class
 * names was inert. That is why these assertions read the computed style rather
 * than the className — a class that does not exist passes a className check.
 */
describe('UserContainerCardInternal — the command to paste', () => {
  const commandBlock = (): HTMLElement => {
    const { container } = render(
      <Tooltip.Provider>
        <UserContainerCardInternal
          {...runningLocallyStory()}
          runners={new Map()}
        />
      </Tooltip.Provider>
    );
    const pre = container.querySelector('pre');
    if (!pre) throw new Error('the local runner story has no command block');
    return pre as HTMLElement;
  };

  it('should wrap the command instead of laying it out in one line', () => {
    expect(commandBlock()).toHaveStyle({ whiteSpace: 'pre-wrap' });
  });

  it('should break inside a word, because the command is one word', () => {
    // `wordBreak` and `overflowWrap` disagree about whether a `=` or a `/` is
    // a break opportunity; together they break wherever they have to.
    const pre = commandBlock();
    expect(pre).toHaveStyle({ wordBreak: 'break-all' });
    expect(pre).toHaveStyle({ overflowWrap: 'anywhere' });
  });

  it('should stay inside the card', () => {
    const pre = commandBlock();
    expect(pre).toHaveStyle({ maxWidth: '100%' });
    expect(pre).toHaveStyle({ maxHeight: '80px' });
    expect(pre).toHaveStyle({ overflowY: 'auto' });
  });

  it('should not rely on class names no stylesheet defines', () => {
    // The regression, stated directly: Tailwind is gone (see reset.scss), so a
    // `bg-black/40` here is a decorative string and nothing more.
    expect(commandBlock().className).toBe('');
  });
});

/**
 * Green is the platform, blue is somebody's machine.
 *
 * `notebook-card` already draws it that way and the two cards sit in one grid,
 * so the same colour has to mean the same thing on both. This card lit blue
 * for anything that answered its watchdog, which said only "alive" — something
 * the card states four other ways already.
 */
describe('UserContainerCardInternal — where it runs, in one colour', () => {
  const ledOf = (args: StoryArgs) => {
    const { container } = render(
      <Tooltip.Provider>
        <UserContainerCardInternal {...args} runners={new Map()} />
      </Tooltip.Provider>
    );
    return container.querySelector('.status-led');
  };

  it('should be green for a container on the platform', () => {
    expect(ledOf(runningOnPlatformStory())).toHaveClass('led-green');
  });

  it('should be blue for a container on somebody machine', () => {
    expect(ledOf(runningLocallyStory())).toHaveClass('led-blue');
  });

  it('should still be red when nothing answers', () => {
    // Unreachable is not a question about placement, and it outranks one.
    const dead = runningLocallyStory();
    dead.container.last_watchdog_at = new Date('1970-01-01').toISOString();
    expect(ledOf(dead)).toHaveClass('led-red');
  });
});

/**
 * The two presence marks: whose machine this runs on, and who is in the
 * project looking at it.
 *
 * The card has drawn both since it was written and nothing ever handed it
 * either one — `useContainerPresence` is the wiring that was missing. These
 * assert the card's half of that contract: given the props, it draws them.
 */
describe('UserContainerCardInternal — presence', () => {
  const HOST = {
    user_id: 'u-host',
    username: 'local:ada',
    firstname: 'Ada',
    lastname: 'Lovelace',
    picture: null,
  };

  const GUEST = {
    user_id: 'u-guest',
    username: 'local:alan',
    firstname: 'Alan',
    lastname: 'Turing',
    picture: null,
  };

  const renderPresence = (
    args: StoryArgs,
    presence: { liveUsers?: TF_User[]; host?: TF_User }
  ) =>
    render(
      <Tooltip.Provider>
        <UserContainerCardInternal
          {...args}
          {...presence}
          runners={new Map()}
        />
      </Tooltip.Provider>
    );

  it('should mark the machine owner as the host', () => {
    // The blue ring and the "host" label on hover are what say "this is
    // running on Ada's laptop" rather than somewhere unattributed.
    const { getByText } = renderPresence(runningLocallyStory(), { host: HOST });

    expect(getByText('host')).toBeInTheDocument();
  });

  it('should show who else is in the project', () => {
    const { getByTitle } = renderPresence(runningLocallyStory(), {
      liveUsers: [HOST, GUEST],
    });

    expect(getByTitle('local:ada')).toBeInTheDocument();
    expect(getByTitle('local:alan')).toBeInTheDocument();
  });

  it('should claim no host for a container on the platform', () => {
    // The platform is owned by nobody. A card that showed an owner for it
    // would be inventing one.
    const { queryByText } = renderPresence(runningOnPlatformStory(), {});

    expect(queryByText('host')).not.toBeInTheDocument();
  });

  it('should not draw live users for a container nothing can reach', () => {
    const dead = runningLocallyStory();
    dead.container.last_watchdog_at = null;
    const { queryByTitle } = renderPresence(dead, { liveUsers: [GUEST] });

    expect(queryByTitle('local:alan')).not.toBeInTheDocument();
  });
});
