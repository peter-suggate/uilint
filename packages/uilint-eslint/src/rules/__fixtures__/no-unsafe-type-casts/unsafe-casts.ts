/**
 * Fixture: Unsafe Type Casts
 *
 * This file contains various unsafe type casting patterns that should be
 * detected by the no-unsafe-type-casts rule.
 */

interface User {
  id: number;
  name: string;
  email: string;
}

interface ApiResponse {
  data: unknown;
  status: number;
}

// ============================================
// AS ANY PATTERNS - Should be flagged
// ============================================

// Simple as any
export function processResponse(response: ApiResponse) {
  // ERROR: as any bypasses type checking
  const data = response.data as any;
  return data.nonExistentProperty; // No compile error, but runtime crash
}

// as any in function argument
export function sendToApi(endpoint: string, payload: unknown) {
  // ERROR: as any in function call
  fetch(endpoint, { body: JSON.stringify(payload as any) });
}

// as any to access properties
export function getNestedValue(obj: object) {
  // ERROR: using as any to access arbitrary properties
  return (obj as any).deeply.nested.value;
}

// ============================================
// DOUBLE-CAST PATTERNS - Should be flagged
// ============================================

// Classic double-cast to force type
export function parseUser(jsonData: unknown): User {
  // ERROR: double-cast bypasses type checking completely
  return jsonData as unknown as User;
}

// Double-cast with any
export function convertData(input: string): number[] {
  // ERROR: double-cast via any
  return input as any as number[];
}

// Double-cast in complex expression
export function transformResponse(response: ApiResponse) {
  // ERROR: double-cast to force incompatible types
  const users = response.data as unknown as User[];
  return users.map((u) => u.email);
}

// ============================================
// LEGACY SYNTAX PATTERNS - Should be flagged
// ============================================

// Legacy <any> syntax
export function legacyAny(value: unknown) {
  // ERROR: legacy angle-bracket any cast
  return <any>value;
}

// Legacy double-cast
export function legacyDoubleCast(data: unknown): User {
  // ERROR: legacy double-cast syntax
  return <User><unknown>data;
}

// ============================================
// SAFE PATTERNS - Should NOT be flagged
// ============================================

// Type guard usage
function isUser(data: unknown): data is User {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data &&
    "email" in data
  );
}

export function safeParseUser(data: unknown): User | null {
  // VALID: using type guard instead of cast
  if (isUser(data)) {
    return data;
  }
  return null;
}

// instanceof narrowing
export function handleError(error: unknown): string {
  // VALID: instanceof narrowing
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// Casting to compatible types
export function castToInterface(response: { name: string; age: number }) {
  // VALID: casting between compatible types is fine
  interface Person {
    name: string;
  }
  return response as Person;
}
