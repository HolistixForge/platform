import {
  icons,
  ResourceButtons,
  UserBubble,
  UserAvatar,
  TagsBar,
  TagsBarProps,
  SelectFieldset,
  SelectItem,
} from '@holistix-forge/ui-base';
import { StatusLed } from '@holistix-forge/user-containers/frontend';
import { TF_User } from '@holistix-forge/types';

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
      className={`relative flex flex-col ${
        status !== 'stopped' ? 'gradient-notebook-card' : ''
      }`}
      style={{
        minWidth: '350px',
        minHeight: '150px',
        maxWidth: '350px',
        marginLeft: 'auto',
        marginRight: 'auto',
        backgroundColor: status === 'stopped' ? '#2C2C47' : undefined,
        borderRadius: '8px',
      }}
    >
      {groups && (
        <div
          className="absolute flex items-center"
          style={{ bottom: '-24px', gap: '6px' }}
        >
          <span
            className="font-bold"
            style={{
              color: 'white',
              fontSize: '12px',
              backgroundColor: '#3FB885',
              borderRadius: '4px',
              padding: '0 7px',
              height: '18px',
            }}
          >
            Newyork_data
          </span>
          <span
            className="font-bold"
            style={{
              color: 'white',
              fontSize: '12px',
              backgroundColor: '#7588B9',
              borderRadius: '4px',
              padding: '0 7px',
              height: '18px',
            }}
          >
            team sync_13
          </span>
        </div>
      )}

      {status !== 'stopped' && (
        <div
          className="absolute"
          style={{
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(28, 28, 61, 0.4)',
            inset: 0,
            borderRadius: '8px',
            zIndex: 10,
          }}
        />
      )}

      {live && (
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

      {host && (
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

      <div
        className="flex items-center justify-between relative"
        style={{ zIndex: 20, paddingTop: '6px', padding: '6px 12px 0 12px' }}
      >
        <div className="flex items-center" style={{ gap: '8px' }}>
          <icons.NoteBookIcon />
          <span
            className="flex items-center"
            style={{
              textTransform: 'uppercase',
              color: '#141432',
              borderRadius: '4px',
              fontSize: '10px',
              paddingLeft: '8px',
              paddingRight: '8px',
              paddingTop: '4px',
              lineHeight: '14px',
              height: '22px',
              backgroundColor: 'var(--orange-300)',
            }}
          >
            Notebook
          </span>
          <p
            className="font-bold"
            style={{
              fontSize: '12px',
              padding: '0 6px',
              border: '1px solid transparent',
              borderRadius: '4px',
              transition: 'all 0.2s',
              outline: 'none',
            }}
            contentEditable
          >
            Notebook #12345
          </p>
          <div
            style={{
              borderRadius: '50%',
              height: '15px',
              width: '15px',
              backgroundColor: '#D95BA7',
            }}
          />
        </div>

        <div className="cursor-pointer" style={{ marginTop: '4px' }}>
          <icons.Settings style={{ height: '24px', width: '24px' }} />
        </div>
      </div>

      <div
        className="flex flex-col relative"
        style={{
          zIndex: 20,
          gap: '8px',
          width: '80%',
          marginTop: '20px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <div className="flex items-center" style={{ gap: '24px' }}>
          <div
            className="w-full cursor-pointer"
            style={{
              borderWidth: '1.5px',
              borderStyle: 'solid',
              borderColor: '#141432',
              backgroundColor: 'transparent',
              borderRadius: '2px',
              height: '16px',
              color: 'white',
              fontSize: '8px',
              padding: '2px 6px',
            }}
          >
            <SelectFieldset
              name={''}
              value={'python 3.10.12 modele'}
              onChange={function (v: string): void {
                /* noop */
              }}
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
        <div className="flex items-center w-full" style={{ gap: '24px' }}>
          <p
            style={{
              color: 'white',
              fontSize: '8px',
              lineHeight: '14px',
              borderWidth: '1.5px',
              borderStyle: 'solid',
              borderColor: '#141432',
              padding: '0 10px',
              height: '16px',
              width: '100%',
              borderRadius: '2px',
            }}
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

      <div style={{ padding: '20px' }}>
        <TagsBar tags={tags} addTag={addTag} />
      </div>

      <div
        className="absolute"
        style={{ right: '16px', bottom: '8px', zIndex: 30 }}
      >
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
