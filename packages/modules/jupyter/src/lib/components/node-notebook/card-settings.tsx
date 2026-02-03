import { icons, SelectFieldset, SelectItem } from '@holistix-forge/ui-base';
import {
  NodeMainToolbar,
  useMakeButton,
} from '@holistix-forge/whiteboard/frontend';

type CardSettingsProps = {
  status: 'success' | 'error' | 'warning';
};

export const CardSettings = ({ status }: CardSettingsProps) => {
  const buttons = useMakeButton({
    isLocked: false,
    isExpanded: true,
    expand: () => null,
    reduce: () => null,
    onLock: () => null,
    onUnlock: () => null,
    onFullScreen: () => null,
  });

  return (
    <div
      className="flex flex-col"
      style={{
        width: '220px',
        padding: '10px',
        borderRadius: '4px',
        gap: '20px',
        backgroundColor: 'var(--surface-800)',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ gap: '12px' }}
      >
        <NodeMainToolbar buttons={buttons} />
        <div className="flex items-center" style={{ gap: '6px' }}>
          <icons.NoteBookIcon />
          <span
            style={{
              textTransform: 'uppercase',
              color: 'var(--white)',
              borderRadius: '2px',
              fontSize: '10px',
              padding: '2px',
              lineHeight: '14px',
              backgroundColor: 'var(--orange-300)',
            }}
          >
            Notebook
          </span>
          <div
            style={{
              borderRadius: '9999px',
              height: '14px',
              width: '14px',
              backgroundColor: 'var(--primary-300)',
            }}
          />
        </div>
      </div>
      <div className="flex flex-col" style={{ gap: '8px' }}>
        <div
          style={{
            borderRadius: '2px',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            borderColor: 'var(--surface-600)',
            padding: '4px 6px',
          }}
        >
          <p
            contentEditable
            className="font-bold"
            style={{
              color: 'var(--white)',
              fontSize: 'var(--font-size-xs)',
              outline: 'none',
            }}
          >
            Node #12345
          </p>
        </div>

        <div
          className="w-full"
          style={{
            borderRadius: '2px',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            borderColor: 'var(--surface-600)',
            padding: '4px 6px',
          }}
        >
          <SelectFieldset
            name={''}
            value={'python 3.10.12 modele'}
            onChange={function (v: string): void {
              // No-op: To be implemented
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

        <div
          className="w-full"
          style={{
            borderRadius: '2px',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            borderColor: 'var(--surface-600)',
            padding: '4px 6px',
          }}
        >
          <SelectFieldset
            name={''}
            value={'master-branch'}
            onChange={function (v: string): void {
              // No-op: To be implemented
            }}
            placeholder={''}
            className="small w-full"
            integrated
          >
            {['master-branch', 'dev-branch'].map((v) => (
              <SelectItem value={v}>{v}</SelectItem>
            ))}
          </SelectFieldset>
        </div>

        <div
          className="w-full"
          style={{
            borderRadius: '2px',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            borderColor: 'var(--surface-600)',
            padding: '4px 6px',
          }}
        >
          <SelectFieldset
            name={''}
            value={'test.ipynb'}
            onChange={function (v: string): void {
              // No-op: To be implemented
            }}
            placeholder={''}
            className="small w-full"
            integrated
          >
            {['test.ipynb', 'test2.ipynb'].map((v) => (
              <SelectItem value={v}>{v}</SelectItem>
            ))}
          </SelectFieldset>
        </div>

        <div
          className="w-full"
          style={{
            borderRadius: '2px',
            borderWidth: '1.5px',
            borderStyle: 'solid',
            borderColor: 'var(--surface-600)',
            padding: '4px 6px',
          }}
        >
          <SelectFieldset
            name={''}
            value={'Title cell # 1'}
            onChange={function (v: string): void {
              // No-op: To be implemented
            }}
            placeholder={''}
            className="small w-full"
            integrated
          >
            {['Title cell # 1', 'Title cell # 2'].map((v) => (
              <SelectItem value={v}>{v}</SelectItem>
            ))}
          </SelectFieldset>
        </div>
      </div>
      {status === 'success' ? (
        <div
          style={{
            marginLeft: 'auto',
            height: '8px',
            width: '8px',
            borderRadius: '9999px',
            backgroundColor: 'var(--green-300)',
          }}
        />
      ) : status === 'error' ? (
        <div
          style={{
            marginLeft: 'auto',
            height: '8px',
            width: '8px',
            borderRadius: '9999px',
            backgroundColor: 'var(--red-300)',
          }}
        />
      ) : (
        <div
          style={{
            marginLeft: 'auto',
            height: '8px',
            width: '8px',
            borderRadius: '9999px',
            backgroundColor: 'var(--yellow-300)',
          }}
        />
      )}
    </div>
  );
};
