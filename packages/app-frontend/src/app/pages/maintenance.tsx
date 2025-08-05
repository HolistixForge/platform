import {
  GearIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@radix-ui/react-icons';

export const MaintenancePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Container */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 border border-amber-500/30 rounded-full mb-4">
              <GearIcon className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            We're Under Maintenance
          </h1>

          {/* Subtitle */}
          <p className="text-slate-400 mb-6">
            We're currently performing some maintenance to improve your
            experience. Please check back soon.
          </p>
        </div>
      </div>
    </div>
  );
};
