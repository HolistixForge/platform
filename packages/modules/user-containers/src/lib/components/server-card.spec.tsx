import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as Tooltip from '@radix-ui/react-tooltip';

import { UserContainerCardInternal } from './server-card';
import { makeStoryArgs } from './server-card-stories';

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
