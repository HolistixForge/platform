import { useState, useEffect } from 'react';

import { icons } from '@monorepo/demiurge-ui-components';
import {
  Inputs,
  Outputs,
  TNodeContext,
  useConnector,
  NodeToolbar,
  useMakeButton,
} from '@monorepo/space';

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

  const inCon = useConnector(nodeId, 'inputs');
  const outCon = useConnector(nodeId, 'outputs');

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
  }, [inCon.isOpened, outCon.isOpened]);

  return (
    <div className="node-wrapper node-reduced relative group h-auto">
      {/* Menu top left */}
      {!isExpanded && (
        <div
          className={`node-menu group-[.test-hover]:opacity-100 !-top-[80%] -translate-x-1/2 !left-1/2 node-hover-visible  ${
            inCon.isOpened ? 'input-open-left' : ''
          }`}
        >
          <NodeToolbar className="outside" buttons={buttons} />
        </div>
      )}

      {/* Module right */}
      {!isExpanded && (
        <div
          className={`node-right !top-0 !left-[120%] node-hover-visible ${
            outCon.isOpened ? '!-translate-y-10 !translate-x-8' : ''
          } transition-transform`}
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
        <div className="flex items-center gap-2 absolute -top-1/3 left-1/2 -translate-x-1/2 w-max">
          <p className="text-white text-sm font-bold">Node #12345</p>
          <div
            className="h-[13px] w-[13px] rounded-full"
            style={{
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
                className={`absolute right-0 top-1/2 -translate-y-1/2 -rotate-90 input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100`}
              >
                <Outputs nodeId={nodeId} />
              </div>
              {/* Input left */}
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100`}
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
                      ? 'var(--c-green-2)'
                      : 'var(--c-red-2)',
                }}
              />
            </div>
            {openNotebook ? (
              <div className="-bg--c-blue-6 absolute top-[85%] left-0 right-0 flex items-center justify-center flex-col z-30">
                <div
                  style={{
                    transform: 'translateX(calc(-50% + (54px / 2)))',
                    paddingTop: handleBarHeight + 20,
                    paddingBottom: handleBarHeight + 20,
                  }}
                >
                  {/* Input left */}
                  <div
                    className={`absolute top-1/2 left-[-20px] -translate-y-1/2 -rotate-90 input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100`}
                  >
                    <Inputs nodeId={nodeId} />
                  </div>

                  <div className={`flex flex-col gap-4 transition-all`}>
                    <HiveLine color="" cells={cells0} title="" />
                    <HiveLine
                      color="-bg--c-blue-1"
                      cells={cells1}
                      title="Hive 1"
                    />
                    <HiveLine
                      color="-bg--c-red-1"
                      cells={cells2}
                      title="Hive 2 lorem ipsum dolor sit amet, consectetur adipiscing elit"
                    />
                  </div>

                  {/* Output right */}
                  <div
                    className={`absolute right-[-20px] top-1/2 -translate-y-1/2 -rotate-90 input-output-rotated opacity-0 transition-opacity group-hover:opacity-100 group-[.testhover]:opacity-100`}
                  >
                    <Outputs nodeId={nodeId} />
                  </div>
                </div>

                <icons.NoteBookBottomClose
                  className="cursor-pointer relative z-20 w-[63px]"
                  onClick={() => setOpenNotebook(false)}
                />
              </div>
            ) : (
              <div
                onClick={() => setOpenNotebook(true)}
                className="absolute left-1/2 group-[.testhover]:!opacity-100 -translate-x-1/2 bottom-0 flex justify-center opacity-0 group-hover/notebook:opacity-100 transition-opacity cursor-pointer z-20"
              >
                <icons.NoteBookBottom className="w-[63px]" />
              </div>
            )}
            <ul className="absolute z-[3] left-0 top-0 h-[90px] w-[90px] list-none m-0 p-0">
              <li
                className="absolute rounded-full opacity-70 w-[7px] h-[7px] bottom-[14px] right-[24px] blur-[1.5px] animate-floating"
                style={{
                  backgroundColor: color,
                }}
              />
              <li
                className="absolute rounded-full opacity-70 w-[12px] h-[12px] bottom-[22px] left-[24px] blur-[1px] animate-floating"
                style={{
                  backgroundColor: color,
                }}
              />
              <li
                className="absolute rounded-full opacity-70 w-[8px] h-[8px] bottom-[40px] left-[18px] blur-[1.5px] animate-floating"
                style={{
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
        className={`w-[14px] h-[5px] rounded-[50px] ${color} rotate-[15deg]`}
      />

      <p
        style={{
          flex: '1 1 auto',
          whiteSpace: 'nowrap',
          maxWidth: '150px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        className="text-white text-right text-[9px] leading-normal"
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
