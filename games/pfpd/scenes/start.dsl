--- start
art: title
ref: none
brief: a huge glowing smartphone screen tearing open like a portal in the night sky over a downtown plaza, spilling four cartoon profile-picture avatars down into a splashing stone fountain below, neon chaos, dramatic splash-page composition, no text

:: <h1>${G.def?.meta?.title||''}</h1>
You were the single most reposted profile picture of the third quarter. Eleven million people woke up to your face every morning. You had a verified glow, a signature smirk, and, by design, exactly zero physical body.

Then someone with a cracked phone and a dream zoomed in too hard, the feed hiccuped, and the four of you fell out of the scroll like loose change out of a couch.

You land in a fountain. A real one. With water that is wet in a way no render has ever been. ${G.name}, you are in San Antonio, Texas, and the year is 2026, and a duck is judging you.

* Pull your face out of the fountain -> squad
--- squad
A pixel-cat VTuber named Kit is wringing out her tail. A bored-looking ape in a tracksuit, Brett, keeps trying to long-press a pigeon. Sir Woof, who is a dog, who is also a meme, who is also somehow wearing a tiny hat, has already started a podcast about the experience.

The math is grim. Out here you age. Out here you can be arrested, canceled, or, worst of all, scheduled. The only way home is back through a portal, and portals run on clout, charge, and a verified account none of you currently have.

* Rally the crew and lock in the quest -> riverwalk
  do: flag('met_crew'); chronicle('The squad reconvened beside a judgmental duck. Main quest: get back online before meatspace gets us.')
* Doomscroll your own trauma for a bit, THEN rally -> riverwalk
  do: flag('met_crew'); spend('battery', 2); chronicle('Spent two percent of battery doomscrolling the incident. Worth it. Probably not.')

--- riverwalk
art: river
brief: a neon-lit san antonio riverwalk at night, string lights over green water, cartoon avatars looking lost among tourists eating tacos
The River Walk curls below the city like a loading bar that never fills. Tourists drift past with margaritas the size of fire extinguishers. String lights buzz. Somewhere a mariachi band tunes up, sounding suspiciously like a notification.

[[if v.met_crew]]
Kit checks an imaginary minimap. Brett has befriended the pigeon. Everyone is looking at you, because out of habit, you are still the main character.
[[end]]

You need a plan, and the city has four bad ideas on offer.

* Storm the Alamo for free gift-shop wifi -> alamo
* Drift into a Whataburger that glows like a small orange sun -> whataburger
* Hijack a river-barge tour and turn it into content -> barge
* Brave the great river of cars they call I-35 -> i35
* Crack the portal back open and go home -> ritual
  req: has('checkmark') | the portal only opens for the verified

--- i35
art: i35
brief: a massive gridlocked texas freeway at dusk, twelve lanes of red brake lights, a cartoon avatar standing on the shoulder looking tiny
I-35 is not a road. It is a parking lot having an identity crisis at seventy miles an hour, except for the part where nobody is moving at all. Brake lights stretch to the curve of the Earth. A man in a stalled truck has simply begun to live there.

* Loot a stalled truck's cupholder for an energy drink -> riverwalk
  do: give('energydrink'); gain('battery', 4); chronicle('Looted a blue energy drink from a man who had given up on the freeway. He understood.')
* Trade your vape to a stranded commuter for a phone charger -> riverwalk
  hide: !has('vape')
  do: take('vape'); gain('battery', 8); chronicle('Traded the mango vape for a car charger in standstill traffic. The circle of life.')
* Cross all twelve lanes on foot like an absolute legend -> end_arrested
