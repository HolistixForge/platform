import * as _ from 'lodash';
import { TPosition } from '@monorepo/core';
import { Viewport } from './demiurge-space';
import { Awareness } from '@monorepo/collab-engine';

//

export class PointerTracker {
  private _viewport: Viewport = { absoluteX: 0, absoluteY: 0, zoom: 1 };
  /** absolute position of current user pointer */
  private _pointer: TPosition = { x: 0, y: 0 };
  private awareness: Awareness;
  private div: HTMLDivElement | null = null;
  private viewId: string;

  constructor(viewId: string, awareness: Awareness) {
    this.viewId = viewId;
    this.awareness = awareness;
  }

  public bindDiv(div: HTMLDivElement) {
    this.div = div;
  }

  private getDivBox() {
    if (this.div) return this.div.getBoundingClientRect();
    else return undefined;
  }

  private fromLocalPane(p: TPosition) {
    return {
      x: p.x / this._viewport.zoom - this._viewport.absoluteX,
      y: p.y / this._viewport.zoom - this._viewport.absoluteY,
    };
  }

  public toLocalPane(p: TPosition) {
    return {
      x: (p.x + this._viewport.absoluteX) * this._viewport.zoom,
      y: (p.y + this._viewport.absoluteY) * this._viewport.zoom,
    };
  }

  public fromMouseEvent(p: TPosition): TPosition {
    const b = this.getDivBox();
    if (b) {
      const local = { x: p.x - b.left, y: p.y - b.top };
      const absolute = this.fromLocalPane(local);
      /*
      console.log('fromMouseEvent: ', {
        event: p,
        box: { left: b.left, top: b.top },
        local,
        viewport: this._viewport,
        absolute,
      });
      */
      return absolute;
    } else throw new Error('PointerTracker: no div bound');
  }

  private track = _.debounce(
    () => {
      const { x, y } = this._pointer;
      this.awareness.emitPositionAwareness({
        referenceId: this.viewId,
        position: { x, y, z: 0 },
        reference: 'LAYER',
      });
    },
    50,
    { maxWait: 50 }
  );

  public setPointerInactive() {
    this.awareness.emitPositionAwareness({
      referenceId: this.viewId,
      position: { x: this._pointer.x, y: this._pointer.y, z: 0 },
      reference: 'LAYER',
      inactive: true,
    });
  }

  public onPaneMouseMove(event: React.MouseEvent) {
    if (event) {
      this._pointer = this.fromMouseEvent({
        x: event.clientX,
        y: event.clientY,
      });
      this.track();
    }
  }

  public onMove(viewport: Viewport) {
    this._viewport = viewport;
  }

  public isPositionVisible(p: TPosition) {
    const MARGE = 40;
    const b = this.getDivBox();
    if (b) {
      let out = false;

      const hw = b.width / 2; // half Pane Width
      const hh = b.height / 2; // half Pane Height
      const aspectRatio = b.width / b.height;

      let { x, y } = p;

      x = x - hw; // from Pane center
      y = y - hh; // from Pane center

      if (x > hw && Math.abs(x / y) >= aspectRatio) {
        y = (hw / x) * y;
        x = hw - MARGE;
        out = true;
      } else if (x < -hw && Math.abs(x / y) >= aspectRatio) {
        y = (-hw / x) * y;
        x = -hw + MARGE;
        out = true;
      } else if (y > hh && Math.abs(x / y) < aspectRatio) {
        x = (hh / y) * x;
        y = hh - MARGE;
        out = true;
      } else if (y < -hh && Math.abs(x / y) < aspectRatio) {
        x = (-hh / y) * x;
        y = -hh + MARGE;
        out = true;
      }

      return { x: x + hw, y: y + hh, out };
    } else return { x: 0, y: 0, out: false };
  }
}
