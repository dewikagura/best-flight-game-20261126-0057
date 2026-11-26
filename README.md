[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/dewikagura/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/dewikagura/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Cendrawasih Airlift — Papua Bush Courier

A complete flight game that runs offline in a desktop browser from its own
files. You fly a battered old Caravan across the islands of Papua: mail,
eggs, medevacs, night runs, monsoon storms — twelve courier missions, one
airplane, and a lot of short dirt strips.

## Play it

Serve `game/` with any static server and open `game/index.html`, or just
open the file in desktop Chrome. No network, no build step, no downloads:
every script, sound and pixel is in the repository. Sound is synthesised
live with WebAudio (engine, wind, chimes) — click once to let the browser
start audio.

## How to fly

| Key | Does |
| --- | --- |
| ↑ / ↓ (or W / S) | Pitch up / down |
| → / ← (or D / A) | Throttle up / down |
| F | Flaps (0 → 1 → 2) |
| G | Landing gear up / down |
| B or Space | Brakes |
| X | Drop cargo (sea-drop mission) |
| P | Pause · M mute · R restart · Esc menu |

Lift follows your angle of attack: pull back to climb, push forward to
descend, and keep the speed above the stall or the nose drops by itself.
Flaps let you fly slower for short strips; the gear must be down to land.
Watch the wind sock, the fuel gauge and the stall lamp — they are the
difference between a courier and a statistic.

## Flying tips (from the flight model)

- **Takeoff:** full throttle, pull back gently once the speed passes
  40 m/s. The wheels leave the ground around 45 m/s.
- **Cruise:** 50–60 m/s (95–115 kt) at about 60% throttle, pitch near
  level. The wing is happiest there.
- **Approach:** slow to 45–55 m/s, flaps 1, gear down, throttle around
  55–60%. Come down at 300–500 ft/min and flare over the numbers.
- **Stall:** clean wing stalls near 38 m/s, full flaps near 30 m/s.
  If the stall lamp lights and the nose drops, push forward and add
  power — the wing flies again once the speed is back above 42 m/s.
  Never try to climb out of a stall by pulling harder.
- **Short strips:** flaps 2 and brakes (B) stop you in half the
  distance, but flaps 2 at cruise speed is a brick — slow down first.
- **Fuel:** a full tank is about 420–720 kg depending on the mission;
  at cruise you burn roughly 0.7 kg/s. The long haul has a fuel stop
  for a reason.

## The campaign

Twelve missions in four chapters, each with its own weather, cargo and
twist: a calm dawn mail run with a tutorial, a fragile egg delivery, a
storm front with crosswind, a night mail run by runway lights, a 420 m
cliff strip, a timed medevac, a fuel-stop long haul, a mountain pass with
downdrafts, a sea drop onto a boat, a full monsoon, and the four-stop
grand finale from Biak to Merauke. Landings are scored on softness, cargo
condition, time, fuel left and smoothness — three stars if you fly it
clean. Finish a run to unlock the next; best scores are kept on your
machine.

## What is inside

- `game/index.html` + `game/style.css` — the page shell.
- `game/src/flight-model.js` — lift, drag, thrust, stall, wind, ground
  effect, takeoffs and landings.
- `game/src/islands.js` — the seeded island chain, airstrips, villages,
  painted terrain and the four time-of-day palettes.
- `game/src/campaign.js` — the twelve missions, scoring and progression.
- `game/src/cockpit.js` — lit instruments, HUD, guidance and all screens.
- `game/src/scenery.js` — sky, sea, clouds, the built-looking plane and
  the chase camera.
- `game/src/soundscape.js` — synthesised WebAudio: engine, wind, chimes.
- `game/src/controls.js` — keyboard, mouse and the autopilot used for
  screenshots.
- `game/src/boot.js` — the state machine, the fixed-step loop and the
  mission flow.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` and
  writes `dossier.json` (Node 22, standard library only).
- `screenshots/` — four real renders of the game running in a browser.

The look follows the toon field notes: ink outlines in warm brown, one
warm/cool palette per mood, painted surfaces instead of flat colour, dense
set dressing on every island, and a camera that follows with a soft
look-ahead and never fights the pilot.

## Originality

Everything here is original: the idea, the art, the sounds, the names and
the missions. The bird on the tail is a cendrawasih (bird-of-paradise),
Papua's own. No commercial game, character, art or music is copied.

---

Made for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057) · ref `6t1r9fj9`
