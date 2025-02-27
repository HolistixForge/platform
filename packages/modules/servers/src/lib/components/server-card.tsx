import { CSSProperties, useRef, useState } from 'react';
import {
  CopyIcon,
  GearIcon,
  InfoCircledIcon,
  TrashIcon,
  OpenInNewWindowIcon,
} from '@radix-ui/react-icons';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Menubar from '@radix-ui/react-menubar';

import {
  icons,
  ResourceButtons,
  UserBubble,
  randomGuys,
  useAction,
  copyToClipboard,
  randomColor,
  Datetime,
  UserAvatar,
  Tag,
  TagsBar,
  DialogControlled,
  FormErrorsError,
  LoadingDots,
  ButtonBase,
  ClickStopPropagation,
} from '@monorepo/ui-base';

import {
  ServerSystemInfo,
  serviceUrl,
  TServerComponentCallbacks,
  TServerComponentProps,
} from '../servers-types';
import { DockerOptionsForm, DockerOptionsFormData } from './docker-options';
import {
  CloudInstanceOptionsForm,
  CloudInstanceOptionsFormData,
} from './cloud-instance-options';
import { StatusLed } from './status-led';
import { useServerProps } from './node-server/node-server';

/**
 *
 */

const isAlive = (
  last_watchdog_at: Date | null,
  location: TServerComponentProps['location'],
  ec2_instance_state: TServerComponentProps['ec2_instance_state']
) => {
  const dateDiffSecondes = last_watchdog_at
    ? (new Date().getTime() - last_watchdog_at.getTime()) / 1000
    : Infinity;

  let alive: boolean = false;

  let color: 'red' | 'yellow' | 'green' | 'blue' = 'red';

  if (location === 'aws') {
    if (ec2_instance_state === 'running') {
      if (dateDiffSecondes < 30) {
        color = 'green';
        alive = true;
      } else {
        color = 'yellow';
      }
    } else if (
      ec2_instance_state === 'stopped' ||
      ec2_instance_state === 'terminated' ||
      ec2_instance_state === 'allocating'
    )
      color = 'red';
    else color = 'yellow';
  }

  //
  else if (location === 'hosted') {
    if (dateDiffSecondes < 30) {
      color = 'blue';
      alive = true;
    } else {
      color = 'red';
    }
  }

  const r = {
    alive,
    color,
  };

  return r;
};

//
//

export const ServerCardInternal = ({
  server_name,
  image,
  last_watchdog_at,
  ip,
  httpServices,
  last_activity,
  host,
  system,
  location,
  ec2_instance_state,
  project_server_id,
  onCopyCommand,
  onHost,
  onCloud,
  onCloudStop,
  onCloudStart,
  onCloudDelete,
  onOpenService,
  onDelete,
}: TServerComponentCallbacks & TServerComponentProps) => {
  //

  const commandRef = useRef('');

  const deleteResourceAction = useAction(
    async () => {
      await onDelete();
    },
    [],
    {
      errorLatchTime: 5000,
    }
  );

  //

  const cloudAction = useAction<CloudInstanceOptionsFormData>(
    async (d) => {
      const errors = new FormErrorsError();
      if (!d.instanceType)
        errors.add('instanceType', 'Please select an instance type');
      if (!d.storage) errors.add('storage', 'Please choose storage size');
      if (errors.hasErrors()) throw errors;
      await onCloud?.(d.instanceType, d.storage);
    },
    [],
    {
      values: { instanceType: 't2.small', storage: 10 },
      resetOnSuccess: false,
      tooltip: <span>Create and start instance</span>,
    }
  );

  //

  const dockerAction = useAction<DockerOptionsFormData>(
    async (d) => {
      let cmd = commandRef.current;

      let options = [];

      if (d.cpu > 0) options.push(`--cpus=${d.cpu}`);

      // TODO: not the good docker option: if (d.storage > 0) options.push(`--storage-opt size=${d.storage}G`);

      if (d.memory > 0) options.push(`--memory=${d.memory}m`);

      if (d.gpuAccess === 'all') options.push(`--gpus all`);
      else if (d.gpuIds) {
        let ids = d.gpuIds.replace(/\s/g, '');
        if (/^\d+(,\d+)*$/.test(ids)) {
          options.push(`--gpus '"device=${ids}"'`);
        } else {
          const e = new Error();
          (e as any).json = {
            errors: {
              gpuIds:
                'Invalid GPU IDs format. Please provide a positive integer comma separated list.',
            },
          };
          throw e;
        }
      }

      const serialized = options.join(' ');

      cmd = cmd.replace('docker run', `docker run ${serialized}`);

      const e = new Error('');
      (e as any).json = {
        errors: {
          memory: "pourquoi pas plus tant qu'on y est",
          storage: "il n'y en a plus",
          cpu: "c'est trop",
          gpuAccess: 'no nvidia cuda layer in tour docker engine',
          global: 'non faut pas déconner quand meme',
        },
      };

      copyToClipboard(cmd);
    },
    [],
    {
      values: {
        cpu: 4,
        memory: 1024,
        storage: 10,
        gpuAccess: 'specific',
        gpuIds: '',
      },
      successMessage: (
        <span>
          Copied to clipboard <CopyIcon />
        </span>
      ),
      errorLatchTime: 5000,
      resetOnSuccess: false,
      closeOnSuccess: false,
      tooltip: <span>Copy docker command</span>,
    }
  );

  //

  const hostAction = useAction(
    async (e) => {
      await onHost?.();
      await copyCmdAction.callback(e);
    },
    [onHost],
    { errorLatchTime: 5000, tooltip: <span>Host locally with docker</span> }
  );

  //

  const copyCmdAction = useAction(
    async () => {
      if (onCopyCommand) {
        const s = await onCopyCommand();
        commandRef.current = s;
        dockerAction.open();
      }
      return;
    },
    [onCopyCommand],
    {
      errorLatchTime: 5000,
      tooltip: <span>Choose options and Copy Docker run command</span>,
    }
  );

  //

  const cloudStartAction = useAction<undefined>(
    async () => {
      await onCloudStart?.();
      return;
    },
    [onCloudStart],
    { errorLatchTime: 5000, tooltip: <span>Start server</span> }
  );

  //

  const cloudStoptAction = useAction(
    async () => {
      await onCloudStop?.();
      return;
    },
    [onCloudStart],
    { errorLatchTime: 5000, tooltip: <span>Stop server</span> }
  );

  //

  const cloudDeletetAction = useAction(
    async () => {
      await onCloudDelete?.();
      return;
    },
    [onCloudStart],
    { errorLatchTime: 5000, tooltip: <span>Delete cloud resource</span> }
  );

  //

  const [tags, setTags] = useState<Tag[]>([
    { text: 'tag-example', color: randomColor() },
  ]);

  const addTag = (t: Tag) => {
    setTags((prevState: any) => [...prevState, t]);
  };

  const users = randomGuys.slice(0, 8);
  const liveUsers = randomGuys.slice(0, 3);

  const { alive, color } = isAlive(
    last_watchdog_at,
    location,
    ec2_instance_state
  );

  server_name === 'MyServer1' && console.log({ alive, color });

  const firstServiceName = httpServices.length > 0 && httpServices[0].name;

  const firstServiceUrl =
    httpServices.length > 0 &&
    serviceUrl({ httpServices, ip }, httpServices[0].name);

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
      {alive && last_activity && (
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
              value={last_activity}
              formats={['ago']}
              showIcon={false}
            />
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <div className="flex gap-3 items-center">
          <p className="text-white text-[12px] font-bold leading-[28px]">
            {server_name}
          </p>
          <span
            className="bg-[#45AFDD] rounded-[4px] h-[18px] flex items-center justify-center text-[12px] font-bold px-2"
            title={image.image_name}
          >
            {image.image_tag}
          </span>
        </div>

        <div className="flex items-center">
          {
            // play button displayed when hosted but disabled
            location !== 'hosted' && (
              <ResourceButtons
                size="small"
                type="host"
                {...hostAction}
                style={{
                  marginRight: '10px',
                }}
                disabled={location === 'aws'}
              />
            )
          }

          {location === 'hosted' && (
            <>
              <ResourceButtons
                size="small"
                type="docker"
                {...copyCmdAction}
                style={{
                  marginRight: '10px',
                }}
                disabled={!onCopyCommand || alive}
              />
            </>
          )}

          {ec2_instance_state === 'allocating' ||
          ec2_instance_state === 'pending' ||
          ec2_instance_state === 'running' ? (
            <ResourceButtons
              size="small"
              type="pause"
              {...cloudStoptAction}
              disabled={ec2_instance_state !== 'running'}
            />
          ) : (
            <ResourceButtons
              size="small"
              type="play"
              callback={
                location === 'none'
                  ? () => cloudAction.open()
                  : () => cloudStartAction.callback(undefined)
              }
              tooltip={
                location === 'none' ? (
                  <span>Deploy in Demiurge's cloud</span>
                ) : (
                  <span>Start Cloud resource</span>
                )
              }
              disabled={location !== 'none' && ec2_instance_state !== 'stopped'}
            />
          )}

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
                    <Menubar.Item
                      className="MenubarItem"
                      onClick={() =>
                        firstServiceUrl &&
                        window.open(firstServiceUrl, '_blank')
                      }
                    >
                      Open in new Tab
                      <div className="RightSlot">
                        <OpenInNewWindowIcon />
                      </div>
                    </Menubar.Item>

                    <Menubar.Item className="MenubarItem">
                      Settings
                      <div className="RightSlot">
                        <GearIcon />
                      </div>
                    </Menubar.Item>

                    {location === 'aws' && (
                      <Menubar.Item
                        className="MenubarItem red"
                        onClick={() => cloudDeletetAction.open()}
                        disabled={ec2_instance_state !== 'stopped'}
                      >
                        Delete Cloud Resource
                        <div className="RightSlot">
                          <TrashIcon />
                        </div>
                      </Menubar.Item>
                    )}

                    <Menubar.Item
                      className="MenubarItem red"
                      onClick={() => deleteResourceAction.open()}
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

      <div className="flex flex-col mt-3 gap-2">
        <p className="text-[12px] text-white leading-[20p]">
          Et sit quisque odio dignissim cras tellus. Dolor facilisi facilisi
          quam cursus.
        </p>
        <div className="relative">
          <div
            className={`absolute top-1/2 -translate-y-1/2 z-20 flex items-center`}
            style={{ left: '-44px' }}
          >
            {location === 'hosted' && host && (
              <UserAvatar size="large" {...host} host={alive || false} />
            )}
            {location === 'aws' && alive && <CloudCircle on={alive} />}
          </div>

          <div
            className="flex items-center gap-16"
            style={{ margin: '0 40px' }}
          >
            <UserBubble
              users={users}
              direction="horizontal"
              live={false}
              size="small"
            />
            {alive && (
              <UserBubble
                users={liveUsers}
                direction="horizontal"
                live={true}
                size="small"
              />
            )}
          </div>
        </div>
      </div>

      {/* alive && (
        <>
          {httpServices.length > 0 && (
            <>
              <Table.Root className="w-full border border-[#50506C] rounded-md overflow-hidden mt-[10px]">
                <Table.Header>
                  <Table.Row className="w-full">
                    <Table.ColumnHeaderCell className="text-[12px] text-white font-bold p-2 w-[50%]">
                      Service
                    </Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className="text-[12px] text-white font-bold p-2 w-[50%]">
                      Action
                    </Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {httpServices.map((service) => (
                    <Table.Row
                      key={service.port}
                      className="border-t border-[#50506C] w-full"
                    >
                      <Table.Cell className="text-[12px] text-white p-2 w-[50%]">
                        {service.name}
                      </Table.Cell>
                      <Table.Cell className="text-[12px] text-white p-2 w-[50%]">
                        <ButtonBase
                          className="small"
                          text="open"
                          callback={() => onOpenService?.(service.name)}
                        />
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            </>
          )}
          <p className="mt-[5px]">
            <span className="-bg--c-green-1 rounded-[4px] h-[18px] text-[12px] font-bold px-2">
              {ip}
            </span>
          </p>
        </>
      )*/}

      <TagsBar tags={tags} addTag={addTag} />

      <div className="absolute right-4 bottom-[20px]">
        <StatusLed color={color} type="server-card" />
      </div>

      <div className="absolute right-9 bottom-[19px]">
        {alive && system && <SystemInfo {...system} />}
      </div>

      <div className="absolute right-0 bottom-[-19px] text-[11px]">
        {location === 'aws' &&
          ec2_instance_state !== null &&
          !['running', 'stopped', 'terminated'].includes(
            ec2_instance_state
          ) && (
            <span>
              {ec2_instance_state}
              <LoadingDots />
            </span>
          )}
      </div>

      <DialogControlled
        title="Docker Options"
        description="select docker resources limits"
        open={dockerAction.isOpened}
        onOpenChange={dockerAction.close}
      >
        <DockerOptionsForm action={dockerAction} />
      </DialogControlled>

      <DialogControlled
        title="Cloud Options"
        description="select cloud hosting options"
        open={cloudAction.isOpened}
        onOpenChange={cloudAction.close}
      >
        <CloudInstanceOptionsForm action={cloudAction} />
      </DialogControlled>

      <DialogControlled
        title="Are you sure ?"
        description="This will permanently delete cloud resource"
        open={cloudDeletetAction.isOpened}
        onOpenChange={cloudDeletetAction.close}
      >
        <ButtonBase className="red" text="Delete" {...cloudDeletetAction} />
      </DialogControlled>

      <DialogControlled
        title="Are you sure ?"
        description="This will permanently delete this resource"
        open={deleteResourceAction.isOpened}
        onOpenChange={deleteResourceAction.close}
      >
        <ButtonBase className="red" text="Delete" {...deleteResourceAction} />
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
}: ServerSystemInfo) => {
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

//

const CloudCircle = ({ on }: { on: boolean }) => {
  return (
    <>
      {on && (
        <div className="absolute left-[8px] -z-10 h-[31px] w-[31px] bg-[#ABFED4] origin-center rounded-full animate-ping"></div>
      )}
      <div
        className={`absolute -z-10 h-[48px] w-[48px] rounded-full border border-[#ACFFD5] bg-[#141432] ${
          on ? 'drop-shadow-[0px_0px_4px_#ABFED4]' : ''
        }`}
      >
        <icons.Cloud
          style={
            {
              '--w': '24px',
              width: 'var(--w)',
              margin: 'calc((48px - var(--w)) / 2) auto',
              stroke: '#ABFED4',
              fill: '#ABFED4',
            } as CSSProperties
          }
        />
      </div>
    </>
  );
};

//

export const ServerCard = ({
  project_server_id,
}: {
  project_server_id: number;
}) => {
  const props = useServerProps(project_server_id);

  if (props)
    return (
      <div style={{ '--node-wrapper-header-height': '-8px' } as CSSProperties}>
        <ServerCardInternal {...props} />
      </div>
    );

  return null;
};
