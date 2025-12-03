import { TPosition } from '@holistix/core-graph';
import { WhiteboardMode } from './demiurge-space';
import { LayerViewport } from './layer-types';

/**
 * ModeIndicator
 *
 * Renders a small toolbar to switch between whiteboard interaction modes and
 * a "+" button that opens the contextual menu centered in the current view.
 *
 * onContextMenu(xy, client) receives:
 * - xy: space coordinates (affected by current viewport pan/zoom)
 * - client: client (window) pixel coordinates for the trigger position
 *
 * The "+" button computes the space coordinates of the current screen center by:
 * - taking the viewport's absoluteX/absoluteY (top-left corner in space units)
 * - adding half of the screen size expressed in space units (width / zoom, height / zoom)
 */
export const ModeIndicator = ({
  mode,
  onModeChange,
  onContextMenu,
  getViewport,
}: {
  mode: WhiteboardMode;
  onModeChange: (mode: WhiteboardMode) => void;
  getViewport: () => LayerViewport;
  onContextMenu: (xy: TPosition, clientPosition: TPosition) => void;
}) => {
  // Available modes and labels for the small toolbar
  const modes: { key: WhiteboardMode; label: string }[] = [
    { key: 'default', label: 'Normal' },
    { key: 'move-node', label: 'Move Node' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '5px',
        zIndex: 5,
        overflow: 'hidden',
      }}
    >
      {modes.map((m) => (
        <button
          key={m.key}
          onClick={() => onModeChange(m.key)}
          style={{
            background: mode === m.key ? '#fff' : 'transparent',
            color: mode === m.key ? '#222' : '#fff',
            border: 'none',
            padding: '0px 10px',
            fontWeight: mode === m.key ? 'bold' : 'normal',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.2s, color 0.2s',
            fontSize: '10px',
            height: '30px',
          }}
        >
          {m.label}
        </button>
      ))}

      {/* The "+" button opens the context menu at the center of the current view */}
      <button
        onClick={() => {
          const { zoom, absoluteX, absoluteY } = getViewport();

          // Convert the screen center to space coordinates using current viewport
          const centerSpaceX = -absoluteX + window.innerWidth / 2 / zoom;
          const centerSpaceY = -absoluteY + window.innerHeight / 2 / zoom;

          onContextMenu(
            { x: centerSpaceX, y: centerSpaceY },
            // Client coordinates set to screen center for the trigger position
            { x: window.innerWidth / 2, y: window.innerHeight / 2 }
          );
        }}
        style={{
          background: 'transparent',
          color: '#fff',
          border: 'none',
          padding: '0px 10px',
          fontWeight: 'normal',
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 0.2s, color 0.2s',
          fontSize: '10px',
          height: '30px',
          borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        +
      </button>
    </div>
  );
};
