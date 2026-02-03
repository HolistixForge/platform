import { icons } from '@holistix-forge/ui-base';

type DisplayMenuProps = {
  title: boolean;
  input: boolean;
  output: boolean;
  setTitle: (t: boolean) => void;
  setInput: (i: boolean) => void;
  setOutput: (o: boolean) => void;
};

export const DisplayMenu = ({
  title,
  input,
  output,
  setTitle,
  setInput,
  setOutput,
}: DisplayMenuProps) => {
  return (
    <ul
      className="flex items-center"
      style={{
        borderRadius: '2px',
        padding: '8px',
        gap: '18px',
        height: '28px',
        backgroundColor: 'var(--surface-800)',
      }}
    >
      <li className="flex items-center" style={{ gap: '6px' }}>
        <icons.Text />
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={title}
            onChange={() => setTitle(!title)}
            className="sr-only peer"
          />
          <div
            className="peer peer-checked:after:translate-x-[calc(100%+1px)] after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:start-[2px] after:bg-white after:rounded-full after:h-[8.4px] after:w-[8.4px] after:transition-all peer-checked:bg-[#00C2FF]"
            style={{
              width: '22px',
              height: '12px',
              outline: 'none',
              borderRadius: '9999px',
              border: '1px solid #C4C4C4',
              backgroundColor: 'var(--surface-800)',
            }}
          ></div>
        </label>
      </li>
      <li className="flex items-center" style={{ gap: '6px' }}>
        <icons.Alignement />
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={input}
            onChange={() => setInput(!input)}
            className="sr-only peer"
          />
          <div
            className="peer peer-checked:after:translate-x-[calc(100%+1px)] after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:start-[2px] after:bg-white after:rounded-full after:h-[8.4px] after:w-[8.4px] after:transition-all peer-checked:bg-[#00C2FF]"
            style={{
              width: '22px',
              height: '12px',
              outline: 'none',
              borderRadius: '9999px',
              border: '1px solid #C4C4C4',
              backgroundColor: 'var(--surface-800)',
            }}
          ></div>
        </label>
      </li>
      <li className="flex items-center" style={{ gap: '6px' }}>
        <icons.Grow />
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={output}
            onChange={() => setOutput(!output)}
            className="sr-only peer"
          />
          <div
            className="peer peer-checked:after:translate-x-[calc(100%+1px)] after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:start-[2px] after:bg-white after:rounded-full after:h-[8.4px] after:w-[8.4px] after:transition-all peer-checked:bg-[#00C2FF]"
            style={{
              width: '22px',
              height: '12px',
              outline: 'none',
              borderRadius: '9999px',
              border: '1px solid #C4C4C4',
              backgroundColor: 'var(--surface-800)',
            }}
          ></div>
        </label>
      </li>
    </ul>
  );
};
