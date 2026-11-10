# Standalone Android Builds

## First Build

Run the signing setup from the repository root in PowerShell:

```powershell
.\scripts\setup-android-signing.ps1
```

Enter the signing password directly in the terminal, never in chat or Git.
The script creates a password-protected key outside the repository at
`%USERPROFILE%\.android\studentai-upload.p12`, or verifies an existing key
without overwriting it. It uploads the required signing values as GitHub Actions
secrets. Back up the key file and its password separately in secure storage.
The password is not saved locally by the script.

In GitHub, open **Actions > Standalone Android Build > Run workflow** on `main`.
The build produces two downloadable artifacts:

- `standalone-apk-*`: extract and share the signed APK with Android testers.
- `play-store-aab-*`: the signed app bundle for eventual Play Console upload.

Artifacts expire after 14 days; retain required builds in your own storage.
The APK bundles JavaScript and assets. It does not need Metro, USB, ADB, your
computer, or an SSH tunnel. Online features still require internet access to
`https://classroom-api.201.18.199.107.sslip.io/api`.

## Signing And Updates

Never change or delete the key used for a distributed app without planning the
signing transition. Android requires matching signing identities for in-place
updates. This release key differs from the earlier debug key; the release APK
cannot update an existing debug installation. Do not uninstall a tester's app
without their consent: uninstalling removes its local data.

Debug builds continue to use the debug key. Release builds fail when the four
release-signing environment variables are missing instead of using that key.
CI restores the release key temporarily and deletes it after the build.

## Before Google Play

- Review the permanent application ID (`com.rnapp` currently) before publishing.
- Enroll in Play App Signing and deliberately choose the app signing key. If
  testers must update the directly distributed APK through Play, preserve its
  signing identity during enrollment rather than assuming any generated Play
  key will match. The upload key and Play app signing key have separate roles.
- Keep each uploaded version code greater than the last Play version. This
  workflow uses `1000 + GitHub run number`; review it before publishing if the
  workflow is replaced or builds come from other systems.
- Complete backend database, authentication, and AI configuration. Standalone
  packaging does not enable unconfigured chat, tutor, or lesson features.
- Complete privacy, account/data deletion, permissions, store listing, and
  current Play policy requirements. No workflow automatically publishes to Play.

The workflow builds on GitHub-hosted Linux, not on the shared VPS, and does
not disable Windows Device Guard or modify other websites.