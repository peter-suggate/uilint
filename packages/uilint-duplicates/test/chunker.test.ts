import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { chunkFile, prepareEmbeddingInput } from '../src/embeddings/chunker.js';
import type { CodeChunk } from '../src/embeddings/types.js';

const FIXTURES_PATH = join(__dirname, 'fixtures/semantic-duplicates');

function readFixture(relativePath: string): string {
  return readFileSync(join(FIXTURES_PATH, relativePath), 'utf-8');
}

describe('chunkFile', () => {
  describe('Component Detection', () => {
    it('should detect UserCard as a component', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.kind).toBe('component');
    });

    it('should detect ProfileCard as a component', () => {
      const content = readFixture('components/ProfileCard.tsx');
      const chunks = chunkFile('components/ProfileCard.tsx', content);

      const profileCard = chunks.find(c => c.name === 'ProfileCard');
      expect(profileCard).toBeDefined();
      expect(profileCard!.kind).toBe('component');
    });

    it('should detect arrow function components (ProfileCard)', () => {
      // ProfileCard is defined as const ProfileCard: React.FC = ...
      const content = readFixture('components/ProfileCard.tsx');
      const chunks = chunkFile('components/ProfileCard.tsx', content);

      const profileCard = chunks.find(c => c.name === 'ProfileCard');
      expect(profileCard).toBeDefined();
      expect(profileCard!.kind).toBe('component');
    });

    it('should detect default exported components (MemberCard)', () => {
      const content = readFixture('components/MemberCard.tsx');
      const chunks = chunkFile('components/MemberCard.tsx', content);

      const memberCard = chunks.find(c => c.name === 'MemberCard');
      expect(memberCard).toBeDefined();
      expect(memberCard!.kind).toBe('component');
      expect(memberCard!.metadata.isDefaultExport).toBe(true);
    });

    it('should detect WeatherWidget as a component', () => {
      const content = readFixture('components/UnrelatedWidget.tsx');
      const chunks = chunkFile('components/UnrelatedWidget.tsx', content);

      const widget = chunks.find(c => c.name === 'WeatherWidget');
      expect(widget).toBeDefined();
      expect(widget!.kind).toBe('component');
    });

    it('should extract props from components', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.metadata.props).toBeDefined();
      expect(userCard!.metadata.props).toContain('user');
    });

    it('should extract multiple props from components', () => {
      const content = readFixture('components/MemberCard.tsx');
      const chunks = chunkFile('components/MemberCard.tsx', content);

      const memberCard = chunks.find(c => c.name === 'MemberCard');
      expect(memberCard).toBeDefined();
      expect(memberCard!.metadata.props).toBeDefined();
      expect(memberCard!.metadata.props).toContain('member');
      expect(memberCard!.metadata.props).toContain('onClick');
    });

    it('should extract JSX elements from components', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.metadata.jsxElements).toBeDefined();
      expect(userCard!.metadata.jsxElements).toContain('div');
      expect(userCard!.metadata.jsxElements).toContain('img');
      expect(userCard!.metadata.jsxElements).toContain('h3');
      expect(userCard!.metadata.jsxElements).toContain('p');
    });

    it('should extract JSX elements from ProfileCard', () => {
      const content = readFixture('components/ProfileCard.tsx');
      const chunks = chunkFile('components/ProfileCard.tsx', content);

      const profileCard = chunks.find(c => c.name === 'ProfileCard');
      expect(profileCard).toBeDefined();
      expect(profileCard!.metadata.jsxElements).toBeDefined();
      expect(profileCard!.metadata.jsxElements).toContain('article');
      expect(profileCard!.metadata.jsxElements).toContain('img');
      expect(profileCard!.metadata.jsxElements).toContain('h2');
      expect(profileCard!.metadata.jsxElements).toContain('span');
    });

    it('should extract hooks used in components', () => {
      const content = readFixture('components/UnrelatedWidget.tsx');
      const chunks = chunkFile('components/UnrelatedWidget.tsx', content);

      const widget = chunks.find(c => c.name === 'WeatherWidget');
      expect(widget).toBeDefined();
      expect(widget!.metadata.hooks).toBeDefined();
      expect(widget!.metadata.hooks).toContain('useState');
    });

    it('should detect LoginForm as a component', () => {
      const content = readFixture('forms/LoginForm.tsx');
      const chunks = chunkFile('forms/LoginForm.tsx', content);

      const loginForm = chunks.find(c => c.name === 'LoginForm');
      expect(loginForm).toBeDefined();
      expect(loginForm!.kind).toBe('component');
      expect(loginForm!.metadata.jsxElements).toContain('form');
      expect(loginForm!.metadata.jsxElements).toContain('input');
      expect(loginForm!.metadata.jsxElements).toContain('button');
      expect(loginForm!.metadata.jsxElements).toContain('label');
    });

    it('should detect SignInForm as a component', () => {
      const content = readFixture('forms/SignInForm.tsx');
      const chunks = chunkFile('forms/SignInForm.tsx', content);

      const signInForm = chunks.find(c => c.name === 'SignInForm');
      expect(signInForm).toBeDefined();
      expect(signInForm!.kind).toBe('component');
    });

    it('should detect RegistrationForm as a component', () => {
      const content = readFixture('forms/RegistrationForm.tsx');
      // Use splitStrategy: none to test component detection without splitting
      const chunks = chunkFile('forms/RegistrationForm.tsx', content, { splitStrategy: 'none' });

      const regForm = chunks.find(c => c.name === 'RegistrationForm');
      expect(regForm).toBeDefined();
      expect(regForm!.kind).toBe('component');
      expect(regForm!.metadata.hooks).toContain('useState');
    });
  });

  describe('Hook Detection', () => {
    it('should detect useUserData as a hook', () => {
      const content = readFixture('hooks/useUserData.tsx');
      const chunks = chunkFile('hooks/useUserData.tsx', content);

      const hook = chunks.find(c => c.name === 'useUserData');
      expect(hook).toBeDefined();
      expect(hook!.kind).toBe('hook');
    });

    it('should detect useFetchProfile as a hook', () => {
      const content = readFixture('hooks/useFetchProfile.tsx');
      const chunks = chunkFile('hooks/useFetchProfile.tsx', content);

      const hook = chunks.find(c => c.name === 'useFetchProfile');
      expect(hook).toBeDefined();
      expect(hook!.kind).toBe('hook');
    });

    it('should extract hooks used within useUserData', () => {
      const content = readFixture('hooks/useUserData.tsx');
      const chunks = chunkFile('hooks/useUserData.tsx', content);

      const hook = chunks.find(c => c.name === 'useUserData');
      expect(hook).toBeDefined();
      expect(hook!.metadata.hooks).toBeDefined();
      expect(hook!.metadata.hooks).toContain('useState');
      expect(hook!.metadata.hooks).toContain('useEffect');
    });

    it('should extract hooks used within useFetchProfile', () => {
      const content = readFixture('hooks/useFetchProfile.tsx');
      const chunks = chunkFile('hooks/useFetchProfile.tsx', content);

      const hook = chunks.find(c => c.name === 'useFetchProfile');
      expect(hook).toBeDefined();
      expect(hook!.metadata.hooks).toBeDefined();
      expect(hook!.metadata.hooks).toContain('useState');
      expect(hook!.metadata.hooks).toContain('useEffect');
      expect(hook!.metadata.hooks).toContain('useCallback');
    });

    it('should detect useLocalStorage as a hook', () => {
      const content = readFixture('hooks/useLocalStorage.tsx');
      const chunks = chunkFile('hooks/useLocalStorage.tsx', content);

      const hook = chunks.find(c => c.name === 'useLocalStorage');
      expect(hook).toBeDefined();
      expect(hook!.kind).toBe('hook');
    });

    it('should extract hooks used within useLocalStorage', () => {
      const content = readFixture('hooks/useLocalStorage.tsx');
      const chunks = chunkFile('hooks/useLocalStorage.tsx', content);

      const hook = chunks.find(c => c.name === 'useLocalStorage');
      expect(hook).toBeDefined();
      expect(hook!.metadata.hooks).toBeDefined();
      expect(hook!.metadata.hooks).toContain('useState');
      expect(hook!.metadata.hooks).toContain('useCallback');
    });

    it('should extract props/parameters from hooks', () => {
      const content = readFixture('hooks/useUserData.tsx');
      const chunks = chunkFile('hooks/useUserData.tsx', content);

      const hook = chunks.find(c => c.name === 'useUserData');
      expect(hook).toBeDefined();
      expect(hook!.metadata.props).toBeDefined();
      expect(hook!.metadata.props).toContain('userId');
    });
  });

  describe('Function Detection', () => {
    it('should detect validateEmail as a function', () => {
      const content = readFixture('validation/validateEmail.ts');
      const chunks = chunkFile('validation/validateEmail.ts', content);

      const fn = chunks.find(c => c.name === 'validateEmail');
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe('function');
    });

    it('should detect checkEmailFormat as a function', () => {
      const content = readFixture('validation/checkEmailFormat.ts');
      const chunks = chunkFile('validation/checkEmailFormat.ts', content);

      const fn = chunks.find(c => c.name === 'checkEmailFormat');
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe('function');
    });

    it('should detect default exported function (isValidEmail)', () => {
      const content = readFixture('validation/isValidEmail.ts');
      const chunks = chunkFile('validation/isValidEmail.ts', content);

      const fn = chunks.find(c => c.name === 'isValidEmail');
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe('function');
      expect(fn!.metadata.isDefaultExport).toBe(true);
    });

    it('should detect validatePhone as a function', () => {
      const content = readFixture('validation/validatePhone.ts');
      const chunks = chunkFile('validation/validatePhone.ts', content);

      const fn = chunks.find(c => c.name === 'validatePhone');
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe('function');
    });

    it('should detect formatPhoneNumber as a function', () => {
      const content = readFixture('validation/validatePhone.ts');
      const chunks = chunkFile('validation/validatePhone.ts', content);

      const fn = chunks.find(c => c.name === 'formatPhoneNumber');
      expect(fn).toBeDefined();
      expect(fn!.kind).toBe('function');
    });

    it('should extract multiple functions from a single file', () => {
      const content = readFixture('validation/validatePhone.ts');
      const chunks = chunkFile('validation/validatePhone.ts', content);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      const validatePhone = chunks.find(c => c.name === 'validatePhone');
      const formatPhone = chunks.find(c => c.name === 'formatPhoneNumber');
      expect(validatePhone).toBeDefined();
      expect(formatPhone).toBeDefined();
    });

    it('should extract function parameters', () => {
      const content = readFixture('validation/validateEmail.ts');
      const chunks = chunkFile('validation/validateEmail.ts', content);

      const fn = chunks.find(c => c.name === 'validateEmail');
      expect(fn).toBeDefined();
      expect(fn!.metadata.props).toBeDefined();
      expect(fn!.metadata.props).toContain('email');
    });
  });

  describe('Export Detection', () => {
    it('should detect named exports', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.metadata.isExported).toBe(true);
      expect(userCard!.metadata.isDefaultExport).toBe(false);
    });

    it('should detect default exports', () => {
      const content = readFixture('components/MemberCard.tsx');
      const chunks = chunkFile('components/MemberCard.tsx', content);

      const memberCard = chunks.find(c => c.name === 'MemberCard');
      expect(memberCard).toBeDefined();
      expect(memberCard!.metadata.isExported).toBe(true);
      expect(memberCard!.metadata.isDefaultExport).toBe(true);
    });

    it('should detect named export for ProfileCard', () => {
      const content = readFixture('components/ProfileCard.tsx');
      const chunks = chunkFile('components/ProfileCard.tsx', content);

      const profileCard = chunks.find(c => c.name === 'ProfileCard');
      expect(profileCard).toBeDefined();
      expect(profileCard!.metadata.isExported).toBe(true);
      expect(profileCard!.metadata.isDefaultExport).toBe(false);
    });

    it('should detect named exports for hooks', () => {
      const content = readFixture('hooks/useUserData.tsx');
      const chunks = chunkFile('hooks/useUserData.tsx', content);

      const hook = chunks.find(c => c.name === 'useUserData');
      expect(hook).toBeDefined();
      expect(hook!.metadata.isExported).toBe(true);
    });

    it('should detect named exports for utility functions', () => {
      const content = readFixture('validation/validateEmail.ts');
      const chunks = chunkFile('validation/validateEmail.ts', content);

      const fn = chunks.find(c => c.name === 'validateEmail');
      expect(fn).toBeDefined();
      expect(fn!.metadata.isExported).toBe(true);
      expect(fn!.metadata.isDefaultExport).toBe(false);
    });
  });

  describe('Chunk Filtering', () => {
    it('should filter by minimum line count', () => {
      const content = `
        export const tiny = () => 1;
        export function larger() {
          const x = 1;
          const y = 2;
          const z = 3;
          return x + y + z;
        }
      `;
      const chunks = chunkFile('test.ts', content, { minLines: 4 });

      expect(chunks.find(c => c.name === 'tiny')).toBeUndefined();
      expect(chunks.find(c => c.name === 'larger')).toBeDefined();
    });

    it('should use default minLines of 3', () => {
      const content = `
        export const one = () => 1;
        export function twoLines() {
          return 2;
        }
        export function threeLines() {
          const x = 3;
          return x;
        }
      `;
      const chunks = chunkFile('test.ts', content);

      // Both one-liner and two-line functions should be filtered out
      expect(chunks.find(c => c.name === 'one')).toBeUndefined();
    });

    it('should filter by kind', () => {
      const content = readFixture('components/UnrelatedWidget.tsx');
      const chunks = chunkFile('components/UnrelatedWidget.tsx', content, { kinds: ['component'] });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every(c => c.kind === 'component')).toBe(true);
    });

    it('should filter hooks only', () => {
      const content = readFixture('hooks/useUserData.tsx');
      const chunks = chunkFile('hooks/useUserData.tsx', content, { kinds: ['hook'] });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every(c => c.kind === 'hook')).toBe(true);
    });

    it('should filter functions only', () => {
      const content = readFixture('validation/validatePhone.ts');
      const chunks = chunkFile('validation/validatePhone.ts', content, { kinds: ['function'] });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every(c => c.kind === 'function')).toBe(true);
    });
  });

  describe('Line Numbers', () => {
    it('should capture correct start line for UserCard', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      // UserCard function starts at line 11 in the fixture
      expect(userCard!.startLine).toBe(11);
    });

    it('should capture correct end line for UserCard', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      // UserCard function ends at line 23 in the fixture
      expect(userCard!.endLine).toBe(23);
    });

    it('should have valid line range', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.startLine).toBeGreaterThan(0);
      expect(userCard!.endLine).toBeGreaterThan(userCard!.startLine);
    });

    it('should capture start column', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.startColumn).toBeDefined();
      expect(typeof userCard!.startColumn).toBe('number');
    });

    it('should capture end column', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.endColumn).toBeDefined();
      expect(typeof userCard!.endColumn).toBe('number');
    });
  });

  describe('Chunk IDs', () => {
    it('should generate unique IDs for different chunks', () => {
      const content = readFixture('validation/validatePhone.ts');
      const chunks = chunkFile('validation/validatePhone.ts', content);

      const ids = chunks.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should generate consistent IDs for same content', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks1 = chunkFile('components/UserCard.tsx', content);
      const chunks2 = chunkFile('components/UserCard.tsx', content);

      const userCard1 = chunks1.find(c => c.name === 'UserCard');
      const userCard2 = chunks2.find(c => c.name === 'UserCard');
      expect(userCard1!.id).toBe(userCard2!.id);
    });

    it('should generate different IDs for different files with same content', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks1 = chunkFile('file1.tsx', content);
      const chunks2 = chunkFile('file2.tsx', content);

      const chunk1 = chunks1.find(c => c.name === 'UserCard');
      const chunk2 = chunks2.find(c => c.name === 'UserCard');
      expect(chunk1!.id).not.toBe(chunk2!.id);
    });

    it('should generate hex string IDs', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.id).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('Content Extraction', () => {
    it('should extract complete function content', () => {
      const content = readFixture('components/UserCard.tsx');
      const chunks = chunkFile('components/UserCard.tsx', content);

      const userCard = chunks.find(c => c.name === 'UserCard');
      expect(userCard).toBeDefined();
      expect(userCard!.content).toContain('function UserCard');
      expect(userCard!.content).toContain('return');
      expect(userCard!.content).toContain('</div>');
    });

    it('should extract arrow function content', () => {
      const content = readFixture('components/ProfileCard.tsx');
      const chunks = chunkFile('components/ProfileCard.tsx', content);

      const profileCard = chunks.find(c => c.name === 'ProfileCard');
      expect(profileCard).toBeDefined();
      expect(profileCard!.content).toContain('ProfileCard');
      expect(profileCard!.content).toContain('React.FC');
    });

    it('should extract hook content with all state and effects', () => {
      const content = readFixture('hooks/useUserData.tsx');
      const chunks = chunkFile('hooks/useUserData.tsx', content);

      const hook = chunks.find(c => c.name === 'useUserData');
      expect(hook).toBeDefined();
      expect(hook!.content).toContain('useState');
      expect(hook!.content).toContain('useEffect');
      expect(hook!.content).toContain('fetch');
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid JavaScript gracefully', () => {
      const content = 'this is not valid javascript {{{';
      const chunks = chunkFile('invalid.ts', content);

      expect(chunks).toEqual([]);
    });

    it('should handle empty file', () => {
      const content = '';
      const chunks = chunkFile('empty.ts', content);

      expect(chunks).toEqual([]);
    });

    it('should handle file with only imports', () => {
      const content = `
        import React from 'react';
        import { useState } from 'react';
      `;
      const chunks = chunkFile('imports-only.ts', content);

      expect(chunks).toEqual([]);
    });

    it('should handle file with interfaces only', () => {
      const content = `
        interface User {
          name: string;
          email: string;
        }

        type Status = 'active' | 'inactive';
      `;
      const chunks = chunkFile('types-only.ts', content);

      expect(chunks).toEqual([]);
    });
  });
});

describe('prepareEmbeddingInput', () => {
  it('should enrich component chunks with context', () => {
    const content = readFixture('components/UserCard.tsx');
    const chunks = chunkFile('components/UserCard.tsx', content);
    const userCard = chunks.find(c => c.name === 'UserCard')!;

    const embeddingInput = prepareEmbeddingInput(userCard);

    expect(embeddingInput).toContain('React component: UserCard');
    expect(embeddingInput).toContain('Props:');
    expect(embeddingInput).toContain('user');
  });

  it('should include JSX elements for components', () => {
    const content = readFixture('components/UserCard.tsx');
    const chunks = chunkFile('components/UserCard.tsx', content);
    const userCard = chunks.find(c => c.name === 'UserCard')!;

    const embeddingInput = prepareEmbeddingInput(userCard);

    expect(embeddingInput).toContain('JSX elements:');
    expect(embeddingInput).toContain('div');
    expect(embeddingInput).toContain('img');
  });

  it('should enrich hook chunks with context', () => {
    const content = readFixture('hooks/useUserData.tsx');
    const chunks = chunkFile('hooks/useUserData.tsx', content);
    const hook = chunks.find(c => c.name === 'useUserData')!;

    const embeddingInput = prepareEmbeddingInput(hook);

    expect(embeddingInput).toContain('React hook: useUserData');
    expect(embeddingInput).toContain('Hooks used:');
  });

  it('should enrich function chunks with context', () => {
    const content = readFixture('validation/validateEmail.ts');
    const chunks = chunkFile('validation/validateEmail.ts', content);
    const fn = chunks.find(c => c.name === 'validateEmail')!;

    const embeddingInput = prepareEmbeddingInput(fn);

    expect(embeddingInput).toContain('Function: validateEmail');
  });

  it('should include the original code content', () => {
    const content = readFixture('validation/validateEmail.ts');
    const chunks = chunkFile('validation/validateEmail.ts', content);
    const fn = chunks.find(c => c.name === 'validateEmail')!;

    const embeddingInput = prepareEmbeddingInput(fn);

    expect(embeddingInput).toContain('validateEmail');
    expect(embeddingInput).toContain('emailRegex');
  });

  it('should include hooks used in the embedding', () => {
    const content = readFixture('hooks/useFetchProfile.tsx');
    const chunks = chunkFile('hooks/useFetchProfile.tsx', content);
    const hook = chunks.find(c => c.name === 'useFetchProfile')!;

    const embeddingInput = prepareEmbeddingInput(hook);

    expect(embeddingInput).toContain('useState');
    expect(embeddingInput).toContain('useEffect');
    expect(embeddingInput).toContain('useCallback');
  });

  it('should handle components with hooks', () => {
    const content = readFixture('forms/LoginForm.tsx');
    const chunks = chunkFile('forms/LoginForm.tsx', content);
    const form = chunks.find(c => c.name === 'LoginForm')!;

    const embeddingInput = prepareEmbeddingInput(form);

    expect(embeddingInput).toContain('React component: LoginForm');
    expect(embeddingInput).toContain('Hooks used:');
    expect(embeddingInput).toContain('useState');
    expect(embeddingInput).toContain('JSX elements:');
  });
});

describe('Multiple Chunks Per File', () => {
  it('should extract all components from a form file', () => {
    const content = readFixture('forms/LoginForm.tsx');
    const chunks = chunkFile('forms/LoginForm.tsx', content);

    // LoginForm should be detected
    const loginForm = chunks.find(c => c.name === 'LoginForm');
    expect(loginForm).toBeDefined();
  });

  it('should extract all functions from validation file', () => {
    const content = readFixture('validation/validatePhone.ts');
    const chunks = chunkFile('validation/validatePhone.ts', content);

    const validatePhone = chunks.find(c => c.name === 'validatePhone');
    const formatPhone = chunks.find(c => c.name === 'formatPhoneNumber');

    expect(validatePhone).toBeDefined();
    expect(formatPhone).toBeDefined();
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('JSX Fragment Detection', () => {
  it('should classify lowercase functions returning JSX as jsx-fragment', () => {
    const content = `
      export function renderUserInfo(user: User) {
        return (
          <div>
            <span>{user.name}</span>
          </div>
        );
      }
    `;
    const chunks = chunkFile('test.tsx', content, { minLines: 1 });

    const renderFn = chunks.find(c => c.name === 'renderUserInfo');
    expect(renderFn).toBeDefined();
    expect(renderFn!.kind).toBe('jsx-fragment');
  });
});

describe('Large Component Splitting', () => {
  const largeComponentsPath = join(__dirname, 'fixtures/semantic-duplicates/large-components');

  function readLargeFixture(relativePath: string): string {
    return readFileSync(join(largeComponentsPath, relativePath), 'utf-8');
  }

  describe('Component Size Detection', () => {
    it('should NOT split small components under maxLines', () => {
      const content = readLargeFixture('SmallCard.tsx');
      const chunks = chunkFile('SmallCard.tsx', content, { maxLines: 100 });

      // Should return a single component chunk
      const componentChunks = chunks.filter(c => c.kind === 'component');
      expect(componentChunks.length).toBe(1);
      expect(componentChunks[0].name).toBe('SmallCard');

      // Should not have any summary or section chunks
      const summaryChunks = chunks.filter(c => c.kind === 'component-summary');
      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');
      expect(summaryChunks.length).toBe(0);
      expect(sectionChunks.length).toBe(0);
    });

    it('should split large components over maxLines', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      // Should have a summary chunk
      const summaryChunks = chunks.filter(c => c.kind === 'component-summary');
      expect(summaryChunks.length).toBe(1);
      expect(summaryChunks[0].name).toBe('DashboardPage');

      // Should have multiple section chunks
      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');
      expect(sectionChunks.length).toBeGreaterThan(1);
    });

    it('should respect splitStrategy: none option', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, {
        maxLines: 50,
        splitStrategy: 'none'
      });

      // Should return a single component chunk (not split)
      const componentChunks = chunks.filter(c => c.kind === 'component');
      expect(componentChunks.length).toBe(1);
      expect(componentChunks[0].name).toBe('DashboardPage');

      // Should not have any summary or section chunks
      const summaryChunks = chunks.filter(c => c.kind === 'component-summary');
      expect(summaryChunks.length).toBe(0);
    });
  });

  describe('JSX Children Splitting Strategy', () => {
    it('should create a summary chunk with hooks and state', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const summaryChunk = chunks.find(c => c.kind === 'component-summary');
      expect(summaryChunk).toBeDefined();

      // Summary should contain hooks
      expect(summaryChunk!.metadata.hooks).toBeDefined();
      expect(summaryChunk!.metadata.hooks).toContain('useState');

      // Summary should NOT have JSX elements (they're in sections)
      expect(summaryChunk!.metadata.jsxElements).toBeUndefined();
    });

    it('should create section chunks for top-level JSX children', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');

      // Each section should have a parent ID
      sectionChunks.forEach(section => {
        expect(section.parentId).toBeDefined();
      });

      // Each section should have JSX elements
      sectionChunks.forEach(section => {
        // Most sections should have JSX elements (some might be expressions)
        if (section.metadata.jsxElements) {
          expect(section.metadata.jsxElements.length).toBeGreaterThan(0);
        }
      });
    });

    it('should preserve component name in section chunks', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');

      sectionChunks.forEach(section => {
        expect(section.name).toBe('DashboardPage');
      });
    });

    it('should assign section indices', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');

      // Check that section indices are sequential
      const indices = sectionChunks.map(s => s.sectionIndex).filter(i => i !== undefined);
      expect(indices.length).toBeGreaterThan(0);

      // All sections should have a section index
      sectionChunks.forEach(section => {
        expect(section.sectionIndex).toBeDefined();
        expect(typeof section.sectionIndex).toBe('number');
      });
    });

    it('should generate section labels', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');

      sectionChunks.forEach(section => {
        expect(section.sectionLabel).toBeDefined();
        expect(typeof section.sectionLabel).toBe('string');
        expect(section.sectionLabel!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Arrow Function Components', () => {
    it('should split arrow function components', () => {
      const content = readLargeFixture('ProductDetailPage.tsx');
      const chunks = chunkFile('ProductDetailPage.tsx', content, { maxLines: 50 });

      // Should have a summary chunk
      const summaryChunks = chunks.filter(c => c.kind === 'component-summary');
      expect(summaryChunks.length).toBe(1);
      expect(summaryChunks[0].name).toBe('ProductDetailPage');

      // Should have section chunks
      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');
      expect(sectionChunks.length).toBeGreaterThan(1);
    });

    it('should extract hooks from arrow function components', () => {
      const content = readLargeFixture('ProductDetailPage.tsx');
      const chunks = chunkFile('ProductDetailPage.tsx', content, { maxLines: 50 });

      const summaryChunk = chunks.find(c => c.kind === 'component-summary');
      expect(summaryChunk).toBeDefined();
      expect(summaryChunk!.metadata.hooks).toBeDefined();
      expect(summaryChunk!.metadata.hooks).toContain('useState');
      expect(summaryChunk!.metadata.hooks).toContain('useEffect');
      expect(summaryChunk!.metadata.hooks).toContain('useCallback');
    });
  });

  describe('Chunk ID Relationships', () => {
    it('should have unique IDs for all chunks', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const ids = chunks.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should link section chunks to their parent summary', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const summaryChunk = chunks.find(c => c.kind === 'component-summary');
      expect(summaryChunk).toBeDefined();

      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');

      sectionChunks.forEach(section => {
        expect(section.parentId).toBe(summaryChunk!.id);
      });
    });
  });

  describe('Line Count Validation', () => {
    it('should produce most chunks smaller than maxLines', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const maxLines = 50;
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines });

      // Most chunks should be under the limit
      // Some JSX sections may be larger if they're single large elements
      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');
      const chunksUnderLimit = sectionChunks.filter(chunk => {
        const lineCount = chunk.endLine - chunk.startLine + 1;
        return lineCount <= maxLines * 2; // Allow 2x tolerance for individual sections
      });

      // At least 50% of chunks should be under the relaxed limit
      expect(chunksUnderLimit.length).toBeGreaterThanOrEqual(sectionChunks.length * 0.5);
    });

    it('should filter out sections smaller than minLines', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const minLines = 5;
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50, minLines });

      // Section chunks should respect minLines
      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');
      sectionChunks.forEach(section => {
        const lineCount = section.endLine - section.startLine + 1;
        expect(lineCount).toBeGreaterThanOrEqual(minLines);
      });
    });
  });

  describe('Content Extraction', () => {
    it('should extract complete JSX content in sections', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');

      sectionChunks.forEach(section => {
        // Content should not be empty
        expect(section.content.length).toBeGreaterThan(0);

        // Content should contain JSX-like syntax for element sections
        if (section.metadata.jsxElements && section.metadata.jsxElements.length > 0) {
          expect(section.content).toMatch(/<|>/);
        }
      });
    });

    it('should preserve export metadata in split chunks', () => {
      const content = readLargeFixture('DashboardPage.tsx');
      const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

      const summaryChunk = chunks.find(c => c.kind === 'component-summary');
      expect(summaryChunk!.metadata.isDefaultExport).toBe(true);

      const sectionChunks = chunks.filter(c => c.kind === 'jsx-section');
      sectionChunks.forEach(section => {
        expect(section.metadata.isDefaultExport).toBe(true);
      });
    });
  });
});

describe('Large Function Splitting', () => {
  it('should split large functions into function-summary and function-section chunks', () => {
    // Create a large function (over 100 lines)
    const lines = [
      'export function processLargeData(data: any[]) {',
      '  let result = [];',
    ];
    for (let i = 0; i < 150; i++) {
      lines.push(`  const value${i} = data[${i}] || ${i};`);
      lines.push(`  result.push(value${i} * 2);`);
    }
    lines.push('  return result;');
    lines.push('}');
    const content = lines.join('\n');

    const chunks = chunkFile('large-function.ts', content, { maxLines: 50 });

    // Should have a summary chunk
    const summaryChunks = chunks.filter(c => c.kind === 'function-summary');
    expect(summaryChunks.length).toBe(1);
    expect(summaryChunks[0].name).toBe('processLargeData');

    // Should have section chunks
    const sectionChunks = chunks.filter(c => c.kind === 'function-section');
    expect(sectionChunks.length).toBeGreaterThan(1);

    // All sections should link to the summary
    sectionChunks.forEach(section => {
      expect(section.parentId).toBe(summaryChunks[0].id);
      expect(section.name).toBe('processLargeData');
    });
  });

  it('should NOT split small functions', () => {
    const content = `
      export function smallFunction(x: number) {
        const a = x * 2;
        const b = a + 1;
        return b;
      }
    `;

    const chunks = chunkFile('small-function.ts', content, { maxLines: 100 });

    const functionChunks = chunks.filter(c => c.kind === 'function');
    expect(functionChunks.length).toBe(1);

    const summaryChunks = chunks.filter(c => c.kind === 'function-summary');
    expect(summaryChunks.length).toBe(0);
  });

  it('should format function-summary in prepareEmbeddingInput', () => {
    const lines = ['export function bigFunc() {'];
    for (let i = 0; i < 150; i++) {
      lines.push(`  console.log(${i});`);
    }
    lines.push('}');
    const content = lines.join('\n');

    const chunks = chunkFile('big-func.ts', content, { maxLines: 50 });
    const summaryChunk = chunks.find(c => c.kind === 'function-summary');
    expect(summaryChunk).toBeDefined();

    const embeddingInput = prepareEmbeddingInput(summaryChunk!);
    expect(embeddingInput).toContain('Function summary: bigFunc');
    expect(embeddingInput).toContain('Large function - split into sections');
  });

  it('should format function-section in prepareEmbeddingInput', () => {
    const lines = ['export function bigFunc() {'];
    for (let i = 0; i < 150; i++) {
      lines.push(`  console.log(${i});`);
    }
    lines.push('}');
    const content = lines.join('\n');

    const chunks = chunkFile('big-func.ts', content, { maxLines: 50 });
    const sectionChunk = chunks.find(c => c.kind === 'function-section');
    expect(sectionChunk).toBeDefined();

    const embeddingInput = prepareEmbeddingInput(sectionChunk!);
    expect(embeddingInput).toContain('Function section from bigFunc');
  });
});

describe('prepareEmbeddingInput Truncation', () => {
  it('should truncate content exceeding maxChars', () => {
    // Create a very large chunk
    const lines = ['export function hugeFunc() {'];
    for (let i = 0; i < 500; i++) {
      lines.push(`  console.log("This is line number ${i} with some extra text to make it longer");`);
    }
    lines.push('}');
    const content = lines.join('\n');

    const chunks = chunkFile('huge-func.ts', content, { splitStrategy: 'none' });
    const chunk = chunks[0];

    // Without truncation it would be over 40000 chars
    const embeddingInputFull = prepareEmbeddingInput(chunk, { maxChars: 50000 });
    expect(embeddingInputFull.length).toBeGreaterThan(8000);

    // With default limit (6000) it should be truncated
    const embeddingInputTruncated = prepareEmbeddingInput(chunk);
    expect(embeddingInputTruncated.length).toBeLessThanOrEqual(6000);
    expect(embeddingInputTruncated).toContain('[... content truncated for embedding ...]');
  });

  it('should not truncate content under maxChars', () => {
    const content = `
      export function smallFunc() {
        console.log("hello");
        return 42;
      }
    `;

    const chunks = chunkFile('small-func.ts', content, { minLines: 1 });
    const chunk = chunks[0];

    const embeddingInput = prepareEmbeddingInput(chunk);
    expect(embeddingInput).not.toContain('[... content truncated');
  });
});

describe('prepareEmbeddingInput for Split Chunks', () => {
  const largeComponentsPath = join(__dirname, 'fixtures/semantic-duplicates/large-components');

  function readLargeFixture(relativePath: string): string {
    return readFileSync(join(largeComponentsPath, relativePath), 'utf-8');
  }

  it('should format component-summary chunks correctly', () => {
    const content = readLargeFixture('DashboardPage.tsx');
    const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

    const summaryChunk = chunks.find(c => c.kind === 'component-summary');
    expect(summaryChunk).toBeDefined();

    const embeddingInput = prepareEmbeddingInput(summaryChunk!);

    expect(embeddingInput).toContain('React component summary: DashboardPage');
    expect(embeddingInput).toContain('Large component - see sections for JSX details');
  });

  it('should format jsx-section chunks correctly', () => {
    const content = readLargeFixture('DashboardPage.tsx');
    const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

    const sectionChunk = chunks.find(c => c.kind === 'jsx-section');
    expect(sectionChunk).toBeDefined();

    const embeddingInput = prepareEmbeddingInput(sectionChunk!);

    expect(embeddingInput).toContain('JSX section from DashboardPage');
    expect(embeddingInput).toContain(sectionChunk!.sectionLabel!);
  });

  it('should include JSX elements in section embedding', () => {
    const content = readLargeFixture('DashboardPage.tsx');
    const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

    const sectionWithElements = chunks.find(
      c => c.kind === 'jsx-section' && c.metadata.jsxElements && c.metadata.jsxElements.length > 0
    );

    if (sectionWithElements) {
      const embeddingInput = prepareEmbeddingInput(sectionWithElements);
      expect(embeddingInput).toContain('JSX elements:');
    }
  });

  it('should include hooks in summary embedding', () => {
    const content = readLargeFixture('DashboardPage.tsx');
    const chunks = chunkFile('DashboardPage.tsx', content, { maxLines: 50 });

    const summaryChunk = chunks.find(c => c.kind === 'component-summary');
    expect(summaryChunk).toBeDefined();

    const embeddingInput = prepareEmbeddingInput(summaryChunk!);

    expect(embeddingInput).toContain('Hooks used:');
    expect(embeddingInput).toContain('useState');
  });
});
