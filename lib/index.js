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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { brandString } from '@deepseek-ai/dsh-brand';
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
/** Non-empty string check shared by request validation. */
function nonEmpty(value) {
    return typeof value === 'string' && value.length > 0;
}
let SubagentRouteService = (() => {
    let _classSuper = TypertRemoteService;
    let _instanceExtraInitializers = [];
    let _switch_decorators;
    return class SubagentRouteService extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _switch_decorators = [Remote('switch')];
            __esDecorate(this, null, _switch_decorators, { kind: "method", name: "switch", static: false, private: false, access: { has: obj => "switch" in obj, get: obj => obj.switch }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        static inject = ['agents', 'llm', 'sessions', 'sessionQuery', 'typertGateway'];
        constructor(ctx) {
            super(ctx, 'subagentRoute', { namespace: 'subagentRoute' });
            __runInitializers(this, _instanceExtraInitializers);
        }
        /**
         * Record a model selection on a live subagent session.
         * @param request - child session id and the target route.
         * @returns the normalized selection and the child's previous route.
         */
        async switch(request) {
            if (!nonEmpty(request?.sessionId) || !nonEmpty(request?.provider) || !nonEmpty(request?.model)) {
                throw new RemoteError('subagentRoute/invalid-request', 'switch requires sessionId, provider, and model as non-empty strings', {});
            }
            const agent = this.ctx.agents.get(request.sessionId);
            if (agent === undefined) {
                throw new RemoteError('subagentRoute/not-live', `no live Agent for session "${request.sessionId}"; the child must be running or resident (idle continuable)`, { sessionId: request.sessionId });
            }
            const header = agent.session.requestHeader()?.config;
            const lastUsed = header === undefined
                ? undefined
                : { provider: header.provider, model: header.model };
            // Preflight the route exactly like session/selectModel does before append.
            const effort = request.reasoningEffort === undefined
                ? undefined
                : brandString(request.reasoningEffort);
            await this.ctx.llm.resolveCallConfig({
                provider: request.provider,
                model: request.model,
                ...effort === undefined ? {} : { reasoningEffort: effort },
            });
            agent.model.select({
                provider: request.provider,
                model: request.model,
                ...effort === undefined ? {} : { reasoningEffort: effort },
            });
            return {
                selected: {
                    provider: request.provider,
                    model: request.model,
                    ...request.reasoningEffort === undefined ? {} : { reasoningEffort: request.reasoningEffort },
                },
                ...lastUsed === undefined ? {} : { lastUsed },
            };
        }
    };
})();
export { SubagentRouteService };
export const name = 'subagent-model-switch';
export const inject = SubagentRouteService.inject;
export function apply(ctx, _config = {}) {
    void _config;
    ctx.plugin(SubagentRouteService);
}
export default SubagentRouteService;
