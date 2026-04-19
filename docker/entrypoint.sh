#!/bin/sh
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  npx prisma db push --skip-generate
fi

exec node index.js
