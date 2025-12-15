/**
 * Tests for my-fetch utility functions
 *
 * These utilities are used throughout the codebase for constructing
 * API request URLs with path parameters and query strings.
 */

import { serialize, fullUri, TUri, TSerializableObject } from './my-fetch';

describe('my-fetch utilities', () => {
  describe('serialize', () => {
    it('should serialize a simple object to query string', () => {
      const input: TSerializableObject = {
        name: 'John',
        age: 30,
        active: true,
      };

      const result = serialize(input);

      expect(result).toBe('name=John&age=30&active=true');
    });

    it('should handle empty object', () => {
      const input: TSerializableObject = {};

      const result = serialize(input);

      expect(result).toBe('');
    });

    it('should URL-encode special characters', () => {
      const input: TSerializableObject = {
        email: 'user@example.com',
        message: 'Hello World!',
        search: 'foo+bar',
        path: '/api/v1/users',
      };

      const result = serialize(input);

      // encodeURIComponent should encode special chars
      expect(result).toContain('email=user%40example.com');
      expect(result).toContain('message=Hello%20World!');
      expect(result).toContain('search=foo%2Bbar');
      expect(result).toContain('path=%2Fapi%2Fv1%2Fusers');
    });

    it('should handle boolean values', () => {
      const input: TSerializableObject = {
        enabled: true,
        disabled: false,
      };

      const result = serialize(input);

      expect(result).toBe('enabled=true&disabled=false');
    });

    it('should handle numeric values including zero', () => {
      const input: TSerializableObject = {
        count: 0,
        limit: 100,
        offset: 25,
      };

      const result = serialize(input);

      expect(result).toBe('count=0&limit=100&offset=25');
    });

    it('should handle unicode characters', () => {
      const input: TSerializableObject = {
        name: '日本語',
        emoji: '🚀',
      };

      const result = serialize(input);

      expect(result).toContain('name=%E6%97%A5%E6%9C%AC%E8%AA%9E');
      expect(result).toContain('emoji=%F0%9F%9A%80');
    });

    it('should handle spaces and special URL characters', () => {
      const input: TSerializableObject = {
        query: 'hello world',
        symbols: '&=?#',
      };

      const result = serialize(input);

      expect(result).toContain('query=hello%20world');
      expect(result).toContain('symbols=%26%3D%3F%23');
    });

    it('should maintain order of keys (object iteration order)', () => {
      const input: TSerializableObject = {
        a: 'first',
        b: 'second',
        c: 'third',
      };

      const result = serialize(input);

      // JavaScript object iteration order is insertion order for string keys
      expect(result).toBe('a=first&b=second&c=third');
    });
  });

  describe('fullUri', () => {
    it('should return URL with query parameters when no path parameters', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users',
        queryParameters: {
          limit: 10,
          offset: 0,
        },
      };

      const result = fullUri(uri);

      expect(result).toBe('https://api.example.com/users?limit=10&offset=0');
    });

    it('should replace path parameters in URL', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users/{userId}/posts/{postId}',
        pathParameters: {
          userId: '123',
          postId: '456',
        },
      };

      const result = fullUri(uri);

      expect(result).toBe('https://api.example.com/users/123/posts/456?');
    });

    it('should handle both path and query parameters', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users/{userId}',
        pathParameters: {
          userId: '123',
        },
        queryParameters: {
          include: 'profile',
          fields: 'name',
        },
      };

      const result = fullUri(uri);

      expect(result).toBe(
        'https://api.example.com/users/123?include=profile&fields=name'
      );
    });

    it('should handle URL with no parameters', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users',
      };

      const result = fullUri(uri);

      // Still adds ? even with no query params
      expect(result).toBe('https://api.example.com/users?');
    });

    it('should replace all occurrences of a path parameter', () => {
      const uri: TUri = {
        url: 'https://api.example.com/{org}/repos/{org}/issues',
        pathParameters: {
          org: 'holistix',
        },
      };

      const result = fullUri(uri);

      expect(result).toBe(
        'https://api.example.com/holistix/repos/holistix/issues?'
      );
    });

    it('should handle numeric path parameters', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users/{id}',
        pathParameters: {
          id: 12345,
        },
      };

      const result = fullUri(uri);

      expect(result).toBe('https://api.example.com/users/12345?');
    });

    it('should handle boolean path parameters', () => {
      const uri: TUri = {
        url: 'https://api.example.com/settings/{enabled}',
        pathParameters: {
          enabled: true,
        },
      };

      const result = fullUri(uri);

      expect(result).toBe('https://api.example.com/settings/true?');
    });

    it('should handle empty path parameters object', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users/{userId}',
        pathParameters: {},
        queryParameters: {
          limit: 10,
        },
      };

      const result = fullUri(uri);

      // Path parameter not replaced if not in pathParameters
      expect(result).toBe('https://api.example.com/users/{userId}?limit=10');
    });

    it('should handle empty query parameters object', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users/{userId}',
        pathParameters: {
          userId: '123',
        },
        queryParameters: {},
      };

      const result = fullUri(uri);

      expect(result).toBe('https://api.example.com/users/123?');
    });

    it('should handle special characters in query parameters', () => {
      const uri: TUri = {
        url: 'https://api.example.com/search',
        queryParameters: {
          q: 'hello world',
          filter: 'type=user&active=true',
        },
      };

      const result = fullUri(uri);

      expect(result).toContain('q=hello%20world');
      expect(result).toContain('filter=type%3Duser%26active%3Dtrue');
    });

    it('should handle relative URLs', () => {
      const uri: TUri = {
        url: '/api/users/{userId}',
        pathParameters: {
          userId: '123',
        },
        queryParameters: {
          expand: 'profile',
        },
      };

      const result = fullUri(uri);

      expect(result).toBe('/api/users/123?expand=profile');
    });

    it('should handle URLs that already have query parameters in base URL', () => {
      // Note: This is an edge case - the function adds ? regardless
      const uri: TUri = {
        url: 'https://api.example.com/users?existing=param',
        queryParameters: {
          new: 'param',
        },
      };

      const result = fullUri(uri);

      // This creates invalid URL with double ? - this is a known limitation
      expect(result).toBe(
        'https://api.example.com/users?existing=param?new=param'
      );
    });

    it('should handle path parameters with special regex characters in value', () => {
      const uri: TUri = {
        url: 'https://api.example.com/users/{userId}',
        pathParameters: {
          userId: 'user.123',
        },
      };

      const result = fullUri(uri);

      expect(result).toBe('https://api.example.com/users/user.123?');
    });

    it('should construct complex API URLs correctly', () => {
      const uri: TUri = {
        url: 'https://api.github.com/repos/{owner}/{repo}/issues',
        pathParameters: {
          owner: 'HolistixForge',
          repo: 'platform',
        },
        queryParameters: {
          state: 'open',
          labels: 'bug',
          per_page: 100,
        },
      };

      const result = fullUri(uri);

      expect(result).toBe(
        'https://api.github.com/repos/HolistixForge/platform/issues?state=open&labels=bug&per_page=100'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle a typical REST API GET request', () => {
      const uri: TUri = {
        url: '/api/v1/organizations/{orgId}/projects',
        pathParameters: {
          orgId: 'org-123',
        },
        queryParameters: {
          status: 'active',
          limit: 20,
          offset: 0,
        },
      };

      const result = fullUri(uri);

      expect(result).toBe(
        '/api/v1/organizations/org-123/projects?status=active&limit=20&offset=0'
      );
    });

    it('should handle a search endpoint with encoded query', () => {
      const uri: TUri = {
        url: '/api/v1/search',
        queryParameters: {
          q: 'user@example.com',
          type: 'email',
          exact: true,
        },
      };

      const result = fullUri(uri);

      expect(result).toContain('q=user%40example.com');
      expect(result).toContain('type=email');
      expect(result).toContain('exact=true');
    });

    it('should handle nested resource paths', () => {
      const uri: TUri = {
        url: '/api/v1/users/{userId}/projects/{projectId}/tasks/{taskId}',
        pathParameters: {
          userId: 'user-1',
          projectId: 'proj-2',
          taskId: 'task-3',
        },
        queryParameters: {
          include: 'subtasks',
        },
      };

      const result = fullUri(uri);

      expect(result).toBe(
        '/api/v1/users/user-1/projects/proj-2/tasks/task-3?include=subtasks'
      );
    });
  });
});
