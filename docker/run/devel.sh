#!/bin/sh
set -eux
npm run build
exec npx vite preview --host 0.0.0.0 --port 5173 --logLevel info
