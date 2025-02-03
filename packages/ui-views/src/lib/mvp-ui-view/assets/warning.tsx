import './warning.scss';

interface WarningProps {
  type: 'resource-bar' | 'server-card' | 'notebook-card';
  color: 'green' | 'red' | 'yellow' | 'blue';
}

export const Warning = ({ type, color }: WarningProps) => {
  const dimensions = {
    'resource-bar': { outer: '14px', inner: '12px' },
    'server-card': { outer: '12px', inner: '10px' },
    'notebook-card': { outer: '8px', inner: '6px' },
  };

  const { outer, inner } = dimensions[type];

  return (
    <div className={`status-led led-${color}`}>
      <div className={`h-[${outer}] w-[${outer}] rounded-full relative`}>
        <div
          className={`absolute h-[${inner}] w-[${inner}] left-px top-px rounded-full opacity-30 animate-ping`}
        />
      </div>
    </div>
  );
};
