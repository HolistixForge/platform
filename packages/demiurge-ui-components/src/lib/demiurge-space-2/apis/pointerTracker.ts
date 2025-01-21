import { Viewport } from 'reactflow';
import { TPosition } from '@monorepo/demiurge-types';
import * as _ from 'lodash';

export abstract class PointerTracker {
  public abstract bindReactFlowParentDiv(div: HTMLDivElement): void;
  public abstract toLocalPane(p: TPosition): TPosition;
  public abstract fromMouseEvent(p: TPosition): TPosition;
  public abstract setPointerInactive(): void;
  public abstract onPaneMouseMove(event: React.MouseEvent): void;
  public abstract onMove(event: MouseEvent | any, viewport: Viewport): void;
  public abstract isPositionVisible(p: TPosition): {
    x: number;
    y: number;
    out: boolean;
  };
}
