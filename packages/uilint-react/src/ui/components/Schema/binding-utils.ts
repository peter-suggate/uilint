/**
 * Data Binding Utilities
 *
 * Functions for evaluating data bindings and expressions in panel schemas.
 */

import type {
  DataBinding,
  ExpressionBinding,
  DynamicValue,
  ConditionalValue,
} from "uilint-core";

// Import type guards as values (they are functions)
import {
  isDataBinding,
  isExpressionBinding,
  isConditionalValue,
} from "uilint-core";

// Re-export type guards
export { isDataBinding, isExpressionBinding, isConditionalValue };

/**
 * Context for evaluating bindings
 */
export interface BindingContext {
  /** Panel data from inspector */
  data: Record<string, unknown>;
  /** Plugin state */
  state: Record<string, unknown>;
  /** Computed values from state definition */
  computed: Record<string, unknown>;
}

/**
 * Gets a value from an object using dot notation path
 */
export function getValueByPath(
  obj: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Resolves a data binding against the context
 */
export function resolveBinding(
  binding: DataBinding,
  ctx: BindingContext
): unknown {
  const path = binding.binding;

  // Try data first (panel data), then state, then computed
  let value = getValueByPath(ctx.data, path);
  if (value === undefined) {
    value = getValueByPath(ctx.state, path);
  }
  if (value === undefined) {
    value = getValueByPath(ctx.computed, path);
  }

  return value;
}

/**
 * Evaluates an expression binding against the context
 *
 * SECURITY NOTE: This uses Function() which is similar to eval().
 * The expressions come from trusted plugin definitions, not user input.
 */
export function evaluateExpression(
  expr: ExpressionBinding,
  ctx: BindingContext
): unknown {
  const expression = expr.expression;

  // Create a combined context object
  const combinedContext = {
    ...ctx.data,
    ...ctx.state,
    ...ctx.computed,
  };

  try {
    // Create a function that has access to context properties
    const keys = Object.keys(combinedContext);
    const values = Object.values(combinedContext);

     
    const fn = new Function(...keys, `return (${expression});`);
    return fn(...values);
  } catch (error) {
    console.warn(`[SchemaRenderer] Failed to evaluate expression: ${expression}`, error);
    return undefined;
  }
}

/**
 * Resolves a dynamic value (static value or binding)
 */
export function resolveDynamicValue<T>(
  value: DynamicValue<T>,
  ctx: BindingContext
): T | undefined {
  if (isDataBinding(value)) {
    return resolveBinding(value, ctx) as T | undefined;
  }
  return value;
}

/**
 * Resolves a conditional value based on condition binding
 */
export function resolveConditionalValue<T>(
  value: ConditionalValue<T>,
  ctx: BindingContext
): T {
  const condition = resolveBinding(value.condition, ctx);
  return condition ? value.true : value.false;
}

/**
 * Resolves any value that could be static, binding, or conditional
 */
export function resolveValue<T>(
  value: T | DataBinding | ConditionalValue<T>,
  ctx: BindingContext
): T | undefined {
  if (isConditionalValue(value)) {
    return resolveConditionalValue(value, ctx);
  }
  if (isDataBinding(value)) {
    return resolveBinding(value, ctx) as T | undefined;
  }
  return value;
}

/**
 * Evaluates a condition (DataBinding or ExpressionBinding)
 */
export function evaluateCondition(
  condition: DataBinding | ExpressionBinding,
  ctx: BindingContext
): boolean {
  if (isExpressionBinding(condition)) {
    return Boolean(evaluateExpression(condition, ctx));
  }
  return Boolean(resolveBinding(condition, ctx));
}

/**
 * Creates action payload from bindings
 */
export function createActionPayload(
  staticPayload: Record<string, unknown> | undefined,
  payloadBindings: Record<string, string> | undefined,
  ctx: BindingContext
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...staticPayload };

  if (payloadBindings) {
    for (const [key, bindingPath] of Object.entries(payloadBindings)) {
      payload[key] = resolveBinding({ binding: bindingPath }, ctx);
    }
  }

  return payload;
}
