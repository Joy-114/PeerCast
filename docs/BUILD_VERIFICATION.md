# Alpha build verification

Local verification for the public alpha preparation, 2026-09-17:

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Fresh single-branch clone | PASS | No `.tools`, `node_modules`, native output or installer copied into the clone |
| `npm ci` | PASS | Lockfile installation; npm reported zero known vulnerabilities at that run |
| `npm test` | PASS | Core checks plus version/HTML/documentation-reference consistency |
| `npm run build` | PASS | .NET native compile and Electron NSIS Windows x64 installer |
| `npm run test:browser` | PASS | 50 real Edge WebRTC assertions with synthetic media |
| `npm run test:desktop` | PASS | 15 production-CSP/IPC/settings assertions |
| `npm run test:e2e` | PASS | 8 native-to-Viewer audio/lifecycle checks |
| Public tree/history pattern scan | PASS | No matched credentials, local user paths or legacy machine address |
| Public screenshots | NEEDS MANUAL TEST | Reviewed idle Host/Viewer included; target-application view still needs capture |
| Actual target applications/network/60 FPS | NEEDS MANUAL TEST | See acceptance checklist |

Build environment: Windows 11 x64 (build 26200), Node.js 22.23.2, .NET SDK
8.0.425 / runtime 8.0.31, Electron 44.4.1 and electron-builder 26.15.3.
The SDKs were supplied on PATH outside the fresh clone, as standard build
prerequisites. The clone did not depend on private configuration or copied outputs.
Build downloads use upstream package caches where available; this is a clean
source build, not a claim that every network download was uncached.

Raw logs remain local and ignored. They can contain build paths, IPC rejection
stacks and device information. Negative IPC tests intentionally generate errors;
the test verifies those requests are denied. The optional screenshot operation is
not counted as a desktop functional test. The included Viewer image was reviewed
and contains no live session code.

Reproduce the publication scan from a Git checkout:

```powershell
node scripts/audit-public.cjs
node scripts/audit-public.cjs --history
```

These are heuristic scans, not a comprehensive security audit. Dummy credentials
and private-range IPs in synthetic fixtures are not operational secrets. The old
local development branch is not part of the public branch's reachable history.

The authoritative final installer checksum is distributed as `SHA256SUMS.txt`
alongside the Release asset. Verify on Windows with:

```powershell
Get-FileHash ./PeerCast-Setup-0.2.0-alpha.exe -Algorithm SHA256
```

Compare that value with the downloaded checksum file. The installer is unsigned;
a checksum confirms file integrity, not a trusted publisher identity.
