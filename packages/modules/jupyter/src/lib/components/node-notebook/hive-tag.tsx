export const HiveTag = ({ title, color }: { title: string; color: string }) => {
  return (
    <div className="flex items-center" style={{ gap: '12px' }}>
      <div
        className={`${color}`}
        style={{
          width: '14px',
          height: '5px',
          borderRadius: '50px',
          transform: 'rotate(15deg)',
        }}
      />
      <p
        className="text-right"
        style={{
          width: '50px',
          color: 'var(--white)',
          fontSize: '9px',
          lineHeight: 'normal',
        }}
      >
        {title}
      </p>
    </div>
  );
};
