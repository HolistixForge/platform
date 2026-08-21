import * as Y from 'yjs';
import { getAllSharedDataAsJSON, setAllSharedDataFromJSON } from './load-save';

describe('setAllSharedDataFromJSON', () => {
  it('restores a map into a document that has never been read', () => {
    // The gateway's restore order: a brand-new doc from y-websocket, the
    // snapshot applied to it, and only then the reducers. Nothing has called
    // getMap yet, so `doc.share` is empty — this used to drop everything.
    const doc = new Y.Doc();

    setAllSharedDataFromJSON(doc, {
      'user-containers:containers': {
        uc_abc: { user_container_id: 'uc_abc', ip: '172.16.1.2' },
      },
    });

    const containers = doc.getMap('user-containers:containers');
    expect(containers.size).toBe(1);
    expect(containers.get('uc_abc')).toEqual({
      user_container_id: 'uc_abc',
      ip: '172.16.1.2',
    });
  });

  it('restores an array into a document that has never been read', () => {
    const doc = new Y.Doc();

    setAllSharedDataFromJSON(doc, {
      'core:nodes': [{ id: 'n1' }, { id: 'n2' }],
    });

    expect(doc.getArray('core:nodes').toJSON()).toEqual([
      { id: 'n1' },
      { id: 'n2' },
    ]);
  });

  it('does not duplicate array elements when a snapshot is applied twice', () => {
    const doc = new Y.Doc();
    const snapshot = { 'core:nodes': [{ id: 'n1' }, { id: 'n2' }] };

    setAllSharedDataFromJSON(doc, snapshot);
    setAllSharedDataFromJSON(doc, snapshot);

    expect(doc.getArray('core:nodes').length).toBe(2);
  });

  it('round-trips a document through save and load', () => {
    const source = new Y.Doc();
    source.getMap('user-containers:containers').set('uc_abc', { port: 5678 });
    source.getArray('core:nodes').push([{ id: 'n1' }]);

    const restored = new Y.Doc();
    setAllSharedDataFromJSON(restored, getAllSharedDataAsJSON(source));

    expect(getAllSharedDataAsJSON(restored)).toEqual(
      getAllSharedDataAsJSON(source)
    );
  });

  it('writes into the type a live document already holds', () => {
    const doc = new Y.Doc();
    doc.getMap('user-containers:containers').set('uc_old', { port: 1 });

    setAllSharedDataFromJSON(doc, {
      'user-containers:containers': { uc_new: { port: 2 } },
    });

    const containers = doc.getMap('user-containers:containers');
    expect(containers.get('uc_old')).toEqual({ port: 1 });
    expect(containers.get('uc_new')).toEqual({ port: 2 });
  });

  it('restores the rest when one key disagrees with the live type', () => {
    const doc = new Y.Doc();
    doc.getArray('core:nodes'); // an array here, an object in the snapshot
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    setAllSharedDataFromJSON(doc, {
      'core:nodes': { not: 'an array' },
      'user-containers:containers': { uc_abc: { port: 5678 } },
    });

    expect(warn).toHaveBeenCalled();
    expect(doc.getMap('user-containers:containers').size).toBe(1);
    warn.mockRestore();
  });

  it('restores editors as text', () => {
    const doc = new Y.Doc();

    setAllSharedDataFromJSON(doc, { editors: { note: 'hello' } });

    expect(doc.getMap('editors').get('note')?.toString()).toBe('hello');
  });
});
