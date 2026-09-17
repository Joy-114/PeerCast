# Security and publication

PeerCast has no project-operated signaling/media backend. Capture starts through
explicit UI actions. PCM stays in memory; no recording feature writes audio.
Configured TURN relays encrypted WebRTC media. STUN receives address-discovery requests.

PC1 is compressed, not encrypted. SDP contains network/session metadata. Never
post live codes, device identifiers or TURN credentials in issues. Desktop protects
local TURN credentials with Windows safeStorage; Web uses origin-local localStorage.

Before publishing:

- Audit the tree **and history of the branch being pushed**.
- Never push private backup refs with `--all` or `--mirror`.
- Exclude keys, .env, settings, profiles, recordings, SDK caches, installers and logs.
- Use synthetic fixtures and example domains. `turnPassword` field names are not secrets.
- Review screenshots for SDP, usernames, notifications and private window titles.
- Pattern scans reduce mistakes but cannot guarantee absence of all secrets.

The first public alpha is a reviewed source snapshot. Earlier development history
is retained locally because old docs included machine paths and LAN addresses.
Only the clean public branch and its release tag should be pushed.

For ordinary bugs, provide OS/runtime version, steps and anonymized metrics. For
security vulnerabilities, use private GitHub reporting if enabled; otherwise ask
the owner for a private channel before sending exploit details or personal data.
