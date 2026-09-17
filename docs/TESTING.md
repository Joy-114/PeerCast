# Testing and acceptance

## Existing local evidence

| Area | Status | Boundary |
| --- | --- | --- |
| Web media regression | PASS: 50 Edge assertions | Real WebRTC, synthetic media, same machine |
| PC1, clipboard, settings, ICE config | PASS | Safari hardware not tested |
| Desktop smoke | PASS: 15 assertions | Production CSP, IPC, settings, enumeration |
| Native process isolation | PASS: separate 440/880 Hz processes | Real WASAPI; not CS2/Discord |
| Native-to-Viewer flow | PASS: 8 checks | Mute, Send OFF/ON, process exit and cleanup |
| STUN discovery | PASS: host and srflx obtained | Not a selected Internet media path |
| TURN runtime | NEEDS MANUAL TEST | Configuration tested; no server supplied |
| Actual screen/mic/system audio | NEEDS MANUAL TEST for alpha | User-tested v0.1 LAN is distinct from desktop alpha acceptance |
| CS2/Discord | NEEDS MANUAL TEST | System Audio fallback does not count |
| Sustained 1080p60 | NEEDS MANUAL TEST | Record measured rates |
| Installer | See RELEASE_NOTES | Build and interactive checks are distinct |

These are local results, not GitHub CI. Raw reports stay ignored because errors,
candidates and devices may contain personal data. Re-run committed harnesses for
new evidence. Hosted CI intentionally excludes hardware capture tests.

```powershell
npm ci
npm test
npm run test:browser
npm run build:native
npm run test:desktop
npm run test:audio
npm run test:e2e
npm run build
```

Native tests require Windows 11 and an active output. Tone tests make sound; keep
volume low. PCM stays in memory; reports contain numeric summaries, not recordings.
The browser harness uses a separate Edge profile and its own loopback port.
Set `PEERCAST_BROWSER` for another Chromium executable; only Edge was validated.

## Installer

1. Run `PeerCast-Setup-0.2.0-alpha.exe` on a test Windows account.
2. Change directory; choose Desktop and Start Menu shortcuts; finish with Launch.
3. Confirm Home opens without developer tools or a server.
4. Close; launch from Desktop, then Start Menu/search.
5. Confirm PeerCast in Windows Installed apps and startup OFF.
6. Enable startup only through explicit user action; disable and verify removal.
7. Uninstall; verify executable, uninstall entry and created shortcuts are removed.
8. Repeat with both shortcuts OFF; verify neither is created.

Windows numeric FileVersion is `0.2.0.0`; product/package/native informational
version is `0.2.0-alpha`. A silent install does not validate interactive options.

## CS2 and Discord

1. Run both applications with sound. Keep mixed System Audio Send OFF.
2. Select their audio sources before Offer creation. CS2 Send ON, Discord OFF.
3. Connect a separate Viewer with headphones. Confirm CS2 audible, Discord absent.
4. Discord ON must become audible; OFF must stop it while CS2 continues.
5. Test each source's mute and gain on Host and local volume on Viewer.
6. Close/restart applications: capture stops and UI reports changed identity;
   reselect in a new session without a PeerCast crash.
7. Change default output and reconnect a headset; record actual recovery.
8. Stop/reset/close and verify no screen, microphone or native capture remains.

## Internet and FPS

1. Host on home Wi-Fi; Viewer on another network or mobile hotspot.
2. Exchange fresh PC1 codes. Record selected candidate types, protocol, route,
   RTT and connection state. A srflx candidate alone is insufficient.
3. Confirm moving decoded video and independent audible sources.
4. If direct ICE fails, record network context. With a real TURN configuration,
   repeat including relay-only mode. Never publish its credentials.
5. Request 1080p/60 FPS. For at least ten minutes of moving content, record
   captured/sent/received rates, dimensions, bitrate, loss and RTT.
6. Report lower values honestly. Test disconnection and explicit reset recovery.

## Browser/hardware

On macOS Safari, copy both codes, deny clipboard access, and verify selected text
with Command+C recovery. Test playback, per-source volume and output availability.
Test microphone denial, display-picker cancellation, real device changes and
fallback to default output without losing video.
