--- forestpark
art: forestpark
brief: a vast dark old-growth forest of towering firs and ferns under rain on a hillside above a distant glowing city, a robed figure standing on a muddy trail where a cracked staff blazes with steady teal light for the first time
budget: 520
beat: Elandor climbs into Forest Park, the huge urban forest; the hum fades with each step until the magic comes back clean and steady; the first true working since the rift — overwhelming wonder and grief; he discovers a reliable dead zone inside the city; then the choice to test the limit deeper (where danger waits) or simply let the power breathe.
The bus lets you off at the edge of the trees and you climb. Forest Park is what they call it, a green spine of old forest laid along the city's western ribs, and the deeper you go the more the world you knew bleeds back into the world you are in. The roar of the avenues drops away. The light goes green and underwater. Fir trunks rise like the pillars of a hall built before there were kings to sit in it, and the rain comes down through a hundred feet of branches softened to a whisper.

And the hum dies. Not all at once. It thins with each switchback, each hundred feet of wet earth and root you put between yourself and the grid, until you stop on a muddy trail with the city a far-off rumor below and you realize you can no longer feel it in your teeth. The silence is so total it rings.

You are almost afraid to try. You raise the cracked staff and you speak the drying-cantrip, the apprentice's word, the first thing you ever learned.

The light comes. Steady. Clean. It runs up the yew in a line of cold fire and pools at the broken tip and holds, and the rain around you turns to a fine warm steam, and your robes dry on your body, and the runes stitched into them wake one by one like stars coming out. You are dry. You are warm. You did it with a turn of your wrist, the way you breathe, and your eyes are streaming and you tell yourself it is only the steam.

Forty years you carried this and never once felt it. You feel it now. You feel all of it, the whole drowned weight of who you were, and you stand in a city's forgotten forest and laugh and weep at the same time like the madman they already think you are.

When it passes you are clear-headed and you understand the rule in your bones, not your theory: where the current cannot reach, you are a magister still. The city has thousands of these pockets, surely. Cellars. Tunnels. Dead buildings. The deep woods. A map of silence laid under the map of noise. You have found the door in the wall.

You stand a while longer than you need to, just to be inside the quiet, just to feel the cold clean current of yourself run unobstructed. A bird you do not know answers a bird you do not know. Water finds a hundred small ways down the slope. The dread you have carried since the alley loosens one full turn, because a man with a door can survive almost any wall.

The trail forks. Down one way the trees thin back toward the trailhead and the bus and the warm safe edge of things. Up the other, the old growth deepens into true dark, and from somewhere up there, faint, you hear a sound you know and have not heard since home: a single low toll, like a bell rung underwater.

* Climb toward the tolling and test the limit of your power
  do: flag('found_deadzone'); gain('composure', 3); add('arcana', 1); chronicle('In Forest Park, deep enough that the hum died, your magic came back whole. You wept. You found the door in the wall.')
  go: v.knell_beaten ? 'forestpark_wonder' : 'knell'
* Stay near the tree-line and simply let the power breathe -> forestpark_wonder
  do: flag('found_deadzone'); gain('composure', 4); chronicle('In Forest Park you found a true dead zone and, for once, you did not push your luck. You let the magic breathe and you breathed with it.')

--- forestpark_wonder
art: forestpark
brief: a robed figure sitting peacefully on a mossy log in a rain-misted old-growth forest, small warm conjured lights drifting around them like fireflies, a cracked staff glowing softly, serene
budget: 420
beat: A quiet beauty scene — Elandor rests in the dead zone and does gentle real magic for its own sake; healing and grief; he tests the shard and learns it needs far more open silence to truly charge; resolves to find a place beyond the city entirely.
You find a fallen log gone soft with moss and you sit, and for an hour you are simply a mage in a quiet wood, which is the only thing you ever wanted to be on the days you were honest. You call small lights and let them drift between the ferns like the lantern-flies of home. You mend the crack in the staff a hair's width, just to feel the wood answer. You warm a stone and hold it like a heart.

It is not spectacle. No one will film this. That is the whole of its worth.

You sit with the grief and let it be grief instead of fighting it, which is a thing you never had time for at home, where there was always a binding to hold or a council to win. Here there is only the drip of the canopy and the small lights you have made for no audience but yourself. You think of your apprentices. You think of the dragon you read to sleep, and whether anyone has thought to wake her. You think of how badly you have wanted, the whole of your life, exactly this much quiet and no more, and how you had to fall through the floor of the world to be handed it.

You take out the rift-shard and hold it up, and here, in the silence, it answers. It glows the deep teal of the place between worlds and it drinks the quiet, charging like a vessel held under a slow spring. But only so far. After a while it dims, full as it will go in a pocket this small, and you understand the limit. This forest is a cup of silence inside an ocean of noise. To fill the shard the way the working home would need it filled, you would have to leave the city's whole humming field behind. Real wilderness. Open country. Somewhere the grid has never reached.

You pocket the shard, lighter than you came. The grief is still there. It has just stopped being the only thing in the room.

You sit until the cold finds your bones and the light begins to fail, and then you rise, and pocket the cooling stone, and start the long walk back down toward the place that will switch your power off again at the property line. You go willingly. A man can bear the cage better once he has remembered, in his body, what the open air feels like.

* Walk back down toward the noise, changed -> hub
  do: gain('composure', 2); chronicle('You learned the dead zone has a ceiling. To charge the shard for the working home, you must leave the city entirely. You need open country.')

--- professor
art: lab
cast: you, okafor
brief: a cramped university physics office stacked with papers and old instruments, a sharp grey-haired woman in a corduroy blazer holding a beeping EMF meter toward a bemused gaunt bearded man in a grey coat, a Faraday cage on the bench behind them
budget: 540
beat: Elandor finds Dr. Okafor, a jaded physicist; her instruments spike around the shard; she gives him the scientific frame for the EMF rule (Faraday cages, dead zones, ambient fields); skeptical-but-curious; she becomes an ally and, if he shares enough, helps him grasp how to amplify a working — the seed of the ritual knowledge. Risk of drawing the wrong attention.
Dr. Okafor's office is in the basement of the physics building, which is the only reason she agrees to see the strange man asking strange questions: down here the students do not come, and she is, you gather, between the kind of grants that buy company. She is sixty-some, sharp as a flensing knife, and she has the specific weariness of someone who stopped being surprised by the universe a long time ago and resents that it keeps trying.

The office is a museum of dead ends: a Faraday cage the size of a birdcage on the bench, coils and old oscilloscopes, a poster of the electromagnetic spectrum gone amber at the edges. It smells of solder and cold coffee. She does not offer you a chair, which you respect. She offers you exactly two minutes, which you respect more, because it is the first honest unit of value anyone in this city has named to your face.

@okafor: You said on the phone you wanted to understand electromagnetic interference. People who say that to me usually want me to validate a story about their fillings receiving radio. So. Two minutes. Impress me or leave me to my misery.

You set the shard on her desk. Her meter, idling, jumps. She frowns, taps it, holds it closer, and the needle climbs into a region she clearly does not see often. For a moment the weariness falls off her face and something younger looks out.

@okafor: Huh. That's. Okay, that's not nothing. Where did you get this.

You tell her a careful half-truth: a place very far away, where the air is quiet, where you could do things you cannot do here. And to your surprise she does not reach for the doctor's number. She reaches for a whiteboard.

@okafor: Fine. Forget where. Here's the boring magic, since you like that word. You live inside a field now. Power lines, transmitters, every device, the whole grid, all of it bathing you in electromagnetic noise around the clock. A century ago this city was nearly silent in that band. Now it screams. If whatever you do depends on a clean signal, the city is the worst place on Earth to do it.

She draws a box, and inside the box, a smaller box.

@okafor: A Faraday cage. Conductive shell, and the field can't get in. Dead air inside. You want your quiet? Old buildings with the power cut. Deep rock. A blackout. Get far enough from the grid and the noise floor drops to nothing. The desert. The deep woods. Out there you'd have whatever this is back at full strength, I'd bet money. Which I don't have, on account of the grants.

She caps the marker and looks at you, and the skepticism is back but it has a crack in it now, a scientist's helpless interest in a thing that should not read on her meter.

@okafor: I don't believe you. I want to be clear about that. But I've been bored for nine years and you are not boring. Bring me the data and I'll tell you what it means. That's the only kind of help I've got.

* Show her enough that she sees the shape of the working -> hub
  req: G.eff.grasp >= 2 | you cannot yet explain it in words she would credit
  do: flag('knows_emf'); flag('knows_ritual'); bond('okafor', 2); add('grasp', 1); set('suspicion', v.suspicion + 1); chronicle('Dr. Okafor gave you the science of your cage: a field you live in, and the dead zones where it cannot reach. Between her physics and your lore, you begin to see how the way home might be torn open: resonance, in true silence.')
* Take the theory and keep the shard's secret close -> hub
  do: flag('knows_emf'); bond('okafor', 1); add('grasp', 1); chronicle('Dr. Okafor named your cage in the language of physics: dead zones, noise floors, the silence beyond the grid. You kept the rest to yourself.')

--- youtuber
art: youtuber
cast: you, dev
brief: a cluttered apartment turned video studio, ringlights and monitors and conspiracy corkboard with red string, a wiry young man draped in cameras grinning at a wary bearded man in robes, glowing screens everywhere
budget: 480
beat: Elandor meets Dev (PrismVox), a conspiracy streamer who believes him instantly and dangerously; Dev offers money and reach but wants to film real magic, which would spike suspicion catastrophically; a strategic/moral fork — take Dev's resources at the cost of exposure, or refuse and keep low.
You find PrismVox in a one-room apartment that has been eaten alive by its own equipment. Lights on stands. Screens within screens. A wall of cork and red string connecting photographs you do not understand to headlines you understand even less. His name is Dev. He has not slept in what looks like a presidency, and when he opens the door and sees you he makes a sound usually reserved for religious experiences.

@dev: It's you. It's actually you. The plaza guy, the staff, the — dude, that video, everybody thinks it's a bit, a viral marketing thing, but I ran the audio, the EM signature on that clip is INSANE, it's the same profile as the Cascadia anomalies and I KNEW it, I knew somebody real would —

@you: Peace. Peace, friend. Yes. I am the man with the stick.

He pulls you inside before the neighbors can witness his joy. The room hums like a hive; every device he owns is awake, and your skin crawls, and you understand that for Dev the hum is not a cage, it is a congregation. He lives inside the very thing that strangles you, and he loves it.

@dev: Okay so here's the thing, here's the THING. You do one real spell, on camera, in good light, and we don't drop it for free, we build it, we tease it, I've got forty thousand subs who would lose their minds. We could fund you for a year. You'd never busk again. We just need it on video.

There it is. The oldest trap in this world, dressed as salvation: be seen, be paid, be real at last. And you have learned exactly what being seen costs, and exactly what your magic does in a room that hums like this one. His camera would catch another dead spark and another humiliation, or, worse, if you somehow found a way, it would catch something true and hand it to everyone with eyes.

You look at him properly. Under the equipment and the caffeine he is just a young man who needs the world to be larger than it admits to being, and you, of all the souls alive, cannot fault him for that. He has built a shrine to the hidden true thing, and the hidden true thing has walked through his door, and it is you, and now you must be the one to tell him that the proof he has hunted for years would burn to nothing the instant his lenses found it. The hum that feeds his cameras is the very hum that gags your magic. He is asking you to be a god in the one room least able to permit it.

@dev: Come on. People deserve to know magic is real. I deserve to be the one who proved it. That's not even a bad reason, is it?

* Refuse the camera, but take his help in the shadows -> hub
  do: bond('dev', 1); set('cash', v.cash + 40); add('grasp', 1); chronicle('Dev believed you instantly, which was its own danger. You took his money and his maps of the dead zones, and you kept the camera dark.')
* Give him one careful demonstration for the funding and the reach -> hub
  do: bond('dev', 1); set('cash', v.cash + 80); set('suspicion', v.suspicion + 3); flag('went_viral'); chronicle('You let Dev film you. The money was real. So was the spike of every eye in the city turning, slowly, toward the man who might be magic.')
