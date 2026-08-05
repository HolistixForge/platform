import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as Tooltip from '@radix-ui/react-tooltip';

import { UserContainerCardInternal } from './server-card';
import {
  makeStoryArgs,
  runningOnPlatformStory,
  runningOnAppleStory,
  runningOnSharedKernelStory,
  StoryArgs,
} from './server-card-stories';

/**
 * The card's box is a set of numbers with a reason, and the reason lives in
 * another package: they are the "add resource" card's dimensions
 * (ui-views/mvp-ui-view/components/server-stack.tsx), which is what this card
 * sits beside in the grid. Nothing links the two files, so the only thing
 * keeping them in step is a test that states the numbers out loud.
 */

const renderCard = () =>
  render(
    <Tooltip.Provider>
      <UserContainerCardInternal {...makeStoryArgs()} runners={new Map()} />
    </Tooltip.Provider>
  );

describe('UserContainerCardInternal — box', () => {
  it('should be as wide as the add-resource card it sits beside', () => {
    // Act
    const { container } = renderCard();

    // Assert - the grid's column arithmetic in server-stack.tsx is written
    // against this 400 as well; changing it here alone miscounts the columns
    expect(container.firstElementChild).toHaveStyle({ width: '400px' });
  });

  it('should be at least as tall as the add-resource card', () => {
    // Act
    const { container } = renderCard();

    // Assert - without a floor, a card with no exposed services was shorter
    // than the dashed card next to it and the row never lined up
    expect(container.firstElementChild).toHaveStyle({ minHeight: '202px' });
  });

  it('should not cap its height', () => {
    // Act
    const { container } = renderCard();

    // Assert - a container exposing several services is taller than 202, and
    // clipping it would hide the links that are the reason to look at the card
    expect((container.firstElementChild as HTMLElement).style.height).toBe('');
    expect((container.firstElementChild as HTMLElement).style.maxHeight).toBe(
      ''
    );
  });

  it('should share the dashed card corner radius', () => {
    // Act
    const { container } = renderCard();

    // Assert
    expect(container.firstElementChild).toHaveStyle({ borderRadius: '8px' });
  });
});

/**
 * What isolated the container, on the card.
 *
 * The broker refuses to start without a stated runtime so that an absent
 * isolation can never be reached by omission. That rule only holds as far as
 * the value travels: two engines now ship with different guarantees, and a
 * card that looks the same either way puts the user back in the dark the rule
 * was written to keep them out of.
 */

const renderWith = (args: StoryArgs) =>
  render(
    <Tooltip.Provider>
      <UserContainerCardInternal {...args} runners={new Map()} />
    </Tooltip.Provider>
  );

describe('UserContainerCardInternal — isolation', () => {
  it('should say the container has its own kernel', () => {
    // Act
    const { getByText } = renderWith(runningOnPlatformStory());

    // Assert
    expect(getByText(/Own kernel/)).toBeInTheDocument();
  });

  it('should name the engine and runtime that ran it', () => {
    // Act - the platform will have two versions, so "platform" is not an answer
    const { getByText } = renderWith(runningOnPlatformStory());

    // Assert
    expect(getByText(/docker · kata/)).toBeInTheDocument();
  });

  it('should say plainly when the host kernel is shared', () => {
    // Act - reachable by stating BROKER_RUNTIME=runc, which is a choice
    const { getByText, queryByText } = renderWith(runningOnSharedKernelStory());

    // Assert
    expect(getByText(/Shares the host kernel/)).toBeInTheDocument();
    expect(queryByText(/Own kernel/)).not.toBeInTheDocument();
  });

  it('should list what a deployment gave up', () => {
    // Act - two microVMs are not the same guarantee, and "own kernel" alone
    // would flatten that difference back out
    const { getByText } = renderWith(runningOnAppleStory());

    // Assert
    expect(getByText(/5 controls given up/)).toBeInTheDocument();
    expect(getByText(/no-new-privileges/)).toBeInTheDocument();
  });

  it('should not claim anything for a runner that reported nothing', () => {
    // Act - a local placement, or a container that has not started. Silence is
    // right: there is no claim to correct
    const { queryByText } = renderWith(makeStoryArgs());

    // Assert
    expect(queryByText(/Own kernel/)).not.toBeInTheDocument();
    expect(queryByText(/Shares the host kernel/)).not.toBeInTheDocument();
    expect(queryByText(/Isolation not reported/)).not.toBeInTheDocument();
  });

  it('should say unknown rather than assume safe when the broker was silent', () => {
    // Act - an older broker that sends host and runtime but no verdict. The
    // safe-looking default is the one that costs something when it is wrong
    const args = runningOnPlatformStory();
    args.container.runner = { id: 'platform', host: 'h1', runtime: 'kata' };
    const { getByText, queryByText } = renderWith(args);

    // Assert
    expect(getByText(/Isolation not reported/)).toBeInTheDocument();
    expect(queryByText(/Own kernel/)).not.toBeInTheDocument();
  });
});
