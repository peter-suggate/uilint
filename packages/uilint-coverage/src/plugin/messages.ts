import type { MessageHandlers } from "uilint-core";
import { createOperationMessageHandlers } from "uilint-core";
import type { CoverageState } from "./state.js";

export interface CoverageSetupStartMessage {
  type: "coverage:setup:start";
}

export interface CoverageSetupProgressMessage {
  type: "coverage:setup:progress";
  message: string;
  phase: string;
}

export interface CoverageSetupCompleteMessage {
  type: "coverage:setup:complete";
  packageAdded: boolean;
  configModified: boolean;
  testsRan: boolean;
  coverageGenerated: boolean;
  duration: number;
  error?: string;
}

export interface CoverageSetupErrorMessage {
  type: "coverage:setup:error";
  error: string;
}

export type CoverageMessage =
  | CoverageSetupStartMessage
  | CoverageSetupProgressMessage
  | CoverageSetupCompleteMessage
  | CoverageSetupErrorMessage;

export const coverageMessageHandlers: MessageHandlers<CoverageState> = {
  ...createOperationMessageHandlers<CoverageState>({
    actionPrefix: "preparation",
    startMessage: "coverage:setup:start",
    progressMessage: "coverage:setup:progress",
    completeMessage: "coverage:setup:complete",
    errorMessage: "coverage:setup:error",
    extractProgress: (msg) => {
      const m = msg as CoverageSetupProgressMessage;
      return {
        current: 0,
        total: 0,
        message: m.message,
      };
    },
    extractStats: (msg) => {
      const m = msg as CoverageSetupCompleteMessage;
      return {
        packageAdded: m.packageAdded,
        configModified: m.configModified,
        testsRan: m.testsRan,
        coverageGenerated: m.coverageGenerated,
        duration: m.duration,
      };
    },
  }),
};
