import * as Y from 'yjs';
import { EDITORS_YTEXT_YMAP_KEY } from './YjsSharedEditor';

//

export function getAllSharedDataAsJSON(doc: Y.Doc): Record<string, any> {
  const result: Record<string, any> = {};
  doc.share.forEach((type, name) => {
    // console.log({ name, type });
    // Only serialize known Yjs types
    if (name !== EDITORS_YTEXT_YMAP_KEY) {
      if ('toJSON' in type && typeof type.toJSON === 'function') {
        result[name] = type.toJSON();
      }
    }
  });

  // save editors
  const editors = doc.getMap(EDITORS_YTEXT_YMAP_KEY);
  result.editors = {};
  editors.forEach((value, key) => {
    // Save as Delta, not string, to keep formatting for quill
    result.editors[key] = (value as Y.Text).toDelta();
  });
  return result;
}

//

export function setAllSharedDataFromJSON(
  doc: Y.Doc,
  data: Record<string, any>
) {
  Object.entries(data).forEach(([name, value]) => {
    if (name === EDITORS_YTEXT_YMAP_KEY) return;

    // The type is taken from the snapshot, not from the document.
    //
    // `doc.share` is populated by `doc.getMap`/`doc.getArray`, and a document
    // that has just been created has called neither: reading it with
    // `doc.share.get(name)` answered `undefined` for every key, all three
    // branches were skipped, and the snapshot was applied silently as nothing.
    // That is exactly the order a gateway restores in — `ywsUtils.getYDoc()`
    // makes a fresh doc, `setAllSharedDataFromJSON` runs on it, and the
    // reducers only touch it afterwards — so every project came back empty.
    // Measured: user containers still running, absent from the document their
    // gateway had just restored, unable to re-register, and unreachable while
    // the platform reported the restart a success.
    //
    // `doc.share` is also the wrong source when it does hold something: yjs
    // stores a generic placeholder for a name it has seen in an update but
    // that nobody has read yet, and `instanceof Y.Map` is false for it. Going
    // through `getMap`/`getArray` both creates the type and resolves that
    // placeholder, which is what the writes below need in either case.
    //
    // The snapshot's own shape is the only description available here, and it
    // is a faithful one: `getAllSharedDataAsJSON` wrote these values out of
    // those same types. An array was a Y.Array, an object a Y.Map, and a
    // string a Y.Text — which is restored from `editors` below, as before.
    try {
      if (Array.isArray(value)) {
        doc.getArray(name).push(value);
      } else if (value !== null && typeof value === 'object') {
        const sharedType = doc.getMap(name);
        Object.entries(value).forEach(([key, entry]) => {
          sharedType.set(key, entry);
        });
      }
    } catch (e) {
      // A name already defined with a different constructor. Loud, and only
      // for that one key: a single disagreement between a snapshot and a live
      // document should not cost the rest of the project its state.
      console.warn(
        `setAllSharedDataFromJSON: could not restore "${name}": ${
          (e as Error).message
        }`
      );
    }
  });

  // load editors
  const editors = doc.getMap(EDITORS_YTEXT_YMAP_KEY);
  const editorsData = data.editors;
  if (editorsData) {
    Object.entries(editorsData).forEach(([key, value]) => {
      if (typeof value === 'string') editors.set(key, new Y.Text(value));
      else {
        const ytext = new Y.Text();
        ytext.applyDelta(value as any); // value is the Delta array
        editors.set(key, ytext);
      }
    });
  }
}
