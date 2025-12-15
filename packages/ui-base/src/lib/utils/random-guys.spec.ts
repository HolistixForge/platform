import { randomPP, randomGuys, randomGuy } from './random-guys';
import { TF_User } from '@holistix-forge/types';

/**
 * TESTING UTILITY FUNCTIONS - random-guys.spec.ts
 *
 * This test suite demonstrates:
 * - Testing utility functions that generate mock data
 * - Testing functions with randomness (URL generation, random selection)
 * - Validating data structures against TypeScript types
 * - Testing array data and object properties
 */

// Mock dependencies - use actual makeUuid for unique IDs
// We only mock randomColor to make color testing predictable
jest.mock('../css-utils/css-utils', () => ({
  randomColor: jest.fn(() => '#FF5733'),
}));

describe('random-guys utilities', () => {
  describe('randomPP', () => {
    it('should return a valid pravatar URL', () => {
      const url = randomPP();

      expect(url).toMatch(/^https:\/\/i\.pravatar\.cc\/\d+$/);
    });

    it('should return URLs with different numbers', () => {
      // Generate multiple URLs to check for variation
      const urls = new Set<string>();
      for (let i = 0; i < 20; i++) {
        urls.add(randomPP());
      }

      // With random numbers, we should get at least some unique URLs
      // (not guaranteed but very likely with 20 attempts)
      expect(urls.size).toBeGreaterThan(1);
    });

    it('should generate URLs with numbers in valid range', () => {
      const url = randomPP();
      const match = url.match(/https:\/\/i\.pravatar\.cc\/(\d+)/);

      expect(match).not.toBeNull();

      if (match) {
        const number = parseInt(match[1], 10);
        expect(number).toBeGreaterThanOrEqual(0);
        expect(number).toBeLessThanOrEqual(10000);
      }
    });
  });

  describe('randomGuys', () => {
    it('should be an array of 10 users', () => {
      expect(Array.isArray(randomGuys)).toBe(true);
      expect(randomGuys).toHaveLength(10);
    });

    it('should have all required TF_User properties', () => {
      randomGuys.forEach((user, index) => {
        expect(user).toHaveProperty('user_id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('firstname');
        expect(user).toHaveProperty('lastname');
        expect(user).toHaveProperty('picture');
        expect(user).toHaveProperty('live');
        expect(user).toHaveProperty('color');
      });
    });

    it('should have valid user_id for each user', () => {
      randomGuys.forEach((user) => {
        expect(typeof user.user_id).toBe('string');
        expect(user.user_id.length).toBeGreaterThan(0);
      });
    });

    it('should have valid username with github prefix', () => {
      randomGuys.forEach((user) => {
        expect(typeof user.username).toBe('string');
        expect(user.username).toMatch(/^github:/);
      });
    });

    it('should have valid first and last names', () => {
      randomGuys.forEach((user) => {
        expect(typeof user.firstname).toBe('string');
        expect(user.firstname?.length).toBeGreaterThan(0);

        expect(typeof user.lastname).toBe('string');
        expect(user.lastname?.length).toBeGreaterThan(0);
      });
    });

    it('should have picture as string or null', () => {
      randomGuys.forEach((user) => {
        if (user.picture !== null) {
          expect(typeof user.picture).toBe('string');
          expect(user.picture).toMatch(/^https:\/\//);
        }
      });
    });

    it('should have at least one user with null picture', () => {
      const usersWithNullPicture = randomGuys.filter(
        (user) => user.picture === null
      );
      expect(usersWithNullPicture.length).toBeGreaterThan(0);
    });

    it('should have live set to false for all users', () => {
      randomGuys.forEach((user) => {
        expect(user.live).toBe(false);
      });
    });

    it('should have valid color strings', () => {
      randomGuys.forEach((user) => {
        expect(typeof user.color).toBe('string');
        expect(user.color?.length).toBeGreaterThan(0);
      });
    });

    it('should have unique user_ids', () => {
      const userIds = randomGuys.map((user) => user.user_id);
      const uniqueIds = new Set(userIds);

      expect(uniqueIds.size).toBe(randomGuys.length);
    });

    it('should have unique usernames', () => {
      const usernames = randomGuys.map((user) => user.username);
      const uniqueUsernames = new Set(usernames);

      expect(uniqueUsernames.size).toBe(randomGuys.length);
    });

    it('should contain expected users', () => {
      // Verify some specific users exist
      const usernames = randomGuys.map((user) => user.username);

      expect(usernames).toContain('github:duconLajoie42');
      expect(usernames).toContain('github:codeMaster99');
      expect(usernames).toContain('github:techGuru88');
    });

    it('should match specific user data', () => {
      // Find Ducon Lajoie
      const ducon = randomGuys.find(
        (u) => u.username === 'github:duconLajoie42'
      );

      expect(ducon).toBeDefined();
      if (ducon) {
        expect(ducon.firstname).toBe('Ducon');
        expect(ducon.lastname).toBe('Lajoie');
        expect(ducon.live).toBe(false);
      }
    });
  });

  describe('randomGuy', () => {
    it('should return a TF_User object', () => {
      const user = randomGuy();

      expect(user).toBeDefined();
      expect(typeof user).toBe('object');
      expect(user).toHaveProperty('user_id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('firstname');
      expect(user).toHaveProperty('lastname');
      expect(user).toHaveProperty('picture');
      expect(user).toHaveProperty('live');
      expect(user).toHaveProperty('color');
    });

    it('should return a user from randomGuys array', () => {
      const user = randomGuy();

      // Check if the returned user matches one of the users in randomGuys
      const matchingUser = randomGuys.find((u) => u.username === user.username);

      expect(matchingUser).toBeDefined();
    });

    it('should return a copy, not the original object', () => {
      const user = randomGuy();
      const originalUser = randomGuys.find((u) => u.username === user.username);

      expect(originalUser).toBeDefined();
      if (originalUser) {
        // Modify the returned user
        user.firstname = 'Modified Name';

        // Original should remain unchanged
        expect(originalUser.firstname).not.toBe('Modified Name');
      }
    });

    it('should potentially return different users on multiple calls', () => {
      // Generate multiple users
      const users = new Set<string>();
      for (let i = 0; i < 30; i++) {
        const user = randomGuy();
        users.add(user.username);
      }

      // With 30 attempts from 10 users, we should get at least 2 different ones
      // (statistically extremely likely)
      expect(users.size).toBeGreaterThan(1);
    });

    it('should always return valid user data', () => {
      // Test multiple calls to ensure consistency
      for (let i = 0; i < 20; i++) {
        const user = randomGuy();

        expect(typeof user.user_id).toBe('string');
        expect(user.user_id.length).toBeGreaterThan(0);

        expect(typeof user.username).toBe('string');
        expect(user.username).toMatch(/^github:/);

        expect(typeof user.firstname).toBe('string');
        expect(user.firstname?.length).toBeGreaterThan(0);

        expect(typeof user.lastname).toBe('string');
        expect(user.lastname?.length).toBeGreaterThan(0);

        expect(user.live).toBe(false);

        expect(typeof user.color).toBe('string');
      }
    });

    it('should return users with all possible values over many iterations', () => {
      // Track which users we get
      const usernamesSeen = new Set<string>();

      // Sample 100 times to ensure we get good coverage
      for (let i = 0; i < 100; i++) {
        const user = randomGuy();
        usernamesSeen.add(user.username);
      }

      // We should see most users with 100 samples from 10 users
      expect(usernamesSeen.size).toBeGreaterThanOrEqual(7);
    });
  });

  describe('Integration tests', () => {
    it('should work together to provide consistent mock data', () => {
      // Get a random guy
      const guy = randomGuy();

      // Verify it's from the randomGuys array
      const found = randomGuys.some((u) => u.username === guy.username);
      expect(found).toBe(true);

      // Verify structure matches TF_User type
      const requiredKeys: (keyof TF_User)[] = [
        'user_id',
        'username',
        'firstname',
        'lastname',
        'picture',
        'live',
        'color',
      ];

      requiredKeys.forEach((key) => {
        expect(guy).toHaveProperty(key);
      });
    });

    it('should provide useful mock data for testing', () => {
      // This test demonstrates practical use
      const testUsers: TF_User[] = [];

      // Get 5 random users for a test scenario
      for (let i = 0; i < 5; i++) {
        testUsers.push(randomGuy());
      }

      // All should be valid
      expect(testUsers).toHaveLength(5);
      testUsers.forEach((user) => {
        expect(user.username).toMatch(/^github:/);
        expect(user.live).toBe(false);
      });
    });
  });
});
