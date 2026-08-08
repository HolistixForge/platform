import { useEffect, useMemo, useRef, useState } from 'react';

import { TJsonObject } from '@holistix-forge/simple-types';

/**
 * An SVG preview of a drawing, rendered locally from its elements.
 *
 * The SVG used to be stored alongside the elements in the shared map and
 * rewritten on every keystroke — a full serialized document pushed through
 * Yjs to every peer, for something each of them can draw itself. It is a
 * rendering, so it is derived here and never replicated.
 *
 * Keyed on the elements' versions rather than their contents: Excalidraw
 * bumps `version` on every mutation, so comparing those is enough and avoids
 * stringifying the scene on each render.
 */
export const useDrawingSvg = (elements: readonly TJsonObject[]): string => {
  const [svg, setSvg] = useState('');

  const signature = useMemo(
    () =>
      elements
        .map((e) => `${String(e['id'])}@${String(e['version'])}`)
        .join(','),
    [elements]
  );

  // `elements` is rebuilt on every shared-data change, so keying the effect on
  // it would re-export on renders where nothing moved. The signature is what
  // says something moved; the ref is how the effect reads the array without
  // depending on its identity.
  const latest = useRef(elements);
  latest.current = elements;

  useEffect(() => {
    let cancelled = false;
    const current = latest.current;

    if (!current.length) {
      setSvg('');
      return;
    }

    (async () => {
      try {
        const { exportToSvg, getCommonBounds } = (await import(
          '@excalidraw/excalidraw'
        )) as unknown as {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          exportToSvg: (args: any) => Promise<SVGSVGElement>;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          getCommonBounds: (e: any) => [number, number, number, number];
        };

        const [minX, minY] = getCommonBounds(current);

        const el = await exportToSvg({
          elements: current,
          appState: {
            exportBackground: false,
            exportWithDarkMode: false,
            scrollX: minX,
            scrollY: minY,
          },
          files: {},
        });

        // The component may have unmounted, or the scene moved on, while the
        // dynamic import and the export were in flight.
        if (cancelled) return;
        setSvg(new XMLSerializer().serializeToString(el));
      } catch (e) {
        if (!cancelled) setSvg('');
        console.error('[excalidraw] preview export failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signature]);

  return svg;
};
