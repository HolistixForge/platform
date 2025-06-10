import { useEffect, useState } from 'react';

function getCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
    ?.split('=')[1];
}

export function MobileBlockOverlay({ hide }: { hide?: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (getCookie('mobileOverlayDismissed') === 'true') {
      setDismissed(true);
    }
  }, []);

  if (hide || dismissed) return null;

  const handleOk = () => {
    document.cookie = 'mobileOverlayDismissed=true; path=/; max-age=31536000'; // 1 year
    setDismissed(true);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm lg:hidden"
      style={{
        pointerEvents: 'auto',
        minHeight: '100vh',
        minWidth: '100vw',
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <div className="bg-white/90 rounded-xl p-8 shadow-xl text-center max-w-xs w-full mx-4">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Sorry!</h2>
        <p className="text-gray-800 mb-2">
          This app is not well adapted for mobile yet.
        </p>
        <p className="text-gray-600 text-sm mb-4">
          Please visit us from a desktop browser for the best experience.
        </p>
        <button
          className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow hover:bg-blue-700 transition"
          onClick={handleOk}
        >
          OK
        </button>
      </div>
    </div>
  );
}
