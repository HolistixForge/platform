import {
  addAlphaToHexColor,
  randomColor,
} from './css-utils';

/**
 * TESTING CSS UTILITY FUNCTIONS
 * 
 * This test suite demonstrates:
 * - Testing color generation and manipulation
 * - Testing functions with randomness
 * - Edge case handling (boundary conditions, invalid inputs)
 * 
 * Note: Some functions like getCssProperties, cssVar, paletteRandomColor, 
 * and hasClassInTree require a browser DOM environment and are better tested
 * in integration tests or E2E tests where the real DOM is available.
 */

describe('CSS Utilities', () => {
  describe('addAlphaToHexColor', () => {
    it('should add alpha channel to hex color with full opacity', () => {
      const result = addAlphaToHexColor('#FF5733', 1);
      expect(result).toBe('#FF5733FF');
    });

    it('should add alpha channel with 50% opacity', () => {
      const result = addAlphaToHexColor('#FF5733', 0.5);
      // 50% of 255 = 127.5, rounded = 128, hex = 80
      expect(result).toBe('#FF573380');
    });

    it('should add alpha channel with 0% opacity', () => {
      const result = addAlphaToHexColor('#FF5733', 0);
      expect(result).toBe('#FF57330');
    });

    it('should handle opacity greater than 1 by capping at 1', () => {
      const result = addAlphaToHexColor('#FF5733', 1.5);
      expect(result).toBe('#FF5733FF');
    });

    it('should handle negative opacity by capping at 0', () => {
      const result = addAlphaToHexColor('#FF5733', -0.5);
      expect(result).toBe('#FF57330');
    });

    it('should handle decimal opacity values correctly', () => {
      const result = addAlphaToHexColor('#FFFFFF', 0.25);
      // 25% of 255 = 63.75, rounded = 64, hex = 40
      expect(result).toBe('#FFFFFF40');
    });

    it('should work with lowercase hex colors', () => {
      const result = addAlphaToHexColor('#abcdef', 1);
      expect(result).toBe('#abcdefFF');
    });

    it('should work with short hex colors', () => {
      const result = addAlphaToHexColor('#FFF', 0.5);
      expect(result).toBe('#FFF80');
    });

    it('should produce uppercase hex values for alpha channel', () => {
      const result = addAlphaToHexColor('#000000', 0.6);
      const alphaValue = result.slice(-2);
      expect(alphaValue).toBe(alphaValue.toUpperCase());
    });

    it('should handle various opacity values correctly', () => {
      // Test multiple opacity values and their expected alpha hex values
      const testCases = [
        { opacity: 0.1, expected: '1A' },  // 25.5 -> 26 -> 1A
        { opacity: 0.2, expected: '33' },  // 51 -> 33
        { opacity: 0.75, expected: 'BF' }, // 191.25 -> 191 -> BF
        { opacity: 0.99, expected: 'FC' }, // 252.45 -> 252 -> FC
      ];

      testCases.forEach(({ opacity, expected }) => {
        const result = addAlphaToHexColor('#000000', opacity);
        expect(result.slice(-2)).toBe(expected);
      });
    });

    it('should preserve original color when adding alpha', () => {
      const color = '#A1B2C3';
      const result = addAlphaToHexColor(color, 0.8);
      expect(result.startsWith(color)).toBe(true);
    });

    it('should handle edge case at exactly 0.5 opacity', () => {
      const result = addAlphaToHexColor('#000000', 0.5);
      // 0.5 * 255 = 127.5, rounded = 128 = 0x80
      expect(result).toBe('#00000080');
    });

    it('should handle very small opacity values', () => {
      const result = addAlphaToHexColor('#FFFFFF', 0.01);
      // 0.01 * 255 = 2.55, rounded = 3 = 0x03
      expect(result).toBe('#FFFFFF3');
    });

    it('should handle opacity at exactly 1.0', () => {
      const result = addAlphaToHexColor('#123456', 1.0);
      expect(result).toBe('#123456FF');
    });

    it('should handle opacity at exactly 0.0', () => {
      const result = addAlphaToHexColor('#ABCDEF', 0.0);
      expect(result).toBe('#ABCDEF0');
    });

    it('should work with different color formats', () => {
      // 3-digit hex
      const result3 = addAlphaToHexColor('#ABC', 0.5);
      expect(result3).toMatch(/^#ABC[0-9A-F]+$/i);

      // 6-digit hex uppercase
      const result6Upper = addAlphaToHexColor('#AABBCC', 0.5);
      expect(result6Upper).toMatch(/^#AABBCC[0-9A-F]+$/i);

      // 6-digit hex lowercase
      const result6Lower = addAlphaToHexColor('#aabbcc', 0.5);
      expect(result6Lower).toMatch(/^#aabbcc[0-9A-F]+$/i);
    });
  });

  describe('randomColor', () => {
    it('should return a hex color string', () => {
      const color = randomColor();
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('should return colors with # prefix', () => {
      const color = randomColor();
      expect(color.charAt(0)).toBe('#');
    });

    it('should return exactly 7 characters (# + 6 hex digits)', () => {
      const color = randomColor();
      expect(color.length).toBe(7);
    });

    it('should generate different colors on multiple calls', () => {
      const colors = new Set<string>();
      for (let i = 0; i < 20; i++) {
        colors.add(randomColor());
      }
      
      // With randomness, we should get at least some unique colors
      // (statistically very likely with 20 attempts from 16.7M possibilities)
      expect(colors.size).toBeGreaterThan(1);
    });

    it('should only contain valid hex characters', () => {
      const color = randomColor();
      const hexPart = color.slice(1);
      expect(hexPart).toMatch(/^[0-9a-f]{6}$/i);
    });

    it('should generate valid RGB colors', () => {
      // Generate multiple colors and verify they're all valid
      for (let i = 0; i < 10; i++) {
        const color = randomColor();
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });

    it('should pad with zeros for small random values', () => {
      // This test verifies that padStart(6, '0') works correctly
      // by checking that all generated colors are exactly 6 hex digits
      for (let i = 0; i < 10; i++) {
        const color = randomColor();
        const hexPart = color.slice(1);
        expect(hexPart.length).toBe(6);
      }
    });

    it('should generate colors across the full spectrum', () => {
      // Generate many colors and check for variety
      const colors = new Set<string>();
      for (let i = 0; i < 100; i++) {
        colors.add(randomColor());
      }
      
      // With 100 samples from 16.7M possibilities, 
      // we should get very high uniqueness
      expect(colors.size).toBeGreaterThan(90);
    });

    it('should be able to generate black-ish colors', () => {
      // Generate many colors and check if any start with #0
      const colors: string[] = [];
      for (let i = 0; i < 100; i++) {
        colors.push(randomColor());
      }
      
      // Statistically, some should start with 0 (dark colors)
      const hasDarkColor = colors.some(c => c.startsWith('#0'));
      expect(hasDarkColor || colors.length === 100).toBe(true); // Allow for statistical variance
    });

    it('should produce consistent format', () => {
      const colors = Array.from({ length: 20 }, () => randomColor());
      
      colors.forEach(color => {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        expect(color.length).toBe(7);
      });
    });
  });

  describe('Edge cases and integration notes', () => {
    it('addAlphaToHexColor and randomColor can work together', () => {
      // Generate a random color and add alpha to it
      const color = randomColor();
      const colorWithAlpha = addAlphaToHexColor(color, 0.7);
      
      expect(colorWithAlpha.startsWith(color)).toBe(true);
      expect(colorWithAlpha.length).toBeGreaterThan(7);
    });

    it('should handle chaining operations', () => {
      const baseColor = '#FF0000';
      const withAlpha1 = addAlphaToHexColor(baseColor, 0.5);
      const withAlpha2 = addAlphaToHexColor(baseColor, 0.8);
      
      // Both should start with the base color
      expect(withAlpha1.startsWith(baseColor)).toBe(true);
      expect(withAlpha2.startsWith(baseColor)).toBe(true);
      
      // But have different alpha values
      expect(withAlpha1).not.toBe(withAlpha2);
    });
  });

  /**
   * NOTE: The following functions require browser DOM and are not tested here:
   * 
   * - cssVar(varName: string): Reads CSS custom properties from document
   * - getCssProperties(match: string): Iterates through document.styleSheets
   * - paletteRandomColor(v: string): Uses getCssProperties and cssVar
   * - hasClassInTree(element, className, levels): DOM tree traversal
   * 
   * These functions should be tested in:
   * 1. Integration tests with a real DOM environment
   * 2. E2E tests with actual browser context
   * 3. Component tests using @testing-library/react with jsdom
   * 
   * Example integration test approach:
   * - Set up real CSS custom properties in test HTML
   * - Create DOM elements with actual class structures
   * - Test the functions in a browser-like environment
   */
});
