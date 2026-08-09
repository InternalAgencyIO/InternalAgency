# Building and releasing

## Requirements

- Windows 11 (Windows 10 may work but is not a release target)
- .NET Framework 4.8 enabled
- Windows PowerShell 5.1 or PowerShell 7
- Git, for source control
- GitHub CLI, only for maintainers publishing a release

There are no NuGet, npm, or other third-party runtime dependencies.

## Build

From `projects\codex-guardian`:

```powershell
.\scripts\build.ps1 -Configuration Release
```

The script locates the 64-bit or 32-bit .NET Framework compiler, compiles all
source files in a stable filename order, embeds `app.manifest`, and writes:

```text
artifacts\build\Release\CodexGuardian.exe
```

The classic `src\CodexGuardian.csproj` is provided for Visual Studio users.

## Verify

```powershell
.\scripts\verify.ps1 -CaptureUi
```

Verification performs:

1. a clean Release compilation;
2. a no-window self-test of config and app-entry serialization, exact-path
   allow matching, and protected Codex matching;
3. a source scan for private prototype identifiers;
4. optional native WinForms rendering to `artifacts\ui\main-window.png`.

The UI capture is a local QA artifact and is not committed because it reflects
the current machine's installed browser paths and Guardian state.

## Package

```powershell
.\scripts\package.ps1 -Version 1.0.0
```

This reruns verification and creates:

```text
artifacts\release\CodexGuardian-1.0.0-Windows-Portable.zip
artifacts\release\CodexGuardian-1.0.0.exe
artifacts\release\SHA256SUMS.txt
artifacts\release\LICENSE.txt
```

The ZIP contains the executable, `START-HERE.txt`, README, documentation,
changelog, security policy, and MIT license. It does not contain an installer or
generated user configuration. Packaging then extracts the ZIP, reruns the
self-test, compares its EXE with the raw EXE, checks the assembly version, rejects
PDB/config/log files, and verifies every checksum.

## Versioning

Use semantic versions. Update both assembly version attributes in
`src\AssemblyInfo.cs`, the changelog, README download links, and release notes.
Monorepo tags are namespaced:

```text
codex-guardian-v1.0.0
```

## Stable release checklist

1. Review the full diff and confirm no personal paths, device IDs, logs, binaries,
   screenshots, or generated app data are staged.
2. Run `scripts\verify.ps1 -CaptureUi` and inspect the PNG at original size.
3. Run `scripts\package.ps1 -Version <version>`.
4. Verify every checksum in `SHA256SUMS.txt` locally.
5. Commit and push the source to `main` through the repository's normal review
   path.
6. Tag that exact source commit with `codex-guardian-v<version>`.
7. Push the tag. GitHub Actions builds the exact tag and creates a **draft**
   release using `RELEASE_NOTES_v<version>.md` with the ZIP, raw EXE, license, and
   checksum file.
8. Download the draft assets, verify their checksums, and run the portable EXE on
   Windows 11.
9. Publish the verified draft as a non-prerelease stable release.

GitHub Actions repeats build, self-test, privacy scan, and packaging on every
Guardian change and tag.
