# SPDX-License-Identifier: Apache-2.0

IMAGE ?= studio-ui
TAG ?= local
CONTAINER_RUNTIME ?= $(shell command -v podman >/dev/null 2>&1 && echo podman || echo docker)

.PHONY: dev build image lint typecheck clean

dev:
	npx vite

build:
	npx vite build

image:
	$(CONTAINER_RUNTIME) build -t $(IMAGE):$(TAG) .

lint:
	npx tsc --noEmit

typecheck: lint

clean:
	rm -rf dist
