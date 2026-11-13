#!/usr/bin/env bash
# Downloads the proot runtime from the Termux package repository into android/app/src/main/jniLibs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JNI="$ROOT/android/app/src/main/jniLibs"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
REPO=https://packages.termux.dev/apt/termux-main/pool/main
latest() { curl -fsSL "$REPO/$1/$2/" | grep -o "$2_[^\"]*_$3.deb" | sort -V | tail -1; }
unpack() { mkdir -p "$WORK/$2" && curl -fsSL "$REPO/$1" -o "$WORK/$2.deb" && (cd "$WORK/$2" && ar x "../$2.deb" && tar xf data.tar.xz); }
for pair in aarch64:arm64-v8a x86_64:x86_64; do
  arch="${pair%%:*}"; abi="${pair##*:}"
  unpack "p/proot/$(latest p proot "$arch")" "proot-$arch"
  unpack "libt/libtalloc/$(latest libt libtalloc "$arch")" "talloc-$arch"
  unpack "liba/libandroid-shmem/$(latest liba libandroid-shmem "$arch")" "shmem-$arch"
  P="$WORK/proot-$arch/data/data/com.termux/files/usr"
  mkdir -p "$JNI/$abi"
  cp "$P/bin/proot" "$JNI/$abi/libproot.so"
  cp "$P/libexec/proot/loader" "$JNI/$abi/libproot-loader.so"
  cp "$(readlink -f "$WORK/talloc-$arch/data/data/com.termux/files/usr/lib/libtalloc.so.2")" "$JNI/$abi/libtalloc.so"
  cp "$WORK/shmem-$arch/data/data/com.termux/files/usr/lib/libandroid-shmem.so" "$JNI/$abi/libandroid-shmem.so"
done
ls -la "$JNI"/*
