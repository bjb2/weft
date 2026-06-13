--- tariq
art: store
cast: you, tariq
brief: a warm cluttered all-night corner store at 3am, shelves of bright packaging, humming glass coolers, a calm older man with a grey moustache and cardigan behind the counter offering tea to a tired bearded man in a grey coat
budget: 500
beat: Elandor sits with Tariq, an immigrant corner-store keeper who left his own country and recognizes exile when he sees it; a deep platonic scene about loneliness across worlds; Tariq does not need to believe the magic to understand the man; he offers his van — a way out of the city — and quiet friendship.
The corner store hums like everywhere else, the coolers breathing their cold electric breath, but the man behind the counter has made an island of it. There is a kettle. There is a stool he pushes toward you without being asked. There is, taped by the register, a photograph of a hillside town the color of honey that is plainly not in this country.

@tariq: You come in three nights now. You buy nothing. You stand by the warm cooler and you read the labels like they are poetry. I am Tariq. Sit. The tea is mint, it is good, and you look like a man who has forgotten the taste of a thing made by hands.

You take the stool. The tea is hot and sweet and it undoes something in your chest. Tariq does not pry. He restocks cigarettes and rings up a man buying lottery tickets and comes back to you, unhurried, a person whose whole trade is the long patient night.

@tariq: You have the look. I know it because I wore it. I came here twenty-two years ago from a place I cannot go back to, and for the first year I also read the labels like poetry, because they were the only thing that would hold still and let me understand them. Everyone here is from somewhere they cannot return to. We just do not all admit how far.

@you: My somewhere is farther than most.

@tariq: They are all the farthest, to the one who left. Distance is not the thing. The thing is the door behind you that does not open the same way twice.

He says it plainly, refilling your cup, and you feel seen in a way none of your spells ever managed, by a man who has not the faintest idea what you are. He does not ask you to prove anything. He has decided you are a person who is tired and far from home, and that is enough fact for him to act on.

@tariq: I have a van. It is old, it complains, but it goes where the buses do not. The mountains, the river, the empty places. Sometimes I drive out on my night off just to stand where it is dark and there is no one to sell anything to. If you need to get out of this city for a while, to somewhere quiet, you tell me. I will drive. We do not even have to talk. Sometimes the not-talking is the whole medicine.

A way out. Open country, beyond the grid, beyond the hum. The thing the forest taught you that you needed, offered over a paper cup of mint tea by a man who simply recognized a fellow exile.

* Accept the offer, and the friendship under it -> hub
  do: flag('has_ride'); bond('tariq', 2); gain('composure', 3); add('grasp', 1); chronicle('Tariq, who left his own country twenty-two years ago, offered his van and his quiet. He does not know what you are. He knows what you carry. It is the same thing.')
* Thank him, but keep your distance — he could be hurt by knowing you -> hub
  do: bond('tariq', 1); gain('composure', 1); chronicle("Tariq offered his van and his friendship. You kept him at arm's length to keep him safe, and hated that you had to.")

--- knell
art: knell
brief: deep in pitch-dark old-growth forest at night, a tall thin wrong-shaped figure of grey mist and hanging bell-iron standing among the firs, its head a cracked bronze bell, facing a robed mage whose cracked staff blazes teal in the dead-zone silence
budget: 470
beat: The Knell — a death-herald creature that came through the rift and hunts in the silent dead zones where it, like Elandor, has full power; a confrontation of real magic for the first time; an arcana check decides whether he drives it off or barely escapes; the terrible irony that his only safe places are now the monster's hunting grounds.
You climb toward the toll, and the toll climbs toward you, and you meet it in a stand of firs so old and so dark that no light from the city has reached here in a thousand years. It is the most silent place you have found. It is therefore the most dangerous, and you understand why only when you see what is waiting.

The Knell. It came through with you, or after you, drawn through the same tear in the dark. You knew its kind at home, where the death-heralds toll on the night a great one dies. Here it has found what you have found: that in the dead air, it too is whole. A tall wrongness of grey mist hung with bell-iron, its head a cracked bronze bell, and where it steps the silence deepens until your own heartbeat sounds obscene.

It tolls once, and the note goes through your bones and tells you, in the old plain grammar of bells, that it has been hunting the quiet places, and the quiet places are exactly where you must go to ever get home, and so the two of you were always going to stand here.

You have stood across from death-heralds before, in the proper world, where they were rare and terrible and bound by old law to toll once and then depart. This one is bound by nothing. It came through the same wound you did, and like you it has spent ten days learning that this world keeps rules its own kind never imagined, and like you it has found the loophole: the silence, the dead places, the pockets where the old powers still answer. You were never the only thing that fell out of the sky; you were only the one who landed believing himself alone.

No witnesses. No slabs. No hum. For the first time since the rift, you may use everything you are.

You plant the cracked staff and you stop being a busker.

The fear is enormous, and it is also, distantly, a relief. For ten days you have been a joke, a wet man with a stick, smothered and filmed and pitied. Here at last is a thing that takes you seriously, a thing worth the whole of your art, and some old soldier in you stands straight for the first time since the rift. Whatever happens in the next minute, it will be true. The staff is cracked and you are far from your best, but in this one black wood, for this one moment, you are entirely yourself again.

* Strike with the full weight of the Obsidian Order
  do: gain('composure', 1)
  go: check('arcana', 11) ? 'knell_won' : 'knell_lost'

--- knell_won
art: knell
brief: a robed mage standing victorious in a dark forest as a figure of grey mist and bell-iron dissolves and flees between the trees, the mage's cracked staff blazing teal, fierce and shaken
budget: 360
beat: Elandor drives the Knell off with true magic; victory, but it flees rather than dies, and he learns it will keep coming, drawn to the same silence he needs; stakes raised — his sanctuary and his hunting ground are one.
You speak the Word of Unsealing and this time, in the dead air, the world obeys. Force leaves you in a line of cold teal fire and the Knell's bell-iron rings and cracks and the grey mist of it shreds like fog in a gale. It does not die. Its kind does not die so easily. It comes apart into the dark between the trunks, tolling its retreat, and the silence it leaves is clean again and yours.

For a moment you simply breathe in the after-quiet, staff still lit, the cold teal throwing your shadow huge against the firs. You had forgotten this feeling, the clean exhaustion of power well spent, the particular hush that follows a thing done right. Your hands are steady now. The crack in the yew smokes faintly where the working forced through it, and you make a note, somewhere beneath the triumph, that the staff failed you on precision at the worst possible instant and will have to be mended before you trust it with your life again.

You stand shaking with the staff blazing in your fist, more alive than you have felt since home, and underneath the triumph a cold understanding settles. It will heal. It will come again. And it will always find you in the same places you must go to be whole, because silence calls to both of you. Your sanctuary is its hunting ground. You have won a wood you can never quite rest in.

You think of the dead zones laid across the city like a secret map, every one of them now a place you must enter armed and leave quickly. The forest you wept in this afternoon is the same forest you will fear tonight. There is no clean refuge anymore, only borrowed quiet with a thing in it that knows your name. You start down the dark trail, listening behind you the whole way. And the city's hum, when it rises to meet you at the trailhead, sounds for the first time almost like a wall, and a wall, tonight, is a thing you are absurdly grateful for.

* Carry the victory and the warning back down -> hub
  do: flag('knell_met'); flag('knell_beaten'); add('arcana', 1); chronicle('Deep in the dead zone you fought the Knell, the death-herald that followed you through, and drove it off with real magic. It did not die. It will find you wherever the air goes quiet. Your only refuge is also its hunting ground.')

--- knell_lost
art: knell
brief: a robed mage scrambling backward down a dark muddy forest trail away from an advancing figure of grey mist and bell-iron, his cracked staff guttering, terror, the city lights far below
budget: 360
beat: The working falters even here; the Knell drives Elandor off; he escapes wounded in spirit, the dread compounding; heavy composure cost; he learns the creature's strength and that the cracked staff betrays him at the worst moment.
You speak the Word and the dead air should have made it a hammer. But the staff is cracked, and the crack chooses now to matter. The force that should have shredded the Knell stutters through the broken yew and comes out wrong, half of it, sideways, and the bell-iron only rings and rolls toward you unbroken.

The toll hits you full in the chest, the death-note, and your knees go and your courage with them. You run. A magister of the Obsidian Order turns and scrambles down a muddy trail in the dark with a death-herald tolling behind him, and the only mercy is that the Knell, having driven you off its silence, does not bother to chase a thing already this broken.

There is a particular shame in running, and you taste all of it. Not the clean ache of a fair fight lost, but the sick knowledge that your own instrument failed you, that the crack you have been nursing like a hangnail is the whole difference between a magister and a corpse. You should have mended it. You had the silence and the hours and you spent them weeping at pretty lights instead, and the wood remembered your neglect at the exact moment your life turned on it.

You sit on the cold curb until the shaking stops. Joggers pass. A bus sighs at the stop and pulls away. None of them can see the death-herald pacing the tree-line a quarter mile up the hill, kept back only by the very hum that keeps your power down, the two of you fenced apart by a wall that cages you both. You understand now that the staff's wound is not cosmetic, that the dead zones you need are the only ground that thing can reach you on, and that you cannot go home until you have made yourself whole enough to cross that wood alive.

You come out at the trailhead under the buzzing lights and the hum closes over you, and for once you are grateful for the cage, because the Knell will not follow you into the noise. Neither will your power. You trade one prison for the other and you sit on the curb and shake.

* Limp back into the loud safe city -> hub
  do: flag('knell_met'); spend('composure', 5); chronicle('The cracked staff betrayed you. The Knell broke your nerve and drove you out of the dead zone. You fled into the hum, where it cannot follow, and neither can you do anything at all.')

--- agents
art: agents
cast: you, reyes
brief: a grey government sedan and a composed woman in a charcoal suit with a lanyard badge showing a tablet to a wary bearded man in a grey coat on a rainy street corner, the tablet displaying the viral video and EM readouts
budget: 460
beat: The Office, in the person of Agent Reyes, has noticed the anomaly and put a face to it; she is calm, reasonable, and far more dangerous than a threat; a guile check decides whether Elandor talks his way clear or is taken into a quiet program that will study and exploit him.
The woman in the charcoal suit does not run when you cross to her, which tells you everything. People who chase you are afraid of losing you. People who wait for you have already decided they have you. She holds up a tablet, and on it is the plaza video, and beside it a graph of something spiking, and she lets you look at both before she speaks.

@reyes: Agent Reyes. I'm not with the people who'd make a scene. We're quieter than that. We've been watching a class of electromagnetic anomalies in the Pacific Northwest for some years, and about ten days ago they started having a center, and the center has your face. I'm not here to arrest you. I'm here to make you an offer, which is so much worse, and I think you're smart enough to know it.

She is calm and she is kind in the way of a person who has read the manual on being kind, and your skin crawls worse than near any transmitter. She is the hum given a face. She is the cage with a pension and a parking spot.

You have bargained with worse than her. You have sat across fire-pits from warlords and across cold marble from kings, and you learned young that the most dangerous person in any room is the one who is not angry. Reyes is not angry. Reyes has a budget and a mandate and patience without a bottom to it, and she has decided, with the serene certainty of an institution, that you are already hers and have merely not finished arriving. The terrible thing is how good the offer sounds. A bed. Warmth. Quiet you could do real work in. You are so tired, and the tiredness makes its own argument, whispering that surrender would at least be rest. You let it whisper. Then you remember the shielded rooms, and the door that locks from outside, and the plain fact that a wonder behind glass is still behind glass.

@reyes: Come in voluntarily. Clean facility, no charges, all the quiet you could want — we have rooms shielded down to nothing, did you know that, rooms where I'm told a man might do remarkable things. We'd take such good care of you. You'd never be cold again. You'd just never leave.

The offer hangs there, reasonable and total. Behind your ribs the shard has gone very cold. You have one move, and it is not magic, because the street hums and her car hums and the cage is everywhere out here. It is words. It is the oldest spell of all.

* Talk your way clear — be too dull, too mad, too poor to be worth the file
  do: flag('faced_agents'); set('suspicion', v.suspicion + 1); spend('composure', 2)
  go: check('guile', 13) ? 'hub' : 'end_taken'
* Refuse her flatly and walk, and pray the hum hides you in the crowd -> hub
  req: G.eff.guile >= 3 | you do not yet have the nerve to simply walk from a federal offer
  do: flag('faced_agents'); set('suspicion', v.suspicion + 2); spend('composure', 1); chronicle('You walked away from Agent Reyes and the Office. You felt her watching you the whole length of the block. The clock is running now.')
