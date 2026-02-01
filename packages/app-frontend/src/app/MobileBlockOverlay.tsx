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
            className="go-fullscreen-btn"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--color-accent-muted)',
              color: 'var(--white)',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-sm)',
              fontWeight: 600,
            }}
            onClick={handleGoFullscreen}
          >
            Go Fullscreen
          </button>
        </div>
      )}
      {/* Overlay only if not hidden, not dismissed, not disabled */}
      {!(hide || dismissed || disabled) && (
        <div
          className="flex items-center justify-center"
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
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            className="text-center w-full"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: '320px',
              margin: '0 16px',
            }}
          >
            <h2
              className="font-bold"
              style={{
                fontSize: '1.5rem',
                lineHeight: '2rem',
                marginBottom: '16px',
                color: '#111827',
              }}
            >
              Sorry!
            </h2>
            <p style={{ color: '#1f2937', marginBottom: '8px' }}>
              This app is not well adapted for mobile yet.
            </p>
            <p
              style={{
                color: '#4b5563',
                fontSize: 'var(--font-size-sm)',
                marginBottom: '16px',
              }}
            >
              Please visit us from a desktop browser for the best experience.
            </p>
            <button
              style={{
                marginTop: '8px',
                padding: '8px 24px',
                backgroundColor: 'var(--color-accent)',
                color: 'var(--white)',
                borderRadius: '8px',
                fontWeight: 600,
                boxShadow: 'var(--shadow-sm)',
              }}
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
