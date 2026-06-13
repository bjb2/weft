--- ch1_road
art: marsh
budget: 300
beat: Wei arrives at the edge of the Reed Marsh below the Drowned Monastery; establish the flood that took her village, her one question, and that she must be ferried across.
The road gives out where the water begins. You stand at the lip of the Reed Marsh with your sandals already soaked, looking at a country that cannot decide whether it is land or river. Ruined paddies stretch to the grey horizon, their dikes broken, and out of the flooded fields the tops of drowned bell-towers rise like the fingers of people who went under waving. Reeds hiss in a wind that smells of mud and old rot.

A year ago you had a village. The spring flood took it in a single night, when the great sluice upriver failed and the water came down the valley with nothing left to slow it. You climbed out of the dark with your mother's hand cooling in yours and one question, and you have carried that question north for a year, the way other pilgrims carry incense.

Out across the water, on the only rise that still counts as ground, stands the Drowned Monastery. Half of it has gone under, the lower windows full of fish. The upper hall still stands, smoke threading from one chimney, and that smoke is the first sign in a hundred miles that anyone here is alive to answer for anything. They say the order on that rise keeps a loom that holds every life in the valley. They say it could have stopped the flood. You mean to learn whether that is mercy or a lie.

You cannot walk to it. You will have to be carried across. The question has worn smooth in your mouth from a year of asking it of priests who only shrugged and rivers that did not answer at all: could it have been stopped? You have decided that this drowned rise is the last place left that might know, and the first that cannot lie to you, because a loom does not have a face to lie with.

* Look for a way across the marsh -> ch1_ferry

--- ch1_ferry
art: ferry
budget: 300
beat: The ferryman Old Bo arrives; he flinches at recognising Wei's grief; he offers passage for coin (no questions) or for working the pole (and a hard truth about the marsh).
A bell-buoy clanks somewhere in the reeds, and out of them slides a flat-bottomed boat poled by an old man who looks as though the marsh built him from its own materials: wet rope, grey wood, regret. He brings the boat alongside without a word and waits, the pole planted, the water sliding past.

@bo: You'll be wanting the rise. Everyone who stands where you're standing wants the rise. Bo, they call me. I pole folk across. It is the only honest work left to me, and some nights I am not certain even of that.
@you: I can pay. I have salt-coin.
@bo: Course you can. They always can.

He studies you a moment too long, as a man studies a face he is afraid he already knows. Something in your bearing, or your grief, or the particular grey of your mourning clothes makes his jaw tighten. He looks away first.

@bo: Two ways across, girl. Pay the coin and ride like a pilgrim, and I will ask you nothing and tell you less. Or put your back into the pole beside me, work your passage, and I will give you one true thing about this marsh that you will not hear up in the hall. The coin is easier. The other costs you a story you may wish you had not bought.

The water laps at the hull. Behind him the monastery waits on its grey rise, patient as everything out here that has already lost what it had to lose. You weigh the coin in your palm. A year on the road has taught you that the cheap passage and the true one are rarely the same passage, and that you usually take the cheap one anyway, because grief is expensive enough on its own.

* Pay the salt-coin and ride -> ch1_gate
  do: flag('paid_bo'); chronicle('You paid Old Bo his coin and asked him nothing.')
* Work the pole beside him -> ch1_gate
  do: chronicle('You worked your passage, and Bo began to talk.')

--- ch1_gate
art: gate
budget: 260
beat: Wei lands in the half-drowned lower courtyard and crosses the warded threshold into the dry upper monastery; ward-thread; the hush; climbing toward lamplight.
The boat noses against a stone stair greened with weed, and you climb out into the lower courtyard, which is a courtyard the way a tide-pool is a courtyard. Water stands ankle-deep across the flagstones. Drowned lanterns sway on their poles. A gate of black wood stands open at the head of the next stair, and across its lintel, strung post to post, hangs a single thread of pale silk, taut and humming faintly in the wind off the water.

You know enough not to touch it. A ward-thread. Break it and the whole hall will know a stranger has come. You step over the high sill instead, careful, the water pouring off your hem, and the thread sings on undisturbed above your head.

Inside the gate the air changes. Drier. Older. The noise of the marsh falls away behind you as though a door has closed, though there is no door, only the sill and the thread. Ahead, worn steps climb out of the flood-line toward lamplight and the smell of woodsmoke and hot oil. Someone up there is awake and working late.

Somewhere a long way beneath your feet, in the flooded lower cells, the dark water shifts and settles again, the slow swallow of a building still drowning by inches. The monastery is mostly under now, and the part that is under is not entirely empty, and you make a firm decision not to wonder what keeps it company down there.

You climb toward the light, your wet feet loud on the dry stone.

* Climb to the upper hall -> ch1_hall

--- ch1_hall
art: hall
budget: 320
beat: Wei meets blind Master Yue at the Loom of Names; Yue confirms the order is forbidden to use the loom, felt the village's forty threads die, and names that Wei came for a choice, not history.
The upper hall is one long room of lamplight and the great frame that fills it end to end: a loom taller than three men, strung with more threads than you can take in at a glance, each catching the light like a wet hair. The Loom of Names. It hums low, like a held chord. Some threads are bright, some frayed, some hang snapped and curling, and you understand without being told that every one of them is a life somewhere down in the valley.

At the loom sits an old woman, blind, her eyes gone to white, her thread-scarred fingers moving over the strings without touching them, reading. She does not turn.

@yue: You came across with Bo. I felt the ward stir. Sit, if you like. Most who climb this far have already chosen what they want; they come only to be told they may have it.
@you: I want to know if my village could have been saved. The spring flood, a year ago. The broken sluice.
@yue: Master Yue, they called me, when there was an order left to call me anything. Yes. I know the flood you mean. I felt forty threads go grey in a single night and could not lift one finger, because we are forbidden to work the loom, and a vow is a kind of thread too.

Her hands go still on the strings, and for a moment the only sound is the loom's low hum and the first of the rain beginning to find the roof.

@yue: But you did not climb a drowned mountain for history, child. You climbed it for a choice. So. Let me show you the loom as it truly is, and then you will know the price of the thing you came to ask, and you may ask it still.

* Follow her to the loom -> ch2_loom
