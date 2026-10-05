#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 22.13 veya ustunu kurun: https://nodejs.org/"
  exit 1
fi
if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  echo "Ilk kurulum gerekli: Bu klasorde terminalden npm ci calistirin."
  echo "Kurulum sonrasi internet olmadan temel sentetik demo localhost'ta acilabilir."
  exit 1
fi
npm run demo:local
