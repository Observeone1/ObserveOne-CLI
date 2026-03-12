#!/bin/bash
echo "=== Build script starting ==="
echo "=== Current directory ==="
pwd
echo "=== Files in current directory ==="
ls -la
echo "=== Files in src/ ==="
ls -la src/
echo "=== TypeScript files ==="
find src/ -name "*.ts" -o -name "*.js"
echo "=== Running TypeScript compilation ==="
npx tsc
echo "=== Build script completed ==="







