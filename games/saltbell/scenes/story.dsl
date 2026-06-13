--- start
art: pass
budget: 220
beat: The courier reaches the Salt-Iron Pass at dusk, carrying a sealed letter for the dying sect above; establish the cold, the salt taste, the weight of the errand.
You reach the pass at dusk, and the cold comes up to meet you like something owed. They call it the Salt-Iron Pass because the rock tastes of both: lick the wind and you get brine and old blood, the breath of mines that bled out a century ago and never quite healed. The road narrows to a ledge. Below, the valley fills with blue shadow. Above, where the last light still clings, a cluster of roofs leans against the mountain like a hand cupped to catch rain.

In your coat, against your ribs, the letter. You have carried heavier things, and lighter things that weighed more. The wax seal is the colour of dried blood and bears no name on its face, which is its own kind of message. A man paid you in the lowland market, counted the coins twice, and would not meet your eye. Carry it, he said. Do not read it. Do not ask. The first two are easy.

The salt gets into the cut on your knuckle and wakes it. Far up the slope a sound is gathering, low and iron, the way a held breath gathers before a word. You tell yourself it is only the wind in the empty shafts. You do not believe it, and you climb anyway, because the road runs one direction and you were paid for the one direction.

* Climb toward the sect -> ascent

--- ascent
budget: 200
beat: The climb up the notch; the bell tolls once across the valley; the courier's first doubt about what the sealed letter carries.
The path bends back on itself, switchback after switchback, and at each turn the air thins and the salt sharpens. Your legs learn the grade; your lungs argue with it. Pilgrims wore these steps once, when the sect was large enough to draw them. Now the stone is furred with moss and the prayer-posts have rotted to grey stubs, their banners long since taken by weather.

Halfway up, the bell speaks.

One note. It rolls across the valley and comes back off the far wall a moment later, doubled, so that the single stroke sounds like a question and its own answer. You stop with one hand on cold rock. You do not know this sect's customs, but you know the grammar of bells everywhere: one stroke is not a summons. One is a counting. Someone above is keeping a tally, and the letter at your ribs feels suddenly like a thing with an opinion about the number.

You could turn back. The man paid for delivery, not for arrival, and that difference has saved couriers before. But the roofs are close now, and the cold behind you is worse than the cold ahead, and curiosity is a debt you always seem to pay in full. You climb the last stretch toward the gate.

* Keep climbing to the gate -> gate

--- gate
art: gate
budget: 240
beat: Ren the gatekeeper bars the way with a staff and a riddle; the courier may answer the riddle or buy past with a coin.
The gate is less a gate than the idea of one: two posts, a crossbar, and a man sitting beneath it with a bamboo staff laid across his knees like a closed conversation. He is lean as a winter dog and just as unbothered by you. He does not rise.

@ren: Long road for a door that is not locked. The door's open. It's me you have to get past. Ren, they call me. I keep the gate because someone has to, and because the old man inside can no longer tell a friend from a debt-collector by the sound of their feet.
@you: I carry a letter. That is all.
@ren: Everyone carries something up this road. Some of them even admit to it.

He taps the staff once on the stone, thinking. Then he offers you the bargain he offers everyone, easy as pouring tea.

@ren: Answer me one question and pass for free. Or pay the toll and pass for coin. The question is cheaper, and it costs more. What do you carry that you would be lighter without, and heavier for having dropped?

The salt wind fills the silence where your answer should go. You understand the shape of it. He is not asking about the letter at all. He is asking whether you know what you are.

* Answer the riddle -> hall
  do: set('paid_ren', false)
* Press a coin into his hand -> hall
  do: flag('paid_ren'); chronicle('You bought your way past the gate.')

--- hall
art: hall
budget: 260
beat: Master Lou receives the courier in the bell-hall, names the letter's weight, and lays the choice bare — deliver it sealed, read it, or burn it.
The hall is colder inside than out, the cold of stone that has not held a crowd in years. The salt-iron bell hangs at the far end, black with age, broad as a cart-wheel. Beneath it, on a low cushion, sits the master of the Mirror-Bell Sect. His eyes are clouded to milk. He does not turn them toward you, because he has no need to.

@lou: You may set it down. The letter. You have been carrying it as though it were a live coal.
@you: You know what it is.
@lou: I know what it weighs, which is the only honest measure of a letter. They rang the bell when you reached the switchbacks. One stroke. A counting. I am being counted, courier, and the man who sent you keeps a long memory behind a short patience.

He lifts one hand, palm up, neither demand nor plea.

@lou: So. The truth of your errand, since you have half-guessed it already. Inside that wax is the date of my death, or its pardon. I am forbidden to read it; the sender forbade it, and his reach is longer than this valley. But you are no one. A hired pair of hands. Whatever you do with it, he cannot punish a road for where it happens to lead.

The bell breathes its low note above you both, stirred by nothing you can feel. Master Lou waits with the calm of a man who has already outlived one of his own funerals.

@lou: Deliver it sealed, and let the wax decide. Read it, and carry the knowing back down alone. Or burn it here in the bell-fire, and answer to no one but the flame.

* Deliver the letter sealed -> end_deliver
* Break the seal and read it first -> end_read
  do: flag('read_letter')
* Burn it in the bell-fire -> end_burn

--- end_deliver
ending: true
budget: 180
beat: The courier delivers the letter sealed; the bell rings once; the quiet weight of having carried, not chosen.
You set the letter in his open hand. The wax has gone soft against your body through the long day; his thumb finds the seal and does not break it. For a while he only holds it, weighing, as a man weighs a stone before he decides to throw it or pocket it.

@lou: Carried, not chosen. There is an honesty in that. The cleanest kind, and the coldest.

He reaches up without rising and strikes the bell with the flat of his hand. One note goes out across the valley. You do not stay to hear whether it returns. Whatever the wax decides, it decides without you, and that was the whole of the errand: to be the road and never the destination.

You walk down through the blue dark with the salt on your lips. The letter's weight is gone from your ribs and has settled somewhere lower that you cannot reach to set down. You were paid for delivery. You delivered. It is enough to have done your work, and it is not enough at all, and you carry both of those the whole way down the mountain.

* Walk back down -> start

--- end_read
ending: true
budget: 180
beat: The courier breaks the seal and reads; the cost of knowing what was meant to pass unseen.
Your thumb breaks the seal before the wiser part of you can object. The wax gives with a small dry sound, like a knuckle cracking in the cold. You read. It does not take long. Bad news rarely needs many words.

@lou: By your silence, you have read it. So now you know a thing that was never addressed to you, and cannot un-know it, and cannot tell me, because I am forbidden the knowing and you the telling. Two men holding one secret from opposite ends.

He smiles, and the smile is not unkind.

@lou: Go down the mountain, courier. Carry this as you carried the letter, against your ribs, where it will keep you warm and keep you sleepless. You wished to know what you carry. Now you do.

You walk down with the broken seal in your pocket and the words sitting behind your eyes. The salt no longer tastes of the old mine. It tastes of every door you were warned away from and opened anyway. The pass lets you go. It always lets you go. That is the trick of mountain passes: they only ever stop a traveller on the way up.

* Walk back down -> start

--- end_burn
ending: true
budget: 180
beat: The courier burns the letter in the bell-fire; mercy or cowardice, and the master's response.
You carry the letter to the bell-fire burning low in its iron bowl and feed it in. The wax goes first, a brief blue flame the colour of the valley at dusk. Then the paper curls, blackens, and is gone, and whatever was written there is only smoke now, climbing the throat of the great bell.

@lou: So the road decided after all. Mercy or cowardice; you will spend the walk down sorting which, and you will change your mind twice, and arrive at neither.

He listens to the fire eat the last of it.

@lou: He will send another letter. His kind always does. But a second letter takes a season to climb this pass, and a season is a long time to a dying man. You have bought me a winter, courier, with a thing that was never yours to spend. I will not thank you for it. I will remember the sound of your feet.

He strikes the bell once, softly, and the note follows you out into the cold. You go down through the salt dark, lighter by one letter and heavier by one winter you handed to a stranger. The pass releases you. Behind you the bell keeps counting, patient as falling snow.

* Walk back down -> start
