BINARY=auth-guard
GOFLAGS=-trimpath -ldflags="-s -w"
GO=/usr/local/go/bin/go

.PHONY: build-linux-amd64 build-linux-arm64 build-all test clean

build-linux-amd64:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 $(GO) build $(GOFLAGS) -o $(BINARY)-linux-amd64 .

build-linux-arm64:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(GO) build $(GOFLAGS) -o $(BINARY)-linux-arm64 .

build-all: build-linux-amd64 build-linux-arm64

test:
	$(GO) test ./... -v -race

clean:
	rm -f $(BINARY)-linux-*
