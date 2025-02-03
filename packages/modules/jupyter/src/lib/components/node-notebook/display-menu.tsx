import { icons } from "../../assets/icons";

interface DisplayMenuProps {
  title: boolean,
  input: boolean,
  output: boolean,
  setTitle: (t: boolean) => void,
  setInput: (i: boolean) => void,
  setOutput: (o: boolean) => void,
}

export const DisplayMenu = ({ title, input, output, setTitle, setInput, setOutput }: DisplayMenuProps) => {

  return (
    <ul className="flex items-center -bg--c-blue-gray-1 rounded-[2px] px-[8px] py-[8px] gap-[18px] h-[28px]">
      <li className="flex items-center gap-[6px]">
        <icons.Text />
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={title} onChange={() => setTitle(!title)} className="sr-only peer" />
          <div className="w-[22px] h-[12px] -bg--c-blue-gray-1 outline-none rounded-full border-[1px] border-[#C4C4C4] peer peer-checked:after:translate-x-[calc(100%+1px)] after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:start-[2px] after:bg-white after:rounded-full after:h-[8.4px] after:w-[8.4px] after:transition-all peer-checked:bg-[#00C2FF]"></div>
        </label>
      </li>
      <li className="flex items-center gap-[6px]">
        <icons.Alignement />
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={input} onChange={() => setInput(!input)} className="sr-only peer" />
          <div className="w-[22px] h-[12px] -bg--c-blue-gray-1 outline-none rounded-full border-[1px] border-[#C4C4C4] peer peer-checked:after:translate-x-[calc(100%+1px)] after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:start-[2px] after:bg-white after:rounded-full after:h-[8.4px] after:w-[8.4px] after:transition-all peer-checked:bg-[#00C2FF]"></div>
        </label>
      </li>
      <li className="flex items-center gap-[6px]">
        <icons.Grow />
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={output} onChange={() => setOutput(!output)} className="sr-only peer" />
          <div className="w-[22px] h-[12px] -bg--c-blue-gray-1 outline-none rounded-full border-[1px] border-[#C4C4C4] peer peer-checked:after:translate-x-[calc(100%+1px)] after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:start-[2px] after:bg-white after:rounded-full after:h-[8.4px] after:w-[8.4px] after:transition-all peer-checked:bg-[#00C2FF]"></div>
        </label>
      </li>
    </ul>
  );
};
