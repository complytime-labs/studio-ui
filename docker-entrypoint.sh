#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Render runtime config from environment variables.
envsubst < /usr/share/nginx/html/env.js.template > /usr/share/nginx/html/env.js

# Inject upstreams into nginx config (defaults: cluster-internal DNS).
GATEWAY_UPSTREAM="${GATEWAY_UPSTREAM:-studio-gateway:8080}"
WORKBENCH_UPSTREAM="${WORKBENCH_UPSTREAM:-studio-workbench:8090}"
sed -i "s|__GATEWAY_UPSTREAM__|${GATEWAY_UPSTREAM}|g" /etc/nginx/conf.d/default.conf
sed -i "s|__WORKBENCH_UPSTREAM__|${WORKBENCH_UPSTREAM}|g" /etc/nginx/conf.d/default.conf
