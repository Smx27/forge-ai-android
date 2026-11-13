# Bundled Linux runtime

`android/app/src/main/jniLibs/*/` holds unmodified binaries from the Termux package repository (packages.termux.dev). They run as separate processes and are not linked into the app. Refresh them with `scripts/fetch-proot.sh`.

| File | Package | License | Source |
| --- | --- | --- | --- |
| libproot.so, libproot-loader.so | proot | GPL-2.0 | https://github.com/termux/proot |
| libtalloc.so | libtalloc | LGPL-3.0 | https://talloc.samba.org |
| libandroid-shmem.so | libandroid-shmem | BSD-3-Clause | https://github.com/termux/libandroid-shmem |
