import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Sidebar } from './Sidebar';

/**
 * SIMPLIFIED REACT COMPONENT TESTING GUIDE
 * 
 * This is a minimal, working example that demonstrates:
 * - Testing React components with @testing-library/react
 * - Basic rendering tests
 * - User interaction tests
 * - Testing without complex dependencies
 */

// Simple mock icon component
const MockIcon = ({ className }: { className: string }) => (
  <svg className={className} data-testid="mock-icon">
    <circle />
  </svg>
);

// Mock react-router-dom to avoid TextEncoder issues
jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  BrowserRouter: ({ children }: any) => <div>{children}</div>,
}));

describe('Sidebar Component - Simple Example', () => {
  // Simple test data (no links to avoid router complexity)
  const simpleItems = [
    { title: 'Home', Icon: MockIcon },
    { title: 'Settings', Icon: MockIcon },
    { title: 'Profile', Icon: MockIcon },
  ];

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<Sidebar items={simpleItems} active="Home" />);
      
      // Component should be in the document
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('should render all items', () => {
      render(<Sidebar items={simpleItems} active="Home" />);
      
      // Check if all items are rendered
      expect(screen.getByTitle('Home')).toBeInTheDocument();
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
      expect(screen.getByTitle('Profile')).toBeInTheDocument();
    });

    it('should render correct number of items', () => {
      render(<Sidebar items={simpleItems} active="Home" />);
      
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });
  });

  describe('Active State', () => {
    it('should mark the active item', () => {
      render(<Sidebar items={simpleItems} active="Settings" />);
      
      // Get the Settings item
      const settingsItem = screen.getByTitle('Settings');
      const icon = settingsItem.querySelector('svg');
      
      // Should have active class
      expect(icon).toHaveClass('active');
    });

    it('should change active item on click', () => {
      render(<Sidebar items={simpleItems} active="Home" />);
      
      // Initially Home is active
      const homeIcon = screen.getByTitle('Home').querySelector('svg');
      expect(homeIcon).toHaveClass('active');
      
      // Click on Settings
      const settingsItem = screen.getByTitle('Settings');
      fireEvent.click(settingsItem);
      
      // Now Settings should be active
      const settingsIcon = settingsItem.querySelector('svg');
      expect(settingsIcon).toHaveClass('active');
    });
  });

  describe('User Interactions', () => {
    it('should call onclick handler when provided', () => {
      const mockClick = jest.fn();
      const itemsWithHandler = [
        { title: 'Button', Icon: MockIcon, onclick: mockClick },
      ];
      
      render(<Sidebar items={itemsWithHandler} active="Button" />);
      
      // Click the item
      const button = screen.getByTitle('Button');
      fireEvent.click(button);
      
      // Handler should be called
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple clicks', () => {
      const mockClick = jest.fn();
      const itemsWithHandler = [
        { title: 'Clickable', Icon: MockIcon, onclick: mockClick },
      ];
      
      render(<Sidebar items={itemsWithHandler} active="Clickable" />);
      
      const item = screen.getByTitle('Clickable');
      
      // Click multiple times
      fireEvent.click(item);
      fireEvent.click(item);
      fireEvent.click(item);
      
      expect(mockClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty items array', () => {
      render(<Sidebar items={[]} active="" />);
      
      const list = screen.getByRole('list');
      expect(list.children).toHaveLength(0);
    });

    it('should handle single item', () => {
      const singleItem = [{ title: 'Only', Icon: MockIcon }];
      
      render(<Sidebar items={singleItem} active="Only" />);
      
      expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('should default to first item when active not found', () => {
      render(<Sidebar items={simpleItems} active="NonExistent" />);
      
      // First item should be active by default
      const firstIcon = screen.getByTitle('Home').querySelector('svg');
      expect(firstIcon).toHaveClass('active');
    });
  });
});

/**
 * HOW TO RUN:
 * ```bash
 * npx nx test ui-base --testFile=Sidebar-simple.spec.tsx
 * npx nx test ui-base --testFile=Sidebar-simple.spec.tsx --watch
 * ```
 * 
 * WHAT THIS TESTS:
 * ✅ Component renders without errors
 * ✅ All items appear in the DOM
 * ✅ Active state works correctly
 * ✅ Click interactions work
 * ✅ Callbacks are called
 * ✅ Edge cases (empty, single item)
 * 
 * NEXT STEPS:
 * Once comfortable with these patterns:
 * 1. Add tests for links (with proper router setup)
 * 2. Test keyboard navigation
 * 3. Test accessibility features
 * 4. Add snapshot tests
 * 5. Test with real Storybook args
 */
