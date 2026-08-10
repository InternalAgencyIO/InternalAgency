# FramePack full-motion attempt

## Outcome

The experimental FramePack image-to-video run did not produce a valid scene or
any releaseable MP4. No FramePack-generated frames are used in the final
NIGHTFLIGHT photo-film, and the release does not claim full character motion.

The run logs recorded the following progress before the server/client ended:

| Logged section | Result |
| --- | --- |
| First 25-step latent section | Completed in 7 h 36 m 15 s |
| Second section | Completed in 3 h 42 m 18 s |
| Third section | Reached 60%; did not complete |

There was no completed Scene 1 output to validate, trim, or include.

## Why the path was retired for this release

The low-RAM runtime repeatedly swapped model components between system memory
and GPU memory. The GPU was also shared with normal desktop and virtual-machine
workloads. At the measured throughput, completing six 15-second scenes would
have taken days and remained vulnerable to another interrupted run. Continuing
that approach was not a practical or stable release path on the production
machine.

This is a throughput and reliability finding for this particular environment,
not a general claim about FramePack quality or performance on other hardware.

## Release pivot

The approved 1672 x 941 photoreal keyframes were retained. The supported
release renderer applies deterministic animated crops, camera moves, restrained
color/sharpening, and temporal film texture with portable FFmpeg. It produces:

- six 3840 x 2160 H.264 scenes at 30 fps;
- exactly 450 frames and 15.000 seconds per scene;
- one 2,700-frame, 90.000-second video-only master;
- CPU `libx264` encoding, without a CUDA, NVENC, or FramePack dependency; and
- the Guardian UI attached to its Scene 1 physical monitor only for frames
  0-299 inclusive.

The resulting work is described as a cinematic photo-film. Its 4K delivery
frames are derived from the 1672 x 941 approved stills and are not represented
as native 4K photography, native 4K diffusion video, or generated actor motion.

## Preserved experimental materials

The FramePack launcher, renderer, merge scripts, prompts, and pinned runtime
commit remain in source control as optional experimental reference material.
The external runtime and model weights are not vendored. None of those scripts
or weights is a dependency of the supported release command in `BUILDING.md`.
