#!/usr/bin/env bash
set -euo pipefail

image=${1:?Specify the Docker image to check}
network=$(node --input-type=module <<'JS'
import { loadConfig } from './src/config.js';

const { databaseUrl } = loadConfig();
const url = URL.parse(databaseUrl);
if (!url?.hostname || !['postgresql:', 'postgres:'].includes(url.protocol)) {
  throw new Error('DATABASE_URL must be a PostgreSQL URL with a hostname');
}

const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
console.log(loopback ? 'host' : (process.env.DOCKER_NETWORK || 'infrastructure'));
JS
)

echo "Starting runtime container with Docker network: $network"
container=$(docker run --detach --rm --network "$network" \
  --env DATABASE_URL --env API_TOKEN --env MOODLE_LOGIN --env MOODLE_FULL_NAME \
  --env HOST --env PORT "$image")

trap 'docker stop "$container" >/dev/null || true' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker exec -i "$container" node --input-type=module < .github/scripts/probe-runtime.mjs
