#!/bin/bash
# Build the fnOS package (hares-panel.fpk).
#
# Requires fnpack from https://developer.fnnas.com/docs/cli/fnpack/
#   FNPACK=/path/to/fnpack ./build.sh
set -eu
cd "$(dirname "$0")"

FNPACK="${FNPACK:-fnpack}"
mkdir -p wizard

"$FNPACK" build
echo "built: $(pwd)/hares-panel.fpk"
