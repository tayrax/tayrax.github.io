#!/bin/sh
set -eux
npm run build
exec npx vite --host 0.0.0.0 --port 1980 --logLevel info
