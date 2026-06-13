--- gather
art: gather
cast: you
brief: a robed mage standing at a rain-streaked window high over the glowing nighttime city, the charged teal rift-shard burning in his cupped hands, his mended staff beside him, a decision written on his face
budget: 480
beat: The decision point. With the shard charged and the staff whole, Elandor finally holds the way home; reflect his allies, what he has become, and what staying would cost or mean; he must choose to attempt the rift, to stay with deliberate purpose, or to set the working down for a human life.
The shard burns in your cupped hands, a captured star heavy with enough silence to tear a door in the dark, and you stand at a high window over the glowing city you fell into ten days or a lifetime ago, and for the first time since the rift you have a real choice instead of a desperate one.

You have learned this world. You can read its cage now, find its quiet pockets, talk past its watchers, sleep unseen. You know which kindnesses are real.

Ten days. It is absurd that ten days should be enough to remake a man, and they have remade you down to the floor of yourself. The Elandor who fell through the rift would have torn this city apart looking for the door, would have spent its people like coin and never bothered to count them. That man could not have lasted a week here. This one has learned to ask, to wait, to be small, to take bread from a stranger and call it grace. You are not certain you like who the cage made of you, only that he is more worth keeping than the one who arrived.

[[if G.bonds.mara >= 1]]
You think of Mara, who fed a coat-rack she found in the rain and asked nothing.
[[end]]
[[if G.bonds.tariq >= 1]]
You think of Tariq, who drove you to the silence and asked you nothing, who knows exactly what it is to have a door behind you that will not open the same way twice.
[[end]]
[[if v.helped_quietly]]
You think of the man on the rest-stop concrete who breathed because you chose to be seen, and how that was the most like yourself you have felt in this whole humming world.
[[end]]
[[if v.faced_agents]]
And you think of Agent Reyes, patient as rust, and the shielded rooms where they would take such good care of you forever.
[[end]]

Home is dragons and weather and a binding you must still answer for. Here is a couch, a van, a cup of mint tea, and a war with the hum you can never fully win. The shard does not care which you choose. It only waits, burning, for you to decide what kind of exile you are going to be.

You weigh it as you have weighed every grave decision of your life, which is to say badly, with your heart shouting over your reason. To open the rift is to leave the people who saved you without a word of farewell. To stay is to leave a world that needs its magister and a binding only you can answer. There is no clean choice on offer here, only the honest naming of what each one costs, and the strange new freedom of getting to pay it on purpose. The shard pulses against your palms, patient as the tide, and waits for the man you have become to decide.

* Carry the shard back to the deep silence and tear the way home open -> ritual
* Stay, and spend what you are in secret, mending the small broken things here -> end_exile
  do: chronicle('You set the way home aside and chose to stay with a purpose: to be the quiet hand in the dead zones, the one who knows what slips through the tears in the dark.')
* Set the working down. Choose a small human life, with the people who held you. -> end_hybrid
  do: chronicle('You set the shard down still burning, and chose a life here: small, warm, human, and only secretly lit.')

--- ritual
art: ritual
ref: none
cast: you
brief: a robed mage standing in a circle of teal runes blazing on dark stone in a wild silent place beyond the city, the charged shard floating and tearing a vertical seam of light into the night air, the mended staff raised
budget: 460
beat: Elandor performs the great working to reopen the rift in true silence; the Knell is drawn to the massive quiet and may shatter the working if it was never beaten; if his nerve and power hold, the door opens; otherwise the working collapses and he must reckon with staying.
You take the shard back out past the grid, to the wild silence where your whole self returns, and you cut the runes into the black stone and you begin the working that should never be attempted twice in one life. The shard rises from your palm and hangs burning, and you pour ten days of grief and forty years of discipline into the High Tongue, and the air begins to part. A seam of light opens in the dark, vertical, and through it, faint, the howl of the Mistral Reaches and the cold clean smell of home.

You have done large workings before, sieges broken, rivers turned, but never one like this, never a thing that asks you to unmake the wall between two worlds with a splinter of the wall itself. The runes take light as you cut them, teal pooling in the grooves, and the cold of the place between presses out through the widening seam and frosts your breath to silver. Your mended staff sings in your hand, whole and willing. For the length of one held breath the working is beautiful and it is going to succeed, and you let yourself believe it.

And the silence calls its other answer.

[[if v.knell_beaten]]
The Knell comes, drawn to the deepest quiet you have ever made, tolling out of the dark between the trees. But you have faced it, and your staff is whole, and you do not break this time. You hold the seam open with one hand and you shatter the death-herald's charge with the other, and it reels back into the night, and the door holds.
[[else]]
The Knell comes, drawn to the deepest quiet you have ever made, a thing of bell-iron you have never tested, and you have a charged shard in one hand and a working in the other and no hand left for it. Its toll goes through your concentration like a stone through ice. The runes scatter. The seam shudders.
[[end]]

The door is open. The way home hangs in front of you, exactly as wide as your nerve. Now, while it holds, you must step.

Everything in you leans toward the seam. Home is on the far side of an arm's length of torn air: the storms, the order, the unfinished binding, your whole self restored to its proper sky. The shard is spending itself fast to hold the way open, and you can feel the window narrowing, the cold pouring through, the smell of the Mistral Reaches sharp as a remembered name. One step. After ten days of being no one, one step and you are a magister in your own world again.

* Step through, while the way home still holds
  go: (v.knell_beaten && check('arcana', 9)) ? 'end_home' : 'ritual_fail'

--- ritual_fail
art: ritual
cast: you
brief: a robed mage on his knees on dark stone as a seam of light collapses and seals in the night air, the spent shard dimming in his hand, the wild silent country around him, grief and resolve
budget: 380
beat: The rift collapses before he can pass; the shard is spent; the door home is closed, perhaps forever; Elandor must now decide what staying means — a purposeful exile or an embraced human life.
The seam shudders and folds. You lunge for it and your hand closes on cold night air where a moment ago there was the howl of home, and then there is nothing, only the spent shard going grey in your palm and the wild dark settling back around you as if no door had ever been. You used the charge. There is no second star to gather. Whatever this was, it was your one tear in the dark, and it has sealed.

You kneel on the black stone for a long time. The grief is enormous and then, slowly, it is only large, and then it is a thing you can stand up while carrying.

There will be time later to hate yourself properly. Now there is only the cold stone under your knees and the enormous quiet where the door used to be, and the spent shard gone the dull grey of any ordinary pebble, light as a lie in your palm. You came so far. You climbed out of a fountain of a city and learned its cage and charged the silence and stood one step from your own sky, and the silence answered, and the answer was no. Some doors, it turns out, only open the once.

The way home is gone. But you are not gone: you are a magister still, whole, in a world that has dead zones enough to live a life of quiet power in, and people in it who held a stranger out of the rain. Exile is no longer a sentence handed to you. It is a shape you get to choose.

You get to your feet. It costs you nearly everything you have left, and you do it anyway, because a man who can stand up carrying his grief is a man who can still be of use, and use is the only cure you have ever found for despair. The wild dark does not mourn with you. The river goes on. The stars wheel overhead, indifferent and beautiful. Somewhere far below the city hums its endless hum, and you will go back down into it, and you will learn what you are for.

* Choose exile with a purpose — guard the silence, mend what slips through -> end_exile
  do: chronicle('The rift sealed with you on the wrong side of it. You knelt in the dark and chose, at last, to stay with a purpose.')
* Choose a small warm human life, and let the magic be a private thing -> end_hybrid
  do: chronicle('The rift sealed and the way home with it. You stood up carrying it, and chose a quiet human life over a war you could not win.')

--- end_home
ending: true
art: home
ref: none
cast: you
brief: a robed mage stepping through a vertical seam of teal light out of a dark earthly forest into a vast fantasy world of dragons and storm-wracked mountains, looking back once over his shoulder, bittersweet
budget: 340
beat: Bittersweet return home. Elandor steps back into his own world, restored to full power, but carrying the city and its people with him; what he gained and what he leaves; the cost of the door.
You step through, and the cage falls away forever, and the Mistral Reaches take you back into a sky full of weather you can command and dragons turning their slow cold circles overhead. You are home. Your power is a sea again and not a candle hidden under a blanket. The binding still waits, and the Order, and the great unfinished work, and all of it is yours once more.

And you stand on the high passes in your whole strength and you find you are weeping, again, for a humming city you spent ten days hating.

You will tell no one here the truth of where you went, because there is no telling it. Already the city is becoming a thing that happened to you rather than a place, a ten-day fever of rain and humiliation and unlooked-for kindness. But the kindness you will keep. You came back to your own sky a colder and prouder thing than you left it, a worse mage by far, and somehow a better man.

[[if G.bonds.mara >= 1 || G.bonds.tariq >= 1]]
You did not get to say goodbye. There was no way to explain it that would not have sounded like the wizard from the video. Somewhere a couch goes unswept and a van waits at a corner store and two people you cannot reach will wonder, for years, whatever happened to the strange tired man who came in out of the rain.
[[end]]

You are the most powerful man in two worlds and you carry the smaller one home in your chest like a coal you will never quite set down. You learned to disappear. You learned to be helped. You learned what your power was worth in a room where it could not work, which is the only place anyone ever finds out. You raise the mended staff to the storm, and the storm answers, and you go to finish what the rift interrupted, a little kinder than the man who left.

* Begin again -> start

--- end_exile
ending: true
art: guardian
cast: you
brief: a robed figure with a glowing staff standing watch at the dark edge of an old forest above a distant glowing city at night, vigilant and at peace, a quiet guardian
budget: 340
beat: Permanent exile with purpose. Elandor stays and becomes the quiet hand in the dead zones — guarding the silences, hunting what slips through the tears, helping in ways no one will ever credit; loneliness transmuted into vocation.
You stay. Not because you must now, but because you have decided what you are for.

The tears in the dark do not only spit out mages. Other things come through, the Knell and worse, and they go where the silence is, into the deep woods and the dead buildings and the bones of old tunnels, the same map of quiet you alone know how to read. So you become its keeper. You learn every dead zone in a hundred miles. You walk them in your full strength, the most powerful man in the city precisely where the city cannot see, and you put down the things that hunt the silence, and you leave no proof, and you are never thanked.

[[if v.helped_quietly]]
Sometimes, where the air goes thin enough, you steady a stranger who will never know why they lived, and that small mercy is enough, and you have made it be enough.
[[end]]
[[if v.faced_agents]]
Agent Reyes keeps a file that never closes and never quite fills. You have made peace with being a rumor. A rumor cannot be put in a shielded room.
[[end]]

It is a lonely vocation and you chose it with your eyes open. You are an exile with a purpose, which is the only kind of exile that can be borne. On clear nights you stand at the tree-line above the glowing grid, leaning on a whole staff, and you keep the watch no one knows is kept, and the hum, for once, sounds almost like the sea.

You do not pretend it costs you nothing. There are nights when the loneliness is a physical weight, when you would trade the whole of your power for one person who knew your real name and what you are. But you chose the watch over the going-home, and a thing chosen sits lighter than a thing endured, and the work is real even on the nights no thanks ever comes. The valley needs its quiet hand. You have decided to be it.

* Keep the watch -> start

--- end_hybrid
ending: true
art: hybrid
cast: you, mara
brief: a bearded man in an ordinary coat laughing in a warm coffee shop with a barista and a corner-store keeper, a cracked-no-more staff leaning unremarkably in the corner, small private teal light cupped under the table, belonging
budget: 340
beat: The embraced quiet life — a hybrid existence. Elandor lays the great working down and chooses to belong here, keeping small private magic and the people who held him; loneliness across worlds answered not by going home but by making one.
You set the shard down still burning and you do not pick it back up. The way home can wait, or close, or stay a possibility you carry and never spend. Either way, you are tired of being a magister. You would like, for a while, to just be a man who came in out of the rain.

So you stay, and you make the smallest life. You sweep Mara's floor and learn her regulars by their orders. You sit the long nights with Tariq and learn to read labels like poetry on purpose now, for the pleasure of it. You get a name this world will recognize, and papers, and a key to a door that opens the same way twice.

And the magic does not die. It just goes quiet and private and yours. In the dead-air pockets only you can find, in a powerless cellar, in a blackout, you still call the small teal lights and let them drift, and once you brought Mara to a dead zone at last and lit a single flame in the dark in your bare hand, and watched her face change, and finally, finally, was believed.

It is not the life you were born to, this small strange thing with its fluorescent lights and a coffee machine that still makes the staff buzz, and you have come to love it with the particular ferocity of a man who chose it on purpose, out of every world he might have had.

[[if v.told_truth]]
She had been kind to you when she thought you were ill. She is fierce for you now that she knows you are not.
[[end]]

You are the most powerful man alive, and you spend that power on small joys in dark rooms, and you have decided that this is not a tragedy but a home. You built it out of strangers and rain. It will do. It will more than do.

* Live the quiet life -> start

--- end_despair
ending: true
art: despair
cast: you
brief: a gaunt broken bearded man sitting on wet brick against a humming wall under cold neon, a forgotten cracked staff across his knees, crowds passing without seeing him, hollow
budget: 320
beat: The sanity collapse. Worn down by the cage, the humiliation, and the impossibility of proof, Elandor surrenders to despair and becomes exactly what the city decided he was — a delusional man with a stick, unseen, lost.
You stop fighting the hum. It is easier. You sit down against a warm humming wall with the staff across your knees and you let the noise come in and fill the places where the working used to live, and after a while you cannot quite remember the shape of the drying-cantrip, the first thing you ever learned.

The city does not need to lock you away. It has a gentler method. It simply agrees with you less and less until you stop insisting. You become a fixture, a man who talks about dragons, who waves a cracked stick at the transmitters and weeps when nothing happens. People step around you. The video of you was funny once and now it is only sad and mostly forgotten. You are the most powerful man alive in a band of silence you can no longer make yourself walk to.

Some days you are almost content, in the flat way of a fever that has finally broken down into nothing. You stop reaching for the word that will not come. You stop flinching from the slabs. You learn which grates breathe warm air and which doorways stay dry, and you grow very good at being no one, which is the single skill this world ever rewarded you for, and the saddest mastery of your long and storied life.

Somewhere far out past the grid the air is still quiet, and your whole strength is still waiting there for you, a sea behind a door you can no longer find the will to open. The shard goes cold in your pocket. The hum goes on. You sit in it, and it hollows you, and the city flows past, and no one, not one of them, will ever know that a king sat here and forgot he was one.

* Sit in the hum -> start

--- end_taken
ending: true
art: facility
cast: you, reyes
brief: a robed mage standing in a windowless white shielded room conjuring a perfect steady teal flame in his palm while figures in suits watch through thick glass and take readings, powerful and utterly caged
budget: 320
beat: Captured and exploited. The Office takes Elandor into a shielded facility where, ironically, his magic works perfectly — and is studied, owned, and never free; the most powerful man alive, made into an asset behind glass.
Agent Reyes was right that the offer was worse than the threat, and she was right that you were smart enough to know it, and none of that saved you. They take you somewhere clean and quiet, and the cruelest joke of your whole exile is waiting for you there: the rooms are shielded down to nothing, dead air, perfect silence, and so your magic works.

It works beautifully. You stand in a windowless white room and call a flame that burns steady and teal and perfect, and behind the thick glass they take their readings and nod and write, and somewhere a graph finally has the data it wanted. You are not cold, not hungry, never alone, never once unwatched, and you will not leave.

They are not cruel, which is the worst of it. They bring you tea exactly as you like it and they ask you, so politely, to do the thing again, a little brighter this time, for the instruments. You are the most powerful man alive and you have become a reading on someone's screen, a resource, a wonder behind glass. The door opens the same way twice and it only opens for them.

You turn the irony over until it stops being funny, which takes about a week. The whole of your exile you fought to find one room quiet enough to prove what you are, and in the end they simply built it for you, and put the lock on the outside, and now the proof happens daily for an audience that owns the footage.

On the worst nights you call the small teal lights and let them drift around the white room, just for yourself, until a kind voice over the speaker asks what you are doing, and you let them go dark, and you understand that the cage was never the city. The cage was always being seen.

* Do it again, a little brighter -> start
