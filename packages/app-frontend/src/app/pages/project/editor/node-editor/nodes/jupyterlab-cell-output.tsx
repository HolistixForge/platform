import { useCallback, useEffect, useMemo, useState } from 'react';
import { OutputArea } from '@jupyterlab/outputarea';
import { Widget } from '@lumino/widgets';

import { IOutput, TDKID, TNodePython } from '@monorepo/demiurge-types';
import { useDebugComponent } from '@monorepo/log';
import { BrowserWidgetManager } from '@monorepo/jupyterlab-api-browser';
import { KernelStateIndicator } from '@monorepo/demiurge-ui-components';

import { useKernelPack, useSharedData } from '../../../model/collab-model-chunk';
import { makeUuid } from '@monorepo/simple-types';

//

type PythonOutputProps = {
  dkid: TDKID;
  nid: string;
};

const constEmptyArray: IOutput[] = [];

//
//

/**
 * create and return a function that inject a `_demiurge_outputArea_uid` field
 * in all object of an array.
 * it is use to wrap output area in a div with a known unique id.
 * this div is used by Javascript widget renderer to owerload
 * document.getElementById like call in the render code.
 * @returns
 */
const uuidInjecter = () => {
  const id = makeUuid();
  return {
    uuidInject: (output: IOutput[]) => {
      return output.map((o) => ({
        ...o,
        // injected uid for use by js-renderer
        _demiurge_outputArea_uid: id,
      }));
    },
    uuid: id,
  };
};

//
//

export const JupyterlabCellOutput = ({ dkid, nid }: PythonOutputProps) => {
  const debug = useDebugComponent();

  const data = useSharedData(['nodeData'], (sd) => sd.nodeData.get(nid));

  const kernelPack = useKernelPack(dkid);

  const { uuid, uuidInject } = useMemo(() => uuidInjecter(), []);

  /** the serialized python output data */
  const output = (data && (data as TNodePython).output) || constEmptyArray;

  const [oa, setOa] = useState<OutputArea | null>(null);

  // if kernel readyness is true, or change from false to true,
  // create a new outputArea.
  // else reset to null to render a information message
  useEffect(() => {
    if (kernelPack.state === 'widget-manager-loaded') {
      const newOA = (
        kernelPack.widgetManager as BrowserWidgetManager
      ).createOutputArea();
      setOa((prev) => {
        prev?.dispose();
        return newOA;
      });
    } else {
      setOa((prev) => {
        prev?.dispose();
        return null;
      });
    }
  }, [kernelPack.state, kernelPack.widgetManager]);

  //

  // reload the widgets whenever the data changed
  useEffect(() => {
    if (oa) {
      oa.model.clear();
      const customOutput = uuidInject(output);
      oa.model.fromJSON(customOutput);
    }
  }, [oa, output, uuidInject]);

  //

  return (
    <div>
      <KernelStateIndicator
        StartProgress={kernelPack.progress}
        startState={kernelPack.state}
      />
      {oa && (
        <div id={uuid} className="jupyter-output-area-box">
          {debug && (
            <span className="jupyter-output-area-box-debug">{uuid}</span>
          )}
          <CodeCellOutputContainer outputArea={oa} />
        </div>
      )}
    </div>
  );
};

//
//
//

const CodeCellOutputContainer = ({
  outputArea,
}: {
  outputArea: OutputArea;
}) => {
  // const scale = useRef(1);

  //
  //

  const handleDivMount = useCallback(
    (div: HTMLDivElement) => {
      //
      /*
        if (div) {
          const observer = new ResizeObserver(() => {
            const p = div.parentNode as HTMLElement;
            if (p) {
              const { width: pw, height: ph } = p.getBoundingClientRect();
              const { width: cw, height: ch } = div.getBoundingClientRect();
              applyScale(div, pw, ph, cw, ch);
            }
          });
          observer.observe(div);
        }*/

      // nominal, widget is attached to a mounted div
      if (outputArea.isAttached && outputArea.node.isConnected) return;

      // else, we have to attach widget if everything is ready
      if (outputArea && outputArea.node && div && div.isConnected)
        Widget.attach(outputArea, div);
    },
    [outputArea]
  );

  return <div className="cell-output" ref={handleDivMount}></div>;
};

//
//
//

/*
const applyScale = (
  n: HTMLDivElement,
  pw: number,
  ph: number,
  cw: number,
  ch: number
) => {
  return;
  // if both dimension does not match
  if (Math.abs(pw - cw) > 2 && Math.abs(ph - ch) > 2) {
    const scale = parseFloat(n.style.getPropertyValue('--fit-scale') || '1');
    // console.log({ pw, ph, cw, ch, scale: scale });
    let ns = scale;
    if (cw === 0 || ch === 0) ns = 1;
    else if (pw / cw < ph / ch) ns = ns * (pw / cw);
    else ns = ns * (ph / ch);

    const rw = cw / scale;
    const fw = rw * ns;
    const rh = ch / scale;
    const fh = rh * ns;
    // console.log({ rw, rh, fw, fh });

    const tx = -(rw - fw) / 2 + (pw - fw) / 2;
    const ty = -(rh - fh) / 2 + (ph - fh) / 2;

    n.style.setProperty('--fit-scale', `${ns}`);
    n.style.setProperty('--fit-tx', `${tx}px`);
    n.style.setProperty('--fit-ty', `${ty}px`);
  }
};
*/
