// Mock the initialization module BEFORE importing GatewayShutdownTimer
// This prevents Jest from trying to parse JupyterLab ES modules
jest.mock('../initialization/gateway-init', () => ({
  shutdownGateway: jest.fn(),
}));

// Mock logger
jest.mock('@holistix-forge/log', () => ({
  log: jest.fn(),
  EPriority: {
    Info: 'info',
    Notice: 'notice',
    Debug: 'debug',
    Error: 'error',
  },
}));

import { GatewayShutdownTimer } from './gateway-shutdown';
import type { ProjectRoomsManager } from '../state/ProjectRooms';

describe('GatewayShutdownTimer', () => {
  let mockProjectRooms: jest.Mocked<ProjectRoomsManager>;
  let shutdownCallback: jest.Mock;
  let timer: GatewayShutdownTimer | null;

  beforeEach(() => {
    // Use real timers for these tests (they use real setTimeout)
    jest.useRealTimers();
    
    // Mock ProjectRoomsManager
    mockProjectRooms = {
      getAllProjectIds: jest.fn().mockReturnValue([]),
    } as any;

    // Mock shutdown callback - fresh for each test
    shutdownCallback = jest.fn().mockResolvedValue(undefined);
    
    timer = null;
  });

  afterEach(async () => {
    // Disable timer to stop background checks
    if (timer) {
      timer.disable();
      timer = null;
    }
    
    // Wait a bit to let any pending callbacks complete
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('Idle Shutdown Logic', () => {
    it('should NOT shutdown if projects exist', async () => {
      // Arrange: Projects exist
      mockProjectRooms.getAllProjectIds.mockReturnValue(['project-1', 'project-2']);

      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 1000, // 1 second
        checkIntervalMs: 999999, // Very long interval to prevent automatic checks
        onShutdown: shutdownCallback,
      });

      timer.enable(); // Must enable for checkAndShutdown() to work
      
      // Act: Wait longer than idle threshold
      await new Promise((resolve) => setTimeout(resolve, 1500));
      timer.checkAndShutdown();

      // Assert: Should NOT shutdown (projects exist)
      expect(shutdownCallback).not.toHaveBeenCalled();
    });

    it('should NOT shutdown if idle time is below threshold', async () => {
      // Arrange: No projects, but not idle long enough
      mockProjectRooms.getAllProjectIds.mockReturnValue([]);

      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 2000, // 2 seconds
        checkIntervalMs: 999999, // Very long interval to prevent automatic checks
        onShutdown: shutdownCallback,
      });

      timer.enable(); // Must enable for checkAndShutdown() to work

      // Act: Wait less than idle threshold
      await new Promise((resolve) => setTimeout(resolve, 500));
      timer.checkAndShutdown();

      // Assert: Should NOT shutdown (not idle long enough)
      expect(shutdownCallback).not.toHaveBeenCalled();
    });

    it('should shutdown if no projects and idle time exceeds threshold', async () => {
      // Arrange: No projects
      mockProjectRooms.getAllProjectIds.mockReturnValue([]);

      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 1000, // 1 second
        checkIntervalMs: 999999, // Very long interval to prevent automatic checks
        onShutdown: shutdownCallback,
      });

      timer.enable(); // Must enable for checkAndShutdown() to work

      // Act: Wait longer than idle threshold
      await new Promise((resolve) => setTimeout(resolve, 1500));
      timer.checkAndShutdown();

      // Assert: Should shutdown
      expect(shutdownCallback).toHaveBeenCalledTimes(1);
    });

    it('should reset idle timer when projects exist', async () => {
      // Arrange: Start with no projects, let timer run for 800ms
      mockProjectRooms.getAllProjectIds.mockReturnValue([]);

      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 1000, // 1 second
        checkIntervalMs: 999999, // Very long interval to prevent automatic checks
        onShutdown: shutdownCallback,
      });

      timer.enable(); // Must enable for checkAndShutdown() to work

      // Wait 800ms (getting close to shutdown threshold)
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Projects exist - this should reset the timer
      mockProjectRooms.getAllProjectIds.mockReturnValue(['project-1']);
      timer.checkAndShutdown(); // Checks and resets timer

      // Remove projects again - fresh idle period starts
      mockProjectRooms.getAllProjectIds.mockReturnValue([]);

      // Wait 900ms - still below threshold (1000ms)
      await new Promise((resolve) => setTimeout(resolve, 900));
      timer.checkAndShutdown();

      // Assert: Should NOT shutdown yet (only 900ms since reset)
      expect(shutdownCallback).not.toHaveBeenCalled();

      // Wait another 200ms (now 1100ms since reset)
      await new Promise((resolve) => setTimeout(resolve, 200));
      timer.checkAndShutdown();

      // Assert: Should shutdown now (over 1000ms threshold)
      expect(shutdownCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timer Control', () => {
    it('should start checking when enabled', () => {
      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 1000,
        checkIntervalMs: 100,
        onShutdown: shutdownCallback,
      });

      timer.enable();

      // Timer should be created
      expect(timer['checkInterval']).not.toBeNull();
    });

    it('should stop checking when disabled', () => {
      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 1000,
        checkIntervalMs: 100,
        onShutdown: shutdownCallback,
      });

      timer.enable();
      expect(timer['checkInterval']).not.toBeNull();

      timer.disable();
      expect(timer['checkInterval']).toBeNull();
    });

    it('should not check if not enabled', async () => {
      mockProjectRooms.getAllProjectIds.mockReturnValue([]);

      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 100,
        checkIntervalMs: 50,
        onShutdown: shutdownCallback,
      });

      // Don't enable timer
      await new Promise((resolve) => setTimeout(resolve, 500));
      timer.checkAndShutdown();

      // Should not shutdown (not enabled)
      expect(shutdownCallback).not.toHaveBeenCalled();
    });
  });

  describe('Automatic Periodic Checking', () => {
    it('should automatically check at specified interval', async () => {
      jest.useFakeTimers();

      mockProjectRooms.getAllProjectIds.mockReturnValue([]);

      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 1000,
        checkIntervalMs: 100,
        onShutdown: shutdownCallback,
      });

      timer.enable();

      // Fast-forward past idle threshold
      jest.advanceTimersByTime(1500);

      // Should have triggered shutdown
      await Promise.resolve(); // Flush promises
      expect(shutdownCallback).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Helper Methods (for testing)', () => {
    it('should provide idle time', async () => {
      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 5000,
        checkIntervalMs: 100,
        onShutdown: shutdownCallback,
      });

      const idleTime1 = timer.getIdleTimeMs();
      expect(idleTime1).toBeGreaterThanOrEqual(0);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const idleTime2 = timer.getIdleTimeMs();
      expect(idleTime2).toBeGreaterThan(idleTime1);
    });

    it('should allow resetting activity timer', async () => {
      timer = new GatewayShutdownTimer(mockProjectRooms, {
        idleShutdownMs: 5000,
        checkIntervalMs: 100,
        onShutdown: shutdownCallback,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      const idleTime1 = timer.getIdleTimeMs();
      expect(idleTime1).toBeGreaterThan(50);

      timer.resetActivityTimer();
      const idleTime2 = timer.getIdleTimeMs();
      expect(idleTime2).toBeLessThan(idleTime1);
    });
  });
});
