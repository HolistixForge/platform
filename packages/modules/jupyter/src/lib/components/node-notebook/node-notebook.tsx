import { useState } from 'react';

import { icons } from '@monorepo/ui-base';
import {
  NodeMainToolbar,
  useMakeButton,
  Inputs,
  Outputs,
  TNodeContext,
} from '@monorepo/space';

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
    <div className="w-[430px] relative group spread">
      {expanded && (
        <div className="absolute group-hover:opacity-100 -top-10 right-0 opacity-0 transition-opacity h-[40px] group-[.testhover]:opacity-100">
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

      <div className="absolute group-hover:opacity-100 -top-10 left-0 opacity-0 transition-opacity h-[40px]  group-[.testhover]:opacity-100">
        <NodeMainToolbar buttons={buttons} />
      </div>

      {/* input left */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 input-output-rotated opacity-0 group-hover:opacity-100 transition-opacity group-[.testhover]:opacity-100">
        <Inputs nodeId={'node-1'} />
      </div>

      {/* Output right */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 -rotate-90 input-output-rotated opacity-0 group-hover:opacity-100 transition-opacity group-[.testhover]:opacity-100">
        <Outputs nodeId={'node-1'} />
      </div>

      {expanded ? (
        <div className="py-[10px] px-[5px] -bg--c-blue-gray-2 rounded-[8px] border -border--c-blue-gray-1 flex flex-col gap-2 ">
          {/* SpreadCell Top */}
          <div className="absolute -top-5 z-10 left-1/2 -translate-x-1/2 h-[14px] w-[14px] border -border--c-alt-blue-4 rounded-full -bg--c-blue-62 flex items-center justify-center">
            <icons.SpreadCellPlugTop />
          </div>

          {title && (
            <div className="flex gap-3">
              <div className="w-[60px] flex items-center justify-end">
                <icons.TitlePolygon />
              </div>
              <p
                contentEditable
                className="text-white text-[9px] whitespace-nowrap"
              >
                Cell #1
              </p>
            </div>
          )}

          {input && (
            <div className="flex gap-3">
              {input && !output ? (
                <div className="flex gap-2 w-full">
                  <div className="flex flex-col items-center gap-3 min-w-[50px] justify-center py-5">
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

                    <div className="h-4 w-4 rounded-full -bg--c-pink-7 mx-auto" />
                  </div>
                  <div
                    className="w-full h-full rounded-[4px] bg-white bg-opacity-10"
                    style={{ overflow: 'hidden' }}
                  >
                    <CodeEditorMonaco code={code} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2 min-w-[60px] justify-center">
                    <p className="text-white text-[9px]">Entrée [1]</p>

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
                    className="w-full rounded-[4px] bg-white bg-opacity-10"
                    style={{ overflow: 'hidden' }}
                  >
                    <CodeEditorMonaco code={code} />
                  </div>
                </>
              )}
            </div>
          )}

          {output && (
            <div className="flex gap-4 mr-2 h-auto">
              {!input && output ? (
                <div className="flex w-full ml-2">
                  <div className="flex flex-col items-center gap-3 min-w-[50px] justify-center bg-white bg-opacity-10 rounded-l-[4px] py-5">
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

                    <div className="h-4 w-4 rounded-full -bg--c-pink-7 mx-auto" />
                  </div>
                  <div className="-bg--c-blue-6 w-full rounded-r-[4px]"></div>
                </div>
              ) : (
                <>
                  <span className="-text--c-red-5 rounded-[4px] bg-white bg-opacity-10 text-[9px] whitespace-nowrap h-auto py-2 min-w-[60px] text-center">
                    Output [1]
                  </span>
                  <p className="-text--ca-white-9 text-[9px] max-w-full">
                    Lorem ipsum dolor sit, amet consectetur adipisicing elit.
                    Repudiandae fugiat iure nam eligendi expedita vel odio a
                    molestiae? Nam dolore esse fuga omnis doloribus animi
                    incidunt expedita nihil, asperiores rem.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <div
              className={`${
                !title && !input && output ? 'min-w-[50px]' : 'min-w-[60px]'
              } h-full flex items-end`}
            >
              {
                // if just output is displayed, we need to add a spacer
                !input && !output && (
                  <div className="h-4 w-4 rounded-full -bg--c-pink-7 mx-auto" />
                )
              }
            </div>

            <div className="flex flex-wrap gap-1 items-center">
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
                className="flex items-center justify-center h-5 w-5 rounded-[4px] border -border--c-blue-gray-1 cursor-pointer p-0"
              >
                <icons.LittlePlus />
              </span>
            </div>
          </div>

          {/* SpreadCell Bottom */}
          <div className="absolute -bottom-5 z-10 left-1/2 -translate-x-1/2 h-[14px] w-[14px] border -border--c-alt-blue-1 rounded-full -bg--c-blue-62 flex items-center justify-center">
            <icons.SpreadCellPlugBottom />
          </div>
        </div>
      ) : (
        <div className="p-5 bg-white"></div>
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
