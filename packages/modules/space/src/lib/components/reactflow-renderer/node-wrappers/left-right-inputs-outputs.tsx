/*
// TODO: left right inputs outputs
// TODO: edges is not needed here, we need to known the handles even if empty
// Delete
export const IncomingEdgeHandles = () => {
  const { edges, id } = useNodeContext();

  const handles = edges.filter(
    (e) => e.to.node === id && e.to.connector !== undefined
  );
  return (
    <>
      {handles.map((edge, k) => (
        <div
          key={edgeLabel(edge)}
          className="incoming-edge-handle-box"
          style={
            {
              '--handle-index': k,
              '--handles-count': handles.length,
            } as React.CSSProperties
          }
        >
          <Handle
            type="target"
            position={'left' as Position}
            id={edge.to.connector}
          />
        </div>
      ))}
    </>
  );
};

//
//

export const OutgoingEdgeHandles = () => {
  const { edges, id } = useNodeContext();

  const handles = edges.filter(
    (e) => e.from.node === id && e.from.connector !== undefined
  );

  return (
    <>
      {handles.map((edge, k) => (
        <div
          key={edgeLabel(edge)}
          className="outgoing-edge-handle-box"
          style={
            {
              '--handle-index': k,
              '--handles-count': handles.length,
            } as React.CSSProperties
          }
        >
          <Handle
            type="source"
            position={'right' as Position}
            id={edge.from.connector}
          />
        </div>
      ))}
    </>
  );
};
*/
