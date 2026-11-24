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
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
declare module '@deepseek-ai/dsh-typert-protocol' {
    interface RemoteErrorDetailsMap {
        /** Request validation refused the switch; fields are missing or empty. */
        'subagentRoute/invalid-request': {};
        /** No live Agent holds the named subagent session. */
        'subagentRoute/not-live': {
            readonly sessionId: string;
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        agents: import('@deepseek-ai/dsh-agent').AgentRegistry;
        llm: import('@deepseek-ai/dsh-llm').LlmRuntime;
    }
}
/** One provider/model route with optional effort. */
export interface RouteSelection {
    provider: string;
    model: string;
    reasoningEffort?: string;
}
/** Request body of one route switch. */
export interface SwitchRequest extends RouteSelection {
    /** Child session id (the subagent id returned by the subagent tool). */
    sessionId: string;
}
/** Response of one successful switch. */
export interface SwitchValue {
    /** The recorded selection (normalized). */
    selected: RouteSelection;
    /** Route used by the child's most recent recorded request, when one exists. */
    lastUsed?: {
        provider: string;
        model: string;
    };
}
export declare class SubagentRouteService extends TypertRemoteService {
    static inject: string[];
    constructor(ctx: Context);
    /**
     * Record a model selection on a live subagent session.
     * @param request - child session id and the target route.
     * @returns the normalized selection and the child's previous route.
     */
    switch(request: SwitchRequest): Promise<SwitchValue>;
}
export declare const name = "subagent-model-switch";
export declare const inject: string[];
export declare function apply(ctx: Context, _config?: Record<string, never>): void;
export default SubagentRouteService;
