import { useState, useEffect } from 'react';

import { icons } from '@holistix-forge/ui-base';
import {
  Inputs,
  Outputs,
  TNodeContext,
  useConnector,
  NodeMainToolbar,
  useMakeButton,
} from '@holistix-forge/whiteboard/frontend';

import { CellsHive, CellsHiveProps } from '../node-notebook/cells-hive';
import { NodeNotebook } from '../node-notebook/node-notebook';

//

export type NodeNotebookComponentProps = {
  color?: string;
  inputs: number;
  outputs: number;
  notebookOpened?: boolean;
  status?: 'success' | 'error' | 'loading';
} & Pick<
  TNodeContext,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

//

export const NodeNotebookComponent = ({
  color,
  status,
  id: nodeId,
  isOpened,
  open,
  notebookOpened,
  close,
  viewStatus,
  expand,
  reduce,
}: NodeNotebookComponentProps) => {
  //

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

  const { isOpened: inConOpened = false } =
    useConnector(nodeId, 'inputs') || {};
  const { isOpened: outConOpened = false } =
    useConnector(nodeId, 'outputs') || {};

  const [handleBarHeight, setHandleBarHeight] = useState<number>(0);

  const [openNotebook, setOpenNotebook] = useState<boolean>(
    notebookOpened || false
  );

  // get handle bar height
  const getHandleBarHeight = () => {
    const handleBar = document.querySelector('.handles-bar') as HTMLElement;

    if (handleBar) {
      setHandleBarHeight(handleBar.offsetHeight);
    }
  };

  useEffect(() => {
    getHandleBarHeight();
  }, [inConOpened, outConOpened]);

  return (
    <div
      className="node-wrapper node-reduced relative group"
      style={{ height: 'auto' }}
    >
      {/* Menu top left */}
      {!isExpanded && (
        <div
          className={`node-menu group-[.test-hover]:opacity-100 node-hover-visible ${
            inConOpened ? 'input-open-left' : ''
          }`}
          style={{ top: '-80%', left: '50%', transform: 'translateX(-50%)' }}
        >
          <NodeMainToolbar className="outside" buttons={buttons} />
        </div>
      )}

      {/* Module right */}
      {!isExpanded && (
        <div
          className={`node-right node-hover-visible transition-transform`}
          style={{
            top: 0,
            left: '120%',
            ...(outConOpened
              ? { transform: 'translateY(-40px) translateX(32px)' }
              : {}),
          }}
        >
          <div
            className={`top ${status === 'loading' ? 'rotate-animation' : ''}`}
          >
            {
              // Status
              status === 'success' ? (
                <icons.Success />
              ) : status === 'error' ? (
                <icons.Error />
              ) : status === 'loading' ? (
                <icons.Loading />
              ) : (
                <icons.Loading />
              )
            }
          </div>
        </div>
      )}

      {!isExpanded && (
        <div
          className="flex items-center absolute"
          style={{
            gap: '8px',
            top: '-33.33%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',
          }}
        >
          <p
            className="font-bold"
            style={{ color: 'var(--white)', fontSize: 'var(--font-size-sm)' }}
          >
            Node #12345
          </p>
          <div
            style={{
              height: '13px',
              width: '13px',
              borderRadius: '9999px',
              backgroundColor: color,
            }}
          />
        </div>
      )}

      {/* Node */}
      {!isExpanded ? (
        <>
          {!openNotebook && (
            <>
              {/* Output right */}
              <div
                className="absolute input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100"
                style={{
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%) rotate(-90deg)',
                }}
              >
                <Outputs nodeId={nodeId} />
              </div>
              {/* Input left */}
              <div
                className="absolute input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100"
                style={{
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%) rotate(-90deg)',
                }}
              >
                <Inputs nodeId={nodeId} />
              </div>
            </>
          )}

          <div className={`node-octogone-secondary python group/notebook`}>
            <div className="content relative">
              {/* Change color of svg's based on the status */}
              <icons.Notebook
                style={{
                  fill:
                    status === 'loading'
                      ? 'var(--green-600)'
                      : 'var(--red-400)',
                }}
              />
            </div>
            {openNotebook ? (
              <div
                className="absolute flex items-center justify-center flex-col"
                style={{
                  top: '85%',
                  left: 0,
                  right: 0,
                  zIndex: 30,
                  backgroundColor: 'var(--surface-600)',
                }}
              >
                <div
                  style={{
                    transform: 'translateX(calc(-50% + (54px / 2)))',
                    paddingTop: handleBarHeight + 20,
                    paddingBottom: handleBarHeight + 20,
                  }}
                >
                  {/* Input left */}
                  <div
                    className="absolute input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100"
                    style={{
                      top: '50%',
                      left: '-20px',
                      transform: 'translateY(-50%) rotate(-90deg)',
                    }}
                  >
                    <Inputs nodeId={nodeId} />
                  </div>

                  <div
                    className="flex flex-col transition-all"
                    style={{ gap: '16px' }}
                  >
                    <HiveLine color="" cells={cells0} title="" />
                    <HiveLine
                      color="var(--surface-100)"
                      cells={cells1}
                      title="Hive 1"
                    />
                    <HiveLine
                      color="var(--red-300)"
                      cells={cells2}
                      title="Hive 2 lorem ipsum dolor sit amet, consectetur adipiscing elit"
                    />
                  </div>

                  {/* Output right */}
                  <div
                    className="absolute input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100"
                    style={{
                      right: '-20px',
                      top: '50%',
                      transform: 'translateY(-50%) rotate(-90deg)',
                    }}
                  >
                    <Outputs nodeId={nodeId} />
                  </div>
                </div>

                <icons.NoteBookBottomClose
                  className="cursor-pointer relative"
                  style={{ zIndex: 20, width: '63px' }}
                  onClick={() => setOpenNotebook(false)}
                />
              </div>
            ) : (
              <div
                onClick={() => setOpenNotebook(true)}
                className="absolute flex justify-center opacity-0 group-hover/notebook:opacity-100 transition-opacity cursor-pointer group-[.testhover]:!opacity-100"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: 0,
                  zIndex: 20,
                }}
              >
                <icons.NoteBookBottom style={{ width: '63px' }} />
              </div>
            )}
            <ul
              className="absolute"
              style={{
                zIndex: 3,
                left: 0,
                top: 0,
                height: '90px',
                width: '90px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              <li
                className="absolute animate-floating"
                style={{
                  borderRadius: '9999px',
                  opacity: 0.7,
                  width: '7px',
                  height: '7px',
                  bottom: '14px',
                  right: '24px',
                  filter: 'blur(1.5px)',
                  backgroundColor: color,
                }}
              />
              <li
                className="absolute animate-floating"
                style={{
                  borderRadius: '9999px',
                  opacity: 0.7,
                  width: '12px',
                  height: '12px',
                  bottom: '22px',
                  left: '24px',
                  filter: 'blur(1px)',
                  backgroundColor: color,
                }}
              />
              <li
                className="absolute animate-floating"
                style={{
                  borderRadius: '9999px',
                  opacity: 0.7,
                  width: '8px',
                  height: '8px',
                  bottom: '40px',
                  left: '18px',
                  filter: 'blur(1.5px)',
                  backgroundColor: color,
                }}
              />
            </ul>
          </div>
        </>
      ) : (
        <NodeNotebook
          titleFixed
          arrow="bottom"
          expanded
          id="1"
          isOpened
          status="success"
          open={open}
          close={close}
          viewStatus={viewStatus}
          expand={expand}
          reduce={reduce}
        />
      )}
    </div>
  );
};

/**
 *
 *
 *
 *
 *
 *
 *
 *
 */

const HiveLine = ({
  color,
  cells,
  title,
}: {
  color: string;
  cells: CellsHiveProps['cells'];
  title: string;
}) => {
  return (
    <div className="relative" style={{ display: 'flex', gap: '10px' }}>
      {/* Hive tag */}

      <div
        style={{
          width: '14px',
          height: '5px',
          borderRadius: '50px',
          transform: 'rotate(15deg)',
          backgroundColor: color || undefined,
        }}
      />

      <p
        className="text-right"
        style={{
          flex: '1 1 auto',
          whiteSpace: 'nowrap',
          maxWidth: '150px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: 'var(--white)',
          fontSize: '9px',
          lineHeight: 'normal',
        }}
      >
        {title}
      </p>

      {/* Cells */}
      <CellsHive cells={cells} columnsNumber={5} />
    </div>
  );
};

/**
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

const cells0: CellsHiveProps['cells'] = [
  {
    type: 'error',
    id: '1',
  },
  {
    type: 'validate',
    id: '1',
  },
  {
    type: 'validate',
    id: '1',
  },
  {
    type: 'normal',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'normal',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
];

const cells1: CellsHiveProps['cells'] = [
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'validate',
    id: '1',
  },
  {
    type: 'normal',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
];

const cells2: CellsHiveProps['cells'] = [
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'validate',
    id: '1',
  },
  {
    type: 'normal',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'validate',
    id: '1',
  },
  {
    type: 'normal',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
  {
    type: 'running',
    id: '1',
  },
];
