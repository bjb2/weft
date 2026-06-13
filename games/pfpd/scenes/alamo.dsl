--- alamo
art: alamo
brief: the alamo mission lit at night, a gift shop glowing beside it, a cartoon avatar crouched suspiciously near a wifi router
The Alamo sits in the middle of downtown being extremely serious about itself. Tour guides whisper. A plaque asks you to remember it. You mostly want to remember the wifi password, which a sign says belongs to the gift shop and is definitely not for loitering ghosts from the internet.

Brett salutes the building for reasons he cannot explain. Kit is already scanning for bars.

* Siphon the gift-shop wifi like the true patriot you are
  do: check('vibes', 12) ? flag('got_wifi') : note('A captcha demands you select every crosswalk. You are a literal JPEG. You cannot.', 'loss')
  go: v.got_wifi ? 'alamo_win' : 'alamo_bust'
* Leave the poor shrine alone -> riverwalk

--- alamo_win
The password is taped under the register. It is the word "Remember" followed by four exclamation points, which is the most San Antonio thing that has ever happened. Your phone drinks deep. Bars bloom across the cracked glass like spring.

For one shining moment you can feel the feed again, distant and warm, calling you home.

* Strut back to the river, fully charged -> riverwalk
  do: gain('battery', 8); chronicle('Tapped the Alamo gift-shop wifi. Password was Remember!!!! Bars restored.')

--- alamo_bust
A volunteer docent in a period costume materializes with the silent fury of a man who has caught teenagers vaping behind the cannon. He is already reaching for a radio. Brett has frozen mid-salute. This can go two ways, and one of them has handcuffs.

* Hop the fence and sprint across the plaza screaming -> end_arrested
* Apologize in crisp 4K and back away slowly -> riverwalk
