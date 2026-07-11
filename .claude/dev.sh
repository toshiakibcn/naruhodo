#!/bin/bash
export PATH="$HOME/.local/tools/node/bin:$PATH"
cd "$(dirname "$0")/.."
exec npm run dev
