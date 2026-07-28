<h1 align="center">Internal Agency</h1>

<p align="center"><strong>A public build archive for independent creative systems.</strong></p>

> **Build in public. Prove in public. Keep the record readable.**

## Public project index

| Project | What it is | Public record | Status |
| --- | --- | --- | --- |
| **Radiance** | A living high-fashion AI desktop companion. | Source, scene manifest, local production flow, tests, and releases live in this repository. | Active |
| **STAR ASCENT** | A bilingual public culture, launch, and evidence project. | [Live source](projects/star-ascent/site), [project guide](projects/star-ascent/README.md), [English site](https://internalagency.io), [Turkish site](https://ileriakil.com). | Live build |

## STAR ASCENT — live public build

The complete, reproducible English and Turkish website source now lives in
[`projects/star-ascent/site`](projects/star-ascent/site). It includes the public
site, Dossier, launch flow, source archive, and validation scripts used by the
live build. Radiance remains a separate active project.

## Start here

1. Read the [repository architecture](docs/REPOSITORY_ARCHITECTURE.md) for
   the separation between public site, contracts, audits, and archive.
2. Read each project README before running code. Every reproducible command,
   dependency, generated asset, and public claim should have an intelligible
   home in the record.
3. Treat on-chain claims as unverified unless their public transaction or
   address evidence is linked alongside the claim.

## Openness commitment

This repository is MIT licensed. New STAR ASCENT public writing, reference
material, and non-code archive artifacts will be released as clearly marked
CC0 material where their dedicated repositories say so. Code keeps its own
explicit license; no private credentials, seed phrases, personal data, or
unverified security claims belong in public history.

---

## Radiance

<p align="center">
  <strong>A living high-fashion AI companion for your desktop.</strong>
</p>

<p align="center">
  <img src="assets/readme/radiance-pet.gif" width="170" alt="Radiance calmly animating in her navy dress">
</p>

Radiance is the girl at the heart of Internal Agency: a personal AI avatar,
confidante, dancer, and experienced field operator. She wears couture into the
control room, keeps her composure when the mission becomes impossible, and
still knows when it is time to put the work aside and move with the music.

She is not meant to be another face trapped inside a chat window. Radiance
lives beside your work as a transparent desktop presence. She listens, reacts,
changes scenes with your day, and brings a little beauty and personality to the
space between tasks.

<p align="center">
  <img src="assets/readme/radiance-scene.gif" width="280" alt="Radiance moving naturally in the neon listening lounge">
</p>

<p align="center">
  <em>Real local image-to-video motion—hair, fabric, posture, and expression—not a camera zoom.</em>
</p>

## What it feels like

Put on techno and Radiance can settle into a slow, elegant dance. Start a
difficult task and she becomes attentive. Step away and she rests. Across
sixteen cinematic scenes she moves from neon lounges and chrome catwalks to
quiet data gardens and fictional world-saving operations—always recognizably
herself.

### The Starlight Era

Radiance also has a life beyond her active animations: mornings at home,
fashion ateliers, recording studios, night markets, observatories, road trips,
parties, and quiet encounters with the wider world.

<p align="center">
  <img src="assets/lore/starlight-era/02-midnight-dj.png" width="23%" alt="Radiance DJing">
  <img src="assets/lore/starlight-era/08-white-fashion-atelier.png" width="23%" alt="Radiance designing couture">
  <img src="assets/lore/starlight-era/11-polar-observatory.png" width="23%" alt="Radiance beneath an aurora">
  <img src="assets/lore/starlight-era/20-starlight-roller-disco.png" width="23%" alt="Radiance roller skating">
</p>

Explore the growing high-resolution collection in
**[Radiance: The Starlight Era](assets/lore/starlight-era/README.md)**. Every
image is preserved as a future animation anchor, avatar memory, and wardrobe
reference.

- **A reactive companion:** music energy, BPM, task state, urgency, milestones,
  and away time can influence what she does.
- **Seven minutes of authored scenes:** sixteen distinct moments can play
  back-to-back without a repetitive idle loop.
- **True 30fps motion:** scene videos are generated from Radiance's original
  artwork with a locked camera and physical character movement.
- **Local and press-and-play:** finished MP4s ship with the app. Watching
  Radiance requires no cloud generation, model download, or recompute.
- **A matching Codex pet:** the same character can live inside Codex through
  the validated v2 `Radiance Butterfly` package.

## Meet Radiance on your desktop

You need Node.js 18+:

```powershell
git clone https://github.com/InternalAgencyIO/InternalAgency.git
cd InternalAgency
npm install
npm start
```

The overlay is frameless, draggable, resizable, and always on top. Hover over
Radiance to reveal her controls. Pick a scene, play the full collection, or
enable **Listen** and let the rhythm guide her.

On supported systems, Listen requests loopback system audio. If loopback is
unavailable, it falls back to the default audio input.

### Add her as a Codex pet

```powershell
npm run install:pet
```

Restart Codex if the pet picker is already open, then select
**Radiance Butterfly**.

### Build a portable Windows app

```powershell
npm run dist
```

The production build is written to `release/` and includes the verified 30fps
scene masters. For development, `npm run dist:preview` packages the motion
available so far and uses original scene frames as graceful fallbacks.

## Make Radiance reactive

Local integrations can send her small activity signals:

```js
window.radianceSignal({
  task: { state: "running", kind: "analysis" },
  urgency: "high"
});
```

Signals merge into Radiance's current state, so integrations only send what
changed. Supported cues include music BPM and energy, task state, urgency,
bold-plan mode, away state, successful review, and session milestones.

## Create more scenes locally

The repository contains the same local FramePack production flow used to make
the motion preview above. It begins with an original Radiance frame and creates
character, hair, fabric, and environment movement without fake zooming:

```powershell
npm run video:server
npm run video:scene -- -Scene neon-listening-lounge -Duration 5
```

See [`scripts/video/README.md`](scripts/video/README.md) for the full local
render workflow. Scene definitions and reproducible prompts live in
[`assets/scene-manifest.json`](assets/scene-manifest.json).

## Overnight Atlas — Batch 9: Nature Adventure

Radiance leaves the city without losing her sense of style: four capable,
cinematic moments across mountain, rainforest, volcanic coast, and arctic sky.

| Alpine Wildflower Ridge | Rainforest Canopy Station |
| --- | --- |
| ![Radiance at sunrise on an alpine wildflower ridge](assets/lore/starlight-era/56-alpine-wildflower-ridge.png) | ![Radiance working at a rainforest canopy station](assets/lore/starlight-era/57-rainforest-canopy-station.png) |

| Black-Sand Horseback Dawn | Northern Lights Field Camp |
| --- | --- |
| ![Radiance riding along a black-sand beach at dawn](assets/lore/starlight-era/58-black-sand-horseback-dawn.png) | ![Radiance at an arctic field camp under the aurora](assets/lore/starlight-era/59-northern-lights-field-camp.png) |

## Overnight Atlas — Batch 10: Full-Colour Swim

Four saturated resort moments bring a brighter pulse to Radiance's world:
Riviera turquoise, Miami primaries, lagoon green, and a violet-gold sunset.

| Riviera Colour Dive | Miami Cabana Flash |
| --- | --- |
| ![Radiance in a colourful Riviera swim editorial](assets/lore/starlight-era/60-riviera-colour-dive.png) | ![Radiance at a bright Miami pool cabana](assets/lore/starlight-era/61-miami-cabana-flash.png) |

| Lagoon Paddle Morning | Sunset Pool Dance |
| --- | --- |
| ![Radiance paddleboarding on a tropical lagoon](assets/lore/starlight-era/62-lagoon-paddle-morning.png) | ![Radiance at a colourful rooftop pool celebration](assets/lore/starlight-era/63-sunset-pool-dance.png) |

## Overnight Atlas — Batch 11: Creative Operator

Radiance directs the image, engineers the sound, builds the fashion, and sends
the final record into sunrise.

| Rain-Stage Film Director | Solar Sound Stage |
| --- | --- |
| ![Radiance directing a miniature rain stage](assets/lore/starlight-era/64-rain-stage-film-director.png) | ![Radiance engineering a solar-powered sound stage](assets/lore/starlight-era/65-solar-sound-stage.png) |

| Paris Metal Couture Atelier | Rooftop Radio Sunrise |
| --- | --- |
| ![Radiance crafting a gold couture structure in Paris](assets/lore/starlight-era/66-paris-metal-couture-atelier.png) | ![Radiance completing a rooftop radio broadcast at sunrise](assets/lore/starlight-era/67-rooftop-radio-sunrise.png) |

## Overnight Atlas — Batch 12: Midnight Grand Tour

Four cities and landscapes become one continuous night of arrival, motion,
texture, and quietly commanding fashion.

| Venice Water Taxi Midnight | Art Deco Elevator Arrival |
| --- | --- |
| ![Radiance arriving in Venice by water taxi](assets/lore/starlight-era/68-venice-water-taxi-midnight.png) | ![Radiance arriving through an Art Deco elevator](assets/lore/starlight-era/69-art-deco-elevator-arrival.png) |

| Desert Night Train | Moonlit Sculpture Garden |
| --- | --- |
| ![Radiance crossing the desert aboard a night train](assets/lore/starlight-era/70-desert-night-train.png) | ![Radiance exploring a moonlit sculpture garden](assets/lore/starlight-era/71-moonlit-sculpture-garden.png) |

## Overnight Atlas — Batch 13: Off-Duty Radiance

Her world feels richer when nothing is at stake: imperfect pastries, a last
record in the rain, one final planet before dawn, and dancing among moving boxes.

| Midnight Cardamom Kitchen | Rainy Record Shop Closing |
| --- | --- |
| ![Radiance baking cardamom rolls after midnight](assets/lore/starlight-era/72-midnight-cardamom-kitchen.png) | ![Radiance browsing a record shop at closing time](assets/lore/starlight-era/73-rainy-record-shop-closing.png) |

| Balcony Stargazing Dawn | Living Room Gold Dance |
| --- | --- |
| ![Radiance stargazing from a flower-filled balcony](assets/lore/starlight-era/74-balcony-stargazing-dawn.png) | ![Radiance dancing in a sunlit living room](assets/lore/starlight-era/75-living-room-gold-dance.png) |

## Overnight Atlas — Batch 14: Celebration Atlas

Radiance joins four celebrations in motion: Lisbon flowers, rooftop jazz,
desert kites, and a winter lantern regatta.

| Lisbon Flower Tram Festival | Rooftop Jazz Brunch |
| --- | --- |
| ![Radiance arranging flowers beside a Lisbon tram](assets/lore/starlight-era/76-lisbon-flower-tram-festival.png) | ![Radiance playing piano at a rooftop jazz brunch](assets/lore/starlight-era/77-rooftop-jazz-brunch.png) |

| Desert Kite Festival | Winter Lantern Regatta |
| --- | --- |
| ![Radiance flying a geometric kite across the desert](assets/lore/starlight-era/78-desert-kite-festival.png) | ![Radiance launching a sculptural lantern on a frozen lake](assets/lore/starlight-era/79-winter-lantern-regatta.png) |

## Overnight Atlas — Batch 15: Tide & Signal

Radiance restores a reef, holds the lighthouse watch, shapes a racing sail,
and lets the Amalfi night end in one perfect turn.

| Mediterranean Coral Restoration | Atlantic Lighthouse Storm Watch |
| --- | --- |
| ![Radiance restoring coral at a Mediterranean marine station](assets/lore/starlight-era/80-mediterranean-coral-restoration.png) | ![Radiance operating an Atlantic lighthouse during a storm](assets/lore/starlight-era/81-atlantic-lighthouse-storm-watch.png) |

| Mediterranean Sailmaker's Loft | Amalfi Midnight Dance |
| --- | --- |
| ![Radiance fitting a racing sail in a Mediterranean loft](assets/lore/starlight-era/82-mediterranean-sailmakers-loft.png) | ![Radiance dancing on a candlelit Amalfi terrace](assets/lore/starlight-era/83-amalfi-midnight-dance.png) |

## Overnight Atlas — Batch 16: Elemental Atelier

Four raw materials become Radiance's medium: orchid mist, geothermal dye,
polar ice, and solar-woven silk.

| Cloud-Forest Orchid Perfumery | Volcanic Textile Dyeing |
| --- | --- |
| ![Radiance crafting perfume in a cloud-forest orchid atelier](assets/lore/starlight-era/84-cloud-forest-orchid-perfumery.png) | ![Radiance dyeing silk on a volcanic coast](assets/lore/starlight-era/85-volcanic-textile-dyeing.png) |

| Polar Ice Pavilion Architect | Desert Solar-Silk Runway |
| --- | --- |
| ![Radiance measuring a polar ice pavilion beneath the aurora](assets/lore/starlight-era/86-polar-ice-pavilion-architect.png) | ![Radiance walking a solar-silk runway in the desert](assets/lore/starlight-era/87-desert-solar-silk-runway.png) |

## Overnight Atlas — Batch 17: The Night Shift

Radiance keeps the city moving, its rooftops alive, its couture intact, and
still finds one quiet moment before morning.

| Midnight Metro Signal Room | Rooftop Apiary Sunrise |
| --- | --- |
| ![Radiance operating a midnight metro signal room](assets/lore/starlight-era/88-midnight-metro-signal-room.png) | ![Radiance inspecting a rooftop apiary at sunrise](assets/lore/starlight-era/89-rooftop-apiary-sunrise.png) |

| Backstage Couture Rescue | Art Deco Hotel Nightcap |
| --- | --- |
| ![Radiance repairing couture backstage at the opera](assets/lore/starlight-era/90-backstage-couture-rescue.png) | ![Radiance making a late-night toast in an Art Deco hotel bar](assets/lore/starlight-era/91-art-deco-hotel-nightcap.png) |

## Overnight Atlas — Batch 18: Field Notes

Radiance works where the map runs out: canyon airspace, Sahara starlight,
rainforest mist, and a lakeside studio made for thinking.

| Canyon Rescue Drone Pilot | Sahara Meteorite Lab |
| --- | --- |
| ![Radiance piloting a rescue drone above a canyon](assets/lore/starlight-era/92-canyon-rescue-drone-pilot.png) | ![Radiance inspecting a meteorite in a Sahara field lab](assets/lore/starlight-era/93-sahara-meteorite-lab.png) |

| Rainforest Bridge Survey | Lakeside Fashion Sketchbook |
| --- | --- |
| ![Radiance surveying a rainforest suspension bridge](assets/lore/starlight-era/94-rainforest-bridge-survey.png) | ![Radiance sketching fashion beside a mountain lake](assets/lore/starlight-era/95-lakeside-fashion-sketchbook.png) |

## Overnight Atlas — Batch 19: Play Mode

Radiance makes room for play: sunrise tennis above the Riviera, a midnight
bowling lane, a Ferris wheel brought back to light, and one last Paris dance.

| Riviera Tennis Sunrise | Midnight Bowling Club |
| --- | --- |
| ![Radiance playing sunrise tennis above the Riviera](assets/lore/starlight-era/96-riviera-tennis-sunrise.png) | ![Radiance bowling after midnight](assets/lore/starlight-era/97-midnight-bowling-club.png) |

| Coastal Ferris-Wheel Light Test | Paris Cocktail Dance |
| --- | --- |
| ![Radiance testing the lights on a coastal Ferris wheel](assets/lore/starlight-era/98-coastal-ferris-wheel-light-test.png) | ![Radiance dancing in a Paris cocktail dress](assets/lore/starlight-era/99-paris-cocktail-dance.png) |

## Overnight Atlas — Batch 20: Motion & Wonder

Radiance moves between city rain and open sky: navigating Tokyo, welcoming
friends to a Tuscan table, tuning the stars, and launching into a new dawn.

| Tokyo Rain Cycle Map | Tuscan Harvest Supper |
| --- | --- |
| ![Radiance navigating Tokyo by bicycle after rain](assets/lore/starlight-era/100-tokyo-rain-cycle-map.png) | ![Radiance preparing a Tuscan harvest supper](assets/lore/starlight-era/101-tuscan-harvest-supper.png) |

| Planetarium Light Rehearsal | Cappadocia Balloon Dawn |
| --- | --- |
| ![Radiance rehearsing a planetarium star projection](assets/lore/starlight-era/102-planetarium-light-rehearsal.png) | ![Radiance preparing a hot-air balloon in Cappadocia](assets/lore/starlight-era/103-cappadocia-balloon-dawn.png) |

## Overnight Atlas — Batch 21: After-Hours Atelier

When the doors close, Radiance keeps creating: fitting gold in Milan, finding
the beat in Havana, composing scent by moonlight, and carrying dawn into New York.

| Milan Gold Fitting | Havana Rooftop Salsa |
| --- | --- |
| ![Radiance fitting a metallic-gold dress in Milan](assets/lore/starlight-era/104-milan-gold-fitting.png) | ![Radiance rehearsing salsa on a Havana rooftop](assets/lore/starlight-era/105-havana-rooftop-salsa.png) |

| Riviera Moon Perfumery | New York Flower Market Dawn |
| --- | --- |
| ![Radiance composing perfume on a moonlit Riviera terrace](assets/lore/starlight-era/106-riviera-moon-perfumery.png) | ![Radiance carrying flowers through New York before dawn](assets/lore/starlight-era/107-new-york-flower-market-dawn.png) |

## Overnight Atlas — Batch 22: Signal & Celebration

Radiance follows the signal from glacial silence to a warm kiln, then turns
the volume up at sunrise and lets Rome have the last word after midnight.

| Patagonia Glacier Relay | Kyoto Raku Kiln Morning |
| --- | --- |
| ![Radiance calibrating a radio relay beside a Patagonian glacier](assets/lore/starlight-era/108-patagonia-glacier-relay.png) | ![Radiance lifting a raku bowl in a Kyoto kiln studio](assets/lore/starlight-era/109-kyoto-raku-kiln-morning.png) |

| Lagos Rooftop DJ Sunrise | Rome Fountain Midnight |
| --- | --- |
| ![Radiance DJing on a Lagos rooftop at sunrise](assets/lore/starlight-era/110-lagos-rooftop-dj-sunrise.png) | ![Radiance crossing a Roman fountain courtyard at midnight](assets/lore/starlight-era/111-rome-fountain-midnight.png) |

## Overnight Atlas — Batch 23: Four Climates

Radiance listens to the savanna, follows tango across an old stage, fills
Marrakech with color, and keeps one warm light burning through Montreal snow.

| Kenya Savanna Acoustic Station | Buenos Aires Tango Rehearsal |
| --- | --- |
| ![Radiance installing an acoustic monitor on the Kenyan savanna](assets/lore/starlight-era/112-kenya-savanna-acoustic-station.png) | ![Radiance rehearsing tango in a Buenos Aires theater](assets/lore/starlight-era/113-buenos-aires-tango-rehearsal.png) |

| Marrakech Riad Rooftop | Montreal Midnight Cocoa |
| --- | --- |
| ![Radiance arranging a colorful Marrakech rooftop terrace](assets/lore/starlight-era/114-marrakech-riad-rooftop.png) | ![Radiance pouring cocoa on a snowy Montreal street](assets/lore/starlight-era/115-montreal-midnight-cocoa.png) |

## Overnight Atlas — Batch 24: Private Hours

Radiance protects the small rituals that keep a large life in balance: Milan
espresso, London footwork, a Seoul soundcheck, and midnight above the Aegean.

| Milan Balcony Espresso | London Boxing Footwork |
| --- | --- |
| ![Radiance having espresso on a Milan balcony](assets/lore/starlight-era/116-milan-balcony-espresso.png) | ![Radiance practicing boxing footwork in a London gym](assets/lore/starlight-era/117-london-boxing-footwork.png) |

| Seoul Karaoke Soundcheck | Santorini Midnight Table |
| --- | --- |
| ![Radiance soundchecking a private Seoul karaoke studio](assets/lore/starlight-era/118-seoul-karaoke-soundcheck.png) | ![Radiance lighting a midnight table in Santorini](assets/lore/starlight-era/119-santorini-midnight-table.png) |

## Overnight Atlas — Batch 25: City Pulse

Radiance follows four different rhythms: a rooftop waking in Mexico City, rain
moving through Singapore, a New Orleans snare, and the precision of Monaco steel.

| Mexico City Rooftop Breakfast | Singapore Rain-Garden Architect |
| --- | --- |
| ![Radiance preparing breakfast on a Mexico City rooftop](assets/lore/starlight-era/120-mexico-city-rooftop-breakfast.png) | ![Radiance inspecting a Singapore rain garden](assets/lore/starlight-era/121-singapore-rain-garden-architect.png) |

| New Orleans Snare Rehearsal | Monaco Night Fencing Salon |
| --- | --- |
| ![Radiance rehearsing snare drum in New Orleans](assets/lore/starlight-era/122-new-orleans-snare-rehearsal.png) | ![Radiance completing a fencing drill in Monaco](assets/lore/starlight-era/123-monaco-night-fencing-salon.png) |

## Overnight Atlas — Batch 26: Summer Voltage

Radiance carries the long light from a Stockholm wreath into a Berlin record,
then follows the stars through Baja before Paris turns the final mirror toward her.

| Stockholm Midsummer Wreath | Berlin Vinyl Dance |
| --- | --- |
| ![Radiance weaving a midsummer wreath in Stockholm](assets/lore/starlight-era/124-stockholm-midsummer-wreath.png) | ![Radiance dancing beside a Berlin record player](assets/lore/starlight-era/125-berlin-vinyl-dance.png) |

| Baja Roadster Star Map | Paris Cocktail Final Look |
| --- | --- |
| ![Radiance mapping the stars beside a Baja roadster](assets/lore/starlight-era/126-baja-roadster-star-map.png) | ![Radiance completing a Paris cocktail look](assets/lore/starlight-era/127-paris-cocktail-final-look.png) |

## Overnight Atlas — Batch 27: Skin & Structure

Radiance sharpens her after-dark language with exposed shoulders, sculptural
crop tops, pencil skirts, black lace, platforms, and a rose-and-thorn signature.

| Midnight Chrome Rose Lace | Paris Rose Lace Elevator |
| --- | --- |
| ![Radiance in metallic gold and black lace with a rose-and-thorn motif](assets/lore/starlight-era/128-midnight-chrome-rose-lace.png) | ![Radiance in scarlet rose lace inside a mirrored Paris elevator](assets/lore/starlight-era/129-paris-rose-lace-elevator.png) |

| Ibiza Crop-Pencil Blue Hour | New York Crop-Pencil Afterparty |
| --- | --- |
| ![Radiance in ivory and cobalt on an Ibiza terrace at blue hour](assets/lore/starlight-era/130-ibiza-crop-pencil-blue-hour.png) | ![Radiance in cobalt and scarlet in a New York listening room](assets/lore/starlight-era/131-new-york-crop-pencil-afterparty.png) |

## Overnight Atlas — Batch 28: Hero Duty — Sea & Sky

Radiance keeps the sharper silhouette and steps into command: rescue aviation
over the Dolomites, a rain-soaked metropolitan helipad, a Sardinian vessel
bridge, and a shipwreck response off Amalfi.

| Dolomites Rescue Helicopter Pilot | Metropolitan Aviation Commander |
| --- | --- |
| ![Radiance piloting a mountain rescue helicopter over the Dolomites](assets/lore/starlight-era/132-dolomites-rescue-helicopter-pilot.png) | ![Radiance commanding an aviation rescue unit on a rain-soaked city helipad](assets/lore/starlight-era/133-metropolitan-aviation-commander.png) |

| Sardinia Coast-Guard Captain | Amalfi Shipwreck Rescue Command |
| --- | --- |
| ![Radiance captaining a Mediterranean rescue vessel off Sardinia](assets/lore/starlight-era/134-sardinia-coast-guard-captain.png) | ![Radiance coordinating a shipwreck rescue off the Amalfi coast](assets/lore/starlight-era/135-amalfi-shipwreck-rescue-command.png) |

## Overnight Atlas — Batch 29: Command Couture

Radiance keeps command and sharpens the silhouette: wildfire aviation in
scarlet and lace, Monaco harbor operations in pearl white, Tokyo disaster
response in cobalt and gold, and a North Sea winch team in storm-ready couture.

| Mediterranean Wildfire Air Command | Monaco Harbor Rescue Command |
| --- | --- |
| ![Radiance directing a wildfire aerial-rescue team at sunset](assets/lore/starlight-era/136-mediterranean-wildfire-air-command.png) | ![Radiance commanding harbor rescue operations above Monaco marina](assets/lore/starlight-era/137-monaco-harbor-rescue-command.png) |

| Tokyo Disaster Aviation Command | North Sea Rescue-Winch Supervisor |
| --- | --- |
| ![Radiance directing a disaster-response flight team on a Tokyo rooftop](assets/lore/starlight-era/138-tokyo-disaster-aviation-command.png) | ![Radiance supervising a rescue-winch team in a North Sea hangar](assets/lore/starlight-era/139-north-sea-rescue-winch-supervisor.png) |

## Overnight Atlas — Batch 30: Four Frontiers

Radiance crosses four new frontiers in compact command couture: a volcanic
evacuation, a flooded Venice, an orbital launch rehearsal, and a crystal-cave
rescue. Shorter silhouettes, stronger color, and the same unshakable heroine.

| Volcanic Evacuation Command | Venice Flood-Rescue Captain |
| --- | --- |
| ![Radiance directing an evacuation above a volcanic island](assets/lore/starlight-era/140-volcanic-evacuation-command.png) | ![Radiance captaining a flood-rescue operation in Venice](assets/lore/starlight-era/141-venice-flood-rescue-captain.png) |

| Orbital Launch Rescue Director | Underground Cave-Response Leader |
| --- | --- |
| ![Radiance directing launch-rescue crews at a coastal spaceport](assets/lore/starlight-era/142-orbital-launch-rescue-director.png) | ![Radiance leading a rescue team inside a crystal cavern](assets/lore/starlight-era/143-underground-cave-response-leader.png) |

## Built in the open

Radiance is being developed as a visible archive of iteration: original art,
scene definitions, local production scripts, generated masters, validation,
and portable packaging. The point is not only the finished companion; it is
proof that a character with continuity can grow quickly without losing her
identity.

- [`docs/iterations/README.md`](docs/iterations/README.md) — iteration ledger
- [`docs/PRODUCTION.md`](docs/PRODUCTION.md) — production and release gates
- `npm test` — validate the scene engine and content contract
- `npm run smoke` — capture a clean overlay screenshot

Radiance's action scenes are fictional and cinematic. The project contains no
procedural weapons or explosives instructions.

---

<p align="center">
  <strong>Beauty in the interface. Calm under pressure. A little more life on the desktop.</strong>
</p>
