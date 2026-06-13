--- whataburger
art: whataburger
brief: a glowing orange-and-white whataburger at night, flying-W sign, a cartoon avatar staring through the drive-thru window with longing
The Whataburger glows orange and white like a beacon for the hungry and the lost, which currently is all of you. Inside, the air smells like salvation and seasoned fries. A help-wanted sign hangs in the window with the quiet menace of a job.

The cashier has the thousand-yard stare of someone who closes on weekends. She has seen everything. She is about to see four cartoons try to order.

* Sweet-talk her into a free order of taquitos
  do: check('rizz', 12) ? give('tacos') : note('She has met every kind of guy. You are merely the newest kind.', 'loss')
  go: has('tacos') ? 'taco_win' : 'whataburger'
* Put on the apron. Get a real job. Become a person. -> end_job
* Leave before the manager makes eye contact -> riverwalk

--- taco_win
She slides a paper boat of taquitos across the counter and says "spicy ketchup is by the napkins" in the voice of a prophet. Brett weeps openly. You have eaten in the digital world before, but it was always a tasteful zero-calorie smoothie emoji. This is grease. This is real. This is breakfast tacos at 4 p.m. and nobody can stop you.

* Float back to the river on a cloud of meat -> riverwalk
  do: chronicle('Conned a free order of taquitos out of a tired prophet. San Antonio provides.')
