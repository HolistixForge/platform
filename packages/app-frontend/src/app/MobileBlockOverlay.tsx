import { useEffect, useState } from 'react';

function getCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
    ?.split('=')[1];
}

function isFullscreen() {
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

function requestFullscreen(elem: HTMLElement) {
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if ((elem as any).webkitRequestFullscreen) {
    (elem as any).webkitRequestFullscreen();
  } else if ((elem as any).msRequestFullscreen) {
    (elem as any).msRequestFullscreen();
  }
}

export function MobileBlockOverlay({
  hide,
  disabled,
}: {
  hide?: boolean;
  disabled?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [fullscreen, setFullscreen] = useState(!!isFullscreen());

  useEffect(() => {
    if (getCookie('mobileOverlayDismissed') === 'true') {
      setDismissed(true);
    }
    // Listen for fullscreen changes
    function handleFullscreenChange() {
      setFullscreen(!!isFullscreen());
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange
      );
      document.removeEventListener(
        'mozfullscreenchange',
        handleFullscreenChange
      );
      document.removeEventListener(
        'MSFullscreenChange',
        handleFullscreenChange
      );
    };
  }, []);

  const handleOk = () => {
    document.cookie = 'mobileOverlayDismissed=true; path=/; max-age=31536000'; // 1 year
    setDismissed(true);
  };

  const handleGoFullscreen = () => {
    requestFullscreen(document.documentElement);
  };

  return (
    <>
      {/* Go Fullscreen button always rendered if not in fullscreen */}
      {!fullscreen && (
        <div className="go-fullscreen-button">
          <button
            className="px-4 py-2 bg-blue-700 text-white rounded-lg shadow font-semibold hover:bg-blue-800 transition"
            onClick={handleGoFullscreen}
          >
            Go Fullscreen
          </button>
        </div>
      )}
      {/* Overlay only if not hidden, not dismissed, not disabled */}
      {!(hide || dismissed || disabled) && (
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
      )}
    </>
  );
}
