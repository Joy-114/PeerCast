# Contributing to PeerCast

PeerCast is an alpha project for one Host and one Viewer. Keep changes focused:
describe the problem, make the smallest useful fix, and include relevant evidence.

## Development

Use Windows 11 x64, Node.js 22, .NET SDK 8 and Git for desktop development.
From the repository root:

```powershell
npm ci
npm test
npm run build:native
npm start
```

The browser UI uses plain HTML/CSS/JavaScript. Keep the root HTML entry points
usable without npm; share WebRTC logic between Web and Desktop. Do not merge
Host and Viewer peer state. Preserve the complete ICE gathering / Offer / Answer
sequence and the explicit audio MID mapping.

## Before submitting

1. Explain the trigger, observed behavior and expected result in an issue or PR.
2. Run `npm test`. For media changes, run `npm run test:browser` on Windows/Edge.
3. For desktop changes, build the native helper and run `npm run test:desktop`.
4. For native audio changes, run `npm run test:audio` and `npm run test:e2e` on
   an interactive Windows 11 machine with an active output device. These tests
   generate audible synthetic tones. They do not validate CS2/Discord isolation.
5. For packaging changes, run `npm run build` and follow the installer checklist
   in [Testing](docs/TESTING.md).
6. State which checks passed and which need manual testing. Do not call a
   requested frame rate a measured frame rate.

Use short, descriptive commits. Do not commit generated installers, SDKs,
node_modules, device IDs, real SDP, credentials, recordings or personal screenshots.
See [Security and publication](docs/SECURITY.md) before sharing diagnostics.

## Scope and licensing

Discuss new dependencies or features before implementing them. Accounts, cloud
recording, chat, file transfer and multi-viewer rooms are outside the alpha scope.
Contributions are distributed under the repository's MIT license. Include
attribution and licenses when adding third-party material.
