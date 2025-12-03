import * as RM from '@jupyterlab/rendermime';
import { log } from '@holistix/log';

//

interface IHasRawData {
  _raw: {
    _demiurge_outputArea_uid: string;
  };
  _rawData: {
    [key: string]: string;
  };
}

//
//

const old = Document.prototype.getElementById.bind(document);

class FrontendJsRenderer extends RM.RenderedJavaScript {
  //

  // redefine jupyterlab\packages\rendermime\src\widgets.ts RenderedJavaScript.render() method
  override render = (model: RM.IRenderMime.IMimeModel) => {
    const m = model as RM.IRenderMime.IMimeModel & IHasRawData;

    const outputAreaUid = m._raw._demiurge_outputArea_uid;

    for (const mime in m._rawData) {
      if (mime === 'application/javascript') {
        const js: string = m._rawData[mime];

        if (outputAreaUid) {
          log(
            7,
            'MY_JAVASCRIPT_RENDERER',
            `mock document.getElementById for [${outputAreaUid}]`
          );
          Document.prototype.getElementById = (id: string) => {
            const container = old(outputAreaUid);
            log(
              7,
              'MY_JAVASCRIPT_RENDERER',
              `document.getElementById("${outputAreaUid}.querySelector('[id="${id}"]')`
            );
            if (container) return container.querySelector(`[id="${id}"]`);
            else return null;
          };
        }

        // eslint-disable-next-line no-eval
        eval(js);

        if (outputAreaUid) {
          log(
            7,
            'MY_JAVASCRIPT_RENDERER',
            `restore original document.getElementById ([${outputAreaUid}])`
          );
          Document.prototype.getElementById = old;
        }
      }
    }

    return Promise.resolve();
  };
}

export default FrontendJsRenderer;
