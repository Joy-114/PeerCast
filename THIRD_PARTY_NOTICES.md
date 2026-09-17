# Third-party software

PeerCast source is licensed under MIT. Dependencies retain their own licenses.

| Component | Role | License / source |
| --- | --- | --- |
| Electron | Desktop runtime | [MIT](https://github.com/electron/electron/blob/main/LICENSE) |
| Chromium and bundled components | Browser, WebRTC, codecs | See `LICENSES.chromium.html` in the desktop distribution |
| Node.js | Electron main process; build tools | [Node.js license and bundled notices](https://github.com/nodejs/node/blob/main/LICENSE) |
| .NET runtime | Self-contained native audio helper | [MIT](https://github.com/dotnet/runtime/blob/main/LICENSE.TXT), [third-party notices](https://github.com/dotnet/runtime/blob/main/THIRD-PARTY-NOTICES.TXT) |
| electron-builder / NSIS | Development and installer tooling | [electron-builder MIT](https://github.com/electron-userland/electron-builder/blob/master/LICENSE), [NSIS licenses](https://nsis.sourceforge.io/License) |

The lockfile identifies exact JavaScript build dependencies. The WASAPI interop
code uses Windows system APIs; it does not bundle Windows DLLs. The application
icon is a project-created geometric screen icon. No game or messaging-app logos
are included. Upstream runtime notices are included under `resources/notices`
when building the Windows distribution.
