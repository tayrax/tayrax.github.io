#!/bin/sh
set -eu
export TAYRAX_CDN=http://localhost:1980/
set -x
npm run build
exec npx vite --host 0.0.0.0 --port 1980
