import { createHash } from 'node:crypto';
import { createPkcePair, createState } from './pkce';

describe('PKCE', () => {
  it('should derive the challenge from the verifier with S256', () => {
    // Act
    const { verifier, challenge, method } = createPkcePair();

    // Assert - the server re-derives exactly this; if the two disagree the
    // exchange is refused and enrolment cannot complete
    expect(method).toBe('S256');
    expect(challenge).toBe(
      createHash('sha256').update(verifier).digest('base64url')
    );
  });

  it('should produce a verifier RFC 7636 accepts', () => {
    // Act
    const { verifier } = createPkcePair();

    // Assert - 43 to 128 characters of unreserved ASCII; Ganymede's library
    // rejects anything else before the flow starts
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
  });

  it('should produce a challenge RFC 7636 accepts', () => {
    // Act
    const { challenge } = createPkcePair();

    // Assert
    expect(challenge).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
  });

  it('should never repeat a verifier', () => {
    // Act - a verifier reused across attempts would let a code captured from
    // an earlier one be exchanged
    const verifiers = new Set(
      Array.from({ length: 100 }, () => createPkcePair().verifier)
    );

    // Assert
    expect(verifiers.size).toBe(100);
  });

  it('should never repeat a state', () => {
    // Act
    const states = new Set(Array.from({ length: 100 }, () => createState()));

    // Assert
    expect(states.size).toBe(100);
  });
});
