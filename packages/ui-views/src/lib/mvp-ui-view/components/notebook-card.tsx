import {
  icons,
  ResourceButtons,
  UserBubble,
  UserAvatar,
  TagsBar,
  TagsBarProps,
  SelectFieldset,
  SelectItem,
} from '@monorepo/demiurge-ui-components';
import { StatusLed } from '@monorepo/servers';
import { TF_User } from '@monorepo/demiurge-types';

//

export type NotebookCardProps = {
  status: 'running' | 'loading' | 'stopped';
  liveUsers?: TF_User[];
  host?: TF_User;
  groups?: boolean;
};

export const NotebookCard = ({
  status,
  groups,
  liveUsers,
  host,
  tags,
  addTag,
}: NotebookCardProps & TagsBarProps) => {
  const live = status === 'running' && liveUsers && liveUsers.length > 0;

  return (
    <div
      className={`min-w-[350px] min-h-[150px] max-w-[350px] mx-auto ${
        status !== 'stopped' ? 'gradient-notebook-card' : 'bg-[#2C2C47]'
      } relative rounded-[8px] flex flex-col`}
    >
      {groups && (
        <div className="absolute -bottom-6 flex items-center gap-[6px]">
          <span className="text-white text-[12px] font-bold bg-[#3FB885] rounded-[4px] px-[7px] h-[18px]">
            Newyork_data
          </span>
          <span className="text-white text-[12px] font-bold bg-[#7588B9] rounded-[4px] px-[7px] h-[18px]">
            team sync_13
          </span>
        </div>
      )}

      {status !== 'stopped' && (
        <div className="backdrop-blur-[4px] bg-[#1C1C3D66] absolute inset-0 rounded-[8px] z-10" />
      )}

      {live && (
        <div
          className={`absolute -right-4 z-20 top-[50%] flex items-center`}
          style={{ transform: 'translateY(-50%)' }}
        >
          <UserBubble
            users={liveUsers}
            direction="vertical"
            live={true}
            size="small"
          />
        </div>
      )}

      {host && (
        <div
          className={`absolute -left-5 top-1/2 -translate-y-1/2 z-20 flex items-center`}
        >
          <UserAvatar size="small" {...host} host />
        </div>
      )}

      <div className="flex items-center justify-between relative z-20 pt-[6px] px-[12px]">
        <div className="flex items-center gap-[8px]">
          <icons.NoteBookIcon />
          <span className="uppercase text-[#141432] -bg--c-orange-3 rounded-[4px] text-[10px] px-2 py-[4px] leading-[14px] h-[22px] flex items-center">
            Notebook
          </span>
          <p
            className="text-[12px] font-bold px-[6px] border border-transparent hover:border-[#6E678C] focus:border-[#6E678C] rounded-[4px] transition-all outline-none"
            contentEditable
          >
            Notebook #12345
          </p>
          <div className="rounded-full h-[15px] w-[15px] bg-[#D95BA7]" />
        </div>

        <div className="cursor-pointer mt-1">
          <icons.Settings className="h-6 w-6" />
        </div>
      </div>

      <div className="flex flex-col relative z-20 gap-2 w-4/5 mt-[20px] mx-auto">
        <div className="flex items-center gap-[24px]">
          <div className="!border-[1.5px] w-full border-[#141432] bg-transparent rounded-[2px] cursor-pointer h-[16px] text-white text-[8px] py-[2px] px-[6px] appearance-none">
            <SelectFieldset
              name={''}
              value={'python 3.10.12 modele'}
              onChange={function (v: string): void {}}
              placeholder={''}
              className="small w-full"
              integrated
            >
              {[
                'python 3.10.11 modele',
                'python 3.10.12 modele',
                'python 3.10.13 modele',
                'python 3.10.14 modele',
              ].map((v) => (
                <SelectItem value={v}>{v}</SelectItem>
              ))}
            </SelectFieldset>
          </div>

          <ResourceButtons
            size="small"
            type="enter"
            disabled={status === 'loading' || status === 'stopped'}
          />
        </div>
        <div className="flex items-center gap-[24px] w-full">
          <p
            className="text-white text-[8px] leading-[14px] !border-[1.5px] border-[#141432] px-[10px] h-[16px] w-full rounded-[2px]"
            contentEditable
          >
            root/app/project_weather/notebook2.ipynb
          </p>
          {status === 'running' && <ResourceButtons size="small" type="stop" />}
          {status === 'loading' && (
            <ResourceButtons size="small" type="pause" />
          )}
          {status === 'stopped' && <ResourceButtons size="small" type="play" />}
        </div>
      </div>

      <div className="p-5">
        <TagsBar tags={tags} addTag={addTag} />
      </div>

      <div className="absolute right-4 bottom-2 z-30">
        <StatusLed
          color={
            status === 'stopped'
              ? 'red'
              : status === 'loading'
              ? 'yellow'
              : /* running */ host
              ? 'blue'
              : 'green'
          }
          type="notebook-card"
        />
      </div>
    </div>
  );
};
