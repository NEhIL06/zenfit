#!/usr/bin/env bash
# Generates local self-signed TLS certificates for local HTTPS development
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="$(cd "${SCRIPT_DIR}/../ssl" 2>/dev/null || (mkdir -p "${SCRIPT_DIR}/../ssl" && cd "${SCRIPT_DIR}/../ssl" && pwd))"

CERT_FILE="${SSL_DIR}/fullchain.pem"
KEY_FILE="${SSL_DIR}/privkey.pem"

echo "Generating local development certificates in ${SSL_DIR}..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${KEY_FILE}" \
  -out "${CERT_FILE}" \
  -subj "/C=US/ST=Dev/L=Local/O=ZenFit/OU=Engineering/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,DNS:zenfit.local,DNS:*.zenfit.local,IP:127.0.0.1"

chmod 600 "${KEY_FILE}"
chmod 644 "${CERT_FILE}"

echo "Self-signed certificate generated successfully:"
echo "  - Certificate: ${CERT_FILE}"
echo "  - Private Key: ${KEY_FILE}"
