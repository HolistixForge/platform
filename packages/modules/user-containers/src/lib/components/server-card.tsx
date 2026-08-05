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
} from '@holistix-forge/ui-base';

import { UserContainerSystemInfo, serviceUrl } from '../servers-types';
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

const isAlive = (last_watchdog_at: string | null) => {
  if (!last_watchdog_at) return { alive: false, color: 'red' as const };

  const d = new Date(last_watchdog_at);

  const dateDiffSecondes = (new Date().getTime() - d.getTime()) / 1000;

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
  runners,
}: UseContainerProps & { runners: Map<string, TContainerRunnerFrontend> }) => {
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

  const { alive, color } = isAlive(container.last_watchdog_at);

  const firstServiceName =
    container.httpServices.length > 0 && container.httpServices[0].name;

  const firstServiceUrl =
    container.httpServices.length > 0 &&
    firstServiceName &&
    serviceUrl(container, firstServiceName);

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
            top: `calc(-25px - (var(--node-wrapper-header-height, 0px)))`,
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
          {image && (
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
              title={
                // `description` is optional, so gluing it on unconditionally
                // renders "ttyd ubuntu — undefined" for a catalogue entry
                // without one — and the badge body is then empty too, so the
                // tooltip is the only text there is.
                image.description
                  ? `${image.imageName} — ${image.description}`
                  : image.imageName
              }
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
          {Array.from(runners.entries()).map(([runnerId, runner]) => {
            const active = container.runner.id === runnerId;
            const known = runnerId === 'local' || runnerId === 'platform';
            return (
              // The click stays on the wrapper rather than on the button:
              // ResourceButtons takes a `useAction` result, and a hook cannot
              // be called once per entry of a list. The button is here for its
              // appearance; the wrapper carries the behaviour.
              <div
                key={runnerId}
                className="cursor-pointer"
                title={
                  active
                    ? `Restart on ${runner.label}`
                    : `Move to ${runner.label}`
                }
                style={{
                  // The active runner is the one piece of state on this card
                  // that is otherwise invisible once chosen. Opacity says it
                  // without a second border around a button that has one.
                  opacity: active ? 1 : 0.45,
                  transition: 'opacity 0.15s ease',
                }}
                onClick={() => onSelectRunner(runnerId)}
              >
                {known ? (
                  <ResourceButtons
                    type={runnerId === 'local' ? 'local' : 'cloud'}
                    size="small"
                    actionOriginId={`runner-${runnerId}`}
                  />
                ) : (
                  <ButtonBase
                    Icon={runner.icon}
                    text={runner.label}
                    className="resource small"
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

      <TagsBar tags={tags} addTag={addTag} />

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
