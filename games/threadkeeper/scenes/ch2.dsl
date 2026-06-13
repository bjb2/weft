--- ch2_loom
art: loom
budget: 300
beat: Yue explains the loom's three powers — cut a thread (a life ends), mend a snapped one (at a borrowed cost), or leave it (let the river decide) — and that only leaving is permitted; she sends Wei to find her village's thread herself (sight check).
@yue: Come closer. Mind your sleeves. A thread is only silk until you snap it, and then it is a funeral.

She rises, smaller than you expected, and walks the length of the loom with one hand a finger's width above the strings, reading the valley the way you might read a wall of rain.

@yue: Every soul below us hangs here. This bright one, a child born at the new moon. This grey one, a man with a month left in him and no notion of it. We watch. We do not weave. That is the whole of the vow, and it has held three hundred years, because the hour a keeper decides she knows better than the river, the loom stops being a record and becomes a weapon.

She stops, and her white eyes find you somehow.

@yue: Three things a hand can do at this frame, and only one is permitted, which is nothing. You may cut a thread, and a life ends, clean as scissors. You may mend a snapped one, and a fate is bound back into the cloth, though the loom will take the length to pay for it from somewhere else. Or you may leave the strings be, and let the water decide as water always has. I am too old and too forsworn to stop you. But I will not choose for you, and I will not pretend the choosing is free.

@you: Then show me my village's thread.
@yue: Find it yourself. It is the only way you will believe what it shows you. A thread shown to you is a rumour. A thread you find with your own ruined eyes is a wound, and only a wound will teach you what your hand is for.

* Find your village's thread -> ch2_trial
  do: set('found_thread', check('sight', 12))

--- ch2_trial
budget: 280
beat: Wei searches the thousands of threads for her village's; on a passed sight check she finds the knot of forty herself, on a fail Yue guides her hand; either way the cut ends are clean, meaning something severed them deliberately.
You step to the loom. Up close it is both worse and better: thousands of threads, and you with one ruined year and a pair of stinging eyes, hunting a single grey line among them as if searching a flooded field for one particular reed.

@yue: Don't look with your eyes. You buried your people with your hands. Look the way grief looks. It always knows where the body is.

You let your gaze go soft. You stop hunting and begin listening, and the loom seems to lean toward you, the strings sorting themselves by some weight you feel in your chest instead of see.

[[if v.found_thread]]
And there. Low on the frame, off to the left where the drowned quarter hung: a knot of forty threads, all snapped in the same instant, their cut ends still bright. Your village. Your mother's thread among them, and you know it without counting, as you would know your own name called across a crowded room.
[[else]]
For a long while there is only the hum and your own pulse. Then Yue's hand closes over yours, dry and light, and guides it down and to the left, to a knot of forty snapped threads you would have passed over. Your sight failed you. Her mercy did not.
[[end]]

@yue: Forty, cut clean in one night. Threads do not break clean by accident, child. Water frays them slow, over hours. Something parted these in an instant. Touch them, and the loom will show you the hour they went.

You reach for the bright, severed ends.

* Touch the threads -> ch2_vision

--- ch2_vision
art: vision
budget: 320
beat: Touching the threads, Wei relives the flood night inside the loom and sees a figure deliberately working the sluice-gate open; the lantern reveals a face she spoke to an hour ago on the water.
You close your fingers around the severed ends, and the hall goes out like a candle.

You are in the valley, in the dark, in the spring of last year. Rain like driven nails. The river is a black animal straining at the sluice-gate upstream, the one great gate that holds the whole valley's water off the lower paddies. You have seen that gate a hundred times in daylight. You have never seen it from inside the loom, where every thread that will drown is already glowing with the cold light of the about-to-end.

A figure stands at the sluice in an oilskin, lantern hooded, turning the great wheel that lifts the gate. Not panicking. Not fighting the storm. Working. Deliberate, hand over hand, the way a man does a thing he has decided on and hates. The gate lifts. The black animal pours through. Down the valley, forty threads begin to brighten toward breaking, and your mother's is one of them, and you cannot move, because you are only watching, as the loom only ever watches.

The lantern swings. For one instant the hood falls back and the light catches the face of the figure at the wheel.

You know that face. You spoke to it within the hour, on the open water, behind a long pole. Inside the vision your mother's thread sings its last and goes dark, and you feel the exact moment she stops, the way you feel a held note end. Grief and blame close their fists at the same instant, around the same throat, and you understand at last that you did not climb this drowned mountain for an answer. You climbed it for someone to hold accountable, and the loom has just put the name in your mouth.

The vision lets you go. You are on your knees on the dry stone, both hands pressed to the severed threads, making a sound you do not recognise as your own.

* Go down to the water and find Bo -> ch2_bo
  do: chronicle('The loom showed you a hand at the sluice that night. You knew the face.')

--- ch2_bo
art: ferry
budget: 300
beat: Wei confronts Bo at the water; he confesses he was the sluice-keeper and bled the failing dam down the valley — forty drowned to spare three thousand upstream — and warns her the loom will tempt her hand; she may let him see she knows, or say nothing.
Bo is where you left him, at the foot of the stair, holding the boat against the current with the pole as though he never expects to be allowed to leave. He sees your face and does not pretend to misread it.

@bo: So she showed you. I wondered if she would. I have ferried pilgrims to that loom for a year, half hoping one of them would come back down with my own face in their eyes, so I would not have to be the one to say it.
@you: You opened the sluice. You drowned them. My mother.
@bo: I was the sluice-keeper. The dam above the valley was failing in the storm; the engineers swore it would burst by dawn and take the upper town, three thousand souls, if the pressure was not bled off. So I bled it off. Down the valley. Onto the paddies. Onto your village. Forty lives to spare three thousand. I did that arithmetic a hundred times in one night and it always came out the same, and it has never once let me sleep since.

He does not look away now. That is the worst of it. He has clearly rehearsed this moment a thousand times against a thousand faces and prepared no defence for any of them, because he believes there is none to make, and he is mostly right.

@bo: I am not asking to be forgiven. There is no coin for that and no pole long enough to reach it. I am telling you because the old woman up there is about to offer you the loom, and you should know whose thread your hand will be reaching for when you decide what kind of grief you mean to become.

* Hold his eye, and let him know you know -> ch3_flood
  do: flag('knows_bo'); chronicle('Bo confessed: forty drowned to spare three thousand. You let him see that you knew.')
* Say nothing, and turn back toward the loom -> ch3_flood
  do: chronicle('Bo confessed. You said nothing, and climbed back toward the loom.')
