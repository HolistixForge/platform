import { InfoCircledIcon } from '@radix-ui/react-icons';

type LoadingProps = {
  message: string;
  progress?: number;
};

export const ProjectLoading = ({ message, progress }: LoadingProps) => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-4">
    <div className="flex flex-col items-center gap-2">
      <span className="text-3xl font-medium text-blue-500">
        {progress || 0}%
      </span>
      <p className="text-slate-400">{message}</p>
    </div>
  </div>
);

type ErrorProps = {
  message: string;
};

export const ProjectError = ({ message }: ErrorProps) => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-4">
    <InfoCircledIcon className="w-12 h-12 text-red-500" />
    <p className="text-red-500 font-medium">{message}</p>
  </div>
);
