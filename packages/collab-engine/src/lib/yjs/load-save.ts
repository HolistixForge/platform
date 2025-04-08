import * as Y from 'yjs';
import { EDITORS_YTEXT_YMAP_KEY } from './YjsSharedEditor';

//

export function getAllSharedDataAsJSON(doc: Y.Doc): Record<string, any> {
  const result: Record<string, any> = {};
  doc.share.forEach((type, name) => {
    console.log({ name, type });
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
    result.editors[key] = (value as Y.Text).toString();
  });
  return result;
}

//

export function setAllSharedDataFromJSON(
  doc: Y.Doc,
  data: Record<string, any>
) {
  Object.entries(data).forEach(([name, value]) => {
    if (name !== EDITORS_YTEXT_YMAP_KEY) {
      const sharedType = doc.share.get(name);

      if (sharedType instanceof Y.Map) {
        // console.log('sharedType is a map');
        if (data[name] && typeof data[name] === 'object') {
          Object.entries(data[name]).forEach(([key, value]) => {
            sharedType.set(key, value);
          });
        } else {
          console.warn('sharedType is a map but data is not an object');
        }
      } else if (sharedType instanceof Y.Array) {
        // console.log('sharedType is an array');
        if (data[name] && Array.isArray(data[name])) {
          sharedType.push(data[name]);
        } else {
          console.warn('sharedType is an array but data is not an array');
        }
      } else if (sharedType instanceof Y.Text) {
        // console.log('sharedType is a text');
      }
    }
  });

  // load editors
  const editors = doc.getMap(EDITORS_YTEXT_YMAP_KEY);
  const editorsData = data.editors;
  if (editorsData) {
    Object.entries(editorsData).forEach(([key, value]) => {
      editors.set(key, new Y.Text(value as string));
    });
  }
}
