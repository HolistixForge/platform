import './status-led.scss';

export type StatusLedProps = {
  type: 'resource-bar' | 'server-card' | 'notebook-card';
  color: 'green' | 'red' | 'yellow' | 'blue';
};

export const StatusLed = ({ type, color }: StatusLedProps) => {
  const dimensions = {
    'resource-bar': { outer: '14px', inner: '12px' },
    'server-card': { outer: '12px', inner: '10px' },
    'notebook-card': { outer: '8px', inner: '6px' },
  };

  const { outer, inner } = dimensions[type];

  return (
    <div className={`status-led led-${color}`}>
      <div
        className="relative"
        style={{ height: outer, width: outer, borderRadius: '9999px' }}
      >
        <div
          className="absolute animate-ping"
          style={{
            height: inner,
            width: inner,
            left: '1px',
            top: '1px',
            borderRadius: '9999px',
            opacity: 0.3,
          }}
        />
      </div>
    </div>
  );
};
