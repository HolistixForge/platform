/**
 * What the jupyter module contributes to the whiteboard.
 *
 * Part of the non-regression harness for the Excalidraw refactor (TAC-213),
 * and the one module where this test has already caught something in the wild:
 * jupyter was left out of the application's module list, so `registerNodes`
 * never ran, and a terminal pulled out of a notebook rendered its own payload
 * as text — `{ "user_container_id": …, "terminal_id": "2" }` — on the canvas,
 * with no error anywhere. The menu entry that offers "New Terminal" was
 * missing for the same reason. Neither failure was loud.
 *
 * JupyterLab's widget packages ship ES modules only and Jest's runtime cannot
 * parse them; `@lumino/dragdrop` additionally extends a `DragEvent` that jsdom
 * does not implement. They are stubbed. What they stand behind is the
 * rendering of a cell and a terminal, which this test does not do — the claim
 * here is that the module registers three node types under three names, and
 * that code is the real one.
 */
import { moduleFrontend } from './frontend';

// Written below the import and still in force above it: babel-jest hoists
// `jest.mock` to the top of the file.
jest.mock('@jupyterlab/terminal', () => ({ Terminal: class {} }));
// A stylesheet imported without an extension, so Jest resolves it as code.
jest.mock('@jupyterlab/terminal/style/index', () => ({}));
jest.mock('@jupyterlab/outputarea', () => ({
  OutputArea: class {},
  OutputAreaModel: class {},
}));
jest.mock('@jupyterlab/rendermime', () => ({ RenderMimeRegistry: class {} }));
jest.mock('@lumino/widgets', () => ({ Widget: class {} }));
jest.mock('@lumino/messaging', () => ({
  MessageLoop: { sendMessage: () => undefined },
}));
// Monaco, behind the code cell, for the same reason.
jest.mock('monaco-editor', () => ({
  editor: {},
  languages: {},
  Uri: class {},
}));

//

/** Everything the module hands over when it loads. */
const load = () => {
  const nodes: Record<string, unknown> = {};
  const menus: unknown[] = [];
  const sharedData: string[] = [];

  moduleFrontend.load({
    depsExports: {
      collab: {
        registry: {
          registerSharedData: (_kind: string, ns: string, name: string) =>
            sharedData.push(`${ns}:${name}`),
        },
        getCollabForProject: () => ({ collab: { sharedData: {} } }),
      },
      whiteboard: {
        registerNodes: (n: Record<string, unknown>) => Object.assign(nodes, n),
        registerPanel: () => undefined,
        registerMenuEntries: (m: unknown) => menus.push(m),
        registerLayer: () => undefined,
      },
      'user-containers': { getToken: async () => '' },
      reducers: { dispatcher: { dispatch: () => undefined } },
    } as never,
    moduleExports: () => undefined,
    config: {},
  });

  return { nodes, menus, sharedData };
};

//

describe('jupyter — what it registers', () => {
  it('mounts its three node types under the names the graph stores', () => {
    expect(Object.keys(load().nodes).sort()).toEqual([
      'jupyter-cell',
      'jupyter-kernel',
      'jupyter-terminal',
    ]);
  });

  it('gives a real component for each of them', () => {
    for (const [name, component] of Object.entries(load().nodes)) {
      expect([name, typeof component]).toEqual([name, 'function']);
    }
  });

  it('contributes the menu that offers a new terminal', () => {
    expect(load().menus).toHaveLength(1);
  });

  it('declares the shared data it reads and writes', () => {
    expect(load().sharedData).toEqual(['jupyter:servers']);
  });

  it('names reducers among its dependencies, since it reads the dispatcher', () => {
    // Declared in the type and once missing from this array. The loader
    // injects from the array, so the compiler was satisfied while the module
    // was handed `undefined` at run time.
    expect(moduleFrontend.dependencies).toContain('reducers');
  });
});
