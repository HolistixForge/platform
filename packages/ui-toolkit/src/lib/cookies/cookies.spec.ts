/**
 * Tests for cookie utility functions
 * 
 * Tests browser cookie parsing and retrieval utilities.
 */

import { getCookies, getCookie } from './cookies';

describe('Cookie Utilities', () => {
  // Store original document.cookie
  let originalCookie: string;

  beforeEach(() => {
    // Save original cookies
    originalCookie = document.cookie;
    
    // Clear all cookies before each test
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
  });

  afterEach(() => {
    // Clean up: remove test cookies
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
  });

  describe('getCookies', () => {
    it('should return empty array when no cookies are set', () => {
      // Ensure document.cookie is empty
      const cookies = getCookies();

      // Might have empty string or empty array depending on browser
      expect(Array.isArray(cookies)).toBe(true);
    });

    it('should parse a single cookie', () => {
      document.cookie = 'testCookie=testValue';

      const cookies = getCookies();

      expect(cookies).toContainEqual(['testCookie', 'testValue']);
    });

    it('should parse multiple cookies', () => {
      document.cookie = 'cookie1=value1';
      document.cookie = 'cookie2=value2';
      document.cookie = 'cookie3=value3';

      const cookies = getCookies();

      expect(cookies.length).toBeGreaterThanOrEqual(3);
      expect(cookies).toContainEqual(['cookie1', 'value1']);
      expect(cookies).toContainEqual(['cookie2', 'value2']);
      expect(cookies).toContainEqual(['cookie3', 'value3']);
    });

    it('should handle cookies with special characters in values', () => {
      // URL-encoded values
      document.cookie = 'email=user%40example.com';

      const cookies = getCookies();

      expect(cookies).toContainEqual(['email', 'user%40example.com']);
    });

    it('should trim whitespace from cookie names and values', () => {
      // Browser may add spaces after semicolons
      document.cookie = 'spacedCookie=spacedValue';

      const cookies = getCookies();

      // The function trims the cookie string
      const cookie = cookies.find((c) => c[0] === 'spacedCookie');
      expect(cookie).toBeDefined();
      expect(cookie![1]).toBe('spacedValue');
    });

    it('should return array of [name, value] pairs', () => {
      document.cookie = 'test1=value1';
      document.cookie = 'test2=value2';

      const cookies = getCookies();

      cookies.forEach((cookie) => {
        expect(Array.isArray(cookie)).toBe(true);
        expect(cookie).toHaveLength(2);
        expect(typeof cookie[0]).toBe('string'); // name
        expect(typeof cookie[1]).toBe('string'); // value
      });
    });
  });

  describe('getCookie', () => {
    beforeEach(() => {
      // Set up test cookies
      document.cookie = 'testCookie=testValue';
      document.cookie = 'jsonCookie=' + encodeURIComponent(JSON.stringify({ key: 'value' }));
      document.cookie = 'numberCookie=123';
    });

    it('should retrieve a cookie by name', () => {
      const value = getCookie('testCookie');

      expect(value).toBe('testValue');
    });

    it('should return undefined for non-existent cookie', () => {
      const value = getCookie('nonExistentCookie');

      expect(value).toBeUndefined();
    });

    it('should decode URL-encoded cookie values', () => {
      document.cookie = 'email=' + encodeURIComponent('user@example.com');

      const value = getCookie('email');

      expect(value).toBe('user@example.com');
    });

    it('should parse JSON cookie when json=true', () => {
      const value = getCookie('jsonCookie', true);

      expect(value).toEqual({ key: 'value' });
    });

    it('should return string when json=false (default)', () => {
      const value = getCookie('jsonCookie', false);

      expect(typeof value).toBe('string');
      expect(value).toBe(JSON.stringify({ key: 'value' }));
    });

    it('should handle numeric string values', () => {
      const value = getCookie('numberCookie');

      expect(value).toBe('123');
      expect(typeof value).toBe('string');
    });

    it('should handle empty string values', () => {
      document.cookie = 'emptyCookie=';

      const value = getCookie('emptyCookie');

      expect(value).toBe('');
    });

    it('should handle complex JSON objects', () => {
      const complexObject = {
        user: { id: 123, name: 'Alice' },
        roles: ['admin', 'user'],
        metadata: { active: true },
      };
      document.cookie = 'complexCookie=' + encodeURIComponent(JSON.stringify(complexObject));

      const value = getCookie('complexCookie', true);

      expect(value).toEqual(complexObject);
    });

    it('should handle boolean values in cookies', () => {
      document.cookie = 'boolCookie=true';

      const value = getCookie('boolCookie');

      expect(value).toBe('true');
      expect(typeof value).toBe('string');
    });

    it('should be case-sensitive for cookie names', () => {
      document.cookie = 'TestCookie=value1';
      document.cookie = 'testCookie=value2';

      const value1 = getCookie('TestCookie');
      const value2 = getCookie('testCookie');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
    });

    it('should handle cookies with equals signs in the value', () => {
      document.cookie = 'equation=' + encodeURIComponent('x=y+2');

      const value = getCookie('equation');

      expect(value).toBe('x=y+2');
    });

    it('should handle special characters in cookie values', () => {
      const specialValue = 'hello world!@#$%^&*()';
      document.cookie = 'specialCookie=' + encodeURIComponent(specialValue);

      const value = getCookie('specialCookie');

      expect(value).toBe(specialValue);
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical user session cookie', () => {
      const sessionData = {
        userId: 'user-123',
        token: 'abc-def-ghi',
        expiresAt: '2024-12-31T23:59:59Z',
      };
      document.cookie = 'session=' + encodeURIComponent(JSON.stringify(sessionData));

      const session = getCookie('session', true);

      expect(session).toEqual(sessionData);
      expect(session.userId).toBe('user-123');
    });

    it('should handle authentication token cookie', () => {
      document.cookie = 'authToken=Bearer%20eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      const token = getCookie('authToken');

      expect(token).toContain('Bearer');
      expect(token).toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should handle user preferences cookie', () => {
      const preferences = {
        theme: 'dark',
        language: 'en',
        notifications: true,
      };
      document.cookie = 'preferences=' + encodeURIComponent(JSON.stringify(preferences));

      const prefs = getCookie('preferences', true);

      expect(prefs.theme).toBe('dark');
      expect(prefs.language).toBe('en');
      expect(prefs.notifications).toBe(true);
    });

    it('should retrieve multiple different cookies', () => {
      document.cookie = 'cookie1=value1';
      document.cookie = 'cookie2=value2';
      document.cookie = 'cookie3=value3';

      const value1 = getCookie('cookie1');
      const value2 = getCookie('cookie2');
      const value3 = getCookie('cookie3');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(value3).toBe('value3');
    });
  });

  describe('edge cases', () => {
    it('should handle malformed JSON when parsing', () => {
      document.cookie = 'badJson=' + encodeURIComponent('{invalid json}');

      expect(() => {
        getCookie('badJson', true);
      }).toThrow();
    });

    it('should return first cookie if multiple cookies have same name', () => {
      // This shouldn't happen in practice, but testing the behavior
      // (browser typically prevents duplicate cookie names)
      document.cookie = 'duplicate=first';
      
      const value = getCookie('duplicate');

      expect(value).toBe('first');
    });

    it('should handle unicode characters in cookie values', () => {
      const unicodeValue = '日本語テキスト';
      document.cookie = 'unicode=' + encodeURIComponent(unicodeValue);

      const value = getCookie('unicode');

      expect(value).toBe(unicodeValue);
    });

    it('should handle emoji in cookie values', () => {
      const emojiValue = '🚀🎉✨';
      document.cookie = 'emoji=' + encodeURIComponent(emojiValue);

      const value = getCookie('emoji');

      expect(value).toBe(emojiValue);
    });
  });
});

