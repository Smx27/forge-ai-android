#!/usr/bin/env bash
# Creates the Play Store upload key and android/keystore.properties.
# Run once on your own computer. Back up the .jks file and the passwords somewhere safe:
# Play App Signing can reset a lost upload key, but only after a support request.
set -euo pipefail
cd "$(dirname "$0")/.."
KEYSTORE="${1:-$HOME/.forge/forge-upload.jks}"
ALIAS="forge-upload"
if [ -e "$KEYSTORE" ]; then echo "$KEYSTORE already exists. Refusing to overwrite it." >&2; exit 1; fi
mkdir -p "$(dirname "$KEYSTORE")"
read -rsp "Keystore password (12+ characters): " STORE_PASS; echo
read -rsp "Repeat password: " STORE_PASS2; echo
[ "$STORE_PASS" = "$STORE_PASS2" ] || { echo "Passwords do not match." >&2; exit 1; }
[ ${#STORE_PASS} -ge 12 ] || { echo "Use at least 12 characters." >&2; exit 1; }
keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$STORE_PASS" -keypass "$STORE_PASS" -dname "CN=Forge, O=Forge, C=US"
umask 077
cat > android/keystore.properties <<EOF
storeFile=$KEYSTORE
storePassword=$STORE_PASS
keyAlias=$ALIAS
keyPassword=$STORE_PASS
EOF
chmod 600 android/keystore.properties "$KEYSTORE"
echo "Upload key created at $KEYSTORE"
echo "android/keystore.properties is git-ignored and excluded from source zips. Never commit either file."
