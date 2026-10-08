# Archived: the /smt-screen chat skill

Retired Oct 7 2026 (HST). The web page is the real game; this was the chat-based front end that played `save.json`. Kept here for history, exactly as it was at retirement.

---

---
name: "smt-screen"
description: "Show the user's Shin Megami Tensei-style ASCII daily-dungeon screen from their GitHub repo okayline/daily-dungeon, play (step, turn, search, fight, talk, give, use items) or reset the chat run without saving, load the saved game, or save it as a commit. Use when they type /smt-screen with or without a command, or ask for their SMT moon screen."
---

# SMT daily dungeon screen

The game lives in the user's public GitHub repo `okayline/daily-dungeon` (branch `main`):

- `save.json` is the CHAT RUN, the one this command plays. Every save is a commit whose message is the log line, so the commit history is its adventure log. (The web page at https://okayline.github.io/daily-dungeon/ doesn't read it: every page visitor has their own run in their browser.)
- `screen.js` is the one renderer, shared by the page and this command, so they always look the same. It draws the live date, time (Honolulu for the chat run) and moon, and checks every line is exactly 80 columns (the weekday kanji counts as 2). The screen, top to bottom: the moon panel (block moon, phase bar, moon note); the 3D view with `[^]` (the day's step) above `[<] N [>]` (turning, N = the way KURA faces), beside the party, SILVER/ICHOR, the minimap and `ALIGN [NEU] TURN DAY`; the day's OMEN in a frame under the 3D view; three log lines; the menu `[F]IGHT [T]ALK [I]NVOKE [S]EARCH`; and the border `[?] [L]OG [P]ASS [R]ESET` with SAVED/NOT SAVED (drawn from the save's `saved` and `unsaved` fields, never in the log lines).
- The three log lines: line 1 is the STATUS report (`status`, set by the rules: news like "First floor. 5 days until the way down closes." or a readout like "Conditions: humid. Odor of mold."; it changes every 5-10 actions), line 2 is what the last action did (`log`), line 3 is voices and flavor (`extra`: party replies, finds, warnings, clues).
- `floor.js` rolls floors: 3 rooms in a 3x3 grid joined by doors, stairs down hidden behind a wall. Minimap, one symbol per room: `[@]` KURA, `[^]` the way up, `[v]` stairs down once found, `[?]` a locker, `[ ]` visited; doors `=` and `‖`.
- `rules.js` is the rules, shared with the page buttons. Read it when unsure; the game is built piece by piece, so never invent rules beyond what it does.

Key rules in short: days follow the real calendar. KURA gets ONE step per real day (`go`, through a door or down found stairs; the stairs don't use the step; a wall or a second step that day stops her with a message and costs nothing). Searching, turning, talking and items are unlimited but each counts a TURN; searching heats the room and risks a wandering demon (more at full moon). Each floor's way down closes at the end of a Sunday; taking the stairs early gives bonus days. Missing the deadline, or KURA falling, ends the run (`dead`): only `reset` starts again. Demons stay until fought, talked down, or escaped; a demon that listens asks for a gift. KURA is the only human; the party (ELF, PIXIE, CU SITH and any recruits) are demons with alignments, and each has hidden patience. Money is SILVER (save field `silver`, formerly MACCA); the demon resource is ICHOR (`ichor`, formerly MAG). The layout is described in memory at `/topics/smt-ascii-screen.md`.

## Saved game vs. working copy

Inside a conversation there is a WORKING COPY of the chat run at `smt-work/save.json` in the scratch folder. Every play command changes only the working copy. Nothing reaches GitHub until the user runs `/smt-screen save`. The user does not want commits they did not ask for: `save` is the ONLY command that commits, and this skill never commits `screen.js`, `rules.js`, `floor.js`, `index.html` or any other file.

## Getting the files

```bash
mkdir -p smt-work && cd smt-work
for f in screen.js rules.js floor.js; do
  gh api repos/okayline/daily-dungeon/contents/$f -H "Accept: application/vnd.github.raw" > $f
done
# only when there is no working copy yet, or for load:
gh api repos/okayline/daily-dungeon/contents/save.json -H "Accept: application/vnd.github.raw" > save.json
```

If `gh api` fails, attach the repo with the `add_repo` tool (owner `okayline`, repo `daily-dungeon`, access `push`), clone it, and copy the files from the clone. If neither works, tell the user plainly that the save could not be reached and stop. raw.githubusercontent.com is blocked by the network proxy, so do not use it.

## Catching up and playing

Before showing or playing, catch the run up with the real date (a new day, or a missed deadline):

```bash
node -e 'const fs=require("fs"),R=require("./rules.js");const s=R.tick(JSON.parse(fs.readFileSync("save.json","utf8")));fs.writeFileSync("save.json",JSON.stringify(s,null,1))'
```

To play, run one rules call. ARGS is a JSON array of the extra arguments (`'[]'` when there are none):

```bash
node -e 'const fs=require("fs"),R=require("./rules.js");const [a,args]=[process.argv[1],JSON.parse(process.argv[2]||"[]")];const s=R[a](JSON.parse(fs.readFileSync("save.json","utf8")),...args);fs.writeFileSync("save.json",JSON.stringify(s,null,1))' ACTION 'ARGS'
```

| Command | ACTION and ARGS |
|---|---|
| step (`go`, `step`, `^`) | `go` `'[]'` walks the way KURA faces; `go` `'["N"]'` (or E, S, W) for a direction |
| turn | `turn` `'["L"]'` or `'["R"]'` |
| search | `search` `'[]'` |
| fight | `fight` `'[]'` |
| talk | `talk` `'[]'` (the demon if one is here; otherwise KURA talks to the party) |
| give (the demon asked for a gift) | list the choices first: `node -e 'const R=require("./rules.js");R.gifts(require("./save.json")).forEach((g,i)=>console.log(i+1, g.label, g.ok?"":"(not enough)"))'`, then `give` `'[N-1]'` for choice N, or `give` `'[null]'` for nothing |
| yes / no (a demon offers to join) | `answer` `'[true]'` or `'[false]'` |
| send someone away (party full) | `swap` `'[i]'` with i = 1-3 (party slot; KURA is 0 and can't leave), or `'[null]'` to keep everyone |
| run (in a fight) | `go` `'[]'` through the door KURA faces, or `go` `'["E"]'` etc. (uses the day's step; may be blocked) |
| use an item | `useItem` `'["exact item name"]'` |
| reset | `reset` `'[]'` |
| next (testing only) | `next` `'[]'` jumps the game a day ahead; use only if the user asks |

To list the bag: `node -e 'const R=require("./rules.js");R.inventory(require("./save.json")).forEach(it=>console.log(it.tier, it.align||"", it.name, it.count>1?"x"+it.count:""))'`

During an encounter, after the action print the save's `round` lines (demon voices, strikes, gifts, joins) under the screen, plus the choices that apply now: FIGHT / TALK / RUN normally; the numbered gift list when `encounter.stage` is `"gift"`; YES / NO when it is `"join"`; the party slots when it is `"swap"`.

After a play command, KEEP the lines the rules wrote: line 1 (`status`), line 2 (`log`) and line 3 (`extra`, which may carry a clue tied to the hidden floor). Never replace or second-guess them.

## Fresh third line (only for show and save)

When showing or saving without a play command, you may write ONE fresh, ORIGINAL third line in the terse, mechanical system-message register of 80s/90s dungeon games (never quote any actual game), different every time. It goes in `extra`; the other lines stay. Make it pure flavor fitting the room view and the party as it is now (read `party` from the save; recruited demons speak in their family's voice). Never do this when the game is over (`dead`) or when line 3 warns that the way down closes tonight; keep those lines.

- Direction words (NORTH, EAST, SOUTH, WEST) appear only when stating a character's action, for any character. Never use a direction in a description, a hint or a door count, and never let an action give away where the stairs or the `?` are.
- Never hint at where the stairs or the `?` are; clues come only from the rules, and they are always subtle and never explicit.
- Never mention how many doors a room has; that only comes from searching.
- Never write a save status ("GAME SAVED", "Not saved"); that lives in the bottom border.
- Starts with "> ", at most 74 characters, plain ASCII.

## Render

```bash
node -e 'const {renderScreen}=require("./screen.js");const s=require("./save.json");console.log(renderScreen(s,process.argv[1]||s.extra))' "> the third line"
```

Leave the argument off to keep the rules' third line. It throws if any line is not exactly 80 columns; shorten the line and rerun. Reply with the screen in a code block (plus the round lines and choices during an encounter) and at most one short line. No questions at the end.

## Commands

- `/smt-screen` (show): catch up, then show the working copy if one exists in this conversation, otherwise the saved chat run. Never commits.
- Play commands: `go` / `step` / `^` (optionally with N, E, S or W), `turn L`, `turn R`, `search`, `fight`, `talk`, `give N` / `give nothing`, `yes`, `no`, `swap N` / `keep`, `run`, `use <item>`: catch up, play as above on the working copy, then render. Never commits.
- `/smt-screen bag`: list the inventory. Never commits.
- `/smt-screen next`: testing only; jumps the game a day ahead. Never commits.
- `/smt-screen reset`: new run on the working copy, then render. Mention that `/smt-screen load` brings back the saved run. Never commits.
- `/smt-screen load`: overwrite the working copy with `save.json` fetched fresh from GitHub, discarding unsaved play, catch up, then render. Never commits.

### `/smt-screen save` (commit the working copy)
The only command that commits. Set `"saved"` to today's Honolulu date (YYYY-MM-DD) and delete the `"unsaved"` field. Keep `"extra"` as it is (never a save message). Then commit with git (the GitHub file-write API is blocked by the proxy, so do not use `gh api -X PUT`):

```bash
# clone once per session (add_repo with access push first if needed)
git clone --depth 1 https://github.com/okayline/daily-dungeon /home/claude/daily-dungeon 2>/dev/null || git -C /home/claude/daily-dungeon pull -q
cp smt-work/save.json /home/claude/daily-dungeon/save.json
cd /home/claude/daily-dungeon && git add save.json && \
  git -c user.name=okayline -c user.email=okayline@users.noreply.github.com commit -q -m "Day NNN  <message>" && git push -q
```

Use the zero-padded day number, two spaces, then the `log` text without the leading "> " and any "Day N. " prefix. If the push is rejected because the remote moved (for example the user edited the README on GitHub), pull with rebase and push again. Render and confirm the commit; the border then reads SAVED with the date. If the push fails, say plainly that the game was NOT saved.