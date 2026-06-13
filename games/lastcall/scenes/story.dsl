--- start
art: undertow
brief: the interior of a tiny dim noir bar at 2am, last call, rain on the window, three stools occupied, a neon sign reflected in wet glass
The Undertow keeps two kinds of time: the clock over the register, and Mara's patience. Tonight they agree. The rain has been coming down since ten, and three regulars are still bolted to their stools like the place might sink without them.

You wipe the same six inches of bar you have been wiping for an hour. Mara shuts the cash drawer and looks at you over her glasses.

@mara: Key's yours tonight. I'm too old to lock up in this weather.
@mara: Get them out gentle. Finch is twitchy and Dot's lying about something. Same as every night.
@you: And if they don't want to go?
@mara: Then you learn the job. Go on.

* Step out from behind the bar and face the room -> table

--- table
The three of them turn toward you at once, which is its own kind of pressure. Finch has his coat half on and his hands flat on the bar, bracing for news. Dot has not touched her sherry in an hour. She has been watching Finch instead.

@finch: I know. Closing. I just need a minute. I'm good for the tab, I swear, I just don't have it on me tonight.
@dot: He doesn't have it any night, dear. Ask him where the rent went.
@finch: That's low, Dot.
@dot: Low is a word people use when they're losing.

The room waits. Mara's key sits heavy in your apron. You can run this two ways.

* Cover Finch's tab from the till and tell Dot to drink her sherry
  do: flag('helped_finch'); set('made_good', check('heart', 8)); chronicle('You covered Finch and quieted Dot. The bar stayed warm.')
  go: "last_call"
* Let Dot say her piece and hear Finch out
  do: flag('knows_truth'); chronicle('You let Dot talk. Finch did not love what fell out of her.')
  go: "last_call"

--- last_call
[[if v.helped_finch]]
Finch exhales like a man cut down from a hook. He counts nothing into your palm and means all of it.
@finch: I'll pay it back. You're a good kid.
@dot: He won't. But you are.
[[end]]
[[if v.knows_truth]]
Dot tells it plain. Finch has been floating three bars and one ex-wife on the same empty wallet. Finch does not argue. He just gets smaller inside his coat.
@finch: When you say it like that it sounds bad.
@dot: It is bad. I only say true things. It's why nobody buys me a drink.
[[end]]

Mara reappears in the back doorway with her coat on, watching how you handle the last of it.

@mara: Lights in five. Stay and put the chairs up with me, or leave the key on the bar and beat the rain home.

* Stay and put the chairs up -> end_stay
* Leave the key on the bar and go -> end_leave

--- end_stay
ending: true
art: chairs
brief: a noir bar after close, chairs stacked legs-up on the tables, an older woman and a young bartender sharing a quiet drink under one hanging light
!! ENDING: THE LONG WAY
You stay. The chairs go up one by one, legs to the ceiling like a row of surrendered animals. Mara pours two short glasses of the good stuff and waves off your hand when you reach for the till.

@mara: You did alright. Soft where it counts, hard where it doesn't.
[[if v.made_good]]
@mara: And you read Finch right. He needed the room more than the money.
[[end]]
@you: I'll lock up next time too.
@mara: I know. That's why the key's yours now.

The rain keeps its own hours. Tonight you keep Mara's.

* Close the night -> start

--- end_leave
ending: true
art: street
brief: a young bartender stepping out into a rain-slick noir street at 2am, neon reflected in the puddles, a brass key left glinting on the bar behind them
!! ENDING: THE SHORT WAY
You set the key on the bar where Mara can see it and push out into the rain. The neon paints the puddles the color of a bruise. Behind you the door sighs shut and the warm noise of the place cuts off all at once.

@mara: Hey.
You turn. Mara is in the doorway, the key already in her hand.
@mara: It's fine. Not everybody wants the key. Get home dry.

You walk. The bar shrinks behind you to one lit window in a wall of dark ones. Somewhere inside, Dot is still telling the truth to a man who will not hear it.

* Walk home -> start
