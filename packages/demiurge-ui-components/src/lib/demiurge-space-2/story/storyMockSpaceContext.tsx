import { ReactNode, useMemo } from 'react';
import { SpaceContext } from '../reactflow-renderer/spaceContext';
import { TUseNodeValue } from '../apis/types/node';
import { DummySpaceAwareness } from './fakeSpaceAwareness';
import { LocalSpaceActionsDispatcher } from './localSpaceActionsDispatcher';
import { SpaceState } from '../apis/spaceState';

//

export const MockReactFlowNodeWrapper = ({
  children,
  selected,
  isOpened,
}: Pick<TUseNodeValue, 'selected' | 'isOpened'> & {
  children: ReactNode;
}) => {
  return (
    <div
      className={`react-flow__node-wrapper node-${
        isOpened ? 'opened' : 'closed'
      } ${selected ? 'selected' : ''}`}
    >
      {children}
    </div>
  );
};

//

export const StoryMockSpaceContext = ({
  children,
  selected,
  isOpened = true,
}: {
  children: ReactNode;
  selected?: boolean;
  isOpened?: boolean;
}) => {
  const context = useMemo(() => {
    const spaceState = new SpaceState();
    return {
      spaceAwareness: new DummySpaceAwareness(),
      spaceActionsDispatcher: new LocalSpaceActionsDispatcher(spaceState),
      spaceState,
      currentUser: { username: 'toto', color: '#ffa500' },
    };
  }, []);

  return (
    <SpaceContext value={context}>
      <div>
        <svg
          className="react-flow__background"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: '0px',
            left: '0px',
          }}
          data-testid="rf__background"
        >
          <pattern
            id="pattern-1undefined"
            x="0"
            y="0"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
            patternTransform="translate(-0.5,-0.5)"
          >
            <circle cx="0.5" cy="0.5" r="0.5" fill="#91919a"></circle>
          </pattern>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#pattern-1undefined)"
          ></rect>
        </svg>

        <MockReactFlowNodeWrapper
          selected={selected || false}
          isOpened={isOpened}
        >
          {children}
        </MockReactFlowNodeWrapper>
      </div>
    </SpaceContext>
  );
};
