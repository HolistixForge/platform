import { icons } from '@holistix-forge/ui-base';

//

type FilterBoxProps = Record<string, never>;

export const Rules = (_props: FilterBoxProps) => {
  return (
    <div className="flex flex-col" style={{ gap: '12px' }}>
      <div
        className="flex items-center w-full"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          height: '28px',
          borderRadius: '4px',
          padding: '4px 12px',
          gap: '20px',
        }}
      >
        <div className="cursor-pointer">
          <icons.Search />
        </div>
        <input
          className="w-full h-full"
          style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}
          placeholder="rules"
        />
        <div className="cursor-pointer">
          <icons.Filter style={{ width: '28px', height: '28px' }} />
        </div>
      </div>

      <div className="flex flex-col">
        <div
          className="flex items-center justify-between cursor-pointer"
          style={{
            borderRadius: '4px',
            padding: '0 13px',
            backgroundColor: '#2A2A3F',
            height: '36px',
          }}
        >
          <p style={{ fontSize: '16px', color: 'white' }}>Rules</p>
        </div>
        <div
          className="flex flex-col"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            padding: '34px',
            borderRadius: '0 0 4px 4px',
            gap: '10px',
          }}
        >
          {Array.from({ length: 15 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center cursor-pointer"
              style={{ gap: '8px' }}
            >
              <input
                type="checkbox"
                id={`rule-${index}`}
                name={`rule-${index}`}
                value={`rule-${index}`}
                className="relative"
                style={{
                  height: '21px',
                  width: '21px',
                  backgroundColor: '#d9d9d9',
                  borderRadius: '5px',
                }}
              />
              <label
                htmlFor={`rule-${index}`}
                className="cursor-pointer"
                style={{ color: 'white' }}
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
