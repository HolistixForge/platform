import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { EditorPage } from './editor-page';

/**
 * The page decides two things from the open tab, and they have to agree: which
 * shape the project rail takes, and whether the page gives up a column for it.
 * A bar with no indent covers the content — that is how the Resources heading
 * came to read "ources". An indent with no bar leaves an empty 56px stripe.
 *
 * The tab system is mocked out: this is about the decision, not about tabs.
 */
const mockActiveTab = jest.fn();

jest.mock('./tabs', () => ({
  EditorTabsSystemLogic: () => <div data-testid="tabs" />,
  useActiveTab: () => mockActiveTab(),
}));

jest.mock('../sidebar', () => ({
  ProjectSidebar: ({ variant }: { variant?: string }) => (
    <aside data-testid="rail" data-variant={variant} />
  ),
}));

/**
 * Read through the custom properties rather than `paddingLeft`: jsdom's CSSOM
 * drops a `var()` in a standard property outright — it does not even reach the
 * style attribute — while custom properties survive intact. Measured. That is
 * also why the indent is a variable in the component: the decision is then
 * visible in one place, in the browser and here.
 */
const renderWith = (type: string) => {
  mockActiveTab.mockReturnValue({ payload: { type } });
  const { getByTestId } = render(<EditorPage />);
  const rail = getByTestId('rail');
  const page = rail.parentElement as HTMLElement;
  return {
    rail,
    indent: page.style.getPropertyValue('--holistix-page-indent'),
    islandLeft: page.style.getPropertyValue('--holistix-island-left'),
  };
};

describe('EditorPage rail placement', () => {
  it('floats an island over the whiteboard, and gives up no column', () => {
    // A canvas has nothing to indent: the board would just get smaller.
    const { rail, indent } = renderWith('node-editor');

    expect(rail).toHaveAttribute('data-variant', 'island');
    expect(indent).toBe('0px');
  });

  it('places the island past the whiteboard layers panel', () => {
    // Only here, because only here is there a panel. The rail component reads
    // `--holistix-island-left` and knows nothing about layers panels, which is
    // what lets it be used on a surface that has none.
    const { islandLeft } = renderWith('node-editor');

    expect(islandLeft).toBe('var(--holistix-left-rail, 255px)');
  });

  it('docks a bar beside content, and indents the page past it', () => {
    const { rail, indent, islandLeft } = renderWith('resources-grid');

    expect(rail).toHaveAttribute('data-variant', 'dashboard');
    expect(indent).toBe('var(--holistix-sidebar-width, 56px)');
    // No island offset off the whiteboard: it would be a guess at the width of
    // a panel that is not on this tab.
    expect(islandLeft).toBe('');
  });

  it('docks a bar for a service tab too', () => {
    const { rail } = renderWith('resource-ui');
    expect(rail).toHaveAttribute('data-variant', 'dashboard');
  });

  it('docks a bar when no tab has answered yet', () => {
    // Before the shared document arrives there is no payload. A bar is the
    // safe default: it is the shape a page with content wants, and an island
    // default would put a stray floating square on anything that forgot.
    mockActiveTab.mockReturnValue({ payload: undefined });
    const { getByTestId } = render(<EditorPage />);

    expect(getByTestId('rail')).toHaveAttribute('data-variant', 'dashboard');
  });
});
