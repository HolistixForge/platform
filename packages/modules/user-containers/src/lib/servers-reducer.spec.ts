/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Servers Reducer Tests
 *
 * Tests for user-containers servers-reducer.ts
 * Specifically tests the buildRedirectUris function that constructs
 * OAuth redirect URIs from paths and container FQDNs
 */

import { UserContainersReducer } from './servers-reducer';
import { ContainerImageRegistry } from './image-registry';

// Mock dependencies
jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
    Debug: 'debug',
  },
  log: jest.fn(),
  error: jest.fn(),
  NotFoundException: class NotFoundException extends Error {},
  ForbiddenException: class ForbiddenException extends Error {},
}));

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => 'test-uuid-123'),
}));

describe('UserContainersReducer - buildRedirectUris', () => {
  let userContainersReducer: UserContainersReducer;
  let mockDepsExports: any;

  beforeEach(() => {
    // Create minimal mock dependencies
    mockDepsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': new Map(),
              'user-containers:oauth-clients': [],
            },
          })),
        },
      },
      gateway: {
        dnsManager: {
          registerRecord: jest.fn(),
          deregisterRecord: jest.fn(),
        },
        permissionRegistry: {
          getPermissions: jest.fn(() => ({})),
        },
        protectedServiceRegistry: {
          registerService: jest.fn(),
        },
      },
    };

    userContainersReducer = new UserContainersReducer(mockDepsExports as any);
  });

  describe('buildRedirectUris - Basic Functionality', () => {
    it('should construct redirect URI from single path', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback',
      ]);
    });

    it('should construct redirect URIs from multiple paths', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback', '/auth/complete', '/oauth/redirect'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback',
        'https://uc-abc123.org-def456.domain.local/auth/complete',
        'https://uc-abc123.org-def456.domain.local/oauth/redirect',
      ]);
    });

    it('should always use https protocol', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/callback'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result[0].startsWith('https://')).toBe(true);
    });

    it('should preserve path structure', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/api/v1/oauth/callback'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/api/v1/oauth/callback',
      ]);
    });
  });

  describe('buildRedirectUris - Path Normalization', () => {
    it('should add leading slash to path without it', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['oauth/callback'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback',
      ]);
    });

    it('should not double-slash paths that already have leading slash', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result[0]).not.toContain('//oauth');
      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback',
      ]);
    });

    it('should handle mixed paths (some with slash, some without)', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback', 'auth/complete', '/oauth/redirect'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback',
        'https://uc-abc123.org-def456.domain.local/auth/complete',
        'https://uc-abc123.org-def456.domain.local/oauth/redirect',
      ]);
    });

    it('should handle root path', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual(['https://uc-abc123.org-def456.domain.local/']);
    });

    it('should handle paths with query parameters', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback?state=123'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback?state=123',
      ]);
    });
  });

  describe('buildRedirectUris - Empty/Invalid Path Filtering', () => {
    it('should filter out empty strings', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback', '', '/auth/complete'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback',
        'https://uc-abc123.org-def456.domain.local/auth/complete',
      ]);
      expect(result).toHaveLength(2);
    });

    it('should filter out whitespace-only strings', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback', '   ', '/auth/complete', '\t\n'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback',
        'https://uc-abc123.org-def456.domain.local/auth/complete',
      ]);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when all paths are empty/whitespace', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['', '   ', '\t\n'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when given empty array', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        [],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([]);
    });
  });

  describe('buildRedirectUris - Different Container FQDNs', () => {
    it('should work with JupyterLab container FQDN', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth_callback'],
        'uc-jupyter123.org-550e8400-e29b-41d4-a716-446655440000.domain.local'
      );

      expect(result).toEqual([
        'https://uc-jupyter123.org-550e8400-e29b-41d4-a716-446655440000.domain.local/oauth_callback',
      ]);
    });

    it('should work with pgAdmin container FQDN', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback'],
        'uc-pgadmin456.org-123e4567-e89b-12d3-a456-426614174000.domain.local'
      );

      expect(result).toEqual([
        'https://uc-pgadmin456.org-123e4567-e89b-12d3-a456-426614174000.domain.local/oauth/callback',
      ]);
    });

    it('should work with n8n container FQDN', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback'],
        'uc-n8n789.org-abcdef01-2345-6789-abcd-ef0123456789.domain.local'
      );

      expect(result).toEqual([
        'https://uc-n8n789.org-abcdef01-2345-6789-abcd-ef0123456789.domain.local/oauth/callback',
      ]);
    });

    it('should work with custom domain', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/callback'],
        'uc-abc123.org-def456.example.com'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.example.com/callback',
      ]);
    });
  });

  describe('buildRedirectUris - Real-World Scenarios', () => {
    it('should handle JupyterLab typical redirect paths', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth_callback', '/hub/oauth_callback'],
        'uc-jupyter.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-jupyter.org-def456.domain.local/oauth_callback',
        'https://uc-jupyter.org-def456.domain.local/hub/oauth_callback',
      ]);
    });

    it('should handle multiple callback endpoints for same service', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback', '/auth/complete', '/api/oauth/redirect'],
        'uc-service.org-def456.domain.local'
      );

      expect(result).toHaveLength(3);
      expect(result).toEqual([
        'https://uc-service.org-def456.domain.local/oauth/callback',
        'https://uc-service.org-def456.domain.local/auth/complete',
        'https://uc-service.org-def456.domain.local/api/oauth/redirect',
      ]);
    });

    it('should handle paths with special characters', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth-callback', '/auth_complete', '/redirect.html'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth-callback',
        'https://uc-abc123.org-def456.domain.local/auth_complete',
        'https://uc-abc123.org-def456.domain.local/redirect.html',
      ]);
    });
  });

  describe('buildRedirectUris - Edge Cases', () => {
    it('should handle very long paths', () => {
      const longPath =
        '/api/v1/oauth/callback/with/very/long/path/structure/for/testing';
      const result = (userContainersReducer as any).buildRedirectUris(
        [longPath],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        `https://uc-abc123.org-def456.domain.local${longPath}`,
      ]);
    });

    it('should handle paths with dots', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback.php', '/auth.html'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback.php',
        'https://uc-abc123.org-def456.domain.local/auth.html',
      ]);
    });

    it('should handle paths with hyphens and underscores', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth-callback', '/auth_complete', '/my-oauth_endpoint'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toHaveLength(3);
      result.forEach((uri: string) => {
        expect(uri.startsWith('https://')).toBe(true);
      });
    });

    it('should handle paths with fragment identifiers', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback#success'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback#success',
      ]);
    });

    it('should handle mixed case in paths (preserve case)', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/OAuth/CallBack', '/AUTH/complete'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/OAuth/CallBack',
        'https://uc-abc123.org-def456.domain.local/AUTH/complete',
      ]);
    });
  });

  describe('buildRedirectUris - Security Considerations', () => {
    it('should NOT validate domain format (handled elsewhere)', () => {
      // buildRedirectUris just constructs URIs, validation happens in OAuth routes
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/callback'],
        'potentially-invalid-domain'
      );

      expect(result).toEqual(['https://potentially-invalid-domain/callback']);
    });

    it('should preserve URL encoding in paths', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['/oauth/callback?redirect=%2Fdashboard'],
        'uc-abc123.org-def456.domain.local'
      );

      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local/oauth/callback?redirect=%2Fdashboard',
      ]);
    });

    it('should handle paths with multiple slashes', () => {
      const result = (userContainersReducer as any).buildRedirectUris(
        ['///oauth///callback'],
        'uc-abc123.org-def456.domain.local'
      );

      // Should preserve the extra slashes (validation happens elsewhere)
      expect(result).toEqual([
        'https://uc-abc123.org-def456.domain.local///oauth///callback',
      ]);
    });
  });
});

describe('ContainerImageRegistry - getAll', () => {
  it('should return empty array when no images registered', () => {
    const registry = new ContainerImageRegistry();
    expect(registry.getAll()).toEqual([]);
  });

  it('should return all registered images', () => {
    const registry = new ContainerImageRegistry();
    const images = [
      {
        imageId: 'ubuntu:terminal',
        imageName: 'Ubuntu Terminal',
        imageUri: 'holistixforge/ubuntu-terminal',
        imageTag: '24.04',
        description: 'Minimal Ubuntu container',
        category: 'utility',
        oauthClients: [],
      },
      {
        imageId: 'jupyter:lab',
        imageName: 'JupyterLab',
        imageUri: 'holistixforge/jupyterlab',
        imageTag: 'latest',
        description: 'JupyterLab notebook',
        category: 'data-science',
        oauthClients: [],
      },
    ];
    registry.register(images);

    const result = registry.getAll();
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(images));
  });
});

describe('UserContainersReducer - _initProject', () => {
  let reducer: UserContainersReducer;
  let mockImagesMap: Map<string, any>;
  let mockImageRegistry: ContainerImageRegistry;
  let mockDepsExports: any;

  beforeEach(() => {
    mockImagesMap = new Map();
    mockImageRegistry = new ContainerImageRegistry();
    mockImageRegistry.register([
      {
        imageId: 'ubuntu:terminal',
        imageName: 'Ubuntu Terminal',
        imageUri: 'holistixforge/ubuntu-terminal',
        imageTag: '24.04',
        description: 'Minimal Ubuntu container',
        category: 'utility',
        oauthClients: [],
      },
    ]);

    // Create a mock SharedMap with copy() method
    const imagesSharedMap = {
      get: (key: string) => mockImagesMap.get(key),
      set: (key: string, value: any) => mockImagesMap.set(key, value),
      copy: () => new Map(mockImagesMap),
    };

    mockDepsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: {
              'user-containers:containers': new Map(),
              'user-containers:images': imagesSharedMap,
            },
          })),
        },
      },
      gateway: {
        permissionRegistry: {
          getPermissions: jest.fn(() => ({})),
        },
        protectedServiceRegistry: {
          registerService: jest.fn(),
        },
      },
      'user-containers': {
        imageRegistry: mockImageRegistry,
      },
    };

    reducer = new UserContainersReducer(mockDepsExports as any);
  });

  it('should sync images from registry to shared map on project:init', async () => {
    const event = {
      type: 'project:init' as const,
      project_id: 'test-project-123',
      systemEvent: true as const,
    };

    const requestData = { project_id: 'test-project-123' } as any;

    await reducer.reduce(event, requestData);

    expect(mockImagesMap.size).toBe(1);
    expect(mockImagesMap.get('ubuntu:terminal')).toEqual({
      imageId: 'ubuntu:terminal',
      imageName: 'Ubuntu Terminal',
      description: 'Minimal Ubuntu container',
    });
  });

  it('should be idempotent - skip images already in shared map', async () => {
    // Pre-populate the shared map
    mockImagesMap.set('ubuntu:terminal', {
      imageId: 'ubuntu:terminal',
      imageName: 'Ubuntu Terminal',
      description: 'Minimal Ubuntu container',
    });

    const event = {
      type: 'project:init' as const,
      project_id: 'test-project-123',
      systemEvent: true as const,
    };

    const requestData = { project_id: 'test-project-123' } as any;

    await reducer.reduce(event, requestData);

    // Should still have exactly 1 entry (not duplicated)
    expect(mockImagesMap.size).toBe(1);
  });

  it('should sync multiple images', async () => {
    // Register a second image
    mockImageRegistry.register([
      {
        imageId: 'jupyter:lab',
        imageName: 'JupyterLab',
        imageUri: 'holistixforge/jupyterlab',
        imageTag: 'latest',
        description: 'JupyterLab notebook',
        category: 'data-science',
        oauthClients: [],
      },
    ]);

    const event = {
      type: 'project:init' as const,
      project_id: 'test-project-123',
      systemEvent: true as const,
    };

    const requestData = { project_id: 'test-project-123' } as any;

    await reducer.reduce(event, requestData);

    expect(mockImagesMap.size).toBe(2);
    expect(mockImagesMap.has('ubuntu:terminal')).toBe(true);
    expect(mockImagesMap.has('jupyter:lab')).toBe(true);
  });
});
