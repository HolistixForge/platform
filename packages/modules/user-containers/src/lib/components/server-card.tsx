import { CSSProperties, useState } from 'react';
import {
  InfoCircledIcon,
  TrashIcon,
  OpenInNewWindowIcon,
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
} from '@monorepo/ui-base';

import { UserContainerSystemInfo, serviceUrl } from '../servers-types';
import { StatusLed } from './status-led';
import {
  useContainerProps,
  UseContainerProps,
} from './node-server/node-server';
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

export const ServerCardInternal = ({
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

  //

  return (
    <div
      className={`${
        color === 'red' ? 'node-background' : 'gradient-notebook-card'
      } rounded-[8px] col-span-1 flex flex-col p-5 relative w-[400px] pointer`}
      onClick={() => {
        firstServiceName && onOpenService?.(firstServiceName);
      }}
    >
      {alive && container.last_activity && (
        <div
          className="absolute flex gap-2 items-center"
          style={{
            top: `calc(-25px - (var(--node-wrapper-header-height, 0px)))`,
          }}
        >
          <div className="rounded-full h-3 w-3 bg-[#F72585]" />
          <p className="text-[12px] text-white/80">
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
        <div className="flex gap-3 items-center">
          <p className="text-white text-[12px] font-bold leading-[28px]">
            {container.container_name}
          </p>
          {image && (
            <span
              className="bg-[#45AFDD] rounded-[4px] h-[18px] flex items-center justify-center text-[12px] font-bold px-2"
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
                  <icons.Settings className="h-6 w-6" />
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
        {container.runner.id === 'none' && (
          <>
            <div className="text-white text-[12px]">
              <p>Select a runner to start the container</p>
            </div>
            <div className="flex gap-2">
              {Array.from(runners.values()).map((runner, k) => (
                <div
                  key={runner.label}
                  className="flex items-center gap-2 cursor-pointer border border-white/10 rounded-[4px] p-2"
                  onClick={() => {
                    onSelectRunner(runner.label);
                  }}
                >
                  <runner.icon />
                  <p>{runner.label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <TagsBar tags={tags} addTag={addTag} />

      <div className="absolute right-4 bottom-[20px]">
        <StatusLed color={color} type="server-card" />
      </div>

      <div className="absolute right-9 bottom-[19px]">
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
        <InfoCircledIcon name="info" className="text-white" />
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="TooltipContent tooltip" sideOffset={12}>
          <div className="text-white text-[12px]">
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
