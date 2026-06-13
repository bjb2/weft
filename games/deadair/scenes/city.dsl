--- hub
art: cityhub
brief: a rain-soaked Portland street corner at dawn, wet asphalt reflecting neon and grey sky, a bridge in the distance, a tall robed figure in a grey coat standing under an awning deciding where to go
budget: 0
beat: The recurring decision hub. The city hums; the player chooses which arc to pursue. State-reactive prose reflects the video, suspicion, allies, hunger, and progress. Always offers safe spokes; gates the road trip and the climax behind flags.
The city does not sleep so much as it changes shifts. Rain comes and goes like a tide that cannot commit. You have learned to read it now: the bridges, the river, the long avenues that all run down toward water, the green hills crouched at the western edge where the buildings give out.

And under all of it, always, the hum. You feel it in your fillings, in the staff, in the dark behind your eyes. Nine days now, or ten. You have started to lose the count, which frightens you more than the cold does.

[[if v.went_viral]]
Somewhere in ten thousand pockets, a small video of a sad man with a stick. You catch a stranger's glance held a half-second too long and your stomach drops every time.
[[end]]
[[if v.knows_emf]]
At least you understand the cage now. Iron and current and signal, a net thrown over the whole grid. Knowing the shape of a wall does not pull it down, but it tells you where the door must be.
[[end]]

You have ${v.cash} dollars to your name, a cracked stick of power, and a choice about where to spend the daylight.

* Go to the cafe on the corner -> cafe
* Cross town to the university and find someone who studies the hum -> professor
* Climb to the green dark on the western hills, where the city thins -> forestpark
* Find the man who films the sky and warns the comments -> youtuber
* Sit awhile with the keeper of the all-night corner store -> tariq
* Find somewhere out of the rain to sleep -> shelter
* Work the street for what coin this world runs on -> busk
* The woman in the charcoal suit has been across the road too long. Cross to her. -> agents
  hide: v.suspicion < 4 || v.faced_agents
* Load the van and leave the grid behind for open country -> roadtrip
  hide: !v.has_ride
* Begin the long working that might tear the way home open again -> gather
  hide: !v.shard_charged
* Let the hum in. Sit against a warm wall in the noise until it hollows you. -> hub
  do: spend('composure', 2)
* Stop. You cannot carry the cage one more day. Lie down on the wet brick and let go. -> end_despair
  hide: G.pools.composure.cur > 2

--- cafe
art: cafe
cast: you, mara
brief: inside a warm cluttered corner coffee shop on a grey morning, condensation on the windows, a tired barista with a green apron and silver nose ring leaning on the counter talking to a gaunt bearded man in a grey coat over a paper cup
budget: 520
beat: Elandor meets (or re-meets) Mara the barista by name; she is skeptical but kind; she feeds him and reads him accurately; bond grows; a moral-dilemma fork — tell her the truth (risking her thinking him ill) or keep the secret and accept her ordinary kindness.
The cafe is the first warm place you have stood in since the rift, and warmth, you have learned, is a kind of mercy this city sells by the cup. The windows weep. A machine behind the counter shrieks steam at intervals, and each time it does, the staff at your hip gives a small unhappy buzz, because of course even coffee here runs on the hum.

The woman from the square is behind the counter. Her apron is the green of old moss and stained the brown of every morning she has worked. A name tag, hand-lettered: Mara.

[[if v.met_mara]]
@mara: The wizard. You came back. Most of my disasters don't come back, they just get new and exciting somewhere else. Sit. You look like a coat-rack somebody left in the rain.
[[else]]
@mara: You've been standing in my doorway dripping for a full minute, which is either a medical event or you want something. Sit before you fall down. First cup's on the house. The second one you have to be interesting for.
[[end]]

You sit. The chair holds you, which is more than the morning has done. She sets down a cup of something black and brutal and a roll that is still warm, and she does not ask for the money you do not have, and you feel your throat do something inconvenient.

The cafe holds its own small weather. A spider plant gone leggy in the window. A corkboard furred with flyers for bands and lost cats and rooms to rent, each one a life you cannot have. Two regulars argue gently about a sport over by the milk station, and the machine shrieks, and the warmth works its way into your hands one knuckle at a time, and you understand that you would commit minor crimes to be allowed to keep this chair.

@you: You are kind to a stranger with no coin. In my country this would be remarked upon.
@mara: In your country. Sure. Drink your coffee, Merlin.

She leans on the counter and looks at you the way a vet looks at an animal that bit someone, deciding how much of it is mean and how much is hurt. She is not stupid. She has clocked the robes under the coat, the way you flinch from the steam-machine, the accent that belongs to no map.

@mara: Look. I don't know your deal, and I've decided I don't need to. But you've got the thousand-yard stare of somebody a long way from home with no way back, and I've seen that stare in the mirror, so. The couch in the back is lumpy and the heat works. You can crash a few nights if you sweep up. Don't make me regret being soft.

It is not a throne, but it is the first roof anyone has offered you in this whole humming world, and a magister of the Obsidian Order finds he cannot speak for a moment.

* Tell her the truth — all of it -> cafe_truth
  do: gain('composure', 1); bond('mara', 1); chronicle('Mara fed you and offered her couch. You decided to tell her everything.')
* Take the kindness, keep the secret, sweep her floor -> hub
  do: gain('composure', 2); add('grasp', 1); bond('mara', 1); flag('met_mara'); (has('coat') || give('coat')); chronicle('Mara gave you a couch, a coat, and no questions. You kept your secret and learned the names of small things.')

--- cafe_truth
art: cafe
cast: you, mara
brief: the same coffee shop, the bearded man leaning across the counter speaking urgently and quietly to the skeptical barista, a useless dead spark at his fingertips, her face caught between worry and care
budget: 430
beat: Elandor tells Mara he is a mage from another world; the cafe's electronics smother any proof; she hears him with care but reads it as illness, gently; the cruelty of the EMF rule made personal; she stays kind, bond holds, he carries the cost.
You tell her. Quietly, over the dying steam, you tell her about the Mistral Reaches and the Obsidian Sanctum and the binding that went wrong, about a world of dragons and weather you could command, about a tear in the dark that dropped you into her doorway. You tell her your power lives in you still and only the hum has it by the throat.

And then, because words are nothing here, you try to show her. You cup your hands over the counter and you reach for the smallest light, the bead of teal you found in the dead-end. You reach with everything you have.

The machine hisses. A spark crawls across your knuckles, cold and wrong, and dies. Nothing more. In this warm bright humming room you are exactly as powerful as the spoon in her hand.

You stare at your own empty hands. You have split mountains with these hands. You have held back a flood for the length of a battle. And in a warm room that smells of coffee you cannot summon the light a child could be taught in an afternoon, because somewhere overhead a wire is carrying the city's endless conversation, and that conversation is louder than you are. You have never once in your life been louder than nothing.

Mara watches your hands. She watches your face do the math. When she speaks her voice has gone careful, the voice you would use on a man standing too near an edge.

@mara: Hey. Hey, okay. I believe that you believe it. That's real, what you're feeling, I'm not saying it isn't. But there are people who can help with the part where the world tore open. Good people, not the lock-you-up kind, I know some. Will you let me make a call?

She means it gently and that is the blade of it. You have told the truth to the first kind face in this world and the truth has made you, in her eyes, a man who needs a doctor. The cage is not only around your magic. It is around your word.

@you: You are good, Mara. Better than my proof. Keep your call. I will earn your belief in a quieter place than this.

She does not push. She squeezes your hand once, dry and warm, and goes to pull a shot for a man in a suit, and you sit with the cost of honesty cooling in front of you.

* Drink the coffee. Carry it. Go. -> hub
  do: flag('told_truth'); flag('met_mara'); (has('coat') || give('coat')); bond('mara', 1); spend('composure', 1); chronicle('You told Mara the truth. She heard a sick man, not a mage. She offered a doctor and her couch both. You took the couch.')

--- shelter
art: shelter
brief: a crowded church-basement night shelter lit by humming fluorescent tubes, rows of cots, a gaunt bearded man lying awake on a cot at the edge cupping a faint dying teal glow under a blanket so no one sees
budget: 470
beat: Living rough — a night shelter under humming fluorescents; Elandor hides a glowing rune under a blanket; a small quiet beauty in the dark; the loneliness of the powerless powerful; rest restores composure and he lowers his profile.
The shelter is a church basement that smells of bleach and wet wool and the particular patience of people waiting out a hard season. Cots in rows. A volunteer with a clipboard and a soft voice writes down a name you invent on the spot. Overhead, long tubes of light hum the flat dead note you have come to hate, and you understand that even here, even among the discarded, the cage holds. There is no charity in the current.

You take a cot at the wall. Around you the room settles into its small noises: a cough, a radio turned low, a man two cots down arguing softly with someone who is not there, and you think, without unkindness, that he and you are not so different to the volunteer with the clipboard. Two men insisting on a world no one else can see.

When the lights finally drop to a single emergency bulb across the room, the hum thins, and in the dimness under your blanket you try the bead of light again. It comes, faint and teal and trembling, no brighter than a coal. You hold it cupped in both hands where no one can see, and for a moment the basement is not a basement. It is a campfire on the high passes of home, and the dragons turning slow circles in the cold above, and your old teacher's voice naming the stars. Then a cot creaks and you snuff it, fast, heart pounding, a king hiding a candle.

This is the joke the universe has built for you. The most powerful man alive, learning to disappear. You lie in the dark counting the breaths of strangers and you let the count slow you down, and somewhere before dawn you sleep, which is its own small magic and the only kind that works in a crowded room.

You learn the shelter's grammar fast, because a court taught you to read a room and a room is a room in any world. Who guards a little hoard under the cot. Who is gentle. Who is one bad night from coming apart. The volunteers move among them with a worn-down tenderness that humbles you, these people doing real and unglamorous good with no magic at all, while you, who once raised a keep from bare rock, can offer nothing here but a folded blanket and your place in the breakfast line. There is a lesson in that, and you are not yet ready to learn it.

You wake stiff and rested and harder to find. A man who sleeps in shadows leaves fewer tracks for whoever might be hunting them.

* Fold your blanket and rejoin the day -> hub
  do: gain('composure', 3); set('suspicion', Math.max(0, v.suspicion - 1)); chronicle('You slept in a church-basement shelter, hiding a candle-sized spell under a blanket like a child. You rested. You laid low.')

--- busk
art: busk
brief: a bearded man in robes and a grey coat performing fake magic tricks for a small amused crowd on a wet brick sidewalk, a cracked staff and an upturned hat with a few crumpled dollars, a street musician nearby
budget: 440
beat: Elandor busks for money — the great mage reduced to sleight-of-hand because real magic won't fire near the crowd; a guile check; lean into the viral infamy for fast cash and more suspicion, or do honest invisible work for slow safe coin.
You need money, which is a word this world uses for the right to exist indoors. You have no trade it recognizes. You have, however, a stick, a costume, and a reputation you did not ask for.

So you busk. You, who once held a war-council spellbound, stand on wet brick and do tricks. Real magic is out of the question with a crowd's worth of slabs aimed at you, so you fall back on the oldest art, the one that needs no power at all: the hand is quicker than the eye, the coin is never where they look, the patter matters more than the trick. Your old master would weep. Your old master also never went a day hungry.

A small crowd gathers. They are warmer than the square was. A child gasps when the silver mark vanishes from your palm, and the gasp is real, and it is the first uncomplicated good thing that has happened to you here.

You find the patter comes back faster than you would like. You learned sleight as a boy, before you learned anything true, palming coins for bread in a market town two worlds and forty years from here, and the hands remember even when the heart objects. You make the silver mark walk across your knuckles. You pull a scarf of colored light from your sleeve, which is only a scarf and only the suggestion of light, and the crowd cannot tell the difference and would not care if they could. They want the wonder. They do not audit its source.

A man stops to heckle, sees the cracked staff, says something about the video, and a few phones come up like reeds turning to the sun. Your stomach clenches. This is the knife-edge you live on now: the same fame that fills the hat also draws the eyes you most need to avoid, and every coin you earn as the wizard from the screen is a coin that makes you easier to find. You have traded for armies in your time. You know a poor exchange when you are standing in one.

And yet the child is still there at the front, mouth open, watching the silver mark vanish and return, vanish and return, certain in the way only the young are certain that the world is exactly as strange as it looks. For her sake you make it good. For her sake you are, for ninety seconds, a wizard again, even if the only true magic in the act is that she believes.

* Lean into it — be the wizard from the video, sell the bit -> hub
  do: set('cash', v.cash + (check('guile', 11) ? 30 : 12)); set('suspicion', v.suspicion + 2); add('guile', 1); chronicle('You became the wizard from the video on purpose, for tips. It paid. It also painted a target.')
* Keep your hood up, work quiet, take what honest coin comes -> hub
  do: set('cash', v.cash + (check('guile', 13) ? 18 : 8)); gain('composure', 1); add('grasp', 1); chronicle('You worked the street with your hood up, quiet and forgettable, for honest small coin.')
