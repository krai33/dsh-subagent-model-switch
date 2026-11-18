# dsh-subagent-model-switch

Switch the LLM route of a **live subagent session** in place — no re-delegation, no lost context.

## Why

DSH subagents fix their provider/model at creation time. When a teammate's
model runs out of quota, fails repeatedly, or the task has moved into a phase
where a cheaper model suffices, the only built-in answer is to start a *new*
subagent and re-establish its context — expensive in tokens, disruptive for
durable team setups (task-board ownership, message routing, accumulated
workspace knowledge).

The data plane for in-place switching already exists in DSH: every Agent's
`AgentModel` folds `model/selection` events into its projection, the recorded
choice applies at the next step boundary, and cold restores replay it. The
stock `session/selectModel` RPC simply refuses sessions owned by a subagent
tree. This plugin exposes exactly that operation for a human operator.

## What it does

- Registers a Host service with a Typert RPC endpoint `subagentRoute/switch`.
- Validates the target route through the same `llm.resolveCallConfig`
  preflight the stock selector uses.
- Records a `model/selection` event on the child Session via the live Agent's
  `model.select()`. The child's next step uses the new route; a running step
  finishes on its captured selection.
- No allowlist applies: this is a human-authorized channel, matching the trust
  model of the main-session selector. (The subagent tool's route allowlist
  guards *model-initiated* delegation and is unaffected.)

## Install

```sh
dsh plugin --profile web add <this-package-source>
dsh --profile web   # restart the host to load the plugin
```

## Use

CLI (from this package):

```sh
dsh-subagent-model-switch <childSessionId> <provider> <model> [reasoningEffort]
# e.g.
dsh-subagent-model-switch 1a624765-… zai glm-5.3
```

`DSH_URL` overrides the host base URL (default `http://127.0.0.1:3080`).

Raw RPC (any client that can POST the host's `/api` channel):

```
POST /api/subagentRoute/switch
{"type":"client-request","rpcId":"1","method":"subagentRoute/switch",
 "payload":{"args":{"sessionId":"…","provider":"zai","model":"glm-5.3"}}}
```

Response: `{"selected":{…},"lastUsed":{…}}` (previous route, when one exists).

## Limitations

- **Live children only.** The child must be running or resident (an idle
  continuable child stays resident; `send_message` wakes it). A child that
  was fully unloaded has no live Agent to accept the event — wake it first
  (e.g. via `send_message`) or switch after its next materialization.
- The child must be a **local** (in-process) subagent. External providers
  (ACP/Codex/Claude Code) own their process and cannot be re-routed.
- The child's `[model changed: …]` notice appears in its own session; the
  parent is not notified (match main-session behavior).

## Development

```sh
npm install   # links dsh deps matching the installed dsh CLI
npm run build
npm run check
```

## How it works (implementation notes)

- `SubagentRouteService extends TypertRemoteService` — the gateway discovers
  any service with a `typertRemote` binding, so no DSH source is modified.
- Ownership guard untouched: the stock guard rejects treating a subagent
  session as an independent *root*; this service appends one event to the
  child's own Session through its live Agent and never touches the
  delegation tree.
- Event, projection, and switch-notice semantics are entirely DSH's:
  `model/selection` → projection `pending` → next `request/header` retires
  it. Durable and replayable like a main-session switch.

License: MIT
