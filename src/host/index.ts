/**
 * Host service: switch the LLM route of a live subagent (continuable) session
 * in place by recording a `model/selection` event on the child Session.
 *
 * DSH's own `session/selectModel` RPC rejects sessions owned by a subagent
 * tree (subagent ownership guard in dsh-api-session-controller). That guard
 * protects the delegation tree from being driven as an independent root; an
 * in-place route switch records one event, does not touch tree structure,
 * task boards, or message routing, so this service exposes exactly that
 * operation for a human operator.
 *
 * Mechanism: every Agent's `AgentModel` folds `model/selection` into its
 * projection; the recorded choice becomes `pending` and applies at the
 * child's next step boundary. Cold restores replay the same event, so the
 * switch survives restarts.
 */

import type { Context } from '@deepseek-ai/cordis'
import { brandString } from '@deepseek-ai/dsh-brand'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteErrorDetailsMap } from '@deepseek-ai/dsh-typert-protocol'
import type { ReasoningEffortId } from '@deepseek-ai/dsh-llm'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Request validation refused the switch; fields are missing or empty. */
    'subagentRoute/invalid-request': {}
    /** No live Agent holds the named subagent session. */
    'subagentRoute/not-live': { readonly sessionId: string }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    agents: import('@deepseek-ai/dsh-agent').AgentRegistry
    llm: import('@deepseek-ai/dsh-llm').LlmRuntime
  }
}

/** One provider/model route with optional effort. */
export interface RouteSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** Request body of one route switch. */
export interface SwitchRequest extends RouteSelection {
  /** Child session id (the subagent id returned by the subagent tool). */
  sessionId: string
}

/** Response of one successful switch. */
export interface SwitchValue {
  /** The recorded selection (normalized). */
  selected: RouteSelection
  /** Route used by the child's most recent recorded request, when one exists. */
  lastUsed?: { provider: string; model: string }
}

/** Non-empty string check shared by request validation. */
function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export class SubagentRouteService extends TypertRemoteService {
  static inject = ['agents', 'llm', 'sessions', 'sessionQuery', 'typertGateway']

  constructor(ctx: Context) {
    super(ctx, 'subagentRoute', { namespace: 'subagentRoute' })
  }

  /**
   * Record a model selection on a live subagent session.
   * @param request - child session id and the target route.
   * @returns the normalized selection and the child's previous route.
   */
  @Remote('switch')
  async switch(request: SwitchRequest): Promise<SwitchValue> {
    if (!nonEmpty(request?.sessionId) || !nonEmpty(request?.provider) || !nonEmpty(request?.model)) {
      throw new RemoteError(
        'subagentRoute/invalid-request',
        'switch requires sessionId, provider, and model as non-empty strings',
        {},
      )
    }
    const agent = this.ctx.agents.get(request.sessionId as never)
    if (agent === undefined) {
      throw new RemoteError(
        'subagentRoute/not-live',
        `no live Agent for session "${request.sessionId}"; the child must be running or resident (idle continuable)`,
        { sessionId: request.sessionId },
      )
    }
    const header = agent.session.requestHeader()?.config
    const lastUsed = header === undefined
      ? undefined
      : { provider: header.provider, model: header.model }

    // Preflight the route exactly like session/selectModel does before append.
    const effort = request.reasoningEffort === undefined
      ? undefined
      : brandString<ReasoningEffortId>(request.reasoningEffort)
    await this.ctx.llm.resolveCallConfig({
      provider: request.provider,
      model: request.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    })
    agent.model.select({
      provider: request.provider,
      model: request.model,
      ...effort === undefined ? {} : { reasoningEffort: effort },
    })
    return {
      selected: {
        provider: request.provider,
        model: request.model,
        ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
      },
      ...lastUsed === undefined ? {} : { lastUsed },
    }
  }
}

export const name = 'subagent-model-switch'
export const inject = SubagentRouteService.inject

export function apply(ctx: Context, _config: Record<string, never> = {}): void {
  void _config
  ctx.plugin(SubagentRouteService)
}

export default SubagentRouteService
