# Radiance rendered scene masters

This directory holds the pre-rendered 30 fps MP4 scene files used by the
desktop app. These are runtime assets, not a generation cache.

Full releases contain one `*-full-30fps.mp4` file per scene plus
`manifest.json`. The videos are tracked with Git LFS and unpacked from the
Electron ASAR so Chromium can stream them directly without generation,
transcoding, or a model download.
