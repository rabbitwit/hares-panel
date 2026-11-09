#!/bin/bash
# Build the native fnOS package (hares-panel.fpk).
#
# Bundles the Linux Node runtime + SPA + server, then calls fnpack.
# Requires Node.js 24 and fnpack from https://developer.fnnas.com/docs/cli/fnpack/
#   FNPACK=/path/to/fnpack ./build.sh
set -eu
cd "$(dirname "$0")"

FNPACK="${FNPACK:-fnpack}"
mkdir -p wizard

node ../scripts/prepare-fnos.mjs
"$FNPACK" build
echo "built: $(pwd)/hares-panel.fpk"
