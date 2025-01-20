export const makeYjsDocId = (o: object) =>
  `__YJS_DOC_ID__ ${JSON.stringify(o)} __YJS_DOC_ID__`;
