import { GanymedeClient } from './ganymede-client';
import { myfetch } from '@holistix-forge/backend-engine';
import { TMyfetchRequest } from '@holistix-forge/simple-types';

type TMyfetchResponse = any;

// Mock the CONFIG module to avoid environment variable requirements
jest.mock('../config', () => ({
  CONFIG: {
    GATEWAY_ID: 'test-gateway-id',
    GATEWAY_TOKEN: 'test-gateway-token',
    GANYMEDE_FQDN: 'ganymede.test.local',
  },
}));

// Mock the myfetch function
jest.mock('@holistix-forge/backend-engine', () => ({
  myfetch: jest.fn(),
}));

// Mock the log function
jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'INFO',
    Error: 'ERROR',
  },
  log: jest.fn(),
}));

const mockedMyfetch = myfetch as jest.MockedFunction<typeof myfetch>;

describe('GanymedeClient', () => {
  let client: GanymedeClient;

  beforeEach(() => {
    jest.clearAllMocks();

    client = new GanymedeClient({
      ganymedeApiUrl: 'https://test-api.example.com',
      ganymedeFQDN: 'ganymede.example.com',
      organizationToken: 'org-token-123',
      gatewayToken: 'gateway-token-456',
    });
  });

  describe('request method - HTTP status code handling', () => {
    // Test all 2xx success codes
    describe('2xx Success Codes', () => {
      test.each([
        [200, 'OK'],
        [201, 'Created'],
        [202, 'Accepted'],
        [204, 'No Content'],
        [206, 'Partial Content'],
        [299, 'Custom 2xx'],
      ])(
        'should accept %d (%s) as successful response',
        async (statusCode, statusText) => {
          const mockResponse: TMyfetchResponse = {
            statusCode,
            statusText,
            json: { success: true, data: 'test-data' },
          };

          mockedMyfetch.mockResolvedValueOnce(mockResponse);

          const request: TMyfetchRequest = {
            method: 'GET',
            url: '/test-endpoint',
          };

          const result = await client.request(request);

          expect(result).toEqual({ success: true, data: 'test-data' });
          expect(mockedMyfetch).toHaveBeenCalledTimes(1);
        }
      );
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
      ])(
        'should reject %d (%s) as failed response',
        async (statusCode, statusText) => {
          const mockResponse: TMyfetchResponse = {
            statusCode,
            statusText,
            json: { error: 'Error message' },
          };

          mockedMyfetch.mockResolvedValueOnce(mockResponse);

          const request: TMyfetchRequest = {
            method: 'GET',
            url: '/test-endpoint',
          };

          await expect(client.request(request)).rejects.toThrow(
            `Request to https://test-api.example.com/test-endpoint failed with status ${statusCode}`
          );
        }
      );
    });
  });

  describe('authentication', () => {
    it('should add Bearer authorization header with organization token by default', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: { success: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      await client.request({
        method: 'GET',
        url: '/test',
      });

      const call = mockedMyfetch.mock.calls[0][0];
      expect(call.headers?.authorization).toBe('Bearer org-token-123');
    });

    it('should use gateway token when organization token is not set', async () => {
      const clientWithoutOrgToken = new GanymedeClient({
        ganymedeApiUrl: 'https://test-api.example.com',
        ganymedeFQDN: 'ganymede.example.com',
        gatewayToken: 'gateway-token-456',
      });

      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: { success: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      await clientWithoutOrgToken.request({
        method: 'GET',
        url: '/test',
      });

      const call = mockedMyfetch.mock.calls[0][0];
      expect(call.headers?.authorization).toBe('Bearer gateway-token-456');
    });

    it('should use tokenOverride when provided', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: { success: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      await client.request(
        {
          method: 'GET',
          url: '/test',
        },
        'override-token-789'
      );

      const call = mockedMyfetch.mock.calls[0][0];
      expect(call.headers?.authorization).toBe('Bearer override-token-789');
    });

    it('should not override authorization header if already provided', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: { success: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      await client.request({
        method: 'GET',
        url: '/test',
        headers: {
          authorization: 'Bearer custom-token',
        },
      });

      const call = mockedMyfetch.mock.calls[0][0];
      expect(call.headers?.authorization).toBe('Bearer custom-token');
    });
  });

  describe('URL construction', () => {
    it('should construct full URL from base URL and relative path', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: { success: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      await client.request({
        method: 'GET',
        url: '/gateway/config',
      });

      const call = mockedMyfetch.mock.calls[0][0];
      expect(call.url).toBe('https://test-api.example.com/gateway/config');
    });

    it('should always add Host header', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: { success: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      await client.request({
        method: 'GET',
        url: '/test',
      });

      const call = mockedMyfetch.mock.calls[0][0];
      expect(call.headers?.Host).toBe('ganymede.example.com');
    });
  });

  describe('setOrganizationToken', () => {
    it('should update organization token', async () => {
      client.setOrganizationToken('new-org-token');

      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: { success: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      await client.request({
        method: 'GET',
        url: '/test',
      });

      const call = mockedMyfetch.mock.calls[0][0];
      expect(call.headers?.authorization).toBe('Bearer new-org-token');
    });
  });

  describe('getBaseUrl', () => {
    it('should return the base URL', () => {
      expect(client.getBaseUrl()).toBe('https://test-api.example.com');
    });
  });

  describe('error handling', () => {
    it('should throw error when myfetch throws', async () => {
      mockedMyfetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        client.request({
          method: 'GET',
          url: '/test',
        })
      ).rejects.toThrow('Network error');
    });

    it('should handle non-Error exceptions', async () => {
      mockedMyfetch.mockRejectedValueOnce('String error');

      await expect(
        client.request({
          method: 'GET',
          url: '/test',
        })
      ).rejects.toBe('String error');
    });
  });

  describe('real-world scenarios', () => {
    it('should handle POST /gateway/config with 200 OK', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 200,
        statusText: 'OK',
        json: {
          organization_id: 'org-123',
          organization_token: 'token-456',
          gateway_id: 'gw-789',
        },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      const result = await client.request<{
        organization_id: string;
        organization_token: string;
        gateway_id: string;
      }>({
        method: 'POST',
        url: '/gateway/config',
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { tmp_handshake_token: 'temp-token' },
      });

      expect(result).toEqual({
        organization_id: 'org-123',
        organization_token: 'token-456',
        gateway_id: 'gw-789',
      });
    });

    it('should handle POST /gateway/ready with 204 No Content', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 204,
        statusText: 'No Content',
        json: null,
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      const result = await client.request({
        method: 'POST',
        url: '/gateway/ready',
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { gateway_id: 'gw-123' },
      });

      expect(result).toBeNull();
    });

    it('should handle POST with 201 Created', async () => {
      const mockResponse: TMyfetchResponse = {
        statusCode: 201,
        statusText: 'Created',
        json: { id: 'new-resource-123', created: true },
      };

      mockedMyfetch.mockResolvedValueOnce(mockResponse);

      const result = await client.request({
        method: 'POST',
        url: '/resources',
        jsonBody: { name: 'New Resource' },
      });

      expect(result).toEqual({ id: 'new-resource-123', created: true });
    });
  });
});
