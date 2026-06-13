--- start
art: door

The tide has gone out of the old reliquary, leaving its lower halls drowned in still black water. ${G.name}, you came down the shaft for what the guild calls the Sunken Vault — and what the dead called a tomb.

A bronze door waits, green with brine. Someone has scratched a warning into it.

* Read the warning -> inscription
* Ignore it and descend -> vestibule

--- inscription

The scratches resolve into words: *The Warden does not sleep. It drinks the deep and is made whole. Bind it, or break its bracing, or it will outlast you.*

You commit it to memory. Forewarned is half-armed.

* Descend into the vault -> vestibule
  do: flag('warned')

--- vestibule

[[if v.warned]]
The warning rings in your ears as you drop into knee-deep water. A drowned quartermaster's locker hangs open before you.
[[else]]
You drop into knee-deep water. A drowned quartermaster's locker hangs open before you, two relics catching your lamp.
[[end]]

You can take one. Your dagger you keep either way.

* Take the Bronze Tideblade -> hall
  do: give('blade'); equip('blade'); chronicle('Armed yourself with the Bronze Tideblade.')
* Take the Pearl Charm -> hall
  do: give('charm'); equip('charm'); chronicle('Took the Pearl Charm for a steadier breath.')

--- hall

The great hall forks. Lamp-light gutters on water that laps at three passages: a guardroom where something metal still paces, a barred cell, and a silted alcove.

* Force the guardroom door -> guardroom
* Look into the barred cell -> companion
* Search the silted alcove -> alcove

--- companion

A diver named Mara is chained to the cell wall, half-drowned but breathing. "Cut me loose," she rasps, "and I'll watch your back down there. I know the Warden's tricks."

* Cut her chains free -> hall
  do: bond('companion', 2); flag('freed_companion'); chronicle('Cut the diver Mara free; she dives at your back now.')
* Leave her — you work alone -> hall

--- alcove

You rake through the silt and your fingers close on a small glass vial: a salt tonic, the kind divers carry against the cold dark.

* Pocket it and return -> hall
  do: give('tonic')

--- guardroom
art: guardroom
brief: a flooded stone guardroom, a corroded bronze automaton with a halberd grinding upright in waist-deep black water
combat: sentinel
win: gallery
lose: defeat

The guardroom floods to your waist. The Sentinel that paces it has not stopped its rounds in three hundred years.

--- gallery

Past the wrecked Sentinel, a gallery of dead lockers lines the wall. A gilded key hangs at the belt of a skeleton still seated at his post — and you finally understand the Warden's bracing.

[[if v.freed_companion]]
Mara slips in behind you, prying at the lockers, covering the dark.
[[end]]

* Take the gilded key and seek the vault door -> sealeddoor
  do: give('vaultkey'); learn('rend'); chronicle('Lifted the gilded vault key; learned the Rend technique.')
* Gamble — dive the flooded grate
  go: check('body', 10) ? 'sealeddoor' : 'guardroom'
* Flee out through the culvert -> escape

--- sealeddoor

A bronze door, twin to the one above, seals the inner vault. Its lock is a single gilded slot.

* Turn the vault key in the lock -> approach
  req: has('vaultkey') | the lock will not turn without its key
* Withdraw to the gallery -> gallery

--- approach

Beyond the door the water deepens to a black mirror. The Warden's dais waits at its center. You steady your breath.

[[if v.freed_companion]]
Mara checks her pry-bar and nods. "When it sheds its shell, I'll jam the gears. Make it count."
[[end]]

* Drink the salt tonic and descend -> vault
  req: has('tonic') | you have nothing to drink
  do: take('tonic'); gain('hp', 6)
* Descend cold -> vault

--- vault
art: vault
brief: the drowned inner vault, a vast Warden of living brine rising from a black-mirror dais under a ceiling of dead lockers
combat: warden
win: victory
lose: defeat

The Warden unfolds from the dais, brine pouring off it, and the deep goes still.

--- victory
ending: true

!! THE VAULT IS YOURS

The Warden comes apart in the black water and does not knit again. In the quiet that follows you find the reliquary's heart: a single cold pearl the size of a fist.

[[if v.freed_companion]]
Mara surfaces beside you, grinning through the murk. You did not do this alone.
[[end]]

You carry it up into the light.

--- defeat
ending: true

!! THE DEEP CLOSES OVER YOU

The water takes you down past the dais, past the dark, into the long cold the divers warned of. The vault keeps its pearl, and you.

--- escape
ending: true

!! YOU LIVE TO DIVE AGAIN

You haul yourself up through the culvert and break the surface, lungs burning, empty-handed but breathing. The Sunken Vault keeps its secrets. There will be other tides.
