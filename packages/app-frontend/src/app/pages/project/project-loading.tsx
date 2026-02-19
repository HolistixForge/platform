import { InfoCircledIcon } from '@radix-ui/react-icons';

type LoadingProps = {
  message: string;
  progress?: number;
};

export const ProjectLoading = ({ message, progress }: LoadingProps) => (
  <div
    className="flex flex-col items-center justify-center"
    style={{ height: 'calc(100vh - 80px)', gap: '16px' }}
  >
    <div className="flex flex-col items-center" style={{ gap: '8px' }}>
      <span
        className="font-medium"
        style={{
          fontSize: '1.875rem',
          lineHeight: '2.25rem',
          color: 'var(--surface-900)',
        }}
      >
        {progress || 0}%
      </span>
      <p style={{ color: 'var(--neutral-5)' }}>{message}</p>
    </div>
  </div>
);

type ErrorProps = {
  message: string;
};

export const ProjectError = ({ message }: ErrorProps) => (
  <div
    className="flex flex-col items-center justify-center"
    style={{ height: 'calc(100vh - 80px)', gap: '16px' }}
  >
    <InfoCircledIcon
      style={{ width: '48px', height: '48px', color: 'var(--primary-500)' }}
    />
    <p className="font-medium" style={{ color: 'var(--primary-500)' }}>
      {message}
    </p>
  </div>
);
