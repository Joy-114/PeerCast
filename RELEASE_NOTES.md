# PeerCast 0.2.0-alpha

First public-source alpha preparation. This release documents and packages the
existing v0.2 implementation; portfolio cleanup adds no product features.

## Included

- Shared Web/Desktop Host and Viewer with manual WebRTC signaling.
- Compact PC1 Offer/Answer, raw compatibility and clipboard failure recovery.
- Configurable STUN/TURN, route diagnostics and measured media statistics.
- Quality requests up to 1080p/60 FPS, with normal WebRTC adaptation.
- Independent system/microphone controls and native Windows process-tree audio.
- Electron sandbox/preload boundary, local settings, opt-in startup and tray.
- Assisted Windows x64 installer, source build scripts and focused test harnesses.
- MIT license, contributor guidance, architecture diagrams and acceptance docs.

## Release assets

- `PeerCast-Setup-0.2.0-alpha.exe` — unsigned Windows x64 installer.
- `SHA256SUMS.txt` — checksum generated from the final local installer.

Source builds place the installer in `dist/` and the unpacked application at
`dist/win-unpacked/PeerCast.exe`. Neither binaries nor build caches are committed.
MSI, macOS/Linux installers and automatic updates are NOT IMPLEMENTED.

## Verification

Base checks, browser WebRTC regression, native audio isolation and desktop
integration have local PASS evidence described in [Testing](docs/TESTING.md).
Fresh-clone and alpha packaging results are recorded in the local delivery report.
GitHub CI is not claimed as passed until its workflow actually runs.

**NEEDS MANUAL TEST:** CS2/Discord exclusion on a separate Viewer, actual
cross-network media and TURN, sustained 1080p60, Safari hardware, device changes
and complete interactive installation/shortcut/uninstall acceptance.

Native audio tests use genuine WASAPI capture of synthetic processes; they do not
claim the target-game acceptance test passed. STUN srflx gathering alone does not
prove an Internet media session. Alpha is the intended stability designation.

## Publication

Prepared tag: `v0.2.0-alpha`. Publish only the reviewed public branch and this tag.
Do not push local development backup branches; their old documentation includes
machine-specific information. Upload the installer as a Release asset and mark
the GitHub Release as a **pre-release**. Code signing is not provided.
