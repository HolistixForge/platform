package auth

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"testing"
)

func TestReadResponseBodyReadsSmallBody(t *testing.T) {
	body, err := readResponseBody(strings.NewReader(`{"allowed":true}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(body) != `{"allowed":true}` {
		t.Errorf("got %q, want %q", body, `{"allowed":true}`)
	}
}

func TestReadResponseBodyReadsBodyAtTheLimit(t *testing.T) {
	// Exactly at the cap must still be accepted: the limit is a backstop, not a
	// budget legitimate responses are expected to stay under by some margin.
	body, err := readResponseBody(bytes.NewReader(make([]byte, maxResponseBytes)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(body) != maxResponseBytes {
		t.Errorf("got %d bytes, want %d", len(body), maxResponseBytes)
	}
}

func TestReadResponseBodyRejectsOversizedBody(t *testing.T) {
	_, err := readResponseBody(bytes.NewReader(make([]byte, maxResponseBytes+1)))
	if err == nil {
		t.Fatal("expected an error for an oversized body")
	}
	if !strings.Contains(err.Error(), "exceeds") {
		t.Errorf("error should name the size limit, got: %v", err)
	}
}

func TestReadResponseBodyDoesNotReadAnUnboundedBody(t *testing.T) {
	// An endless body is the case the limit exists for: without it this read
	// never returns and the guard grows until the container is killed.
	done := make(chan struct{})
	go func() {
		defer close(done)
		if _, err := readResponseBody(endlessReader{}); err == nil {
			t.Error("expected an error for an endless body")
		}
	}()
	<-done
}

func TestReadResponseBodyPropagatesReadErrors(t *testing.T) {
	want := errors.New("connection reset")
	_, err := readResponseBody(errReader{err: want})
	if !errors.Is(err, want) {
		t.Errorf("got %v, want %v", err, want)
	}
}

// endlessReader never reaches EOF.
type endlessReader struct{}

func (endlessReader) Read(p []byte) (int, error) {
	for i := range p {
		p[i] = 'x'
	}
	return len(p), nil
}

type errReader struct{ err error }

func (r errReader) Read([]byte) (int, error) { return 0, r.err }

var _ io.Reader = endlessReader{}
