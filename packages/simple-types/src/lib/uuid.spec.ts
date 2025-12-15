import { makeUuid, makeShortUuid, isUuid, toUuid } from './uuid';

/**
 * TESTING UUID UTILITY FUNCTIONS
 * 
 * This test suite demonstrates:
 * - Testing UUID generation and validation
 * - Testing string pattern matching with regex
 * - Testing string transformation functions
 * - Edge cases and format validation
 */

// Mock the uuid library to have predictable output for some tests
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

describe('UUID Utilities', () => {
  describe('makeUuid', () => {
    it('should return a valid UUID v4 string', () => {
      const uuid = makeUuid();
      expect(uuid).toBeDefined();
      expect(typeof uuid).toBe('string');
    });

    it('should return UUID in correct format', () => {
      const uuid = makeUuid();
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should return the mocked UUID value', () => {
      const uuid = makeUuid();
      expect(uuid).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    it('should have correct length (36 characters)', () => {
      const uuid = makeUuid();
      expect(uuid.length).toBe(36);
    });

    it('should have hyphens at correct positions', () => {
      const uuid = makeUuid();
      expect(uuid[8]).toBe('-');
      expect(uuid[13]).toBe('-');
      expect(uuid[18]).toBe('-');
      expect(uuid[23]).toBe('-');
    });
  });

  describe('makeShortUuid', () => {
    it('should return first 8 characters of UUID', () => {
      const shortUuid = makeShortUuid();
      expect(shortUuid).toBe('a1b2c3d4');
    });

    it('should return 8 character string', () => {
      const shortUuid = makeShortUuid();
      expect(shortUuid.length).toBe(8);
    });

    it('should return only hexadecimal characters', () => {
      const shortUuid = makeShortUuid();
      expect(shortUuid).toMatch(/^[0-9a-f]{8}$/i);
    });

    it('should not contain hyphens', () => {
      const shortUuid = makeShortUuid();
      expect(shortUuid).not.toContain('-');
    });
  });

  describe('isUuid', () => {
    it('should return true for valid UUID', () => {
      expect(isUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    });

    it('should return true for UUID with uppercase letters', () => {
      expect(isUuid('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(true);
    });

    it('should return true for UUID with mixed case', () => {
      expect(isUuid('A1b2C3d4-e5F6-7890-AbCd-Ef1234567890')).toBe(true);
    });

    it('should return false for UUID without hyphens', () => {
      expect(isUuid('a1b2c3d4e5f67890abcdef1234567890')).toBe(false);
    });

    it('should return false for short UUID (8 chars)', () => {
      expect(isUuid('a1b2c3d4')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isUuid('')).toBe(false);
    });

    it('should return false for UUID with wrong hyphen positions', () => {
      expect(isUuid('a1b2c3d4e-5f6-7890-abcd-ef1234567890')).toBe(false);
      expect(isUuid('a1b2c3d4-e5f67-890-abcd-ef1234567890')).toBe(false);
    });

    it('should return false for UUID with invalid characters', () => {
      expect(isUuid('g1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(false);
      expect(isUuid('a1b2c3d4-e5f6-7890-abcd-ef123456789z')).toBe(false);
    });

    it('should return false for UUID that is too short', () => {
      expect(isUuid('a1b2c3d4-e5f6-7890-abcd-ef12345678')).toBe(false);
    });

    it('should return false for UUID that is too long', () => {
      expect(isUuid('a1b2c3d4-e5f6-7890-abcd-ef12345678900')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      expect(isUuid(null as any)).toBe(false);
      expect(isUuid(undefined as any)).toBe(false);
      expect(isUuid(123 as any)).toBe(false);
    });

    it('should return false for UUID with spaces', () => {
      expect(isUuid('a1b2c3d4 e5f6-7890-abcd-ef1234567890')).toBe(false);
    });

    it('should validate UUIDs with all zeros', () => {
      expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    });

    it('should validate UUIDs with all f characters', () => {
      expect(isUuid('ffffffff-ffff-ffff-ffff-ffffffffffff')).toBe(true);
    });
  });

  describe('toUuid', () => {
    it('should return UUID unchanged if already valid UUID', () => {
      const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(toUuid(validUuid)).toBe(validUuid);
    });

    it('should convert 32-char hex string to UUID format', () => {
      const hexString = 'a1b2c3d4e5f67890abcdef1234567890';
      const expected = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(toUuid(hexString)).toBe(expected);
    });

    it('should convert uppercase hex string to UUID format', () => {
      const hexString = 'A1B2C3D4E5F67890ABCDEF1234567890';
      const expected = 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890';
      expect(toUuid(hexString)).toBe(expected);
    });

    it('should convert mixed case hex string to UUID format', () => {
      const hexString = 'a1B2c3D4e5F67890AbCdEf1234567890';
      const expected = 'a1B2c3D4-e5F6-7890-AbCd-Ef1234567890';
      expect(toUuid(hexString)).toBe(expected);
    });

    it('should return false for invalid hex string (too short)', () => {
      expect(toUuid('a1b2c3d4e5f67890abcdef12345678')).toBe(false);
    });

    it('should return false for invalid hex string (too long)', () => {
      expect(toUuid('a1b2c3d4e5f67890abcdef12345678900')).toBe(false);
    });

    it('should return false for string with invalid characters', () => {
      expect(toUuid('g1b2c3d4e5f67890abcdef1234567890')).toBe(false);
      expect(toUuid('a1b2c3d4e5f67890abcdef123456789z')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(toUuid('')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(toUuid('hello-world')).toBe(false);
    });

    it('should return false for UUID with wrong hyphen count', () => {
      expect(toUuid('a1b2c3d4-e5f6-7890-abcd')).toBe(false);
    });

    it('should handle hex string with all zeros', () => {
      const hexString = '00000000000000000000000000000000';
      const expected = '00000000-0000-0000-0000-000000000000';
      expect(toUuid(hexString)).toBe(expected);
    });

    it('should handle hex string with all f characters', () => {
      const hexString = 'ffffffffffffffffffffffffffffffff';
      const expected = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      expect(toUuid(hexString)).toBe(expected);
    });

    it('should correctly split hex string into UUID segments', () => {
      const hexString = '12345678901234567890123456789012';
      const result = toUuid(hexString);
      
      // Verify the format
      expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      // Verify each segment length
      const segments = (result as string).split('-');
      expect(segments[0].length).toBe(8);
      expect(segments[1].length).toBe(4);
      expect(segments[2].length).toBe(4);
      expect(segments[3].length).toBe(4);
      expect(segments[4].length).toBe(12);
    });

    it('should return false for hex string with hyphens', () => {
      // If it already has hyphens but wrong format, should return false
      expect(toUuid('a1b2c3d4-e5f6-7890-abcd-ef12345678')).toBe(false);
    });
  });

  describe('Integration tests', () => {
    it('makeUuid should produce UUIDs that pass isUuid validation', () => {
      const uuid = makeUuid();
      expect(isUuid(uuid)).toBe(true);
    });

    it('makeShortUuid should not pass isUuid validation', () => {
      const shortUuid = makeShortUuid();
      expect(isUuid(shortUuid)).toBe(false);
    });

    it('toUuid should accept makeUuid output unchanged', () => {
      const uuid = makeUuid();
      expect(toUuid(uuid)).toBe(uuid);
    });

    it('should be able to convert UUID to hex and back', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const hexString = uuid.replace(/-/g, '');
      const converted = toUuid(hexString);
      
      expect(converted).toBe(uuid);
      expect(isUuid(converted as string)).toBe(true);
    });

    it('should handle round-trip conversion', () => {
      const originalHex = 'deadbeefcafebabe0123456789abcdef';
      const uuid = toUuid(originalHex);
      const backToHex = (uuid as string).replace(/-/g, '');
      
      expect(uuid).not.toBe(false);
      expect(backToHex.toLowerCase()).toBe(originalHex.toLowerCase());
    });

    it('makeShortUuid should be first 8 chars of makeUuid', () => {
      const fullUuid = makeUuid();
      const shortUuid = makeShortUuid();
      
      expect(shortUuid).toBe(fullUuid.substring(0, 8));
    });

    it('should handle edge cases consistently', () => {
      // Test various invalid inputs across all functions
      const invalidInputs = [
        '',
        'invalid',
        '123',
        'not-a-uuid',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      ];

      invalidInputs.forEach(input => {
        expect(isUuid(input)).toBe(false);
        // toUuid should also return false for these
        if (input.length !== 32) {
          expect(toUuid(input)).toBe(false);
        }
      });
    });
  });
});

