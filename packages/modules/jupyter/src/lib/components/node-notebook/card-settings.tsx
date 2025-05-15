import { icons, SelectFieldset, SelectItem } from '@monorepo/ui-base';
import { NodeMainToolbar, useMakeButton } from '@monorepo/space/frontend';

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
    <div className="w-[220px] -bg--c-blue-gray-1 p-[10px] rounded-[4px] flex flex-col gap-[20px]">
      <div className="flex items-center justify-between gap-3">
        <NodeMainToolbar buttons={buttons} />
        <div className="flex items-center gap-[6px]">
          <icons.NoteBookIcon />
          <span className="uppercase text-white -bg--c-orange-3 rounded-[2px] text-[10px] p-[2px] leading-[14px]">
            Notebook
          </span>
          <div className="rounded-full h-[14px] w-[14px] -bg--c-pink-3" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="rounded-[2px] border-[1.5px] -border--c-blue-gray-3 px-[6px] py-[4px]">
          <p
            contentEditable
            className="text-white text-xs font-bold outline-none"
          >
            Node #12345
          </p>
        </div>

        <div className="w-full rounded-[2px] border-[1.5px] -border--c-blue-gray-3 px-[6px] py-[4px]">
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

        <div className="w-full rounded-[2px] border-[1.5px] -border--c-blue-gray-3 px-[6px] py-[4px]">
          <SelectFieldset
            name={''}
            value={'master-branch'}
            onChange={function (v: string): void {}}
            placeholder={''}
            className="small w-full"
            integrated
          >
            {['master-branch', 'dev-branch'].map((v) => (
              <SelectItem value={v}>{v}</SelectItem>
            ))}
          </SelectFieldset>
        </div>

        <div className="w-full rounded-[2px] border-[1.5px] -border--c-blue-gray-3 px-[6px] py-[4px]">
          <SelectFieldset
            name={''}
            value={'test.ipynb'}
            onChange={function (v: string): void {}}
            placeholder={''}
            className="small w-full"
            integrated
          >
            {['test.ipynb', 'test2.ipynb'].map((v) => (
              <SelectItem value={v}>{v}</SelectItem>
            ))}
          </SelectFieldset>
        </div>

        <div className="w-full rounded-[2px] border-[1.5px] -border--c-blue-gray-3 px-[6px] py-[4px]">
          <SelectFieldset
            name={''}
            value={'Title cell # 1'}
            onChange={function (v: string): void {}}
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
        <div className="ml-auto h-[8px] w-[8px] rounded-full -bg--c-green-3" />
      ) : status === 'error' ? (
        <div className="ml-auto h-[8px] w-[8px] rounded-full -bg--c-red-1" />
      ) : (
        <div className="ml-auto h-[8px] w-[8px] rounded-full -bg--c-yellow-3" />
      )}
    </div>
  );
};
