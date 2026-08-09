/**
 * What the socials module contributes to the whiteboard.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213),
 * covering two of the eleven invariants: every node type is mounted, and every
 * module gets its entries into the context menu.
 *
 * Node types are registered by name into a shared table, and nothing in the
 * type system says which names have to be there. A type that stops being
 * registered does not fail to compile and does not throw: the whiteboard finds
 * no component for it and draws the node's own payload as text. That is how a
 * terminal pulled out of a notebook came to render `{ "user_container_id": … }`
 * on the canvas, with no error anywhere. So the set is written out in full.
 */
import { moduleFrontend } from './frontend';

/**
 * Quill ships ES modules only and Jest's runtime cannot parse them. It is the
 * rich-text engine behind one of the five nodes, and this test never types a
 * character into it — what is being checked is that the module registers a
 * component under `text-editor`, and the registration code is the real one
 * either way.
 *
 * Written below the import and still in force above it: babel-jest hoists
 * `jest.mock` to the top of the file.
 */
jest.mock('quill', () => {
  // A static method rather than a static property: a property initialiser
  // inside the factory's inferred return type refers back to the class being
  // inferred, which TypeScript reports as a circular `any` (TS7022).
  class Quill {
    static register(): void {
      return undefined;
    }
  }
  return { __esModule: true, default: Quill };
});
jest.mock('quill-cursors', () => ({
  __esModule: true,
  default: class QuillCursors {},
}));

/** Everything the module hands to the whiteboard when it loads. */
const load = () => {
  const nodes: Record<string, unknown> = {};
  const panels: Record<string, unknown> = {};
  const menus: unknown[] = [];

  moduleFrontend.load({
    depsExports: {
      whiteboard: {
        registerNodes: (n: Record<string, unknown>) => Object.assign(nodes, n),
        registerPanel: (p: Record<string, unknown>) => Object.assign(panels, p),
        registerMenuEntries: (m: unknown) => menus.push(m),
        registerLayer: () => undefined,
      },
    } as never,
    moduleExports: () => undefined,
    config: {},
  });

  return { nodes, panels, menus };
};

describe('socials — what it registers', () => {
  it('mounts its five node types under the names the graph stores', () => {
    expect(Object.keys(load().nodes).sort()).toEqual([
      'iframe',
      'node-user',
      'reservation',
      'text-editor',
      'youtube',
    ]);
  });

  it('gives a real component for each of them', () => {
    // A name mapped to undefined registers just as quietly as one mapped to a
    // component, and fails the same way at draw time.
    for (const [name, component] of Object.entries(load().nodes)) {
      expect([name, typeof component]).toEqual([name, 'function']);
    }
  });

  it('contributes its context menu entries', () => {
    expect(load().menus).toHaveLength(1);
  });
});
