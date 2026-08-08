/**
 * TAC-211 spike — an interactive React component inside the Excalidraw scene.
 *
 * Throwaway. Nothing here is meant to be merged; it exists to answer three
 * questions the ticket names, and to answer them by observation rather than
 * by reading the types:
 *
 *   1. Does `validateEmbeddable` let an element through that has no URL?
 *   2. Does the component receive keyboard and mouse directly, or does
 *      Excalidraw's "click to interact" gate sit in front of it?
 *   3. Does Excalidraw unmount the JSX of an embeddable scrolled out of view
 *      (free culling), or does it keep it mounted (culling is ours to build)?
 *
 * Question 3 is answered by the mount counter: it is module-level, so it
 * survives the component and counts every mount of every instance.
 */
import { FC, useEffect, useRef, useState } from 'react';

//

/** Mounts observed so far, per embeddable id — the culling probe. */
const mountLog = new Map<string, number>();

/** Exposed on window so the browser can read it without a React devtool. */
const publishMountLog = () => {
  (
    window as unknown as { __spikeMounts: Record<string, number> }
  ).__spikeMounts = Object.fromEntries(mountLog);
};

//

export type TSpikeEmbeddableProps = {
  id: string;
  /** Whatever the element carried in `customData`. */
  data: Record<string, unknown>;
};

/**
 * Deliberately exercises the three input paths an Excalidraw embed is known to
 * interfere with: a click, a text field that needs the keyboard, and a wheel
 * that must not be stolen by the canvas zoom.
 */
export const SpikeEmbeddable: FC<TSpikeEmbeddableProps> = ({ id, data }) => {
  const [clicks, setClicks] = useState(0);
  const [text, setText] = useState('');
  const [wheelDeltas, setWheelDeltas] = useState(0);
  const [keydowns, setKeydowns] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountLog.set(id, (mountLog.get(id) ?? 0) + 1);
    publishMountLog();
  }, [id]);

  const label = typeof data['label'] === 'string' ? data['label'] : 'spike';

  return (
    <div
      className="spike-embeddable"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: 10,
        background: '#12121a',
        color: '#e8e8f0',
        border: '1px solid #672aa4',
        borderRadius: 8,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflow: 'hidden',
      }}
    >
      <strong style={{ color: '#b98bff' }}>{label}</strong>

      <button
        data-testid={`spike-click-${id}`}
        onClick={() => setClicks((c) => c + 1)}
        style={{
          background: '#672aa4',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
      >
        clicks: {clicks}
      </button>

      <input
        data-testid={`spike-input-${id}`}
        value={text}
        placeholder="type here"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={() => setKeydowns((k) => k + 1)}
        style={{
          background: '#1e1e2a',
          color: '#e8e8f0',
          border: '1px solid #3a3a52',
          borderRadius: 4,
          padding: '3px 6px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      <span data-testid={`spike-keys-${id}`}>keydowns: {keydowns}</span>

      <div
        ref={scrollerRef}
        data-testid={`spike-wheel-${id}`}
        onWheel={(e) => setWheelDeltas((w) => w + Math.sign(e.deltaY))}
        style={{
          flex: 1,
          minHeight: 24,
          overflow: 'auto',
          background: '#0d0d14',
          borderRadius: 4,
          padding: 4,
        }}
      >
        wheel: {wheelDeltas}
        <div style={{ height: 200 }} />
      </div>
    </div>
  );
};
