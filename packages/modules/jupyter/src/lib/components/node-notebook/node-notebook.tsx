import { useState } from 'react';

import { icons } from '@holistix-forge/ui-base';
import {
  NodeMainToolbar,
  useMakeButton,
  Inputs,
  Outputs,
  TNodeContext,
} from '@holistix-forge/whiteboard/frontend';

import { DisplayMenu } from './display-menu';
import { Tag } from './tag';
import { CodeEditorMonaco } from '../code-editor-monaco/code-editor-monaco-lazy';

//

export type NodeNotebookProps = {
  arrow: 'top' | 'bottom' | 'left' | 'right';
  status?: 'success' | 'error' | 'loading';
  titleFixed: boolean;
  nodeInfos?: boolean;
  expanded: boolean;
} & Pick<
  TNodeContext,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

export const NodeNotebook = ({
  arrow,
  status,
  titleFixed,
  expanded,
  isOpened,
  id: nodeId,
  open,
  close,
  viewStatus,
  expand,
  reduce,
}: NodeNotebookProps) => {
  const [title, setTitle] = useState<boolean>(titleFixed);
  const [input, setInput] = useState<boolean>(true);
  const [output, setOutput] = useState<boolean>(true);

  const [tag, setTag] = useState<any[]>([]);

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isLocked: false,
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

  const addTag = (name: string, crowned: boolean) => {
    if (tag.length >= 0) {
      setTag((prev) => [...prev, { name, crowned }]);
    }
  };

  const removeTag = (tagId: number) => {
    // id is the index of the tag in the array
    setTag((prev) => prev.filter((_, i) => i !== tagId));
  };

  const setCrowned = (tagId: number, crowned: boolean) => {
    // if another tag is crowned, we uncrown it
    setTag((prev) =>
      prev.map((tag, i) => {
        if (i === tagId) {
          return { ...tag, crowned };
        }
        return { ...tag, crowned: false };
      })
    );
  };

  return (
    <div className="relative group spread" style={{ width: '430px' }}>
      {expanded && (
        <div
          className="absolute opacity-0 group-hover:opacity-100 transition-opacity group-[.testhover]:opacity-100"
          style={{ top: '-40px', right: 0, height: '40px' }}
        >
          <DisplayMenu
            title={title}
            input={input}
            output={output}
            setTitle={setTitle}
            setInput={setInput}
            setOutput={setOutput}
          />
        </div>
      )}

      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity group-[.testhover]:opacity-100"
        style={{ top: '-40px', left: 0, height: '40px' }}
      >
        <NodeMainToolbar buttons={buttons} />
      </div>

      {/* input left */}
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity input-output-rotated group-[.testhover]:opacity-100"
        style={{
          left: 0,
          top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
        }}
      >
        <Inputs nodeId={'node-1'} />
      </div>

      {/* Output right */}
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity input-output-rotated group-[.testhover]:opacity-100"
        style={{
          right: 0,
          top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
        }}
      >
        <Outputs nodeId={'node-1'} />
      </div>

      {expanded ? (
        <div
          className="flex flex-col"
          style={{
            padding: '10px 5px',
            borderRadius: '8px',
            border: '1px solid var(--surface-800)',
            gap: '8px',
            backgroundColor: 'var(--surface-700)',
          }}
        >
          {/* SpreadCell Top */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: '-20px',
              zIndex: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              height: '14px',
              width: '14px',
              border: '1px solid var(--surface-600)',
              borderRadius: '9999px',
              backgroundColor: 'var(--surface-600)',
            }}
          >
            <icons.SpreadCellPlugTop />
          </div>

          {title && (
            <div className="flex" style={{ gap: '12px' }}>
              <div
                className="flex items-center justify-end"
                style={{ width: '60px' }}
              >
                <icons.TitlePolygon />
              </div>
              <p
                contentEditable
                className="whitespace-nowrap"
                style={{ color: 'var(--white)', fontSize: '9px' }}
              >
                Cell #1
              </p>
            </div>
          )}

          {input && (
            <div className="flex" style={{ gap: '12px' }}>
              {input && !output ? (
                <div className="flex w-full" style={{ gap: '8px' }}>
                  <div
                    className="flex flex-col items-center justify-center"
                    style={{ gap: '12px', minWidth: '50px', padding: '20px 0' }}
                  >
                    {status === 'success' ? (
                      <icons.CheckMark />
                    ) : status === 'error' ? (
                      <icons.Error />
                    ) : (
                      <icons.Loading className="animate-spin" />
                    )}

                    {arrow === 'top' ? (
                      <icons.ArrowUpCircle />
                    ) : arrow === 'bottom' ? (
                      <icons.ArrowDownCircle />
                    ) : arrow === 'left' ? (
                      <icons.ArrowLeftCircle />
                    ) : (
                      <icons.ArrowRightCircle />
                    )}

                    <div
                      style={{
                        height: '16px',
                        width: '16px',
                        borderRadius: '9999px',
                        margin: '0 auto',
                        backgroundColor: 'var(--primary-700)',
                      }}
                    />
                  </div>
                  <div
                    className="w-full h-full"
                    style={{
                      overflow: 'hidden',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <CodeEditorMonaco code={code} />
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="flex flex-col items-center justify-center"
                    style={{ gap: '8px', minWidth: '60px' }}
                  >
                    <p style={{ color: 'var(--white)', fontSize: '9px' }}>
                      Entrée [1]
                    </p>

                    {status === 'success' ? (
                      <icons.CheckMark />
                    ) : status === 'error' ? (
                      <icons.Error />
                    ) : (
                      <icons.Loading className="animate-spin" />
                    )}

                    {arrow === 'top' ? (
                      <icons.ArrowUpCircle />
                    ) : arrow === 'bottom' ? (
                      <icons.ArrowDownCircle />
                    ) : arrow === 'left' ? (
                      <icons.ArrowLeftCircle />
                    ) : (
                      <icons.ArrowRightCircle />
                    )}
                  </div>
                  <div
                    className="w-full"
                    style={{
                      overflow: 'hidden',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <CodeEditorMonaco code={code} />
                  </div>
                </>
              )}
            </div>
          )}

          {output && (
            <div
              className="flex"
              style={{ gap: '16px', marginRight: '8px', height: 'auto' }}
            >
              {!input && output ? (
                <div className="flex w-full" style={{ marginLeft: '8px' }}>
                  <div
                    className="flex flex-col items-center justify-center"
                    style={{
                      gap: '12px',
                      minWidth: '50px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px 0 0 4px',
                      padding: '20px 0',
                    }}
                  >
                    {status === 'success' ? (
                      <icons.CheckMark />
                    ) : status === 'error' ? (
                      <icons.Error />
                    ) : (
                      <icons.Loading className="animate-spin" />
                    )}

                    {arrow === 'top' ? (
                      <icons.ArrowUpCircle />
                    ) : arrow === 'bottom' ? (
                      <icons.ArrowDownCircle />
                    ) : arrow === 'left' ? (
                      <icons.ArrowLeftCircle />
                    ) : (
                      <icons.ArrowRightCircle />
                    )}

                    <div
                      style={{
                        height: '16px',
                        width: '16px',
                        borderRadius: '9999px',
                        margin: '0 auto',
                        backgroundColor: 'var(--primary-700)',
                      }}
                    />
                  </div>
                  <div
                    className="w-full"
                    style={{
                      borderRadius: '0 4px 4px 0',
                      backgroundColor: 'var(--surface-600)',
                    }}
                  ></div>
                </div>
              ) : (
                <>
                  <span
                    className="whitespace-nowrap text-center"
                    style={{
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      fontSize: '9px',
                      height: 'auto',
                      padding: '8px 0',
                      minWidth: '60px',
                      color: 'var(--red-500)',
                    }}
                  >
                    Output [1]
                  </span>
                  <p
                    style={{
                      fontSize: '9px',
                      maxWidth: '100%',
                      color: 'var(--alpha-white-90)',
                    }}
                  >
                    Lorem ipsum dolor sit, amet consectetur adipisicing elit.
                    Repudiandae fugiat iure nam eligendi expedita vel odio a
                    molestiae? Nam dolore esse fuga omnis doloribus animi
                    incidunt expedita nihil, asperiores rem.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex" style={{ gap: '12px' }}>
            <div
              className="h-full flex items-end"
              style={{ minWidth: !title && !input && output ? '50px' : '60px' }}
            >
              {
                // if just output is displayed, we need to add a spacer
                !input && !output && (
                  <div
                    style={{
                      height: '16px',
                      width: '16px',
                      borderRadius: '9999px',
                      margin: '0 auto',
                      backgroundColor: 'var(--primary-700)',
                    }}
                  />
                )
              }
            </div>

            <div className="flex flex-wrap items-center" style={{ gap: '4px' }}>
              {tag.map((tag, i) => (
                <Tag
                  key={i}
                  text={tag.name}
                  crowned={tag.crowned}
                  textColor="white"
                  setCrowned={(crowned) => setCrowned(i, crowned)}
                  removeTag={() => removeTag(i)}
                />
              ))}
              <span
                onClick={() => addTag('test', false)}
                className="flex items-center justify-center cursor-pointer"
                style={{
                  height: '20px',
                  width: '20px',
                  borderRadius: '4px',
                  border: '1px solid var(--surface-800)',
                  padding: 0,
                }}
              >
                <icons.LittlePlus />
              </span>
            </div>
          </div>

          {/* SpreadCell Bottom */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              bottom: '-20px',
              zIndex: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              height: '14px',
              width: '14px',
              border: '1px solid var(--cyan-300)',
              borderRadius: '9999px',
              backgroundColor: 'var(--surface-600)',
            }}
          >
            <icons.SpreadCellPlugBottom />
          </div>
        </div>
      ) : (
        <div style={{ padding: '20px', backgroundColor: 'white' }}></div>
      )}
    </div>
  );
};

const code = `# function with two arguments
def add_numbers(num1, num2):
    sum = num1 + num2
    print("Sum: ",sum)

# function call with two values
add_numbers(5, 4)

# Output: Sum: 9`;
