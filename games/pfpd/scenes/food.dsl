--- whataburger
art: whataburger
brief: a real Whataburger fast-food restaurant on the ground at night, orange-and-white striped A-frame roof, tall orange W pole sign (logo only, no words), drive-thru lane and parking lot, a cartoon avatar gazing longingly through the lit window, firmly on the ground, NOT flying, no rockets
The Whataburger glows orange and white like a beacon for the hungry and the lost, which currently is all of you. Inside, the air smells like salvation and seasoned fries. A help-wanted sign hangs in the window with the quiet menace of a job.

The cashier has the thousand-yard stare of someone who closes on weekends. She has seen everything. She is about to see four cartoons try to order.

* Sweet-talk her into a free order of fries
  do: check('rizz', 12) ? give('fries') : note('She has met every kind of guy. You are merely the newest kind.', 'loss')
  go: has('fries') ? 'fries_win' : 'whataburger'
* Put on the apron. Get a real job. Become a person. -> end_job
* Leave before the manager makes eye contact -> riverwalk

--- fries_win
She slides a paper boat of fries across the counter and says "spicy ketchup is by the napkins" in the voice of a prophet. Brett weeps openly. You have eaten in the digital world before, but it was always a tasteful zero-calorie smoothie emoji. This is grease. This is real. This is a fistful of hot fries at 4 p.m. and nobody can stop you.

* Float back to the river on a cloud of salt -> riverwalk
  do: chronicle('Conned a free order of fries out of a tired prophet. San Antonio provides.')
