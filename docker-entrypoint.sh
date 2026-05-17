#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
# Render runtime config from environment variables.
envsubst < /usr/share/nginx/html/env.js.template > /usr/share/nginx/html/env.js

# Inject upstreams into nginx config (defaults: cluster-internal DNS).
GATEWAY_UPSTREAM="${GATEWAY_UPSTREAM:-studio-gateway:8080}"
DNS_RESOLVER="${DNS_RESOLVER:-$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)}"
DNS_RESOLVER="${DNS_RESOLVER:-127.0.0.11}"
sed -i "s|__DNS_RESOLVER__|${DNS_RESOLVER}|g" /etc/nginx/conf.d/default.conf
sed -i "s|__GATEWAY_UPSTREAM__|${GATEWAY_UPSTREAM}|g" /etc/nginx/conf.d/default.conf
