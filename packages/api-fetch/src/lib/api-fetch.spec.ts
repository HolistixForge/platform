import { ApiFetch } from './api-fetch';
import { TMyfetchRequest } from '@holistix-forge/simple-types';

// Mock the global fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('ApiFetch', () => {
  let apiFetch: ApiFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    apiFetch = new ApiFetch('https://api.example.com');
  });

  describe('fetch method - HTTP status code handling', () => {
    // Test all 2xx success codes
    describe('2xx Success Codes', () => {
      test.each([
        [200, 'OK'],
        [201, 'Created'],
        [202, 'Accepted'],
        [204, 'No Content'],
        [206, 'Partial Content'],
        [299, 'Custom 2xx'],
      ])('should accept %d (%s) as successful response', async (statusCode, statusText) => {
        const mockJson = { success: true, data: 'test-data' };
        
        mockFetch.mockResolvedValueOnce({
          status: statusCode,
          statusText,
          json: jest.fn().mockResolvedValueOnce(mockJson),
        });

        const request: TMyfetchRequest = {
          method: 'GET',
          url: '/test-endpoint',
        };

        const result = await apiFetch.fetch(request);

        expect(result).toEqual(mockJson);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        // Note: fullUri always adds "?" even without query params, and URLs may have double slashes
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/test-endpoint'),
          expect.objectContaining({
            method: 'GET',
          })
        );
      });
    });

    // Test failure codes (non-2xx)
    describe('Non-2xx Error Codes', () => {
      test.each([
        [199, 'Below 2xx range'],
        [300, 'Multiple Choices'],
        [301, 'Moved Permanently'],
        [400, 'Bad Request'],
        [401, 'Unauthorized'],
        [403, 'Forbidden'],
        [404, 'Not Found'],
        [500, 'Internal Server Error'],
        [502, 'Bad Gateway'],
        [503, 'Service Unavailable'],
      ])('should reject %d (%s) as failed response', async (statusCode, statusText) => {
        const mockJson = { error: 'Error message', details: 'Error details' };
        
        mockFetch.mockResolvedValueOnce({
          status: statusCode,
          statusText,
          json: jest.fn().mockResolvedValueOnce(mockJson),
        });

        const request: TMyfetchRequest = {
          method: 'GET',
          url: '/test-endpoint',
        };

        let thrownError;
        try {
          await apiFetch.fetch(request);
        } catch (error) {
          thrownError = error;
        }

        expect(thrownError).toBeDefined();
        expect((thrownError as any).message).toBe('API error');
        expect((thrownError as any).status).toBe(statusCode);
        expect((thrownError as any).json).toEqual(mockJson);
      });
    });
  });

  describe('URL construction', () => {
    it('should construct full URL from host and relative path', async () => {
      const mockJson = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch({
        method: 'GET',
        url: '/users/123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.example.com'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/123'),
        expect.any(Object)
      );
    });

    it('should handle query parameters', async () => {
      const mockJson = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch({
        method: 'GET',
        url: '/users',
        queryParameters: { page: '1', limit: '10' },
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('api.example.com');
      expect(callUrl).toContain('/users');
      expect(callUrl).toContain('page=1');
      expect(callUrl).toContain('limit=10');
    });

    it('should handle path parameters', async () => {
      const mockJson = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch({
        method: 'GET',
        url: '/users/{id}',
        pathParameters: { id: '123' },
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('api.example.com');
      expect(callUrl).toContain('/users/123');
      expect(callUrl).not.toContain('{id}');
    });
  });

  describe('request body handling', () => {
    it('should send JSON body for POST requests', async () => {
      const mockJson = { success: true };
      const requestBody = { name: 'Test User', email: 'test@example.com' };
      
      mockFetch.mockResolvedValueOnce({
        status: 201,
        statusText: 'Created',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch({
        method: 'POST',
        url: '/users',
        jsonBody: requestBody,
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('api.example.com');
      expect(callArgs[0]).toContain('/users');
      expect(callArgs[1]).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-type': 'application/json; charset=UTF-8',
        }),
        body: JSON.stringify(requestBody),
      });
    });

    it('should send form-urlencoded body', async () => {
      const mockJson = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch({
        method: 'POST',
        url: '/login',
        formUrlencoded: { username: 'test', password: 'pass123' },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('api.example.com');
      expect(callArgs[0]).toContain('/login');
      expect(callArgs[1]).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      });
      // Body should be URLSearchParams-like object
      expect(callArgs[1].body).toBeDefined();
    });

    it('should not send body for GET requests even with jsonBody', async () => {
      const mockJson = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch({
        method: 'GET',
        url: '/users',
        jsonBody: { filter: 'active' },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].body).toBeUndefined();
    });
  });

  describe('authentication', () => {
    it('should add authorization headers when auth is provided', async () => {
      const mockJson = { success: true };
      const authHeaders = { authorization: 'Bearer test-token-123' };
      
      const apiFetchWithAuth = new ApiFetch('https://api.example.com', {
        authorization: () => ({ headers: authHeaders }),
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetchWithAuth.fetch({
        method: 'GET',
        url: '/protected',
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('api.example.com');
      expect(callArgs[0]).toContain('/protected');
      expect(callArgs[1].headers).toMatchObject(authHeaders);
    });

    it('should include credentials when specified', async () => {
      const mockJson = { success: true };
      
      const apiFetchWithCredentials = new ApiFetch('https://api.example.com', {
        credentials: 'include',
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetchWithCredentials.fetch({
        method: 'GET',
        url: '/protected',
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('api.example.com');
      expect(callArgs[0]).toContain('/protected');
      expect(callArgs[1].credentials).toBe('include');
    });
  });

  describe('custom headers', () => {
    it('should merge custom headers with existing headers', async () => {
      const mockJson = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch({
        method: 'GET',
        url: '/users',
        headers: {
          'X-Custom-Header': 'custom-value',
          'Accept-Language': 'en-US',
        },
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('api.example.com');
      expect(callArgs[0]).toContain('/users');
      expect(callArgs[1].headers).toMatchObject({
        'X-Custom-Header': 'custom-value',
        'Accept-Language': 'en-US',
      });
    });
  });

  describe('real-world scenarios', () => {
    it('should handle POST with 201 Created', async () => {
      const mockJson = { id: 'user-123', created: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 201,
        statusText: 'Created',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      const result = await apiFetch.fetch({
        method: 'POST',
        url: '/users',
        jsonBody: { name: 'New User' },
      });

      expect(result).toEqual(mockJson);
    });

    it('should handle DELETE with 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 204,
        statusText: 'No Content',
        json: jest.fn().mockResolvedValueOnce(null),
      });

      const result = await apiFetch.fetch({
        method: 'DELETE',
        url: '/users/123',
      });

      expect(result).toBeNull();
    });

    it('should handle PATCH with 202 Accepted', async () => {
      const mockJson = { id: 'user-123', updated: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 202,
        statusText: 'Accepted',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      const result = await apiFetch.fetch({
        method: 'PATCH',
        url: '/users/123',
        jsonBody: { name: 'Updated Name' },
      });

      expect(result).toEqual(mockJson);
    });

    it('should handle 401 Unauthorized and preserve error details', async () => {
      const mockErrorJson = {
        error: 'Unauthorized',
        message: 'Invalid token',
      };
      
      mockFetch.mockResolvedValueOnce({
        status: 401,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValueOnce(mockErrorJson),
      });

      let thrownError;
      try {
        await apiFetch.fetch({
          method: 'GET',
          url: '/protected',
        });
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBeDefined();
      expect((thrownError as any).status).toBe(401);
      expect((thrownError as any).json).toEqual(mockErrorJson);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        apiFetch.fetch({
          method: 'GET',
          url: '/users',
        })
      ).rejects.toThrow('Network error');
    });
  });

  describe('host override', () => {
    it('should use custom host when provided', async () => {
      const mockJson = { success: true };
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      await apiFetch.fetch(
        {
          method: 'GET',
          url: '/users',
        },
        'https://custom-host.example.com'
      );

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('custom-host.example.com');
      expect(callArgs[0]).toContain('/users');
    });
  });
});

