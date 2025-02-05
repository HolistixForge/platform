import { icons } from '@monorepo/demiurge-ui-components';

//

type FilterBoxProps = {};

export const Rules = ({}: FilterBoxProps) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center bg-white/5 h-[28px] w-full rounded-[4px] py-1 px-3 gap-[20px]">
        <div className="cursor-pointer">
          <icons.Search />
        </div>
        <input
          className="w-full h-full text-[14px] text-white/40"
          placeholder="rules"
        />
        <div className="cursor-pointer">
          <icons.Filter className="w-7 h-7" />
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between rounded-[4px] px-[13px] bg-[#2A2A3F] h-[36px] cursor-pointer">
          <p className="text-[16px] text-white">Rules</p>
        </div>
        <div className="bg-white bg-opacity-5 p-[34px] rounded-b-[4px] flex flex-col gap-[10px]">
          {Array.from({ length: 15 }).map((_, index) => (
            <div key={index} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id={`rule-${index}`}
                name={`rule-${index}`}
                value={`rule-${index}`}
                className='h-[21px] w-[21px] bg-[#d9d9d9] rounded-[5px] before:content-["✔"] before:absolute before:top-1/2 before:left-1/2 before:-translate-y-1/2 before:-translate-x-1/2 before:text-[#642F78] relative before:opacity-0 checked:before:opacity-100 before:transition-all'
              />
              <label
                htmlFor={`rule-${index}`}
                className="text-white cursor-pointer"
              >
                Rule {index}
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
