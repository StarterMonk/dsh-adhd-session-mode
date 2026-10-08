# Third-party notices

## i-have-adhd — the ruleset text

`skill/SKILL.md` reproduces the ten-rule ruleset from
[ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) **verbatim**, including its
section headings, examples, override list and pre-send checklist. Only the YAML
frontmatter was adapted for DeepSeek Harness, and an `upstream` field was added to
`metadata`.

That project is MIT licensed, and MIT requires this notice to travel with the text.
The upstream licence, reproduced in full:

```
MIT License

Copyright (c) 2026 Ayoub Ghriss

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### What is original here

Everything else: the DeepSeek Harness port itself (the system-prompt section, the
slash command, the session-log projection, the client dock badge), the bundle and its
manifest, and all documentation in this repository.

### A note on scope

The upstream project is a skill for several coding assistants and ships no DeepSeek
Harness code. This package is an independent port: it reuses the ruleset text under
the licence above and adds the harness integration that makes the mode a
per-session switch.

## DeepSeek Harness

This package imports no DeepSeek Harness package at runtime. It uses only the
services a plugin is handed through its Cordis context (`skills`, `systemPrompt`,
`commands`, `sessionProjections`) and, on the client half, the browser module table's
`react`.
