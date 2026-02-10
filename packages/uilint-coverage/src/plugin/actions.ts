import type { ActionHandlers, PluginContext } from "uilint-core";
import { createOperationActions } from "uilint-core";
import type { CoverageState, CoveragePreparationStats } from "./state.js";

type Handler<TPayload = void> = (
  ctx: PluginContext<CoverageState>,
  payload: TPayload
) => void | Promise<void>;

const h = <TPayload = void>(fn: Handler<TPayload>): Handler<unknown> =>
  fn as Handler<unknown>;

const preparationActions = createOperationActions<CoverageState, CoveragePreparationStats>(
  "preparation",
  {
    getOp: (s) => s.preparation,
    setOp: (op) => ({ preparation: op }),
  }
);

export const coverageActionHandlers: ActionHandlers<CoverageState> = {
  ...preparationActions,

  "start-preparation": h((ctx) => {
    ctx.dispatch("handle-preparation-start");
    ctx.websocket.send({ type: "coverage:prepare" });
  }),

  "set-coverage-available": h<{ available: boolean; fileCount: number }>((ctx, payload) => {
    ctx.setState({ coverageAvailable: payload.available, fileCount: payload.fileCount });
  }),
};
