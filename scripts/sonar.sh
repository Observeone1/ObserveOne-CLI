#!/usr/bin/env bash
# Runs a SonarQube scan against $SONAR_HOST_URL using $SONAR_TOKEN.
# Locally: export SONAR_HOST_URL / SONAR_TOKEN yourself, or `source ../../tools/sonarqube/.env`
# from the workspace root first. In CI these come from repo secrets.
set -euo pipefail

: "${SONAR_HOST_URL:?SONAR_HOST_URL is not set}"
if [[ -z "${SONAR_TOKEN:-}" && -n "${SONAR_ANALYSIS_TOKEN:-}" ]]; then
  SONAR_TOKEN="$SONAR_ANALYSIS_TOKEN"
fi
: "${SONAR_TOKEN:?SONAR_TOKEN (or SONAR_ANALYSIS_TOKEN) is not set}"

docker volume create observeone-cli-sonar-cache >/dev/null
docker run --rm --network host \
  -v "$PWD":/usr/src \
  -v observeone-cli-sonar-cache:/opt/sonar-scanner/.sonar/cache \
  sonarsource/sonar-scanner-cli \
  -Dsonar.scanner.skipJreProvisioning=true \
  -Dsonar.scanner.skipSystemTruststore=true \
  -Dsonar.host.url="$SONAR_HOST_URL" \
  -Dsonar.token="$SONAR_TOKEN" \
  -Dsonar.scm.disabled=true
