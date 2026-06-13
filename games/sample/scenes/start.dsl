--- start
art: title
:: <h1>${G.def?.meta?.title||''}</h1>
You stand at the trailhead of a story not yet written. ${G.name}, the road forks.

* Take the high road -> high
* Take the low road
  do: flag('met_stranger')
  go: "low"

--- high
You climb. The air thins; the view opens. There is nothing here yet but possibility.

* Make a small wager on yourself -> end_high
  req: G.eff.nerve >= 1 | needs steady nerve
  do: check('nerve', 8) ? bond('fortune', 1) : note('The dice cool.', 'loss')
* Turn back -> start

--- end_high
ending: true
!! AN ENDING — THE HIGH ROAD
You reached the summit of the smallest possible story. Replace this with your own.

* Begin again -> start

--- low
[[if v.met_stranger]]
A stranger falls into step beside you and says nothing, which is somehow companionable.
[[else]]
You walk alone.
[[end]]
The low road ends, for now, at a quiet ending.

* Rest here -> end_low

--- end_low
ending: true
!! AN ENDING — THE LOW ROAD
A short, complete thread. Now make it longer.

* Begin again -> start
