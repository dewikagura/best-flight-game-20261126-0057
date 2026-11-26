# Cendrawasih Airlift — Island Courier Flight

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?ref=6t1r9fj9)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/dewikagura/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?ref=6t1r9fj9)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/dewikagura/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?ref=6t1r9fj9)

A bush-plane courier game over the Indonesian archipelago, built for the
[best-flight-game](https://make.fun/bounty/best-flight-game-20261126-0057?ref=6t1r9fj9)
bounty on make.fun. Fly a little Cendrawasih (bird-of-paradise) cargo plane
between island strips: thread the ring gates, drop the crate on the painted
target, and put her down gently on the runway — then do it all again on the
next island chain, with stronger wind and tighter rings.

## Play

Open `game/index.html` in a desktop browser. It plays offline — no network
requests, no libraries, no audio files (every sound is synthesised live
with WebAudio).

| Control | What it does |
| --- | --- |
| ↑ / ↓ or W / S | Pitch the nose up / down |
| ← / → or A / D | Throttle down / up |
| Space | Drop the cargo crate |
| P | Pause |
| M | Mute |
| Mouse / touch drag | Steer: up/down pitches, left/right throttles |
| Enter / click | Take off, resume, fly again |

## The flying

Speed makes lift and lift fights gravity, so there is a real trim speed:
push the throttle and she climbs, pull it back and she sinks, and below
stall speed the wings stop flying and she drops. Wind gusts push the nose
around, and a damaged airframe wobbles more. Fuel burns with the throttle,
so every finished mission pays fuel back — run dry over the sea and you
ditch; glide onto a strip and the ground crew refuels you. The HUD shows
score, level, mission, time, fuel, hull, altitude, speed, heading, wind,
rings and combo at a glance.

## Missions

Each level is three missions in a row, and finishing all three opens the
next island chain (three chains in total):

1. **Ring Run** — fly through all 6 gates. Dead centre pays a bonus, and
   clean rings in a row build a combo that multiplies the next reward.
2. **Cargo Drop** — release the crate over the painted target on the strip.
   On target pays most, close pays some, the sea pays nothing.
3. **Island Landing** — touch down on the strip inside the sink, speed and
   pitch limits. A butter-smooth landing pays extra; a hard one bends the
   airframe.

Crash into a hillside, ditch in the sea, or let the mission clock run out
and the run ends — press R to fly again.

## Screenshots

`?shot=cover` mid-flight over the volcano · `?shot=rings` lined up on the
next gate · `?shot=landing` on final approach · `?shot=storm` fighting a
gust in heavy weather. The four screenshots in `screenshots/` are real
renders of this game's own code at those states.

## Build

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` into `$MAKEFUN_OUTPUT_DIR`, checks the screenshot caps,
and writes `dossier.json` with the kit's `buildDossier`:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

## Licence

MIT — see [LICENSE](LICENSE).
