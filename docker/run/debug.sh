#!/bin/sh
set -eux
exec npx vite --host 0.0.0.0 --port 1980 --logLevel info
