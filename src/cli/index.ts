/**
 * CLI: switch a live subagent session's LLM route by calling the running
 * DSH Web host's shared `/api` RPC channel.
 *
 * Usage:
 *   dsh-subagent-model-switch <childSessionId> <provider> <model> [effort]
 *
 * Environment:
 *   DSH_URL  base URL of the DSH Web host (default http://127.0.0.1:3080)
 *
 * Wire: POST /api/subagentRoute/switch with the Connection RPC envelope
 * `{type:"client-request", rpcId, method, payload}`; the response envelope
 * carries `{ok:true,value}` or `{ok:false,error}`.
 */

const USAGE = 'usage: dsh-subagent-model-switch <childSessionId> <provider> <model> [reasoningEffort]'

const args = process.argv.slice(2)
if (args.includes('-h') || args.includes('--help')) {
  console.log(USAGE)
  process.exit(0)
}
if (args.length < 3 || args.length > 4) {
  console.error(USAGE)
  process.exit(2)
}
const [sessionId, provider, model, reasoningEffort] = args as [string, string, string, string?]
if (!sessionId || !provider || !model) {
  console.error(USAGE)
  process.exit(2)
}

const baseUrl = (process.env.DSH_URL ?? 'http://127.0.0.1:3080').replace(/\/$/, '')
const endpoint = 'subagentRoute/switch'
const url = `${baseUrl}/api/${endpoint}`

interface ResponseEnvelope {
  type: 'server-response'
  rpcId: string
  result:
    | { ok: true; value?: unknown }
    | { ok: false; error: { code: string; message: string } }
}

const response = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    type: 'client-request',
    rpcId: '1',
    method: endpoint,
    payload: { args: { sessionId, provider, model, ...(reasoningEffort === undefined ? {} : { reasoningEffort }) } },
  }),
})

const text = await response.text()
let envelope: ResponseEnvelope | undefined
try {
  envelope = JSON.parse(text) as ResponseEnvelope
} catch {
  console.error(`switch failed (HTTP ${response.status}): ${text.slice(0, 500)}`)
  process.exit(1)
}

if (envelope.result?.ok === true) {
  console.log(JSON.stringify(envelope.result.value ?? {}, null, 2))
  process.exit(0)
}
if (envelope.result?.ok === false) {
  console.error(`switch failed: ${envelope.result.error.code}: ${envelope.result.error.message}`)
  process.exit(1)
}
console.error(`switch failed (HTTP ${response.status}): ${text.slice(0, 500)}`)
process.exit(1)
