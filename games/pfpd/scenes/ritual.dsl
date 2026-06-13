--- ritual
art: ritual
brief: a glowing trash can portal swirling with feed-light in a downtown alley, a cartoon avatar holding a cracked phone aloft like a relic
Kit found the weak spot: a dumpster behind a vacant storefront where the wifi of nine different businesses overlaps into a shimmering seam. Hold up a verified phone, recite the right incantation, and the membrane between meatspace and the feed goes thin. The trash can is already glowing. It smells like ozone and old nachos.

You raise your cracked phone like a relic. Battery ${G.pools.battery.cur} percent. Checkmark gleaming.

[[if v.got_wifi]]
The Alamo wifi still hums in your bones. The signal here is strong. This might actually work.
[[else]]
There is barely any signal. You will have to carry this recitation on charm alone.
[[end]]

* Recite the Terms of Service backward and ascend
  do: check('rizz', v.got_wifi ? 10 : 14) ? flag('ascended') : note('The portal buffers. The portal always buffers.', 'loss')
  go: v.ascended ? 'end_portal' : 'ritual_fizzle'
* Chug the energy drink and brute-force the upload by sheer caffeine -> end_portal
  hide: !has('energydrink')
  do: take('energydrink'); chronicle('Brute-forced the portal on a blue energy drink. Skill issue: resolved.')
* Step back from the glowing trash can and regroup -> riverwalk

--- ritual_fizzle
The portal flickers, shows a spinning loading wheel, and then displays the worst thing a portal can display: a small grey message reading "Something went wrong. Try again later." Sir Woof howls. The seam is closing.

* Dump your entire remaining battery into one desperate final upload
  req: G.pools.battery.cur >= 5 | your phone is at one percent and your hands are shaking
  do: spend('battery', 5)
  go: check('clout', 12) ? 'end_portal' : 'end_canceled'
* Give up, walk back to the Whataburger, ask if they are still hiring -> end_job
