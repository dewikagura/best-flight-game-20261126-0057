// campaign.js — the Cendrawasih Airlift campaign: 12 courier missions across
// Papua in four chapters. Each mission has its own weather, cargo, time of
// day and twist, so flying is a series of different decisions, not one
// repeated hop. Scoring rewards soft landings, gentle cargo handling, time
// discipline and fuel left over.
var CA = window.CA || (window.CA = {});

CA.Campaign = (function () {
  var CHAPTERS = ['First Light', 'The Trades', 'Storm Season', 'The Long Haul'];

  // legs: island hops. distKm is the leg length, stripLen the runway in
  // metres, mountain marks a high island (valley flying).
  // Geometry worth knowing: distKm also sets that leg's island length
  // (islands.js builds len = max(4200, distKm * 1000)), so a 14 km leg is
  // a 14 km island, not a 14 km sea gap. The first leg's strip is the
  // DEPARTURE strip (near the start of the first island); every later
  // leg's strip sits near the far end of its island. The game starts on
  // leg index 1 — island 0 is home, island 1 is the first destination.
  var MISSIONS = [
    { id: 'm01', chapter: 0, name: 'First Light', cargo: 'Mail sacks',
      brief: 'Your first run: lift the mail out of Biak at dawn and set it down gently on Numfor. Calm air, long grass strip. Learn the plane before the weather does.',
      tod: 'day', wind: 2, gust: 1, rain: 0, fog: 0, fuel: 420, par: 200,
      legs: [{ name: 'Biak', distKm: 9, stripLen: 900 }, { name: 'Numfor', distKm: 0, stripLen: 900 }] },
    { id: 'm02', chapter: 0, name: 'Mail Run', cargo: 'Parcels + mail',
      brief: 'Two stops before lunch: Numfor to Manokwari, then on to a beach strip at Ransiki. Keep the throttle honest and the clock will be kind.',
      tod: 'day', wind: 4, gust: 2, rain: 0, fog: 0, fuel: 460, par: 260,
      legs: [{ name: 'Numfor', distKm: 10, stripLen: 900 }, { name: 'Manokwari', distKm: 11, stripLen: 800 }, { name: 'Ransiki', distKm: 0, stripLen: 800 }] },
    { id: 'm03', chapter: 0, name: 'Fragile Eggs', cargo: 'Village eggs, 40 crates',
      brief: 'Forty crates of eggs for the Raja Ampat market. Every hard bank and every firm touchdown costs you breakfast. Fly like the cargo is asleep.',
      tod: 'day', wind: 3, gust: 2, rain: 0, fog: 0, fuel: 440, par: 240, fragile: true,
      legs: [{ name: 'Sorong', distKm: 12, stripLen: 850 }, { name: 'Raja Ampat', distKm: 0, stripLen: 750 }] },
    { id: 'm04', chapter: 1, name: 'Storm Front', cargo: 'Medical supplies',
      brief: 'A front is coming in off the Banda Sea. Rain on the windscreen, a crosswind at Kaimana, and a clinic waiting. Crab into the wind and plant it straight.',
      tod: 'storm', wind: 9, gust: 7, rain: 0.7, fog: 0.25, fuel: 460, par: 280,
      legs: [{ name: 'Fakfak', distKm: 13, stripLen: 800 }, { name: 'Kaimana', distKm: 0, stripLen: 800 }] },
    { id: 'm05', chapter: 1, name: 'Night Mail', cargo: 'Mail + spare parts',
      brief: 'The mail does not wait for sunrise. Fly the night leg to Timika by instruments and runway lights. The dark is luminous out here — trust the gauges, not your eyes.',
      tod: 'night', wind: 3, gust: 2, rain: 0, fog: 0.1, fuel: 460, par: 280,
      legs: [{ name: 'Kaimana', distKm: 14, stripLen: 850 }, { name: 'Timika', distKm: 0, stripLen: 900 }] },
    { id: 'm06', chapter: 1, name: 'Short Strip', cargo: 'Coffee beans',
      brief: 'Ilaga strip is 420 metres of dirt on a cliff edge, with a drop at both ends. Come in slow, full flaps, brakes ready. There is no go-around twice.',
      tod: 'day', wind: 5, gust: 3, rain: 0, fog: 0, fuel: 420, par: 230,
      legs: [{ name: 'Timika', distKm: 11, stripLen: 900 }, { name: 'Ilaga', distKm: 0, stripLen: 420, mountain: true }] },
    { id: 'm07', chapter: 1, name: 'Medevac', cargo: 'One patient, one nurse',
      brief: 'A patient in Ilaga needs the hospital in Wamena, and the clock is the disease. Fly fast but fly smooth — a sick passenger feels every bump twice.',
      tod: 'dusk', wind: 4, gust: 3, rain: 0, fog: 0.15, fuel: 440, par: 210, medevac: true,
      legs: [{ name: 'Ilaga', distKm: 12, stripLen: 420, mountain: true }, { name: 'Wamena', distKm: 0, stripLen: 800, mountain: true }] },
    { id: 'm08', chapter: 1, name: 'Fuel Stop', cargo: 'School books',
      brief: 'Wamena to Nabire is too far on one tank with the headwind. Plan the stop at Enarotali: land, refuel, lift again. Running dry over the highlands is not an option.',
      tod: 'day', wind: 7, gust: 3, rain: 0, fog: 0, fuel: 420, par: 320, refuel: true,
      legs: [{ name: 'Wamena', distKm: 12, stripLen: 800, mountain: true }, { name: 'Enarotali', distKm: 13, stripLen: 700, mountain: true }, { name: 'Nabire', distKm: 0, stripLen: 850 }] },
    { id: 'm09', chapter: 1, name: 'Mountain Pass', cargo: 'Survey gear',
      brief: 'The direct line to Paniai goes through a valley between two ridges. Downdrafts live in the pass. Stay in the middle, keep your speed up, and do not chase the wind.',
      tod: 'day', wind: 6, gust: 5, rain: 0.15, fog: 0.2, fuel: 440, par: 280,
      legs: [{ name: 'Nabire', distKm: 13, stripLen: 850 }, { name: 'Paniai', distKm: 0, stripLen: 700, mountain: true }] },
    { id: 'm10', chapter: 2, name: 'Sea Drop', cargo: 'Relief crates for a boat',
      brief: 'A fishing boat is taking on water east of Serui. Drop the relief crates into the ring beside her — low, slow, steady — then land at Serui. The ring is the runway this time.',
      tod: 'dusk', wind: 6, gust: 4, rain: 0.3, fog: 0.1, fuel: 460, par: 300, airdrop: true,
      legs: [{ name: 'Paniai', distKm: 12, stripLen: 700, mountain: true }, { name: 'Serui', distKm: 0, stripLen: 800 }] },
    { id: 'm11', chapter: 2, name: 'Monsoon', cargo: 'Generator + fuel drums',
      brief: 'The monsoon arrived early. Heavy rain, gusts that shove the tail, and a strip that is more river than runway. This is the one the old pilots talk about.',
      tod: 'storm', wind: 12, gust: 9, rain: 1, fog: 0.35, fuel: 480, par: 320,
      legs: [{ name: 'Serui', distKm: 14, stripLen: 800 }, { name: 'Biak', distKm: 0, stripLen: 900 }] },
    { id: 'm12', chapter: 2, name: 'The Long Haul', cargo: 'Everything, everywhere',
      brief: 'The grand finale: Biak to Merauke, four stops, dawn to dusk, every kind of weather Papua owns. Fly the whole chain and the route is yours.',
      tod: 'day', wind: 5, gust: 4, rain: 0.2, fog: 0.15, fuel: 720, par: 620,
      legs: [{ name: 'Biak', distKm: 11, stripLen: 900 }, { name: 'Nabire', distKm: 12, stripLen: 850 }, { name: 'Timika', distKm: 13, stripLen: 900 }, { name: 'Merauke', distKm: 0, stripLen: 900 }] }
  ];

  function missionById(id) {
    for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i];
    return MISSIONS[0];
  }

  // Score one completed leg-landing. Returns {total, stars, parts}.
  function scoreLanding(m, plane, timeSec, legsDone, legsTotal) {
    var parts = {};
    var vs = plane.touchdownVs;
    parts.landing = vs < 1.2 ? 300 : vs < 2.5 ? 260 : vs < 4 ? 200 : vs < 6.5 ? 120 : 40;
    parts.cargo = Math.round(plane.cargoHealth * 2.5); // 0..250
    var timeBonus = Math.max(0, Math.round((m.par - timeSec) * 1.5));
    parts.time = Math.min(200, timeBonus);
    parts.fuel = Math.round((plane.fuel / m.fuel) * 150); // 0..150
    parts.smooth = Math.round(plane.smoothScore); // 0..100
    var total = parts.landing + parts.cargo + parts.time + parts.fuel + parts.smooth;
    var stars = total >= 850 ? 3 : total >= 650 ? 2 : 1;
    return { total: total, stars: stars, parts: parts, legsDone: legsDone, legsTotal: legsTotal };
  }

  // Best results, guarded so a denied store never breaks the game.
  var store = {
    read: function () {
      try {
        var raw = window.localStorage.getItem('cendrawasih-airlift-v2');
        return raw ? JSON.parse(raw) : { best: {}, unlocked: 1 };
      } catch (e) { return { best: {}, unlocked: 1 }; }
    },
    write: function (data) {
      try { window.localStorage.setItem('cendrawasih-airlift-v2', JSON.stringify(data)); } catch (e) {}
    }
  };

  return { CHAPTERS: CHAPTERS, MISSIONS: MISSIONS, missionById: missionById, scoreLanding: scoreLanding, store: store };
})();
