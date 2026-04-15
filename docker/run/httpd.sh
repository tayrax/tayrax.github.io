#!/bin/sh
set -eu
rm -rf dist
export TAYRAX_CDN=http://localhost:1980/
make dist
echo 'http://localhost:1980/'
exec python3 -m http.server -d ./dist -b 0.0.0.0 1980
