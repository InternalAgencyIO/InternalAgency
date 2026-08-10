# Keyframe generation record

The six accepted starting frames were generated one at a time with OpenAI's
built-in image generation. Every call was identity-preserving and used the four
project-owned Signal Four portrait anchors in `source/references/`.

All depicted characters are fictional adults. The four women are explicitly
25 or older in the inherited NIGHTFLIGHT provenance; the unanchored boss is a
fictional adult man described as 30 or older and is framed mostly from behind.
No real-person face photograph was used.

## Reference order

1. `radiance-face-anchor.webp`
2. `ellie-face-anchor.webp`
3. `ece-face-anchor.webp`
4. `alia-face-anchor.webp`
5. Environment reference for the first pass, then `scene-02.png` as the exact
   wardrobe and material master for continuity repairs.

The fifth reference never replaces the four identity anchors. `scene-02.png`
defines the final clothes: Radiance's sleeveless red/white/cobalt opaque latex
dress, Ellie's white skirt first-officer suit, Ece's cobalt skirt captain suit,
and Alia's fully lined cobalt/red/white lace dress.

## Accepted scene briefs

Every brief also required true 16:9 landscape framing, 35 mm cinematic optics,
photorealistic skin and materials, complete natural anatomy, a fixed cast,
fully opaque clothing, and no caption, title, logo, watermark, or border.

### Scene 01 - arrival

Exactly the four women walk left-to-right into the black-glass and brushed-gold
NIGHTFLIGHT orbital casino toward an autonomous roulette table, with Earth
through panoramic windows. A small blank oblique monitor is reserved on the
right background wall for the later Guardian composite. The accepted frame was
a wardrobe-continuity repair using Scene 02 as reference five.

### Scene 02 - roulette loss

The red-black-gold roulette wheel remains prominent in the lower foreground
immediately after a lost round. The four women exchange amused, mildly
disappointed expressions: raised brows, a wry smile, and a playful shrug. No
dealer, money, readable number, or other person appears. This accepted frame is
the final wardrobe master.

### Scene 03 - upper level

The quartet climbs a broad safe glass-and-gold staircase surrounding a crystal
elevator. The camera is eye-level and architecture-forward; hands touch the
rail naturally and feet meet separate stair treads. The accepted continuity
repair uses the Scene 02 clothes exactly and treats the moment as a formal,
family-safe transition between casino floors.

### Scene 04 - Ece and Radiance

Five adults occupy the private upstairs suite. Ece, the boss's wife, completes
a brief affectionate closed-mouth peck and warm embrace. Radiance approaches
next and rests both hands gently over the front and shoulders of his tailored
jacket. Alia and Ellie wait nearby. Contact is fully clothed and non-explicit.

### Scene 05 - Alia and Ellie

Alia remains beside the boss with one hand on his shoulder just after a warm
cheek kiss. Ellie stands face-to-face with him, foreheads nearly touching and
lips an inch apart at the beginning of a sustained closed-mouth romantic kiss.
Ece and Radiance exchange the same playful, amused jealous glance. The accepted
frame was a Scene 02 wardrobe-continuity repair.

### Scene 06 - shared close

The playful tension has dissolved. All four women smile at one another around
the boss in a respectful, fully clothed group embrace. The accepted continuity
repair keeps Ellie's white skirt suit and Ece's cobalt skirt suit rather than
silhouette-changing trousers. The composition leaves room for the orbital
window and ends without promotional typography.

## Rejected generations

Output-stage safety filters rejected two otherwise non-explicit requests, and
one first-pass finale contained an extra background person. Those results were
not accepted or published. Safer family-fashion wording and stricter exact-cast
instructions produced the final frames. The first-pass files remain only in
the private generator cache; the repository contains the accepted files and
their hashes in `manifest.json`.

Image generation is not deterministic. Repeating a brief will produce a new
candidate, so the accepted PNG and SHA-256—not the prose alone—is the canonical
source for the motion stage.
