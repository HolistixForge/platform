package auth

import (
	"fmt"
	"io"
)

// maxResponseBytes caps how much of an HTTP response body the guard will hold
// in memory.
//
// Every response read here is a small JSON envelope — a token pair, a
// permission verdict, a public key — so 1 MiB is far above anything legitimate
// while keeping a malformed or hostile peer from exhausting the container's
// memory with an unbounded body. The peers are on the internal network, so this
// is a backstop rather than a defence against a likely attacker.
const maxResponseBytes = 1 << 20 // 1 MiB

// readResponseBody reads an HTTP response body, refusing bodies larger than
// maxResponseBytes.
//
// It reads one byte past the limit so that an oversized body is reported as
// such, rather than silently truncated into a JSON parse error further down.
func readResponseBody(body io.Reader) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(body, maxResponseBytes+1))
	if err != nil {
		return nil, err
	}
	if len(b) > maxResponseBytes {
		return nil, fmt.Errorf("response body exceeds %d bytes", maxResponseBytes)
	}
	return b, nil
}
