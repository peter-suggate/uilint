import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { categorizeFile, getCategoryWeight } from "./file-categorizer";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const FIXTURES_DIR = join(__dirname, "__fixtures__/file-categorizer");

// Create test fixtures before tests run
beforeAll(() => {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  // Type files
  writeFileSync(
    join(FIXTURES_DIR, "types.d.ts"),
    `
declare module "my-module" {
  export function foo(): void;
}
`
  );

  writeFileSync(
    join(FIXTURES_DIR, "types-only.ts"),
    `
export type User = {
  id: string;
  name: string;
};

export interface Config {
  apiUrl: string;
  timeout: number;
}
`
  );

  // Constant files
  writeFileSync(
    join(FIXTURES_DIR, "config.ts"),
    `
export const API_URL = "https://api.example.com";
export const TIMEOUT = 5000;
export const ROUTES = {
  home: "/",
  about: "/about",
};
`
  );

  writeFileSync(
    join(FIXTURES_DIR, "enums.ts"),
    `
export enum Status {
  Pending = "pending",
  Active = "active",
  Completed = "completed",
}

export enum Priority {
  Low = 1,
  Medium = 2,
  High = 3,
}
`
  );

  // Core files - hooks
  writeFileSync(
    join(FIXTURES_DIR, "useAuth.ts"),
    `
import { useState, useEffect } from "react";

export function useAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Load user
  }, []);

  return { user, setUser };
}
`
  );

  // Core files - components
  writeFileSync(
    join(FIXTURES_DIR, "Button.tsx"),
    `
import React from "react";

export function Button({ children, onClick }) {
  return <button onClick={onClick}>{children}</button>;
}
`
  );

  writeFileSync(
    join(FIXTURES_DIR, "Card.tsx"),
    `
export const Card = ({ title, children }) => {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
};
`
  );

  // Core files - services
  writeFileSync(
    join(FIXTURES_DIR, "user.service.ts"),
    `
export async function getUser(id: string) {
  const response = await fetch(\`/api/users/\${id}\`);
  return response.json();
}

export async function updateUser(id: string, data: any) {
  const response = await fetch(\`/api/users/\${id}\`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return response.json();
}
`
  );

  // Core files - stores
  writeFileSync(
    join(FIXTURES_DIR, "auth.store.ts"),
    `
import { create } from "zustand";

export const useAuthStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
`
  );

  // Core files - API
  writeFileSync(
    join(FIXTURES_DIR, "users.api.ts"),
    `
export const usersApi = {
  getAll: () => fetch("/api/users"),
  getById: (id: string) => fetch(\`/api/users/\${id}\`),
  create: (data: any) => fetch("/api/users", { method: "POST", body: JSON.stringify(data) }),
};
`
  );

  // Utility files
  writeFileSync(
    join(FIXTURES_DIR, "formatDate.ts"),
    `
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function formatTime(date: Date): string {
  return date.toTimeString().split(" ")[0];
}
`
  );

  writeFileSync(
    join(FIXTURES_DIR, "validators.ts"),
    `
export function isValidEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

export function isValidPhone(phone: string): boolean {
  return /^\\d{10}$/.test(phone);
}
`
  );

  // Mixed files (types + functions)
  writeFileSync(
    join(FIXTURES_DIR, "helpers.ts"),
    `
export type HelperResult<T> = {
  data: T;
  error: string | null;
};

export function wrapResult<T>(data: T): HelperResult<T> {
  return { data, error: null };
}

export function wrapError<T>(error: string): HelperResult<T> {
  return { data: null as T, error };
}
`
  );

  // Mixed constants + types
  writeFileSync(
    join(FIXTURES_DIR, "constants-with-types.ts"),
    `
export type Theme = "light" | "dark";

export const DEFAULT_THEME: Theme = "light";
export const THEMES: Theme[] = ["light", "dark"];
`
  );
});

// Clean up fixtures after tests
afterAll(() => {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe("categorizeFile", () => {
  describe("type files", () => {
    it("categorizes .d.ts files as type with weight 0", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "types.d.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("type");
      expect(result.weight).toBe(0);
      expect(result.reason).toContain(".d.ts");
    });

    it("categorizes files with only type exports as type", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "types-only.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("type");
      expect(result.weight).toBe(0);
      expect(result.reason).toContain("type/interface");
    });
  });

  describe("constant files", () => {
    it("categorizes files with only const exports as constant with weight 0.25", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "config.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("constant");
      expect(result.weight).toBe(0.25);
      expect(result.reason).toContain("constant");
    });

    it("categorizes enum-only files as constant", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "enums.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("constant");
      expect(result.weight).toBe(0.25);
    });
  });

  describe("core files", () => {
    it("categorizes hooks (use*.ts) as core with weight 1.0", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "useAuth.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("core");
      expect(result.weight).toBe(1.0);
      expect(result.reason).toContain("hook");
    });

    it("categorizes React components (files with JSX) as core", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "Button.tsx"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("core");
      expect(result.weight).toBe(1.0);
      expect(result.reason).toContain("JSX");
    });

    it("categorizes arrow function components with JSX as core", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "Card.tsx"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("core");
      expect(result.weight).toBe(1.0);
      expect(result.reason).toContain("JSX");
    });

    it("categorizes .service.ts files as core", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "user.service.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("core");
      expect(result.weight).toBe(1.0);
      expect(result.reason).toContain("service");
    });

    it("categorizes .store.ts files as core", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "auth.store.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("core");
      expect(result.weight).toBe(1.0);
      expect(result.reason).toContain("store");
    });

    it("categorizes .api.ts files as core", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "users.api.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("core");
      expect(result.weight).toBe(1.0);
      expect(result.reason).toContain("API");
    });
  });

  describe("utility files", () => {
    it("categorizes general .ts files with functions as utility with weight 0.5", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "formatDate.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("utility");
      expect(result.weight).toBe(0.5);
    });

    it("categorizes validator files as utility", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "validators.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("utility");
      expect(result.weight).toBe(0.5);
    });
  });

  describe("edge cases", () => {
    it("handles mixed files (types + functions) as utility", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "helpers.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("utility");
      expect(result.weight).toBe(0.5);
    });

    it("handles non-existent files gracefully", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "does-not-exist.ts"),
        FIXTURES_DIR
      );
      expect(result.category).toBe("utility");
      expect(result.weight).toBe(0.5);
      expect(result.reason).toContain("not found");
    });

    it("handles files with mixed constants and types", () => {
      const result = categorizeFile(
        join(FIXTURES_DIR, "constants-with-types.ts"),
        FIXTURES_DIR
      );
      // Has both type exports and const exports, so not pure type or pure constant
      // Should be utility since it has const exports alongside types
      expect(["utility", "constant"]).toContain(result.category);
    });
  });
});

describe("getCategoryWeight", () => {
  it("returns 1.0 for core", () => {
    expect(getCategoryWeight("core")).toBe(1.0);
  });

  it("returns 0.5 for utility", () => {
    expect(getCategoryWeight("utility")).toBe(0.5);
  });

  it("returns 0.25 for constant", () => {
    expect(getCategoryWeight("constant")).toBe(0.25);
  });

  it("returns 0 for type", () => {
    expect(getCategoryWeight("type")).toBe(0);
  });
});
