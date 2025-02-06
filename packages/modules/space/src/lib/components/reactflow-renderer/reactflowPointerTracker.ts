import { Viewport } from 'reactflow';
import * as _ from 'lodash';
import { SpaceAwareness } from '../apis/spaceAwareness';
import { PointerTracker } from '../apis/pointerTracker';
import { TPosition } from '@monorepo/core';

//

export class ReactflowPointerTracker extends PointerTracker {
  private _viewport = { x: 0, y: 0, zoom: 1 };
  private _pointer: TPosition = { x: 0, y: 0 };
  private ga: SpaceAwareness;
  private reactFlowParentDiv: HTMLDivElement | null = null;

  constructor(ga: SpaceAwareness) {
    super();
    this.ga = ga;
  }

  public bindReactFlowParentDiv(div: HTMLDivElement) {
    this.reactFlowParentDiv = div;
  }

  private getReactflowPaneBox() {
    const a =
      this.reactFlowParentDiv?.getElementsByClassName('react-flow__pane');
    if (a && a.length === 1)
      return (a[0] as HTMLDivElement).getBoundingClientRect();
    else return undefined;
  }

  private fromLocalPane(p: TPosition) {
    return {
      x: (p.x - this._viewport.x) / this._viewport.zoom,
      y: (p.y - this._viewport.y) / this._viewport.zoom,
    };
  }

  public toLocalPane(p: TPosition) {
    return {
      x: p.x * this._viewport.zoom + this._viewport.x,
      y: p.y * this._viewport.zoom + this._viewport.y,
    };
  }

  public fromMouseEvent(p: TPosition): TPosition {
    const b = this.getReactflowPaneBox();
    if (b) return this.fromLocalPane({ x: p.x - b.left, y: p.y - b.top });
    else return p;
  }

  private track = _.debounce(
    () => {
      const { x, y } = this.fromLocalPane(this._pointer);
      this.ga.setPointer(x, y);
    },
    250,
    { maxWait: 250 }
  );

  public setPointerInactive() {
    this.ga.setPointer(this._pointer.x, this._pointer.y);
  }

  public onPaneMouseMove(event: React.MouseEvent) {
    if (event) {
      const b = this.getReactflowPaneBox();
      if (b) {
        this._pointer = {
          x: event.clientX - b.left,
          y: event.clientY - b.top,
        };
        this.track();
      }
    }
  }

  public onMove(event: MouseEvent | any, viewport: Viewport) {
    this.onPaneMouseMove(event);
    this._viewport = viewport;
    this.track();
  }

  public isPositionVisible(p: TPosition) {
    const MARGE = 40;
    const b = this.getReactflowPaneBox();
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
