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
} from '@holistix-forge/ui-base';

import { UserContainerSystemInfo, serviceUrl } from '../servers-types';
import { StatusLed } from './status-led';
import { UseContainerProps } from './node-server/node-server';
import { TContainerRunnerFrontend } from '../../frontend';

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
      style={{ borderRadius: '8px', padding: '20px', width: '400px' }}
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
            <span
              className="flex items-center justify-center font-bold"
              style={{
                backgroundColor: '#45AFDD',
                borderRadius: '4px',
                height: '18px',
                fontSize: '12px',
                padding: '0 8px',
              }}
              title={image.imageName}
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
        <div className="flex" style={{ gap: 'var(--spacing-4)' }}>
          {Array.from(runners.entries()).map(([runnerId, runner]) => {
            const active = container.runner.id === runnerId;
            return (
              <div
                key={runnerId}
                className="flex items-center cursor-pointer"
                title={
                  active
                    ? `Restart on ${runner.label}`
                    : `Move to ${runner.label}`
                }
                style={{
                  gap: 'var(--spacing-4)',
                  // The active runner is the one piece of state on this card
                  // that is otherwise invisible once chosen.
                  border: `1px solid ${
                    active ? 'var(--color-accent)' : 'var(--color-border)'
                  }`,
                  background: active ? 'var(--color-bg-hover)' : 'transparent',
                  color: active
                    ? 'var(--color-text)'
                    : 'var(--color-text-muted)',
                  borderRadius: 'var(--radius-xs)',
                  padding: 'var(--spacing-4)',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                }}
                onClick={() => {
                  onSelectRunner(runnerId);
                }}
              >
                <runner.icon />
                <p>{runner.label}</p>
              </div>
            );
          })}
        </div>

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
