# Changelog

Changes to the game itself, newest first, with the time each went live (Honolulu time, from the commit history). Save commits (`Day NNN ...`) are the adventure log and aren't listed here.

## v0.34 - Oct 7 2026, 17:53 HST

![v0.34](screenshots/v0.34.png)

- **Six kinds of rooms.** Rooms 1 and 2 of each new floor get a different one of six kinds (older floors are unchanged). Names never show; each does its one thing when you walk in, with its own line:
  - Den: starts hot, so demons come easily.
  - Bay: safe (no demons) and heals the party by a third.
  - Relay: points toward the stairs.
  - Vault: coin.
  - Forge: clears ICHOR taint and ends a TRIP.
  - Altar: see below.
  The Den, Bay, Forge and Altar work again when you come back, once a day. The rest are one-time finds. Gear, shield, key and repair parts are still placeholders.
- **The Altar is a terminal in the wall.** Face it (it draws in the 3D view) and `[S]EARCH` or `[G]IVE` to wake it. Its screen types a greeting (`> INPUT?`, `> ...?`, `> Hello.`) over a drifting sine wave. Offer an item or SILVER (once a day, always lost) and it answers with a face (`:)` `:|` `:(`) and the wave goes excited, easy or flat. The offering quietly shifts KURA's lean (an aligned item pulls toward its own alignment, a rarer one harder; SILVER or a plain item pulls back toward the middle). Nothing says which way.
- **`STA[N]DBY`, a third choice for the day** beside going forward and back. It spends the day's step, and the next morning's rest is deeper: another fifth of HP, party patience restored, the room cooled again, the loop cleared. A day you just don't step gets nothing extra.
- **The moon strip**: the eight phases as blocks (lit on the right while waxing) on the line above `ALIGN`, with a `.` over today's.
- **`[S]EARCH` works on a door** (and the stairs): it still finds nothing, but it counts as an action, so line 1 changes, line 3 holds, and spamming it feeds the loop.
- `[^]` has no glow. `[P]ASS` moved off the bottom border (the `P` key and the `[?]` help still have it).
- **Cheats:** `X` toggles infinite steps (and shows the room and counters under the screen), `Shift+X` jumps a day.

## v0.33 - Oct 7 2026, 16:45 HST

![v0.33](screenshots/v0.33.png)

- **Text lines hold for two turns and two seconds.** Line 3 stays on screen until KURA has taken two more actions and two seconds have passed, so fast clicking can't skip past it. Warnings (a demon, damage, a closing way down, game over) still replace it at once.
- **One loop counter.** Doing the same thing over and over is now a single count for everything (searching, turning, walking, items, fighting, talking). The old separate streak is gone. Searching a wall still counts at half. The party gets restless as before.
- **Lingering counts every action in a room**, and the trigger is now 30.
- **Dread, when KURA is alone.** Repeat the same action about 8 times and the room starts to whisper. At 15 she starts TRIPPING. At 25, something answers: ATOM SLASHER (it can't be talked to, tough and hits hard). Company keeps the dark away.

## v0.32 - Oct 7 2026, 16:19 HST

![v0.32](screenshots/v0.32.png)

- **The block moon was backwards.** Waxing is now lit on the right and waning on the left, as in the northern sky, so today's waning crescent shows its sliver on the left.
- **The fight box moved into the 3D view**, like the bag, so the party panel and map stay in sight (and `[^] RUN` and the turn buttons stay clickable under it). It has a faint empty slot at the top for art later, a `>` that points at KURA when it's your move and at the demon while its lines play, and `ROUND N` at the right end of the button row. A round plays back one line at a time; click or act to skip it.
- **`[G]IVE` replaces `[I]NVOKE` in the fight box** (`[I]NVOKE` on the bottom menu still opens the bag, and closing it from the menu now brings the fight box back). GIVE opens the gift list straight away, with `[B]ACK` to close it for free. A demon that is already fighting mostly doesn't care: it stands down rarely (under 9%, and sometimes offers to join), holds its blow about a quarter of the time, and otherwise takes the gift only to break it or throw it away and strike anyway. A gift it hates is lost the same way, and the demon stops listening. Every family has new voice lines for it.
- The blinking `[^]` and `RUN` glow less.
- VT323 now ships with the game (`fonts/`, with its license), so the page no longer loads anything from Google.

## v0.31 - Oct 7 2026, 15:01 HST

![v0.31](screenshots/v0.31.png)

- The README is shorter and punchier: what the game feels like, not how every system works.
- The fight box reads `[F]IGHT [T]ALK [I]NVOKE`: INVOKE opens the bag mid-fight (using something, then back to the fight), and RUN is gone from the box. Running is still the `[^]` step (or the up arrow) through a door.
- The LOG page (and the end-of-run log) has `[D]OWNLOAD`, which saves the log as a text file, and `[COPY]`, which copies it to the clipboard. The text includes the end-of-run stats when the run is over.
- Nothing breaks early any more: an item can't break before 10 tries (COMMON), 12 (UNCOMMON), 20 (RARE) or 40 (MYTHIC). After that each try has the same small chance as before, so a common thing lasts about 20 tries on average.
- The `[^]` step button glows more softly, and when it's spent (or facing a wall) it dims to a dark blue.
- In a fight, the way out flashes: `[^]` blinks with RUN beside it when KURA faces an open way, and the turn buttons blink when she faces a wall (turn to find a door). Nothing flashes once today's step is spent.

## v0.30 - Oct 6 2026, 20:58 HST

![v0.30](screenshots/v0.30.png)

- The `[^]` step button is drawn bigger and glows, since it's the one move of the day.
- The omen on the ceiling has carets pointing in: `> "The stone dreams of the sea." <`.
- Talking to the party is much easier on them: plain chatter only starts to wear their patience after about 7 talks each in a day (around 30 for the whole party). Questions, fiddling with junk and repeating yourself still wear on them as before.
- **ICHOR is the party's medicine.** It sits at the top of INVOKE: Enter feeds the wounded demons (about 1 ICHOR per HP; bringing back a fallen one costs three times as much). It doesn't work on KURA, who is human.
- **KURA can drink it anyway** (`[D]RINK` in INVOKE, 10 ICHOR): it heals her a little, pulls her hard toward CHAOS, unsettles the party ("PIXIE: "KURA?? Spit it OUT."", "HUMAN INTEGRITY: 97%."), and leaves TAINT, which fades a point each night. One drink gives her a buzz ("KURA can feel it in her teeth."): her blows land harder. After 3 she starts seeing things ("The walls are breathing with her.").
- **TRIP, the first status effect.** At 6 drinks' worth of taint KURA TRIPS (`KURA*` in the party panel) for 50-100 actions, or until she sleeps. She strikes twice as hard, but a third of her blows go wild and hit the party ("KURA swings at the WIRE WITCH... and hits CU SITH."), never knocking anyone out. She sometimes answers demons the opposite of what she meant, strange thoughts crowd line 3, deep finds come three times as easily, she can read binary on her own, and the TURN counter can't be trusted: it sometimes counts backwards. Coming down hard costs her a third of her HP.
- The CODEX button moved from INVOKE to the top of the LOG page (C still opens it anywhere).
- The stray `|` to the right of `[S]EARCH` on the menu bar is gone.

## v0.29 - Oct 6 2026, 20:36 HST

![v0.29](screenshots/v0.29.png)

- **The omen moved to the top of the 3D view**, centered across the ceiling. A long omen wraps onto a second row, so the walls always show. The moon panel's bottom row is back to just the `^^^` marker, and the frame under the 3D view is gone, so the screen is back to its old height.
- "The moon is day 26, waning crescent." is now one of the status reports on log line 1.
- **Things are much harder to break by hand:** about 12 tries on average for COMMON things, 17 for UNCOMMON, 33 for RARE and 100 for MYTHIC (MOON things still never break). The party's patience goes as it gets close instead: reactions are rare at first and come more and more often the longer KURA keeps at it, and the break itself costs everyone a point of patience (more for whoever loved the thing).
- Searching while facing a door has a few different replies now ("KURA checks the hinges. Old, but only hinges."), never the same twice in a row.
- **Doing the same thing over and over gets noticed.** Searching the same wall again and again, turning round and round, or searching a door: after a few repeats the party starts to say something, more often the longer it goes on, and each remark costs that member a point of patience. "PIXIE: "Are you CRAZY? What are you DOING??"", "ELF: "You have searched that wall a hundred times."", "CU SITH lies down. It knows this will take a while.", "LOOP DETECTED."
- **The party asks questions.** Talking to a member in a calm room, about 1 time in 4 they ask KURA something instead, and big `[Y]ES | [N]O` buttons appear on the right side of the log box (or press Y / N). "PIXIE: "Can I have the next shiny thing?"", "ELF: "Do you trust me?"", "CU SITH drops a bone at KURA's feet. Throw it?", "QUERY: IS THIS A TEST? Y / N". Answers change their patience (a kind answer can win some back), some lean KURA's alignment, and each gets a reply. Doing anything else lets the question lapse.
- Party remarks about doing the same thing over and over now take longer to start.
- **Demons talk before they bargain.** A demon that listens now sizes KURA up with a question or two first, each family its own way ("QUERY: ARE YOU HUMAN? Y / N", "do you have a charger? anything?", "Do you hear the wires sing too?", "Do you fear me?"), answered `[Y]ES` / `[N]O` in the fight box. Answers it likes put it in a better mood (gifts go further and it's likelier to join); two it dislikes and it loses its temper and strikes. Then it asks for a gift as before.
- Data demons sometimes slip into binary (real ASCII, if you decode it): `01001000 01001001`, and one even asks a question in it. Only a data demon in the party can read binary: with one along, each binary line comes with a translation (`01001000 01001001  [PACKET: "HI"]`); without one, it's just 1s and 0s.
- Fixed the right border of a log line sitting one cell short in the page font (an apostrophe, as in "Today's", wasn't exactly one cell wide). Each log line's text now sits in a box exactly 78 cells wide.

## v0.28 - Oct 6 2026, 20:03 HST

![v0.28](screenshots/v0.28.png)

- **About page** (`[?]` in the bottom border, or the ? key): the build number, what the game is, a few numbers from this run (floor, day, turns, alignment, demons met, items found) and how full the codex is. The full stats still only show at the end of a run.
- **SEARCH is `[S]` now** (it was A). With the NSEW buttons gone, the compass keys are retired too: the day's step is `[^]` or the up arrow, and in a fight the up arrow or R runs.
- About has a guide to every key.
- **The omen has its own frame** under the 3D view: centered, with arrows on the edges that grow inward when the omen is short (`||>  "Count the doors."  <||`). It no longer sits on log line 1.
- **Log line 1 is a status report** that changes every 5-10 actions. Mostly news ("First floor. 5 days until the way down closes.", "Day 6 on this floor. The way down closes tomorrow.", "First floor. 2 of 3 rooms surveyed. Stairs unconfirmed.", "Day 3. Party wounded."), mixed with a detached conditions readout: the air (the room's heat, as temperature), a smell, a sound or the light ("Conditions: humid. Odor of mold. Dripping, distant."). It updates right away when the heat changes, on a new day or floor, and on the last day. A fight leaves copper in the air; a break, smoke.
- One omen reworded: "The deep remembers a name. Yours...soon."
- The build number shows small under the screen's lower right corner.
- The bottom border reads `[?] [L]OG [P]ASS [R]ESET`. BACKUP is now `[P]ASS`, the run's password like old console games (copy it to keep or move the run; paste one in to continue it), and RST is spelled out as `[R]ESET`.
- **The adventure log keeps everything you read:** each day's omen, every action, everything said and done in a fight or a talk, and line 3 whenever it changes (party replies, finds, warnings). Follow-up lines sit indented under the action they belong to. Hidden numbers stay out.
- **Items can break.** Trying to use something that does nothing can break it ("comes apart in KURA's hands"), and every try is a roll: one battery survives a dozen tries, the next snaps on the first. COMMON things break 30% of the time per try, UNCOMMON 22%, RARE 10%, MYTHIC 3%, and MOON things never break. Junk is hollow, though: when a COMMON thing breaks there's a 1 in 10 chance something was inside (1 in 12 for UNCOMMON), and it pops up like a find: usually more junk, 35% of the time a RARE, 5% a MYTHIC. Breaking things has consequences:
  - **Noise.** Fiddling makes a little noise and breaking makes a lot: the room heats up, and something may "come to see what broke."
  - **Alignment.** Breaking things leans CHAOS. Breaking a LAW relic is a big CHAOS act; breaking a CHAOS relic leans LAW, like getting rid of something dangerous.
  - **The party cares what you break.** Break something a member loves (folklore: old spirit things; data and hardware: tech; hybrids: half-and-half things) and they take it hard: "ELF: "That was older than you."", "PIXIE: "You BROKE it!"", "CU SITH whines at the pieces.", "ASSET DESTROYED.", costing extra patience. Once per kind of item, one of them may stop you: "ELF catches KURA's wrist. "Not that one.""
  - **The moon.** Spirit things are more fragile under a full moon and tougher at the new moon, and things turn up inside junk more often at the new moon.
  - The codex counts how many of each item you've broken, and the end-of-run stats list items broken and how many had something inside.
  
  The party notices fiddling too: "What are you doing?", "It's not going to do anything.", and it wears on their patience like being talked at, up to snapping.
- Each changelog entry now comes with a screenshot of that build.
- The README is up to date with how the game plays now.

## v0.27 - Oct 6 2026, 19:16 HST

![v0.27](screenshots/v0.27.png)

- **A block moon** sits at the far left of the top panel, showing today's phase: lit columns fill in as it waxes and empty as it wanes, and on the page the lit part glows and slowly breathes. The phase bar shifts over to make room.
- **The day's step is the `[^]` button** above the facing letter in the 3D view: it walks KURA the way she faces (dimmed when that's a wall or the step is spent). The NSEW buttons are gone from the bottom right, which is kept free for answering the party later. The N/S/E/W keys still work, and in a fight `[R]UN` handles escaping.
- `[C]ODEX` left the bottom border; it's still in INVOKE (and on the C key).
- **The end-of-run log has the whole run's stats:** floor reached, days, turns, steps walked, searches, alignment and its hidden lean, heat (here and hottest), demons met, beaten, talked to, gifted, recruited and escaped, party talks, items found, SILVER and ICHOR, and who was left in the party.
- On a run's first day, taking the step asks twice: "GO WEST?" and then "ARE YOU REALLY SURE? This is your only move for the day."
- The fight box has a `[R]UN` button (or R): KURA runs through the door she faces, or another open one. It's dimmed when today's step is already spent.
- When the run ends, the adventure log opens by itself (after the fight box is closed), topped with where and when it ended: "THE RUN IS OVER. B2F, day 4, turn 61."

## v0.26 - Oct 6 2026, 16:02 HST

- Trying to use an item that does nothing still counts a TURN, like any other action.
- **Runs that got ahead of the real date snap back.** Old X presses (the hidden testing cheat) or a wrong device clock could push a run's calendar days ahead, and the rewind guard then locked that in. Once the page knows the real time, such a run snaps back to today once ("The calendar shudders and settles on today."), and a deadline further out than next week's Sunday is pulled in. RST always starts a run on the real calendar now.

## v0.25 - Oct 6 2026, 15:54 HST

- **The game uses the real time, not the device's.** When the page loads it asks the server for the time and goes by that, so a wrong or changed device clock can't move the game forward or back. If the server can't be reached (offline), it falls back to the device clock, still guarded against rewinding.
- **Days follow the player's own midnight.** A new run counts days in the timezone of the device that starts it: the clock, the date, the daily step and the Sunday deadlines are all local. The run keeps that timezone, so traveling mid-run can't add or skip a day. Runs started before this, and the chat run, stay on Honolulu time.
- Using an item from INVOKE shows the result on log line 2 in gold, instead of inside the INVOKE box.
- The clock shows the timezone after the time (`15:51 HST`, `EDT`, or `GMT+9` where there's no short name).

## v0.24 - Oct 6 2026, 15:42 HST

- **Talking reads the room.** When KURA talks to the party, the answer follows the room's heat: easy chatter when it's calm, then uneasy ("Lower your voice. The room is waking."), nervous ("Something keeps breathing. It isn't us."), and finally just wrong ("PIXIE tries to answer. Her voice won't come.") as it heats up. Each member answers in their own way; recruited demons in their family's voice ("MULTIPLE SIGNALS. ORIGIN: EVERYWHERE.").

- **Patience.** Party members get tired of being talked to. Each talk wears down the one who answers: after a few they get short ("ELF: "Must you?"", "RATE LIMIT EXCEEDED."), then irritated ("PIXIE sticks out her tongue."), then they ignore KURA ("CU SITH pretends to be asleep."). A night's rest gives some patience back. A dangerous room still outranks being annoyed. Keep pushing someone with no patience left and they snap: CHAOS members lash out at KURA ("CU SITH bites KURA's hand. Not hard. Hard enough."), never fatally; LAW and NEUTRAL ones leave the party ("SESSION TERMINATED.", "PIXIE: "FINE. Bye!"").
- Nervous replies are less explicit too ("MULTIPLE SIGNALS. ORIGIN: EVERYWHERE.", "WARNING: TRACE DETECTED.").

## v0.23 - Oct 6 2026, 15:31 HST

- **TALK with no demon around** talks to the party. Someone answers on line 3: PIXIE chatters, ELF is aloof, CU SITH answers without words, and recruited demons speak in their family's voice ("QUERY NOT UNDERSTOOD. RETRY?"). Now and then something that isn't the party answers instead ("A voice below counts to seven, then stops."), more often under a full moon. Alone, KURA hears only the walls, or the voice.
- INVOKE: `[ENTER] use` and `[C]ODEX` can be clicked, and what happened shows right in the box. Items with no use yet say "KURA turns the spent battery over. Nothing happens." and aren't spent.
- The minimap sits one row higher, so KURA is centered in the map box.

## v0.22 - Oct 6 2026, 15:20 HST

- **Demons ask for anything.** A demon that listens asks for a gift, and KURA picks from a list: SILVER, any item she carries, or nothing. How it reacts depends on what it gets:
  - **Taste by family.** Data and hardware demons like tech junk, hardware loves SILVER, hybrids love things that are both machine and spirit (most RARE items), and folklore likes old spirit things and hates tech. Data demons hate spirit things too.
  - **Worth.** Rarer items are worth more, and a relic of the demon's own alignment is worth extra (an opposite one, less).
  - **Reactions.** Hated gifts get thrown back and the demon attacks ("Wires and plastic? You insult me."). Too little and it keeps it and asks for more ("A crumb. Where's the rest?"), up to three times before it leaves with everything. Enough and it may offer to join; well over and it almost always does.
- **CHAOS demons are tricksters.** They rarely join, even when pleased: mostly they demand more ("More. MORE.") or run off laughing with the gift. Only a great gift sometimes wins one over.
- Giving SILVER leans KURA toward LAW; giving items leans CHAOS, or toward a relic's own alignment.
- **INVOKE opens inside the 3D view** instead of over the whole screen, so the party, map and log stay visible. Pick an item with the number keys or arrows (or click it) and a box below shows what it is and what it does; Enter (or clicking it again) uses it.
- KURA starts each run with 2-3 pieces of COMMON junk and one UNCOMMON item, so there's something to give the first demon. Very rarely there's more: 1 run in 40 starts with a RARE item and 1 in 200 with a MYTHIC ("Her bag feels heavier than it should.").
- **CODEX** (`[C]`, in the bottom border): an encyclopedia of every demon met and item found, with `[D]EMONS` and `[I]TEMS` tabs. Unknown entries show as `???`. Demon entries have the family, alignment, a line of its voice, what it wants, and how often it's been met and recruited. Item entries have rarity, alignment, which families love or hate it, and how it pulls KURA. The codex survives RST, so it fills up across runs.

## v0.21 - Oct 6 2026, 15:00 HST

- **Recruiting.** KURA is the only human; ELF, PIXIE and CU SITH are demons too, and any demon can join. TALK goes in steps: the demon decides whether to listen (moon, omen and alignment), names its price, KURA answers `[Y]ES` or `[N]O`, and once paid it may offer to join. With a full party (KURA plus 3), you choose who to send away, or keep everyone.
- **Each family speaks and bargains its own way.** Data demons talk in system messages and just want a task ("ASSIGN TASK? Y / N", "TASK RECEIVED. LINKED TO USER."). Haunted hardware speaks in corrupted memory and wants SILVER ("ERROR 404: owner not found"). Hybrids mix the two and take a SILVER toll ("ACCESS GRANTED, traveler."). Folklore speaks in old words and wants an offering from the inventory.
- **Alignments.** Every demon is LAW (data, clean machines), NEUTRAL (hybrids, haunted hardware) or CHAOS (folklore), with a few outliers. The encounter box shows how it sees KURA: "KURA is recognized." (same), "Undecided." (neutral) or "bares its teeth." (opposite). Same-alignment demons listen more and charge less; opposite ones listen less and charge more.
- **KURA's alignment moves with her choices.** A hidden score shifts with nearly every action: talking, paying SILVER and taking tasks lean LAW, as does patient searching; fighting, finishing demons off, giving offerings, running, and searching a room that's already hot lean CHAOS. Recruits pull hardest, toward their own alignment. Early choices weigh more than late ones. The ALIGN tag only flips at a threshold ("The system takes notice. [LAW]" / "The old things take notice. [CHA]"), returns to [NEU] near the middle ("KURA finds her balance."), and "Something is pulling at you." warns once when a flip is close.
- **The ALIGN tag shows each action's pull.** A bracket turns into a glowing arrow for the action that just happened: `<NEU]` pulled toward LAW, `[NEU>` toward CHAOS. Only bigger pulls show an arrow: tiny nudges like searching a cool room move the score quietly.
- **High-rarity items have alignments.** RARE, MYTHIC and MOON items are LAW, NEUTRAL or CHAOS (commons and uncommons have none), shown in INVOKE and in the found popup. Finding a LAW or CHAOS relic tugs KURA toward it; offering one to a demon pulls toward the relic's alignment, and a demon offered a relic of its own alignment is pleased and joins more often (an opposite one, less often).
- A new run now resets KURA's alignment fully.
- PIXIE, ELF and CU SITH can now also turn up as wild demons.
- Long demon names are shortened in the party panel (STATIC BANSHEE shows as S.BANSHE).
- Fixed the right border on the clock line sticking out past the rest of the frame (the weekday kanji was taking more than its two cells).

## v0.20 - Oct 6 2026, 14:35 HST

- The Japanese weekday kanji sits left of the date (`火 TUE OCT 06 2026`).
- The moon panel's marker row carries a short moon update: "The moon is day 26, waning crescent." It sits on whichever side the `^^^` marker isn't.

## v0.19 - Oct 6 2026, 14:24 HST

- The game never goes back in time: setting the device clock earlier than a day the run has already seen leaves the game on that day ("The calendar won't turn back."), so a day can't be redone and a deadline can't be dodged.
- `?` lockers are much rarer: about 1 floor in 4.
- Confirming a step is now a popup: "GO EAST? This uses today's one step." with `[ YES ]` (Enter, Y, or the same direction again) and `[ NO ]` (Esc or anything else).
- Good omens: "The halls are sleeping." (heat rises half as fast) and "The deep is generous today." (rare finds three times as likely), alongside the existing good ones for finding secrets and talking.
- Omens are always in quotes. Ordinary days get mysterious lines too ("Count the doors. Then count them again."), so every day reads like an omen; they just carry no effect.

## v0.18 - Oct 6 2026, 14:13 HST

- **Daily omens** on line 1: one per real day, seeded from the date, always true. About half are ordinary days; the rest make data or folklore demons more common, make heat rise faster, make secrets harder or easier to find, or make demons easier to talk down.
- **Heat:** every search warms the room. Encounter odds climb from about 1 in 24 per search when cold to about 1 in 4 at the hottest. Heat halves each night and never fully resets. Line 3 tells you when it rises ("Your footsteps sound louder than before." / "Something in the walls goes quiet." / "The room is listening."), and "The room settles." when it cools.
- **Noise:** searching the same wall again and again draws data demons (and data tells: a dial tone, counting, SIGNAL DETECTED); lingering in one room draws older things (wet iron, humming, salt underfoot).
- **Demon ladder by depth:** pure data near the top (PING, DAEMON, CRON, NULL, PACKET, WORM, TRACER), then haunted hardware, then hybrids (CHROME HOUND, WIRE WITCH, KITSUNE.EXE…), then folklore (REDCAP, BANSHEE, TROLL…) deeper down.
- **Rarity tiers:** COMMON, UNCOMMON, RARE, MYTHIC, MOON, each with its own color in the found box and inventory. Searches mostly turn up commons, sometimes uncommons, rarely rares. New RARE hybrids (a rune scratched into a circuit board, a rosary of fiber optic beads, a sealed jar humming faintly…). Deep caches hold MYTHIC relics; lockers hold RARE or MYTHIC items.
- **Taking the stairs down is free:** it no longer uses the day's step.
- More search misses ("Old tally marks, in groups of five."), and a true near-miss: "The wall is warmer than the others." only when that wall still hides something.
- The moon shows up on line 3 now and then. The black candle now cools the room it's lit in.

- During a fight, the directions you can run through glow white, with a `RUN?` label above them; the long explanation in the fight box is gone.
- Popup boxes close with `[ OK ]` (click it, or press Enter, Space or Esc).
- The `?` is now a hidden locker holding a rare item ("A locker holds a black pearl."). Only under a full moon can it hold a moon drop instead (half the time). Shops and special rooms behind it come later.
- New demons: half old folklore (GHOUL, ONI, KAPPA, LAMIA…), half born in the city's wires (GLITCH, STATIC, CHROMEDOG, WIREWRAITH, NEON ONI, DATAGHOUL, RUST KAPPA, BLACK ICE).
- ATOM SLASHER: a rare named demon (3% of encounters), twice as tough, hits harder, and won't talk.

## v0.17 - Oct 6 2026, 11:06 HST

- SE[A]RCH moved to the free actions on the left, since it can be used any number of times.
- The day's step buttons are spelled out: `[N]ORTH [S]OUTH [E]AST [W]EST`.
- When a search turns something up, a gold-bordered box says what KURA found (with its note) and waits for Enter, Space, Esc or a click. Holding A won't skip past it.
- Real encounters. A demon that turns up (in a wall, or wandering in) stays until it's dealt with, in a box showing its name and HP bar. Each round, choose:
  - `[F]IGHT`: everyone still standing strikes, then the demon strikes back. Beat it for ICHOR (and, under a bright moon, maybe a rare drop).
  - `[T]ALK`: it may listen and leave (sometimes with a gift), ask for SILVER, or laugh and refuse to talk again. Demons listen best at new moon and almost never at full moon.
  - Run through a door: during a fight the open directions in the menu glow red. Stepping through one uses the day's step either way; half the time KURA gets away into that room, otherwise the demon blocks the door and strikes. With the step already spent, there's no running.
- Demons hit harder under a brighter moon. If KURA falls, the run is over. Using an item mid-fight is free.
- Moving takes two presses: the first lights the button gold and asks "Use today's step to go NORTH? Press [N] again.", the second moves. Anything else, or six seconds, cancels.

## v0.16 - Oct 6 2026, 10:48 HST

- Deep caches: about one room in three hides something rare deep inside one wall, found only 1 in 35 per search. That wall can stay silent for 30, 40, 50 tries and then give.
- Moon drops: demons that fall under a gibbous moon (10%) or a full moon (25%) sometimes leave a rare item behind.
- `[I]NVOKE` (or I) opens the inventory: every item KURA carries, with counts and a short note. Press a number or click to use one; using an item is free.
- 20 more common finds, old-dungeon things (a rusted iron key, a jar of grave salt) and ruined-city tech (a dead pager, a cracked phone, a neon tube fragment, a VR visor). Just for keeping, each with a short note.
- Usable for now: a vial of medicine (heals everyone by a third), a strip of prayer cloth (raises fallen allies a little), a stub of black candle. Keepsakes and rares can be looked at but not used yet.

## v0.15 - Oct 6 2026, 10:31 HST

- Demons can kill. Every demon fight (hidden or wandering) can drop party members to 0 HP, and if KURA falls, the run is over. A night's rest heals a fifth of everyone's HP.
- SEARCH works on the wall KURA faces. Each wall has its own hidden things (the stairs are always behind the wall they open in), so turn to try another wall. Doors can't be searched, and SE[A]RCH dims while facing one.
- The look controls are spaced out: `[<]  W  [>]`.
- Party rows give names one more column and fit three-digit HP and MP (`KURA     L99 999/999 450/999`).
- The adventure log records every action now: steps, every search (empty ones too), turns, walls and new days, each tagged with its day and turn (`D005 T012  KURA turns to face NORTH. Bare stone.`). It keeps the last 20,000 entries; a BACKUP code carries the last 300.
- Turning now says what KURA sees on line 2: "KURA turns to face WEST. A warped door in its frame." Only what the 3D view already shows (wall, door, or found stairs), in a few different words each.

## v0.14 - Oct 6 2026, 10:17 HST

- Search lines no longer show a try count ("KURA searches. Nothing.").
- The third line drifts: besides changing with each step and new day, it has a chance to change after any search or turn, so it isn't frozen all day.
- The third line has more to say: party chatter ("PIXIE hums an old song, off key."), how hurt members are holding up ("CU SITH is breathing hard."), demon sounds that grow more common under a bright moon, and ambient sounds. Faint clues still turn up now and then.
- The controls under the 3D view only look around now: `[<]` and `[>]` (and the left/right arrow keys) turn KURA, and `[^]` is gone. Moving is only `[N] [S] [E] [W]`.
- The minimap shows which way KURA faces with an arrow beside her room: `[@]>` east, `<[@]` west, `^` above for north, `v` below for south. It covers the door mark on that side.

## v0.13 - Oct 6 2026, 10:00 HST

- Anyone can play on the page: each player's run is saved in their own browser and saves itself after every action. A first visit starts a fresh run. No accounts or tokens.
- `[L]OG` shows the run's adventure log, newest first: every step, find, new day and descent. Empty searches are left out.
- `[B]ACKUP` shows the run as a save code to copy. Pasting a code restores that run, for backups or moving to another device.
- `[R]ST` asks before ending a run. LOAD is gone; the repo's `save.json` is now only the chat run (`/smt-screen`).

## v0.12 - Oct 6 2026, 10:00 HST

- Days follow the real calendar (Honolulu time). The day's step comes back at midnight, DAY counts real days since the run began, and the map header shows today's real weekday.
- Each floor's way down closes at the end of a Sunday. A new run's first floor closes this Sunday (or next Sunday if fewer than 3 days are left). Taking the stairs early gives bonus days: the next floor closes the Sunday after next.
- On the last day, the third line warns that the way down closes tonight. Miss the deadline and the run is over.
- NE[X]T is gone from the screen. The X key still jumps the game a day ahead, as a hidden testing cheat.

## v0.11 - Oct 6 2026, 09:48 HST

- One step per day. `[N] [S] [E] [W]` take the day's step through the door on that side (or down the stairs once found), and dim once used. Turning and the free actions are unlimited.
- Searching works like NetHack: unlimited, but each search has only a small chance (1 in 5) to turn up the room's next hidden thing, and an empty room never answers. The log counts the tries ("KURA searches (12). Nothing."). Each search also risks a wandering demon, rare at new moon and common at full moon.
- New bottom menu: free actions on the left (`[F]IGHT [T]ALK [I]NVOKE`, not built yet; INVOKE replaces SUMMON), daily actions on the right after a divider. ITEM, MAGIC, COMP, EQUIP and GO are gone; `[^]` under the 3D view still steps forward.
- `NE[X]T` (key X) ends the day, standing in for real midnight. After the 7th day on a floor without taking the stairs, the run is over.
- The map header shows the floor's weekday, MON to SUN (`MAP  B3F  WED`). SUN is the last day to find the stairs. For now it follows the floor's day count; later a floor will start on a real Monday.
- STEP on the bottom line is renamed TURN, to match DAY. It still counts every action: steps, searches and turning.
- Keys: N S E W step, A search, arrows turn and step forward, X next day, L load, R reset.

## v0.10 - Oct 6 2026, 09:25 HST

- New minimap symbols, one per room: `[@]` KURA, `[^]` the way up, `[v]` the stairs down once found, `[?]` the lure, `[ ]` a visited room. Doors are `=` between rooms side by side and `‖` between stacked rooms. The facing direction lives in the turn controls and FACE instead of the map.
- The saved game's map is redrawn in the new style.
- `[^]` (GO) into a wall now stops with a message like "KURA walks into solid stone." No day is spent, and KURA no longer spins to the next door.
- The end of the week is now deadly: if the stairs aren't taken by the 7th day on a floor, the next action ends the run. The party falls to 0 HP, the view goes dark, and only RST starts over. (This replaces the old placeholder that dropped KURA to the next floor.)
- The three log lines each have one job. Line 1 (moon and demons) changes once per real day. Line 2 describes KURA's latest action: moving, searching, turning, walking into a wall. Line 3 is flavor, with the occasional faint clue, and changes when a day passes.
- FACE on the bottom line is replaced by STEP, a count of every action KURA has taken: GO, SEARCH and turning (`STEP 012`). Bumping a wall doesn't count.

## v0.9 - Oct 6 2026, 09:15 HST

- Turn controls at the foot of the 3D view: `[^]` walks forward, `[<]` and `[>]` turn, and the letter between them shows which way KURA faces. Click them or use the arrow keys.
- Turning writes "KURA turns to face EAST." (free, no day spent), so direction words show up in actions as well as movement.
- The "[L]OAD returns to the saved game" note under the screen is gone.
- The first log line is now a mysterious word on the moon, the demons or both ("Demons drowse in the corners.", "The moon is a white eye, wide open."), with no phase number since the moon bar shows it. Five versions per phase, changing with each new day.

## v0.8 - Oct 6 2026, 08:16 HST

- The save status moved into the bottom border (`SAVED 2026-10-06` or a gold `NOT SAVED`), so all three log lines are free for the game.
- Log lines only name a direction when stating a character's action, such as "KURA goes WEST into a new room". Doors and hints never give a direction away; the map, the room view and FACE show where things are.
- Doors are only counted when KURA first searches a room ("A single door." / "Two doors.").
- Turning no longer writes a log line. After GO or SEARCH, the third line is atmosphere. About half the time it carries a faint clue about the room or the door KURA faces (a hollow floor, a cold draft, a glint), never a direction.
- The save status shows for a few seconds after loading or playing, then fades back into the border.
- The clock's colon blinks more slowly.

## v0.7 - Oct 6 2026, 08:02 HST

- The clock is live: the colon blinks every second and the time changes the moment the minute turns over.
- The minimap is centered on KURA: her room stays in the middle and the floor moves around her.
- The README links to the playable page.

## v0.6 - Oct 6 2026, 07:53 HST

- The game now plays on real floors. The minimap, the room view and the second log line all follow KURA.
- `[G]O` (or the up arrow) walks through the door KURA faces, or down the stairs once they're found. Facing a wall, GO turns to the next way out instead. The left and right arrows turn KURA. Turning is free.
- `SE[A]RCH` (or A) turns up the next hidden thing in the room: demons (damage and ICHOR), items, SILVER, the `?` or the stairs. A room with nothing left can't be searched.
- GO and SEARCH each use up a day. NEXT picks a day's action by itself, as a testing shortcut.
- If the week runs out without finding the stairs, the floor gives way and KURA falls to the next floor (a placeholder rule).
- RST starts a new run on a fresh B1F.
- MAG is now ICHOR.

## v0.5 - Oct 6 2026, 07:43 HST

- Floor generation in the new `floor.js`. Each floor is 3 rooms in a 3x3 grid, joined by doors in a line or an L. KURA starts in the up-stairs room.
- The stairs down are hidden in one of the other rooms. Every room hides 1-3 things (demons, items, SILVER, the stairs, sometimes the `?`), and searching turns them up one at a time. Walking straight to the stairs room and searching it always fits in the 7-day week.
- Most floors have a `?`: a shop, special room or rare item, shown in the dark until it's found.
- New minimap for floors: only rooms KURA has been in are drawn, as `[   ]`, with doors `╫` (side by side) and `═` (stacked). Floors aren't wired into NEXT or the save yet.
- MACCA is now SILVER.

## v0.4 - Oct 6 2026, 06:57 HST

- `[N]EXT`, `[L]OAD` and `[R]ST` buttons in the bottom border of the page. Click them or press N, L or R.
- NEXT rerolls a placeholder room (random map, room view, HP/MP, MACCA, MAG) and RST starts a new run. Both happen only in your browser and are never saved; a `NOT SAVED` note shows until you LOAD.
- LOAD reloads the saved game from GitHub.
- Random rolls live in the new `rules.js`.

## v0.3 - Oct 6 2026, 06:42 HST

- New fog-of-war minimap: visited rooms are `□`, unexplored rooms stay hidden, and a lone gold `?` waits in the dark (a lure, not the exit).
- Stairs: `⋰↑` up, `↓⋱` down.
- Text is soft white instead of green-tinted, KURA's arrow is pure white, and the screen is slightly bigger on computers.
- Map symbols are boxed to exactly one character so the right border stays straight in any font; plain characters like `?` and the arrow use the retro screen font.

## v0.2 - Oct 6 2026, 05:59 HST

- MACCA and MAG share one line; the party panel uses the full width.
- KURA is drawn on the minimap as an arrow showing the facing direction (`^ > v <`), and the bottom line reads `ALIGN [NEU]  FACE E  DAY 004`.
- The page refreshes once a minute and picks up new saves without reloading.

## v0.1 - Oct 6 2026, 05:43 HST

- First screen on the web: an 80-column Shin Megami Tensei-style dungeon screen drawn from `save.json`, with the live Honolulu date, time and moon phase.
- The same drawing code (`screen.js`) is used by the web page, the `/smt-screen` chat command and the morning screen.
