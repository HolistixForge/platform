import { useState, useCallback } from 'react';
import {
  InfoCircledIcon,
  TrashIcon,
  OpenInNewWindowIcon,
  CopyIcon,
  CheckIcon,
} from '@radix-ui/react-icons';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Menubar from '@radix-ui/react-menubar';

import {
  icons,
  useAction,
  randomColor,
  Datetime,
  Tag,
  TagsBar,
  DialogControlled,
  ButtonBase,
  ClickStopPropagation,
  ResourceButtons,
  UserBubble,
  UserAvatar,
} from '@holistix-forge/ui-base';
import { TF_User } from '@holistix-forge/types';

import {
  UserContainerSystemInfo,
  serviceUrl,
  openableServices,
} from '../servers-types';
import { StatusLed } from './status-led';
import { UseContainerProps } from './node-server/node-server';
import { TContainerRunnerFrontend } from '../../frontend';

/**
 * The card's own box.
 *
 * 400 × 202 are the "add resource" card's dimensions — `server-stack.tsx` in
 * ui-views — which is what this card sits beside in the grid, and whose column
 * arithmetic (`Math.floor(width / (400 + 32))`, `minmax(400px, 1fr)`) is
 * written against that same 400. The width already agreed; the height did not,
 * so a service card and the dashed card next to it never lined up.
 *
 * `minHeight` and not `height`: a container exposing several services is
 * taller than 202, and clipping it would hide the links that are the reason to
 * look at the card at all. The floor is what makes the short ones align.
 */
const CARD_BOX = {
  borderRadius: '8px',
  padding: '20px',
  width: '400px',
  minHeight: '202px',
} as const;

/**
 *
 */

/** What the light on a card can say. */
export type TLedColor = 'red' | 'yellow' | 'blue' | 'green';

/**
 * The colour a service takes once it is up, by where it runs.
 *
 * The light is not only "is it alive" — it is also "where". Blue is a
 * machine somebody owns; green is the platform. Everything ran blue before,
 * so a service on the platform looked like a service on a laptop, and the one
 * fact the card most needed to carry was the one it did not.
 *
 * A runner nobody here knows still lights blue rather than going dark: it is
 * running, and that is the more important half.
 */
const RUNNER_LED: Record<string, TLedColor> = {
  local: 'blue',
  platform: 'green',
};

/**
 * How long a service has to come up before its silence means failure.
 *
 * Generous on purpose: an image that has to be pulled takes longer than one
 * already on the machine, and a light that gives up early is worse than one
 * that waits — the first says "broken" about something that is about to work.
 */
const STARTING_WINDOW_S = 90;

/**
 * The light on the card, in one place.
 *
 * Four states, and the order they are tested in is the whole of the logic:
 *
 *   red      stopped, or silent past the starting window
 *   yellow   asked to start, nothing heard back yet
 *   blue     running, on somebody's machine
 *   green    running, on the platform
 *
 * Yellow comes before red because they describe the same absence of news.
 * What separates them is only how long it has been going on.
 */
export const ledColor = (
  container: {
    last_watchdog_at: string | null;
    stopped_at?: string;
    started_at?: string;
    runner?: { id?: string };
  },
  now: number = new Date().getTime()
): TLedColor => {
  const { alive } = isAlive(
    container.last_watchdog_at,
    container.stopped_at,
    now
  );

  if (alive) return RUNNER_LED[container.runner?.id ?? ''] ?? 'blue';

  // A stop is a decision, and it outranks a start that came before it.
  if (container.stopped_at && container.started_at) {
    if (
      new Date(container.stopped_at).getTime() >=
      new Date(container.started_at).getTime()
    )
      return 'red';
  } else if (container.stopped_at) {
    return 'red';
  }

  if (!container.started_at) return 'red';

  const since = (now - new Date(container.started_at).getTime()) / 1000;
  return since >= 0 && since < STARTING_WINDOW_S ? 'yellow' : 'red';
};

export const isAlive = (
  last_watchdog_at: string | null,
  stopped_at?: string,
  now: number = new Date().getTime()
) => {
  // Somebody stopped it, and that is not something a watchdog can say.
  //
  // The watchdog only reports; it cannot report *not* running, so for the
  // thirty seconds after a stop the last report is still recent and the card
  // went on showing the service as alive — offering "stop" for a container the
  // broker had already removed, and no way to start it again until the window
  // elapsed. Clicking stop again then did nothing visible, because the broker
  // answers 404 for a container that is gone and this platform reads that as
  // success.
  //
  // `_start` clears `stopped_at`, so this is one field rather than two states
  // that have to agree.
  if (stopped_at) {
    const stoppedFor = (now - new Date(stopped_at).getTime()) / 1000;
    // Only while it is the newer fact. A container that was stopped and later
    // started reports again, and its own report is what should win from then
    // on — otherwise a stale `stopped_at` would keep a running service looking
    // dead. `_start` already clears the field; this holds if it ever does not.
    const reportedAfter =
      last_watchdog_at &&
      new Date(last_watchdog_at).getTime() > new Date(stopped_at).getTime();
    if (!reportedAfter && stoppedFor >= 0)
      return { alive: false, color: 'red' as const };
  }

  if (!last_watchdog_at) return { alive: false, color: 'red' as const };

  const d = new Date(last_watchdog_at);

  const dateDiffSecondes = (now - d.getTime()) / 1000;

  let alive = false;

  let color: 'red' | 'yellow' | 'green' | 'blue' = 'red';

  if (dateDiffSecondes < 30) {
    color = 'blue';
    alive = true;
  } else {
    color = 'red';
  }

  const r = {
    alive,
    color,
  };

  return r;
};

/**
 * What actually isolated this container, in one line under the runner.
 *
 * The platform ships two engines with different guarantees, and the whole
 * reason the broker refuses to start without a stated runtime is that an
 * absent isolation must never be reached by omission. That rule only holds as
 * far as the value travels: if a deployment isolates less well and the card
 * says nothing, the person whose code is running still believes they got a
 * private kernel. So it comes out of the environment and onto the card.
 *
 * Three states, and the third is not a gap to be filled in:
 *
 *   own kernel     a microVM — Kata under Docker, or any Apple container
 *   shared kernel  runc: the host's kernel, with every other tenant on it
 *   unknown        the broker did not say. An older one, or a runner that is
 *                  not the platform. Shown as unknown rather than assumed
 *                  safe, because the safe-looking assumption is the one that
 *                  costs something when it is wrong.
 *
 * Concessions are listed when there are any. They are the difference between
 * two microVMs, and "own kernel" alone would flatten that back out.
 */
const IsolationLine = ({ runner }: { runner: Record<string, unknown> }) => {
  const isolation = runner.isolation;
  const engine = typeof runner.engine === 'string' ? runner.engine : undefined;
  const runtime =
    typeof runner.runtime === 'string' ? runner.runtime : undefined;
  const concessions = Array.isArray(runner.concessions)
    ? (runner.concessions as string[])
    : [];

  // Nothing was reported at all — a local placement, or a container that has
  // not started yet. Silence is right here; there is no claim to correct.
  if (!runtime && !engine && !isolation) return null;

  const shared = isolation === 'shared-kernel';
  const known = isolation === 'microvm' || shared;

  const what = !known
    ? 'Isolation not reported'
    : shared
    ? 'Shares the host kernel'
    : 'Own kernel';

  const detail = [engine, runtime].filter(Boolean).join(' · ');

  return (
    <div
      style={{
        marginTop: 'var(--spacing-4)',
        fontSize: 'var(--font-size-sm)',
        // A shared kernel is the one case worth interrupting someone for.
        color: shared ? 'var(--color-warning)' : 'var(--color-text-muted)',
      }}
      title={
        concessions.length > 0
          ? `This deployment gives up: ${concessions.join(', ')}`
          : undefined
      }
    >
      <p>
        {what}
        {detail ? ` · ${detail}` : ''}
      </p>
      {concessions.length > 0 && (
        <p>
          {concessions.length} control{concessions.length > 1 ? 's' : ''} given
          up: {concessions.join(', ')}
        </p>
      )}
    </div>
  );
};

//
//

//

export const UserContainerCardInternal = ({
  container,
  image,
  onDelete,
  onOpenService,
  onSelectRunner,
  onStart,
  onStop,
  runners,
  liveUsers,
  host,
}: UseContainerProps & {
  runners: Map<string, TContainerRunnerFrontend>;
  /**
   * Who is on this service right now, and whose machine it runs on.
   *
   * The same two props `notebook-card` carries, drawn the same way and in the
   * same places, because the two cards sit in the same grid and a person
   * reading them should not have to learn the layout twice.
   *
   * Optional, and nothing in the platform passes them yet: a container has no
   * awareness channel of its own, so the users would have to come from the
   * project's collab session. Left as props rather than invented inside the
   * card, so whoever wires that decides what "on this service" means.
   */
  liveUsers?: TF_User[];
  host?: TF_User;
}) => {
  //

  const deleteAction = useAction(
    async () => {
      await onDelete();
    },
    [],
    {
      errorLatchTime: 5000,
    }
  );

  const [tags, setTags] = useState<Tag[]>([
    { text: 'tag-example', color: randomColor() },
  ]);

  const addTag = (t: Tag) => {
    setTags((prevState: Tag[]) => [...prevState, t]);
  };

  const { alive } = isAlive(container.last_watchdog_at, container.stopped_at);
  const color = ledColor(container);
  const onPlatform = container.runner.id === 'platform';

  /**
   * Whether the badge beside the run control is shown at all.
   *
   * Only while the service is actually up — which is exactly when the light
   * is blue or green, so the condition is written as that rather than as a
   * second reading of the same facts. A badge on a stopped service answers
   * "where would this run", which nobody asked; the runner picker below is
   * already the place for that question.
   */
  const running = color === 'blue' || color === 'green';

  // The run control, wrapped the same way `deleteAction` is: a click on it
  // reaches the gateway, and a gateway that refuses has to say so somewhere the
  // person who clicked can see it. `useAction` is what the card already uses
  // for that, and doing it by hand here would be a second convention.
  const runAction = useAction(
    async () => {
      if (alive) await onStop();
      else await onStart();
    },
    [alive, onStart, onStop],
    {
      errorLatchTime: 5000,
    }
  );

  // Not `httpServices[0]`: the guard's internal names register too, and
  // whichever wins the race would become what the card opens.
  const openable = openableServices(container);

  const firstServiceName = openable.length > 0 && openable[0].name;

  const firstServiceUrl =
    firstServiceName && serviceUrl(container, firstServiceName);

  // Terminal URL: use serviceUrl helper to construct proper FQDN-based URL
  const terminalService = container.httpServices.find(
    (s) => s.name === 'terminal'
  );
  const terminalUrl = terminalService
    ? serviceUrl(container, 'terminal')
    : null;

  //

  return (
    <div
      className={`${
        color === 'red' ? 'node-background' : 'gradient-notebook-card'
      } flex flex-col relative pointer`}
      style={CARD_BOX}
      onClick={() => {
        if (firstServiceName) {
          onOpenService?.(firstServiceName);
        }
      }}
    >
      {alive && container.last_activity && (
        <div
          className="absolute flex items-center"
          style={{
            gap: '8px',
            // Above the card, 5px clear of it. `bottom: 100%` and not a
            // negative `top`: the anchor is then the card's own top edge
            // rather than a guess at how tall this line is, so the gap stays
            // 5px whatever the font does to it. -18px put the line on the
            // card; -25px left it floating.
            bottom: `calc(100% + 5px + var(--node-wrapper-header-height, 0px))`,
          }}
        >
          <div
            style={{
              borderRadius: '9999px',
              height: '12px',
              width: '12px',
              backgroundColor: '#F72585',
            }}
          />
          <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)' }}>
            last activity&nbsp;
            <Datetime
              value={container.last_activity}
              formats={['ago']}
              showIcon={false}
            />
          </p>
        </div>
      )}

      {alive && liveUsers && liveUsers.length > 0 && (
        <div
          className="absolute flex items-center"
          style={{
            right: '-16px',
            zIndex: 20,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <UserBubble
            users={liveUsers}
            direction="vertical"
            live={true}
            size="small"
          />
        </div>
      )}

      {host && running && (
        <div
          className="absolute flex items-center"
          style={{
            left: '-20px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 20,
          }}
        >
          <UserAvatar size="small" {...host} host />
        </div>
      )}

      {onPlatform && running && (
        <div
          className="absolute flex items-center"
          style={{
            left: '-20px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 20,
          }}
        >
          <PlatformBadge />
        </div>
      )}

      <div className="flex justify-between">
        <div className="flex items-center" style={{ gap: '12px' }}>
          <p
            className="font-bold"
            style={{
              color: 'var(--white)',
              fontSize: '12px',
              lineHeight: '28px',
            }}
          >
            {container.container_name}
          </p>
          {/* On the description and not on the image: a catalogue entry
              without one rendered an empty 18px coloured box whose only
              content was a hover title, which reads as a rendering fault. No
              description, no badge. */}
          {image?.description && (
            // One line, clipped, with the whole of it on hover.
            //
            // The height was fixed at 18px with nothing said about overflow, so
            // a description of any length wrapped and spilled straight out of
            // the coloured box — "Minimal Ubuntu 24.04 container exposing only
            // a web-based terminal" renders as two lines of text with a badge
            // sized for one behind them. Descriptions come from the image
            // catalogue and are sentences, not words, so this is the normal
            // case rather than an edge one.
            //
            // `minWidth: 0` because this sits in a flex row: without it a flex
            // item refuses to shrink below its content, and the ellipsis never
            // engages no matter what `overflow` says.
            <span
              className="flex items-center justify-center font-bold"
              style={{
                backgroundColor: '#45AFDD',
                borderRadius: '4px',
                height: '18px',
                fontSize: '12px',
                padding: '0 8px',
                minWidth: '0px',
                maxWidth: '240px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
                lineHeight: '18px',
              }}
              title={`${image.imageName} — ${image.description}`}
            >
              {image.description}
            </span>
          )}
        </div>

        <div className="flex items-center">
          <ClickStopPropagation>
            <Menubar.Root className="MenubarRoot integrated">
              <Menubar.Menu>
                <Menubar.Trigger className="">
                  <icons.Settings style={{ height: '24px', width: '24px' }} />
                </Menubar.Trigger>
                <Menubar.Portal>
                  <Menubar.Content
                    className="MenubarContent"
                    align="start"
                    sideOffset={5}
                    alignOffset={-3}
                  >
                    {firstServiceUrl && (
                      <Menubar.Item
                        className="MenubarItem"
                        onClick={() => window.open(firstServiceUrl, '_blank')}
                      >
                        Open in new Tab
                        <div className="RightSlot">
                          <OpenInNewWindowIcon />
                        </div>
                      </Menubar.Item>
                    )}

                    {terminalUrl && (
                      <Menubar.Item
                        className="MenubarItem"
                        onClick={() => window.open(terminalUrl, '_blank')}
                      >
                        Open Terminal
                        <div className="RightSlot">
                          <OpenInNewWindowIcon />
                        </div>
                      </Menubar.Item>
                    )}

                    <Menubar.Item
                      className="MenubarItem red"
                      onClick={() => deleteAction.open()}
                    >
                      Delete
                      <div className="RightSlot">
                        <TrashIcon />
                      </div>
                    </Menubar.Item>
                  </Menubar.Content>
                </Menubar.Portal>
              </Menubar.Menu>
            </Menubar.Root>
          </ClickStopPropagation>
        </div>
      </div>

      <div>
        {/*
          Shown whichever runner is active, not only before the first choice.
          Where a service runs is a decision people revise — moving it from
          their laptop to the platform, or back to debug it — and hiding the
          control after one click left no way to do that but delete the
          container and make another one.
        */}
        <div
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <p>
            {container.runner.id === 'none'
              ? 'Select a runner to start the container'
              : 'Runs on'}
          </p>
        </div>
        {/*
          The two runners are `ResourceButtons`, not bordered chips. Where a
          service runs is the same kind of choice as host-or-not on a notebook
          card, and it was being drawn in a vocabulary used nowhere else on the
          card. `local` is the laptop button added beside `cloud`; both carry
          the blue box `host` already had, so the pair reads as one choice.

          A runner the registry does not know still renders — as its own label
          on a plain button — rather than disappearing, because a third runner
          silently vanishing from the card is worse than one that looks odd.
        */}
        <div className="flex items-center" style={{ gap: 'var(--spacing-4)' }}>
          {/*
            Run control, the same shape `notebook-card` uses: one button per
            state rather than one button that changes meaning. `alive` comes
            from the watchdog, so a container whose watchdog has gone quiet
            offers play, and one still reporting offers stop.

            The callback goes on `ResourceButtons` itself, for the reason the
            runner picker below spells out: `ButtonBase` opens its handler with
            an unconditional `e.stopPropagation()`, so a handler on any wrapper
            never fires and the click does not reach the card's own `onClick`
            either. Drawn without one, this button did nothing at all and did
            not open the service either — a control that looks alive.

            `onSelectRunner` also starts the container, but as a consequence of
            *choosing where it runs*: restarting a service should not require
            pretending to move it, which is why `onStart` exists beside it.
          */}
          <ResourceButtons
            {...runAction}
            size="small"
            type={alive ? 'stop' : 'play'}
            actionOriginId={alive ? 'container-stop' : 'container-play'}
            ariaLabel={alive ? 'Stop this service' : 'Start this service'}
          />

          <div
            style={{
              width: '1px',
              height: '20px',
              // The violet-pink of the design system's own ramp, not the
              // activity dot's #F72585 — that one reads red against this
              // card's purple and pulled the eye like a warning. A token
              // rather than a hex, so it follows the ramp if it moves.
              background: 'var(--primary-300)',
              margin: '0 var(--spacing-4)',
            }}
          />

          {Array.from(runners.entries()).map(([runnerId, runner]) => {
            const active = container.runner.id === runnerId;
            const known = runnerId === 'local' || runnerId === 'platform';
            const label = active
              ? `Restart on ${runner.label}`
              : `Move to ${runner.label}`;
            const select = () => onSelectRunner(runnerId);
            return (
              // The click is on the button itself, and the wrapper only
              // positions it.
              //
              // It was on the wrapper — first a div, then a div made into a
              // button — and it never fired either way: `ButtonBase` opens its
              // own handler with an unconditional `e.stopPropagation()`, so the
              // click died on the inner button and never reached anything
              // outside it. Choosing a runner did nothing at all, which is a
              // dead control that looks alive. A button inside a button is also
              // invalid HTML, and React says so.
              //
              // `ResourceButtons` spreads the rest of its props into
              // `ButtonBase`, and `callback` is one of them — so the real
              // button carries the behaviour and no hook is called per list
              // entry. `stopPropagation` then becomes right rather than
              // fatal: it keeps the card's own onClick from opening a service
              // when somebody meant to change where it runs.
              <div
                key={runnerId}
                title={label}
                style={{
                  // The active runner is the one piece of state on this card
                  // that is otherwise invisible once chosen. Opacity says it
                  // without a second border around a button that has one, and
                  // `aria-pressed` on the button says the same thing to a
                  // screen reader, which an opacity cannot.
                  opacity: active ? 1 : 0.45,
                  transition: 'opacity 0.15s ease',
                  lineHeight: 0,
                }}
              >
                {known ? (
                  <ResourceButtons
                    type={runnerId === 'local' ? 'local' : 'cloud'}
                    size="small"
                    actionOriginId={`runner-${runnerId}`}
                    ariaLabel={label}
                    ariaPressed={active}
                    callback={select}
                  />
                ) : (
                  <ButtonBase
                    Icon={runner.icon}
                    text={runner.label}
                    className="resource small"
                    ariaLabel={label}
                    ariaPressed={active}
                    callback={select}
                  />
                )}
              </div>
            );
          })}
        </div>

        <IsolationLine runner={container.runner as Record<string, unknown>} />

        {typeof container.runner.command === 'string' && (
          <DockerCommand command={container.runner.command} />
        )}
      </div>

      {/*
        `marginTop: auto` and not a fixed offset: the card is a column with a
        `minHeight`, and its middle grows — a container exposing several
        services pushes everything down. Anchoring the tags to the bottom of
        the flex box keeps them on the same line whatever is above them, which
        a margin cannot do.
      */}
      <div style={{ marginTop: 'auto' }}>
        <TagsBar tags={tags} addTag={addTag} />
      </div>

      <div className="absolute" style={{ right: '16px', bottom: '20px' }}>
        <StatusLed color={color} type="server-card" />
      </div>

      <div className="absolute" style={{ right: '36px', bottom: '19px' }}>
        {alive && container.system && <SystemInfo {...container.system} />}
      </div>

      <DialogControlled
        title="Are you sure ?"
        description="This will permanently delete this resource"
        open={deleteAction.isOpened}
        onOpenChange={deleteAction.close}
      >
        <ButtonBase className="red" text="Delete" {...deleteAction} />
      </DialogControlled>
    </div>
  );
};

const DockerCommand = ({ command }: { command: string }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);

  return (
    <ClickStopPropagation>
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-white/60 text-[11px]">
            Run this command to start the container:
          </p>
          <button
            className="flex items-center gap-1 text-white/60 hover:text-white text-[11px] cursor-pointer"
            onClick={onCopy}
          >
            {copied ? (
              <>
                <CheckIcon className="h-3 w-3" /> Copied
              </>
            ) : (
              <>
                <CopyIcon className="h-3 w-3" /> Copy
              </>
            )}
          </button>
        </div>
        <pre
          className="bg-black/40 rounded-[4px] p-2 text-[10px] text-green-400 overflow-x-auto max-h-[80px] whitespace-pre-wrap break-all cursor-text select-all"
          onClick={onCopy}
        >
          {command}
        </pre>
      </div>
    </ClickStopPropagation>
  );
};

//
/**
 * Who — or what — is running this service, beside the run control.
 *
 * On a machine somebody owns, that slot holds their face: a round badge with
 * a blue ring, so the card says whose laptop is doing the work before it says
 * anything else. On the platform there is no one to show, and the slot was
 * simply empty — which does not read as "nobody owns this", it reads as a
 * card missing a piece.
 *
 * So the platform gets a face of its own: the same badge, the same ring, a
 * cloud instead of a person and green instead of blue. Green because that is
 * what the light says for the platform, and one fact should not be told in
 * two colours.
 *
 * Shown only while the service is actually up, like the face it stands in
 * for. On a stopped one it would answer "where would this run" — a question
 * the runner picker below already owns, and one nobody asked.
 */
const PlatformBadge = () => (
  <span
    title="Runs on the platform"
    data-testid="platform-badge"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '38px',
      height: '38px',
      borderRadius: '9999px',
      backgroundColor: 'var(--surface-700)',
      border: '1px solid var(--green-300)',
      color: 'var(--green-300)',
      filter: 'drop-shadow(0px 0px 4px var(--green-300))',
    }}
  >
    <icons.Cloud style={{ width: '20px', height: '20px' }} />
  </span>
);

//

const SystemInfo = ({
  cpu,
  memory,
  disk,
  network,
  graphic,
}: UserContainerSystemInfo) => {
  const convertMBtoGB = (mb: number) => (mb / 1024).toFixed(2) + ' GB';

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <InfoCircledIcon name="info" style={{ color: 'var(--white)' }} />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="TooltipContent tooltip" sideOffset={12}>
          <div style={{ color: 'var(--white)', fontSize: '12px' }}>
            {cpu && (
              <div>
                <strong>CPU:</strong> {cpu.model} ({cpu.count} cores,{' '}
                {cpu.threads_per_core} threads/core)
                <br />
                Usage: {cpu.usage}
              </div>
            )}
            {memory && (
              <div>
                <strong>Memory:</strong> {convertMBtoGB(memory.total)} (
                {convertMBtoGB(memory.free)} free)
              </div>
            )}
            {disk && (
              <div>
                <strong>Disk:</strong> {disk.size} ({disk.usage})
              </div>
            )}
            {network && (
              <div>
                <strong>Network:</strong> Ping Time: {network.ping_time}
              </div>
            )}
            {graphic && graphic.cards.length > 0 && (
              <div>
                <strong>Graphics:</strong> {graphic.cards}
              </div>
            )}
          </div>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
