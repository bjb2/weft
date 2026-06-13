// Voice config for Dead Air (merged over src/writing/rules.js).
// Second person; present for the city, past for the world he lost. The narrator
// owns a few load-bearing theme words; cap them so they stay motifs, not tics.
export default {
  pov: "second",
  tense: "present for action, past for memory",
  // "the hum" and "the cage" are the central images of the EMF premise; "dead
  // zone" and "the rift" are its machinery. They recur on purpose. Generous caps
  // keep them from drifting into verbal tic territory without fighting the theme.
  motifs: {
    "hum": { perFile: 32 },
    "cage": { perFile: 24 },
    "shard": { perFile: 22 },
    "silence": { perFile: 24 },
  },
};
