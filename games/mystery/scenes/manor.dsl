--- start
art: title
:: <h1>${G.def?.meta?.title||''}</h1>
Rain hammers the slates of Ashford Manor. Lord Ashford lies three days dead in the cold
room, and his fortune dangles between three living hands. They sent for you, ${G.name},
because the village constable lost his nerve at the threshold.

The steward meets you under the dripping portico, lantern raised, smile thin as a wire.

* Step inside and begin -> foyer

--- foyer
The great hall swallows the lamplight. Doors lead off in every direction, each one a
question. Somewhere upstairs a clock you cannot see counts down to the reading of the will.

[[if v.met_crane]]
Crane the steward hovers at the edge of the dark, watching which door you choose.
[[else]]
Crane the steward bows you in, then withdraws to watch from the shadow of the stair.
[[end]]

* Search the study -> study
  do: flag('met_crane')
* Search the library -> library
* Descend toward the cellar -> cellar
* Take tea with the family in the parlor -> parlor
* Climb the back stair to the attic -> attic
  hide: !has('key')
* Gather the household and make your accusation -> accuse

--- study
The late Lord's study reeks of pipe smoke and ash. The estate ledger lies open on the
desk, a fresh inkwell beside it. The figures march down the page in two different hands.

* Read the columns closely
  do: check('wits', 13) ? flag('ledger_clue') : note('The figures blur; you cannot fault them.', 'loss')
  go: v.ledger_clue ? 'study_found' : 'study_miss'
* Leave the study -> foyer

--- study_found
You see it at once: a whole column of debts entered after the Lord's death, in a steadier
hand than a dying man could hold. Someone has been writing the estate poorer on paper while
fattening a private purse. You take the ledger.

* Pocket the ledger and withdraw -> foyer
  do: give('ledger')

--- study_miss
The numbers swim. Tired and rain-soaked, you cannot make the columns confess. Perhaps with
a clearer head you might try again.

* Return to the hall -> foyer

--- library
Floor to ceiling with rotting calf-bound spines. A grate of cold ashes holds one survivor:
a half-burned letter, the Lord's seal still legible. *If you alter one figure more, I will
see you hang* — and then the fire took the name of who he meant.

* Rescue the letter from the grate -> foyer
  do: give('letter')
* Leave the library -> foyer

--- cellar
The cellar stair drops into black water-smell and the small sounds of things moving. A
draught snuffs your candle halfway down. To go on you must trust your feet and your nerve.

* Feel your way down into the dark
  do: check('nerve', 12) ? flag('cellar_ok') : note('Your courage fails on the seventh step.', 'loss')
  go: v.cellar_ok ? 'cellar_key' : 'cellar_fail'
* Climb back to the light -> foyer

--- cellar_key
You hold steady. At the bottom, hung on a nail behind the wine racks where no servant would
bother, a brass key still warm from a recent hand. Attic-shaped. You take it and climb.

* Return to the hall with the key -> foyer
  do: give('key')

--- cellar_fail
The dark presses in and your heart bolts. You scramble back up the stairs, candle dead,
hands shaking. Whatever waits below will wait.

* Catch your breath in the hall -> foyer

--- parlor
The family takes tea as though no corpse cools overhead. Lydia, the niece, weeps on cue.
Dr. Mallow, the late Lord's physician, stirs his cup and watches you over the rim. Crane
pours, silent, his sleeves — you notice — stained faintly with fresh ink.

* Press Lydia about her debts -> parlor
  do: note('She inherits least of the three. She knows it, and it frightens her.', 'gain')
  hide: v.read_will
* Press Dr. Mallow about the death -> parlor
  do: note('Heart failure, he insists. He signed the certificate himself.', 'gain')
  hide: v.read_will
* Withdraw to the hall -> foyer

--- attic
Under the eaves, rain drums an inch above your skull. A steamer trunk crouches in the
corner, and your brass key fits its lock as if cut for it.

[[if v.read_will]]
The forged will lies open across your knees: Crane's careful hand mimicking a dead man's
signature, naming Crane himself residual heir.
[[else]]
The lock is stiff with disuse; forcing it will cost what little composure the night has
left you. (Composure ${G.pools.composure.cur}/${G.pools.composure.max})
[[end]]

* Force the trunk open -> attic
  req: G.pools.composure.cur >= 2 | your nerves are too frayed to wrestle the lock
  hide: v.read_will
  do: spend('composure', 2); flag('read_will'); note('Inside: a second will, freshly inked.', 'gain')
* Go back down the stair -> foyer

--- accuse
You ring the bell. Lydia, Mallow, and Crane assemble beneath the cold portrait of the man
they are about to inherit. The clock upstairs stops. Whatever you say now, you say for the
record — and for the rope.

* Accuse Crane the steward
  go: (has('ledger') && has('letter') && v.read_will) ? 'end_solved' : 'end_wrong'
* Accuse Lydia the niece -> end_wrong
* Accuse Dr. Mallow the physician -> end_wrong
* Say nothing. Slip out into the rain and leave them to it -> end_flee

--- end_solved
ending: true
!! THE INHERITANCE UNDONE
You lay them side by side: the doctored ledger, the dead man's threat, the forged will from
the attic trunk. Three threads, one hand. Crane's composure cracks at the word *forgery*; he
is taken in irons before the clock strikes again. The estate passes clean. They will speak
of the night the inspector read a house like a confession.

* Close the case -> start

--- end_wrong
ending: true
!! THE WRONG NECK
You name your suspect with a confidence the evidence cannot bear. The accused goes white,
then furious, then free — your case unravels in open court within the month. The true hand
collects the inheritance and a reputation for grief. You leave Ashford with the rain and
keep, ever after, the cold suspicion that you held the truth and let it slip.

* Live with it -> start

--- end_flee
ending: true
!! THE ROAD AWAY
Some houses are not meant to be solved. You set down the lamp, turn up your collar, and walk
out into the storm without a backward glance. Behind you the will is read; a fortune changes
hands in a manner no one will ever question. You never learn who. You tell yourself that is
mercy. The road does not believe you.

* Walk on -> start
