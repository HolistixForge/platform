/**
 * Tests for FrontendDispatcher - ensures project_id is properly included in events
 */

import { FrontendDispatcher } from './dispatchers';
import type { ApiFetch } from '@holistix-forge/api-fetch';
import type { TBaseEvent } from '..';

/** Helper to extract jsonBody from a mock call as a record with string keys */
function getJsonBody(
  call: Parameters<ApiFetch['fetch']>
): Record<string, unknown> {
  return call[0].jsonBody as Record<string, unknown>;
}

describe('FrontendDispatcher', () => {
  let dispatcher: FrontendDispatcher<TBaseEvent>;
  let mockApiFetch: jest.Mocked<ApiFetch>;

  beforeEach(() => {
    // Create mock ApiFetch
    mockApiFetch = {
      fetch: jest.fn().mockResolvedValue({ ok: true }),
    } as any;

    dispatcher = new FrontendDispatcher();
    dispatcher.setFetch(mockApiFetch);
  });

  describe('setProjectId', () => {
    it('should set project_id', () => {
      dispatcher.setProjectId('test-project-123');
      expect(dispatcher['_project_id']).toBe('test-project-123');
    });

    it('should allow changing project_id', () => {
      dispatcher.setProjectId('project-1');
      expect(dispatcher['_project_id']).toBe('project-1');

      dispatcher.setProjectId('project-2');
      expect(dispatcher['_project_id']).toBe('project-2');
    });
  });

  describe('dispatch without project_id set', () => {
    it('should not dispatch if project_id not set', async () => {
      const event = { type: 'test:event', data: 'test' };

      await dispatcher.dispatch(event);

      // Should not call fetch without project_id
      expect(mockApiFetch.fetch).not.toHaveBeenCalled();
    });
  });

  describe('dispatch with project_id set', () => {
    beforeEach(() => {
      dispatcher.setProjectId('test-project-456');
    });

    it('should call ApiFetch with correct parameters', async () => {
      const event = { type: 'test:event', data: 'test' };

      await dispatcher.dispatch(event);

      expect(mockApiFetch.fetch).toHaveBeenCalledWith({
        url: 'collab/event',
        method: 'POST',
        jsonBody: {
          event,
          project_id: 'test-project-456',
        },
      });
    });

    it('should include project_id for all event types', async () => {
      const events = [
        { type: 'tabs:add-tab', name: 'New Tab' },
        { type: 'whiteboard:create-node', id: 'node-1' },
        { type: 'core:delete-node', id: 'node-2' },
      ];

      for (const event of events) {
        mockApiFetch.fetch.mockClear();
        await dispatcher.dispatch(event);

        expect(mockApiFetch.fetch).toHaveBeenCalledWith({
          url: 'collab/event',
          method: 'POST',
          jsonBody: {
            event,
            project_id: 'test-project-456',
          },
        });
      }
    });

    it('should maintain project_id across multiple dispatches', async () => {
      await dispatcher.dispatch({ type: 'test:event-1' });
      await dispatcher.dispatch({ type: 'test:event-2' });
      await dispatcher.dispatch({ type: 'test:event-3' });

      expect(mockApiFetch.fetch).toHaveBeenCalledTimes(3);

      mockApiFetch.fetch.mock.calls.forEach((call) => {
        expect(getJsonBody(call).project_id).toBe('test-project-456');
      });
    });

    it('should use updated project_id after setProjectId call', async () => {
      await dispatcher.dispatch({ type: 'test:event-1' });

      expect(getJsonBody(mockApiFetch.fetch.mock.calls[0]).project_id).toBe(
        'test-project-456'
      );

      // Change project
      dispatcher.setProjectId('different-project-789');
      mockApiFetch.fetch.mockClear();

      await dispatcher.dispatch({ type: 'test:event-2' });

      expect(getJsonBody(mockApiFetch.fetch.mock.calls[0]).project_id).toBe(
        'different-project-789'
      );
    });
  });

  describe('request formatting', () => {
    beforeEach(() => {
      dispatcher.setProjectId('format-test-project');
    });

    it('should use correct URL and method', async () => {
      await dispatcher.dispatch({ type: 'test:event' });

      expect(mockApiFetch.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'collab/event',
          method: 'POST',
        })
      );
    });

    it('should properly serialize complex event data', async () => {
      const complexEvent = {
        type: 'test:complex',
        nested: { deep: { data: 'value' } },
        array: [1, { key: 'val' }, 3],
        boolean: true,
      };

      await dispatcher.dispatch(complexEvent);

      expect(mockApiFetch.fetch).toHaveBeenCalledWith({
        url: 'collab/event',
        method: 'POST',
        jsonBody: {
          event: complexEvent,
          project_id: 'format-test-project',
        },
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      dispatcher.setProjectId('error-test-project');
    });

    it('should propagate network errors', async () => {
      mockApiFetch.fetch.mockRejectedValue(new Error('Network error'));

      await expect(dispatcher.dispatch({ type: 'test:event' })).rejects.toThrow(
        'Network error'
      );
    });

    it('should not dispatch if fetch not set', async () => {
      const newDispatcher = new FrontendDispatcher();
      newDispatcher.setProjectId('test');

      // Should not throw, just not call fetch
      await newDispatcher.dispatch({ type: 'test:event' });

      expect(mockApiFetch.fetch).not.toHaveBeenCalled();
    });
  });

  describe('project switching scenarios', () => {
    it('should handle rapid project switches', async () => {
      const projects = ['project-1', 'project-2', 'project-3'];

      for (const project_id of projects) {
        dispatcher.setProjectId(project_id);
        await dispatcher.dispatch({ type: 'test:event', id: project_id });
      }

      expect(mockApiFetch.fetch).toHaveBeenCalledTimes(3);

      mockApiFetch.fetch.mock.calls.forEach((call, i) => {
        expect(getJsonBody(call).project_id).toBe(projects[i]);
      });
    });

    it('should handle project switch mid-dispatch', async () => {
      dispatcher.setProjectId('project-1');
      const promise1 = dispatcher.dispatch({ type: 'test:event-1' });

      dispatcher.setProjectId('project-2');
      const promise2 = dispatcher.dispatch({ type: 'test:event-2' });

      await Promise.all([promise1, promise2]);

      expect(getJsonBody(mockApiFetch.fetch.mock.calls[0]).project_id).toBe(
        'project-1'
      );
      expect(getJsonBody(mockApiFetch.fetch.mock.calls[1]).project_id).toBe(
        'project-2'
      );
    });
  });

  describe('integration with ProjectDispatcherSync', () => {
    it('should work when setProjectId is called once at mount', async () => {
      dispatcher.setProjectId('mounted-project-123');

      await dispatcher.dispatch({ type: 'tabs:add-tab', name: 'Tab 1' });
      await dispatcher.dispatch({ type: 'tabs:add-tab', name: 'Tab 2' });
      await dispatcher.dispatch({
        type: 'whiteboard:create-node',
        id: 'node-1',
      });

      expect(mockApiFetch.fetch).toHaveBeenCalledTimes(3);

      mockApiFetch.fetch.mock.calls.forEach((call) => {
        expect(getJsonBody(call).project_id).toBe('mounted-project-123');
      });
    });

    it('should update when project changes', async () => {
      dispatcher.setProjectId('project-1');
      await dispatcher.dispatch({ type: 'test:event-1' });

      dispatcher.setProjectId('project-2');
      await dispatcher.dispatch({ type: 'test:event-2' });

      expect(getJsonBody(mockApiFetch.fetch.mock.calls[0]).project_id).toBe(
        'project-1'
      );
      expect(getJsonBody(mockApiFetch.fetch.mock.calls[1]).project_id).toBe(
        'project-2'
      );
    });
  });

  describe('concurrent dispatches', () => {
    beforeEach(() => {
      dispatcher.setProjectId('concurrent-test-project');
    });

    it('should handle multiple concurrent dispatches', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(dispatcher.dispatch({ type: 'test:event', index: i }));
      }

      await Promise.all(promises);

      expect(mockApiFetch.fetch).toHaveBeenCalledTimes(10);

      mockApiFetch.fetch.mock.calls.forEach((call) => {
        expect(getJsonBody(call).project_id).toBe('concurrent-test-project');
      });
    });
  });
});
