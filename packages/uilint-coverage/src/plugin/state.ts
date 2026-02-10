import type { StateDefinition, OperationState } from "uilint-core";
import { createOperationInitialState, createOperationComputed } from "uilint-core";

export interface CoveragePreparationStats {
  packageAdded: boolean;
  configModified: boolean;
  testsRan: boolean;
  coverageGenerated: boolean;
  duration: number;
}

export interface CoverageState {
  preparation: OperationState<CoveragePreparationStats>;
  coverageAvailable: boolean;
  fileCount: number;
}

export const coverageInitialState: CoverageState = {
  preparation: createOperationInitialState<CoveragePreparationStats>(),
  coverageAvailable: false,
  fileCount: 0,
};

const opComputed = createOperationComputed<CoverageState>((s) => s.preparation);

export const coverageStateDefinition: StateDefinition<CoverageState> = {
  initialState: coverageInitialState,
  computed: {
    isReady: opComputed.isReady,
    isActive: opComputed.isActive,
    hasError: opComputed.hasError,
    progressPercent: opComputed.progressPercent,
  },
  persist: {
    key: "uilint-coverage",
    include: [],
  },
};
