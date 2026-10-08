# dsh-adhd-session-mode

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) plugin **converted from the GitHub skill project [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)**. It takes effect **in one session at a time — never globally**.

One system-prompt section rewrites how the assistant replies — action first, numbered steps, concrete time estimates, no preamble or closers — and every session switches it on or off on its own.

## Origin

The upstream project is an output-style skill for several coding assistants and ships no DeepSeek Harness code. This repository ports its ruleset to DSH and adds the harness integration the original had no equivalent for: a system-prompt section, a `/i-have-adhd` command, a session-log projection that holds the per-session state, and a badge below the composer.

The ruleset in [`skill/SKILL.md`](./skill/SKILL.md) is upstream's text reproduced verbatim under its MIT licence — see [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md). Everything else here is original.

## Why per-session

Output style is not a global preference; it depends on what the conversation is for.

Sometimes you need the model to explain something properly — to walk through a mechanism, weigh trade-offs, or answer a question where the detail *is* the answer. A mode that compresses every reply into a numbered action list actively gets in the way there. At other times you are executing: you know what you want, you want the next move and nothing around it, and a five-paragraph lead-in is pure cost.

A single global switch forces one of those to lose. So this plugin makes the mode a property of the session:

- Turn it on in the sessions where you are executing.
- Leave it off in the sessions where you are reading and thinking.
- Both can be open at the same time, and neither remembers the other's choice.

It is not a setting you flip and forget; it is a decision you make per conversation, which is the granularity at which the decision is actually made.

## Install

```sh
dsh plugin --profile <your-profile> add dsh-adhd-session-mode
```

From the source repository instead:

```sh
dsh plugin --profile <your-profile> add github:StarterMonk/dsh-adhd-session-mode
```

Then restart DeepSeek Harness. The plugin's row is a bundle patch, so the first activation needs a restart.

## Usage

In the session you want shaped:

```
/i-have-adhd on
```

`/i-have-adhd off` turns it back off, and a bare `/i-have-adhd` toggles. You can also just say **stop adhd mode** (or **normal mode**) as an ordinary message — the phrase is matched against the whole message, so `how do I stop adhd mode?` is treated as a question, not a command.

While the mode is on for a session, a small `● ADHD ON` badge sits below the composer, so the state is never a thing you have to remember.

Starting every session with it on is possible too, by overriding the row's config in your profile patch:

```yaml
- id: i-have-adhd
  name: dsh-adhd-session-mode
  config:
    alwaysOn: true
```

## How it works

| Piece | What it does |
| --- | --- |
| System-prompt section | Carries the ruleset into every model step while the session's mode is on. Registered at order `10150` — after every tool description, the harness source and the web surface, immediately before the deployment persona's closing section — so a style instruction lands last. |
| Session projection | The mode is *derived from the session log*, not from a setting. `/i-have-adhd on` is durable as `command/run`; a typed `stop adhd mode` is durable as `user/message`. Folding those two events means the mode replays correctly when a session is resumed or forked. |
| `/i-have-adhd` command | The switch. Declaring input on the command is what lets the client route `/i-have-adhd on` into it instead of submitting the line to the model as text. |
| Skill | The full ruleset is also registered as an on-demand skill, so the text can be loaded when it is wanted without turning the mode on. |
| Client badge | Reads the session's projected state through `useProjection` and renders below the composer. No harness client package is imported; styling uses `--dsw-alias-*` theme tokens only. |

Nothing is written to `$DSH_HOME` or to a config file. There is no flag file to find, and there is nothing to clean up if you uninstall.

## Relationship to other ADHD plugins

Several plugins in this space do different jobs, and it is worth being precise:

| Plugin | Job |
| --- | --- |
| [`dsh-i-have-adhd`](https://github.com/yongshuai0314/dsh-i-have-adhd) | Shapes the assistant's replies. One system-prompt section at order 50, plus three zero-argument tools (`adhd_on` / `adhd_off` / `adhd_status`) and a **global** flag file under `$DSH_HOME` that restores the mode at boot. |
| [`dsh-adhd-copilot`](https://github.com/zimai233/dsh-adhd-copilot) | Coaches the user: task breakdown, launch rituals. |
| [`adhdgofly-dsh-ext`](https://github.com/zuoguyoupan2023/adhdgofly-dsh-ext) | Highlights parts of speech in rendered Markdown. |
| **this plugin** | Shapes the assistant's replies, with the switch scoped to **one session** and its state stored in that session's log. |

The practical difference from `dsh-i-have-adhd` is the scope of the switch and where the state lives. A global flag file cannot express "on here, off there"; a per-session projection can, and because the projection folds the session log rather than holding a variable, the answer survives resume and fork without any extra bookkeeping. The trade-off is on the control surface: `dsh-i-have-adhd` can be driven by simply saying *adhd mode on* because the model has tools for it, whereas this plugin asks you to type the slash command.

Both reuse the same idea from [`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd).

## Limitations

- **Delegated subagents do not inherit the mode.** A subagent runs in its own session, and the mode is per session, so a child agent writes in the default style. Parent and child therefore differ in register. Sharing the mode with children would mean threading the parent's state through the projection's `init`, which is not implemented.
- **One mode per session, not per turn.** Turning it on or off affects the rest of that session.
- **The injected ruleset is an instruction, not a guarantee.** It shapes the model's output; it cannot force compliance. Judge it by reading a few replies.

## The ruleset

Ten rules, grouped for skimming — the full text is in [`skill/SKILL.md`](./skill/SKILL.md):

**Shape** · first line is the action · number the steps · close with one next move · park side quests
**State** · re-say where we are · estimate in real units · surface what now works
**Tone** · errors are facts · cap lists at five · no throat-clearing

With explicit overrides: harness rules outrank the mode; an "explain" request keeps the shape but opens up the depth; destructive actions still confirm first; and a three-turn debug spiral triggers one diagnostic question instead of more edits.

## Licence

MIT. The ruleset text is reproduced verbatim from
[ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) (MIT) — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md), which carries the upstream licence
in full. Everything else here is original.
