/**
 * What the chats module contributes to the whiteboard.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213).
 * This module builds its context menu inline rather than importing it, so the
 * menu is not only counted here but called: the entries are a function of the
 * click — where it landed, and whether it landed on a node — and that is the
 * part a new surface has to keep supplying.
 */
import { moduleFrontend } from './frontend';

type TMenuEntry = {
  type: string;
  label: string;
  entries?: {
    type: string;
    label: string;
    disabled?: boolean;
    onClick: () => void;
  }[];
};
type TMenuFactory = (ctx: {
  dispatcher: { dispatch: (e: unknown) => void };
  from?: unknown;
  position: () => { x: number; y: number };
  viewId: string;
}) => TMenuEntry[];

/** Everything the module hands over when it loads. */
const load = () => {
  const nodes: Record<string, unknown> = {};
  const menus: TMenuFactory[] = [];
  const sharedData: string[] = [];

  moduleFrontend.load({
    depsExports: {
      collab: {
        registry: {
          registerSharedData: (_kind: string, ns: string, name: string) =>
            sharedData.push(`${ns}:${name}`),
        },
      },
      whiteboard: {
        registerNodes: (n: Record<string, unknown>) => Object.assign(nodes, n),
        registerPanel: () => undefined,
        registerMenuEntries: (m: TMenuFactory) => menus.push(m),
        registerLayer: () => undefined,
      },
    } as never,
    moduleExports: () => undefined,
    config: {},
  });

  return { nodes, menus, sharedData };
};

/** The menu as it would be built by a right-click on empty canvas. */
const menuOn = (from?: unknown) => {
  const dispatched: unknown[] = [];
  const entries = load().menus[0]({
    dispatcher: { dispatch: (e) => dispatched.push(e) },
    from,
    position: () => ({ x: 12, y: 34 }),
    viewId: 'view-1',
  });
  return { entries, dispatched };
};

describe('chats — what it registers', () => {
  it('mounts its two node types under the names the graph stores', () => {
    expect(Object.keys(load().nodes).sort()).toEqual(['chat', 'chat-anchor']);
  });

  it('gives a real component for each of them', () => {
    for (const [name, component] of Object.entries(load().nodes)) {
      expect([name, typeof component]).toEqual([name, 'function']);
    }
  });

  it('offers a Chats submenu on the canvas', () => {
    const { entries } = menuOn();
    expect(entries.map((e) => [e.type, e.label])).toEqual([
      ['sub-menu', 'Chats'],
    ]);
    expect(entries[0].entries?.map((e) => e.label)).toEqual(['New Chat']);
  });

  it('creates the chat where the click landed, in the view it was clicked in', () => {
    const { entries, dispatched } = menuOn();
    entries[0].entries?.[0].onClick();

    expect(dispatched).toEqual([
      {
        type: 'chats:new-chat',
        origin: { viewId: 'view-1', position: { x: 12, y: 34 } },
      },
    ]);
  });

  it('greys out New Chat when the click started from a node', () => {
    // `from` is the node the drag came out of. A chat is created on the
    // canvas, not off a connector, so the entry stays visible and inert
    // rather than disappearing and moving everything below it.
    expect(menuOn('node-a').entries[0].entries?.[0].disabled).toBe(true);
  });

  it('declares the shared data it reads and writes', () => {
    expect(load().sharedData).toEqual(['chats:chats']);
  });
});
