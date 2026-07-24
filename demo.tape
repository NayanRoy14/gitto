# Generates demo.gif showing gitto's `/` command palette.
#
# Requires vhs (https://github.com/charmbracelet/vhs) plus its own
# dependencies (ttyd, ffmpeg, and on first run a headless Chromium that
# go-rod downloads automatically). Also requires the `gitto` command itself
# on PATH — from the repo root: `npm run build && npm link`. Then:
#
#   vhs demo.tape
#
# The script builds its own scratch git repo under the OS temp dir so the
# recording is reproducible and never touches this checkout.
#
# Assumes the machine running this is already `gitto login`-ed in (i.e.
# ~/.gitto/config.json exists) — otherwise the palette shows the first-run
# greeting and login prompt instead of jumping straight to the menu, and the
# scripted keystrokes below won't line up.

Output demo.gif

Set Shell "bash"
Set FontSize 18
Set Width 900
Set Height 560
Set Theme "Dracula"
Set TypingSpeed 60ms

# Set up a throwaway repo with something to save, so the palette's
# context-aware menu (the whole point of this demo) has "save" to show.
Hide
Type "rm -rf /tmp/gitto-demo && mkdir -p /tmp/gitto-demo && cd /tmp/gitto-demo && git init -q && git config user.email demo@example.com && git config user.name Demo && echo 'hello' > README.md"
Enter
Sleep 500ms
Type "clear"
Enter
Show

Type "gitto"
Sleep 1.5s
Enter
Sleep 1.5s

# The palette only lists actions that currently apply — "save" is here
# because README.md is untracked, but there's no "switch"/"combine" yet
# since there's only one line of work.
Down 1
Sleep 500ms
Enter
Sleep 1.5s

# Blank answer means "save everything" — typing a word here would be taken
# as a literal file/folder path to scope the save to instead.
Enter
Sleep 500ms

Type "first commit"
Sleep 500ms
Enter
Sleep 2s
