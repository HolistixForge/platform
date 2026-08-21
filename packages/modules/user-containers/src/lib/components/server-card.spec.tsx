import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { TF_User } from '@holistix-forge/types';

import { UserContainerCardInternal, isAlive, ledColor } from './server-card';
import {
  makeStoryArgs,
  runningOnPlatformStory,
  runningOnAppleStory,
  runningOnSharedKernelStory,
  runningLocallyStory,
  StoryArgs,
} from './server-card-stories';

// The picker asks Ganymede for this person's machines, so mounting it needs an
// ApiContext and a query client that say nothing about this card. What the
// dialog does with what it gets is `machine-picker.spec.tsx`; what the card
// does is open it, which is all these tests need to see.
//
// Below the imports, not above them: `jest.mock` is hoisted above the whole
// module by babel, so where it is written changes nothing at runtime — and
// written first it puts two imports in the body of the module, which
// `import/first` refuses.
jest.mock('./machine-picker-connected', () => ({
  ConnectedMachinePicker: () => <div data-testid="machine-picker" />,
}));

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
    const { getByLabelText, picked } = renderPicker('none');

    fireEvent.click(getByLabelText('Move to Holistix'));

    expect(picked).toEqual(['platform']);
  });

  // "local" is the one runner that is not a destination — it is a set of
  // machines, and a placement naming none of them is refused by every enrolled
  // runner. So this click opens the picker instead of choosing, and what
  // reaches `onSelectRunner` comes from there with a machine beside it.
  it('asks which machine instead of placing nowhere', () => {
    const { getByLabelText, queryByTestId, picked } = renderPicker('none');

    expect(queryByTestId('machine-picker')).not.toBeInTheDocument();

    fireEvent.click(getByLabelText('Move to This machine'));

    expect(picked).toEqual([]);
    expect(queryByTestId('machine-picker')).toBeInTheDocument();
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

//

describe('isAlive - a stop is a decision the watchdog cannot express', () => {
  const now = new Date('2026-01-01T12:00:00.000Z').getTime();
  const at = (secondsAgo: number) =>
    new Date(now - secondsAgo * 1000).toISOString();

  it('reports a just-stopped service as not running', () => {
    // The watchdog reported 5s ago and cannot report *not* running, so without
    // stopped_at the card offered "stop" for a container already removed, and
    // no way to start it again for half a minute.
    expect(isAlive(at(5), at(1), now).alive).toBe(false);
  });

  it('still reports a running service as running', () => {
    expect(isAlive(at(5), undefined, now).alive).toBe(true);
  });

  it('lets a report made after the stop win', () => {
    // Started again: its own report is the newer fact, and a stale stopped_at
    // must not keep a running service looking dead.
    expect(isAlive(at(2), at(60), now).alive).toBe(true);
  });

  it('reports a silent service as not running, stopped or not', () => {
    expect(isAlive(at(120), undefined, now).alive).toBe(false);
    expect(isAlive(null, undefined, now).alive).toBe(false);
  });
});

/**
 * The light on a resource card says two things at once: whether the service is
 * running, and where. Everything ran blue before, so a service on the platform
 * looked exactly like one on somebody's laptop — the card carried the state and
 * dropped the placement, which is the half a person cannot guess.
 *
 * And pressing play made red stay red: between the ask and the container's
 * first report there is a window where nothing is true yet, and it reads
 * exactly like a service that died in silence.
 */
describe('ledColor', () => {
  const now = new Date('2026-01-01T12:00:00.000Z').getTime();
  const at = (secondsAgo: number) =>
    new Date(now - secondsAgo * 1000).toISOString();

  const card = (over: {
    last_watchdog_at?: string | null;
    stopped_at?: string;
    started_at?: string;
    runner?: { id?: string };
  }) =>
    ledColor(
      { last_watchdog_at: null, ...over } as Parameters<typeof ledColor>[0],
      now
    );

  describe('running', () => {
    it('is green on the platform', () => {
      expect(
        card({ last_watchdog_at: at(5), runner: { id: 'platform' } })
      ).toBe('green');
    });

    it('is blue on somebody’s machine', () => {
      expect(card({ last_watchdog_at: at(5), runner: { id: 'local' } })).toBe(
        'blue'
      );
    });

    it('is blue for a runner this build has never heard of', () => {
      // Still running, and that is the more important half. Going dark would
      // report a healthy service as broken because a newer gateway named its
      // runner something this frontend does not know.
      expect(
        card({ last_watchdog_at: at(5), runner: { id: 'kata-next' } })
      ).toBe('blue');
    });
  });

  describe('starting', () => {
    it('is yellow as soon as someone presses play', () => {
      expect(card({ started_at: at(1), runner: { id: 'platform' } })).toBe(
        'yellow'
      );
    });

    it('stays yellow while the image could still be pulling', () => {
      expect(card({ started_at: at(60) })).toBe('yellow');
    });

    it('gives up once nothing has come back for long enough', () => {
      expect(card({ started_at: at(120) })).toBe('red');
    });

    it('turns the runner’s colour the moment the first report lands', () => {
      expect(
        card({
          started_at: at(10),
          last_watchdog_at: at(1),
          runner: { id: 'platform' },
        })
      ).toBe('green');
    });
  });

  describe('stopped', () => {
    it('is red when someone stopped it', () => {
      expect(
        card({
          last_watchdog_at: at(5),
          stopped_at: at(1),
          runner: { id: 'platform' },
        })
      ).toBe('red');
    });

    it('is red rather than yellow when the stop came after the start', () => {
      // Pressing play then stop inside the window: the newer decision wins,
      // or the card would sit yellow for a minute and a half on a service
      // nobody is starting.
      expect(card({ started_at: at(30), stopped_at: at(2) })).toBe('red');
    });

    it('is yellow again when the start came after the stop', () => {
      expect(card({ stopped_at: at(30), started_at: at(2) })).toBe('yellow');
    });
  });

  it('is red for a service that has never run and nobody asked for', () => {
    expect(card({})).toBe('red');
  });
});

/**
 * On a machine somebody owns, the badge beside the run control holds their
 * face. On the platform there is nobody to show, and the slot was simply
 * empty — which does not read as "nobody owns this", it reads as a card
 * missing a piece.
 */
describe('the platform badge', () => {
  const cardWith = (runnerId: string, args = makeStoryArgs()) =>
    render(
      <Tooltip.Provider>
        <UserContainerCardInternal
          {...args}
          container={
            {
              ...args.container,
              runner: { ...args.container.runner, id: runnerId },
            } as StoryArgs['container']
          }
          runners={new Map()}
        />
      </Tooltip.Provider>
    );

  it('stands in for the missing face on a running platform service', () => {
    const { queryByTestId } = cardWith('platform', runningOnPlatformStory());

    expect(queryByTestId('platform-badge')).toBeInTheDocument();
  });

  it('is absent while the service is not running', () => {
    // Only while the light is blue or green. On a stopped service it would
    // answer "where would this run" — which the runner picker already owns,
    // and which nobody asked.
    const { queryByTestId } = cardWith('platform');

    expect(queryByTestId('platform-badge')).not.toBeInTheDocument();
  });

  it('leaves the slot to the person on somebody’s machine', () => {
    const { queryByTestId } = cardWith('local', runningOnAppleStory());

    expect(queryByTestId('platform-badge')).not.toBeInTheDocument();
  });

  it('shows none before a runner has been chosen', () => {
    const { queryByTestId } = cardWith('none');

    expect(queryByTestId('platform-badge')).not.toBeInTheDocument();
  });

  it('carries the cloud, and lets it take the badge’s colour', () => {
    // The icon's path has no fill of its own, so it falls to the SVG default
    // — black — and the parent's `color` never reaches it. On a dark badge
    // that reads as a hole rather than as a cloud. The stylesheet sets `fill`
    // on the svg, which is inherited; this checks the icon is there for it to
    // apply to, since jsdom applies no external CSS.
    const { getByTestId } = cardWith('platform', runningOnPlatformStory());

    expect(getByTestId('platform-badge').querySelector('svg')).toBeTruthy();
    expect(getByTestId('platform-badge').className).toBe('platform-badge');
  });
});

//

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
