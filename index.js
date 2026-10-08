/**
 * i-have-adhd — ADHD-friendly output rules for DeepSeek Harness.
 *
 * Port of https://github.com/ayghri/i-have-adhd (MIT) from its Pi / Claude Code
 * / OpenCode adapters to the DSH Host extension points:
 *
 *   skills/i-have-adhd/SKILL.md    ->  ctx.skills.register()
 *   SessionStart hook injection    ->  ctx.systemPrompt.section()
 *   pi.registerCommand()           ->  ctx.commands.register()
 *   pi.on("input") stop phrases    ->  a `user/message` fold in the projection
 *   pi.appendEntry() session state ->  ctx.sessionProjections.register()
 *   .i-have-adhd-always flag       ->  the row's `config.alwaysOn`
 *   ctx.ui.setStatus()             ->  the Client half's dock badge
 *
 * Omitted relative to upstream, with reasons:
 *   - session_start / session_tree / session_compact re-injection: DSH re-assembles
 *     the system prompt on every model step, so a section is already compaction-proof,
 *     and the projection's `init` covers resume and fork.
 *   - The DISABLED_NOTICE the Pi adapter injects: it existed because `pi.on("input")`
 *     SWALLOWED the user's text, leaving the model nothing to explain the rules'
 *     disappearance. Here the model always sees the phrase itself, so it would only
 *     add words.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Cordis plugin name. */
export const name = 'i-have-adhd';

/** Services this plugin needs; absent any of them the plugin stays inactive. */
export const inject = ['skills', 'systemPrompt', 'commands', 'sessionProjections'];

const SKILL_FILE = fileURLToPath(new URL('./skill/SKILL.md', import.meta.url));
const SKILL_DIR = fileURLToPath(new URL('./skill/', import.meta.url));

const COMMAND_NAME = 'i-have-adhd';
const PROJECTION_KEY = COMMAND_NAME;
/** Bump when the folded state's fields or meaning change. */
const STATE_VERSION = 1;

/**
 * Late in the system prompt: after every tool description (<= 5000), the harness
 * source (10000) and the web surface (10100), just before the deployment persona
 * suffix (10200). An output-style instruction carries the most weight last.
 * Order names come from @deepseek-ai/dsh-system-prompt SECTION_ORDERS.
 */
const SECTION_ORDER = 10150;

const FALLBACK_DESCRIPTION =
  'Shape output for a reader with ADHD: lead with the next action, number '
  + 'multi-step work, restate state across turns, suppress tangents, give '
  + 'specific time estimates, make wins visible.';

const HEADER =
  'ADHD MODE ACTIVE. The ruleset below applies to every response until turned '
  + 'off. "stop adhd mode" or "normal mode" turns it off.';

/** Upstream's STOP_PHRASES, matched against the whole user message. */
const STOP_PHRASES = new Set(['stop adhd mode', 'normal mode']);

const USAGE = 'Usage: /i-have-adhd [on|off]';
const FRONTMATTER = /^---[^\S\r\n]*\r?\n([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n|$)/;

/**
 * The registry validates state and wire view with a real `parse()`
 * (`dsh-session-projection/lib/index.js:255,259,297,305,433`), the only member it
 * ever touches. These are hand-written validators rather than zod schemas: a
 * profile-installed bundle cannot rely on resolving `zod` from outside its own
 * package, and the checks below are exactly as strict.
 */
const modeShape = {
  parse(value) {
    if (typeof value !== 'object' || value === null) throw new TypeError('i-have-adhd: expected an object');
    if (typeof value.enabled !== 'boolean') throw new TypeError('i-have-adhd: enabled must be a boolean');
    if (value.settledBy !== null && typeof value.settledBy !== 'string') {
      throw new TypeError('i-have-adhd: settledBy must be a string or null');
    }
    if (value.settledEnabled !== null && typeof value.settledEnabled !== 'boolean') {
      throw new TypeError('i-have-adhd: settledEnabled must be a boolean or null');
    }
    return { enabled: value.enabled, settledBy: value.settledBy, settledEnabled: value.settledEnabled };
  },
};

const enabledShape = {
  parse(value) {
    if (typeof value !== 'object' || value === null || typeof value.enabled !== 'boolean') {
      throw new TypeError('i-have-adhd: expected { enabled: boolean }');
    }
    return { enabled: value.enabled };
  },
};

/** Strip a leading YAML frontmatter block, matching the upstream implementation. */
function stripFrontmatter(raw) {
  return raw.replace(FRONTMATTER, '').replace(/(?:\r?\n)+$/, '');
}

/**
 * Read the top-level scalar fields of the frontmatter block, so the skill keeps
 * the SKILL.md file as its single source of truth. Nested mappings (for example
 * `metadata:`) are indented and therefore skipped.
 */
function frontmatterFields(raw) {
  const block = raw.match(FRONTMATTER);
  const fields = {};
  if (block === null) return fields;
  for (const line of block[1].split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9-]*):[ \t]*(.*)$/);
    if (match === null) continue;
    const value = match[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    if (value.length > 0) fields[match[1]] = value;
  }
  return fields;
}

/** Concatenated plain text of one message's text blocks. */
function messageText(message) {
  if (!Array.isArray(message.content)) return '';
  let text = '';
  for (const block of message.content) {
    if (block.type === 'text' && typeof block.text === 'string') text += block.text;
  }
  return text.trim().toLowerCase();
}

/**
 * Whole-message match against the stop phrases.
 *
 * Upstream compares the entire trimmed input, and that strictness is kept: a
 * question such as "how do I stop adhd mode?" must NOT switch the mode off. But a
 * trailing sentence period is not a different intention, and a real reader does
 * type `stop adhd mode.` — so terminal punctuation and trailing whitespace are
 * stripped before the comparison. Question marks are deliberately NOT stripped,
 * because that spelling is at least as likely to be a question.
 */
function isStopPhrase(message) {
  return STOP_PHRASES.has(messageText(message).replace(/[\s.!！。~～,，、;；:：]+$/u, ''));
}

/**
 * The switch one command argument means, given the state it starts from. Shared by
 * the projection fold and the command handler so the two cannot disagree.
 * @param current - whether the mode is on before this command.
 * @param argument - the trimmed, lower-cased raw input after the command name.
 * @returns whether the mode is on after it.
 */
function switched(current, argument) {
  if (argument === 'on') return true;
  if (argument === 'off' || argument === 'stop') return false;
  return !current;
}

/** Whether one command argument is accepted at all. */
function isAcceptedArgument(argument) {
  return argument === '' || argument === 'on' || argument === 'off' || argument === 'stop';
}

/**
 * Host half of the bundle.
 * @param ctx - Cordis context owning every registration below.
 * @param config - the row's `config` object from cordis.patch.yml.
 */
export function apply(ctx, config = {}) {
  const source = readFileSync(SKILL_FILE, 'utf8');
  const rules = stripFrontmatter(source);
  if (rules.length === 0) {
    throw new Error(`i-have-adhd: rules file is empty: ${SKILL_FILE}`);
  }
  const fields = frontmatterFields(source);
  const alwaysOn = config.alwaysOn === true;

  // 1. The mode itself, derived from the session log and nothing else.
  //
  //    Two durable events drive it:
  //      - `/i-have-adhd` is `command/run`, appended by `commands.execute()` BEFORE the
  //        turn exists (`dsh-commands/lib/index.js:334`), so it is folded before any
  //        assembly and the switch is immediate.
  //      - a typed "stop adhd mode" is `user/message`, appended INSIDE the loop
  //        (`dsh-agent-loop/lib/index.js:1046`) — after that step's assembly, which
  //        already ran inside `preStep()` (`:902-918`). So the plain-text switch lands
  //        one step late, exactly as an `agent/pre-step` flip would have.
  //
  //    That lag is harmless and self-correcting, which is why it is accepted rather
  //    than papered over: the step carrying the phrase still holds the ruleset, whose
  //    own Persistence section instructs the confirmation the reader expects, and the
  //    step after it is clean. Removing the lag would mean reacting to the live inbox
  //    (`agent/inbox/inserted`) with state that is not in the log — trading replay
  //    correctness across resume and fork for one step of latency.
  //
  //    `settledBy` / `settledEnabled` exist for the command handler. Because
  //    `command/run` is appended before the handler runs and the fold happens
  //    synchronously on `session/event`, a bare toggle cannot read `enabled` to learn
  //    what it just did — that value may already be the RESULT. Recording the
  //    settling command id lets the handler tell the two orderings apart.
  const disposeProjection = ctx.sessionProjections.register({
    key: PROJECTION_KEY,
    stateVersion: STATE_VERSION,
    stateSchema: modeShape,
    init: () => ({ enabled: alwaysOn, settledBy: null, settledEnabled: null }),
    apply(state, event) {
      if (event.type === 'command/run' && event.data.name === COMMAND_NAME) {
        const argument = (event.data.args ?? '').trim().toLowerCase();
        if (!isAcceptedArgument(argument)) return state;
        const enabled = switched(state.enabled, argument);
        return { enabled, settledBy: String(event.data.commandId), settledEnabled: enabled };
      }
      if (event.type === 'user/message') {
        if (!state.enabled) return state;
        // Only real user speech: injected and synthesized messages are not the reader.
        if (event.data.source?.kind !== 'user') return state;
        if (isStopPhrase(event.data)) return { enabled: false, settledBy: null, settledEnabled: null };
      }
      return state;
    },
    wire: { viewSchema: enabledShape, view: (state) => ({ enabled: state.enabled }) },
  });

  // 2. On-demand ruleset, so the model can load it when the user names it. The body
  //    carries no status header: loading it does not turn the mode on.
  const disposeSkill = ctx.skills.register({
    name: fields.name ?? COMMAND_NAME,
    description: fields.description ?? FALLBACK_DESCRIPTION,
    source: 'runtime',
    resourceBase: { kind: 'directory', path: SKILL_DIR },
    invocation: { modelInvocable: true, userInvocable: true },
    content: rules,
  });

  // 3. The ruleset, per session. `assembleContextFor` supplies `{ agent, scope: agent }`
  //    (`dsh-agent/lib/index.js:291-297`), so one global section reaches each session's
  //    own state without registering anything on `agent.ctx`.
  const disposeSection = ctx.systemPrompt.section({
    name: 'i-have-adhd:rules',
    order: SECTION_ORDER,
    text: (context) => {
      const agent = context?.agent;
      if (agent === undefined) return '';
      return ctx.sessionProjections.stateOf(agent.session, PROJECTION_KEY)?.enabled === true
        ? `${HEADER}\n\n${rules}`
        : '';
    },
  });

  // 4. /i-have-adhd [on|off]. Declaring `input` is load-bearing: the Client routes
  //    `/cmd args` into a command only when the descriptor declares one
  //    (`dsh-client-ui-commands/lib/client.js:978-989`); without it the line would be
  //    submitted to the model as ordinary text. The handler only REPORTS — the switch
  //    itself is the logged `command/run` the projection folds.
  const disposeCommand = ctx.commands.register({
    name: COMMAND_NAME,
    description: 'Toggle ADHD-friendly output for this session',
    input: { hint: '[on|off]' },
    handler: ({ agent, commandId, rawInput }) => {
      const argument = rawInput.trim().toLowerCase();
      if (!isAcceptedArgument(argument)) return { kind: 'error', text: USAGE };
      const state = ctx.sessionProjections.stateOf(agent.session, PROJECTION_KEY);
      const enabled = state?.settledBy === String(commandId)
        ? state.settledEnabled === true
        : switched(state?.enabled === true, argument);
      return { kind: 'success', text: enabled ? 'ADHD mode enabled.' : 'ADHD mode disabled.' };
    },
  });

  ctx.effect(() => () => {
    disposeCommand();
    disposeSection();
    disposeSkill();
    disposeProjection();
  }, 'i-have-adhd teardown');
}
