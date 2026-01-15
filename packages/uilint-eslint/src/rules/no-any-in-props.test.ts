/**
 * Tests for: no-any-in-props
 *
 * Tests the detection of 'any' type in React component props.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./no-any-in-props.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run("no-any-in-props", rule, {
  valid: [
    // ============================================
    // PROPERLY TYPED PROPS
    // ============================================
    {
      name: "function with typed props object",
      code: `function Button(props: { label: string }) { return <button>{props.label}</button>; }`,
    },
    {
      name: "function with destructured typed props",
      code: `function Button({ label }: { label: string }) { return <button>{label}</button>; }`,
    },
    {
      name: "arrow function with typed props",
      code: `const Button = (props: { label: string }) => <button>{props.label}</button>;`,
    },
    {
      name: "component with multiple props",
      code: `function Card({ title, content }: { title: string; content: React.ReactNode }) { return <div>{title}{content}</div>; }`,
    },

    // ============================================
    // USING UNKNOWN TYPE
    // ============================================
    {
      name: "using unknown for dynamic data",
      code: `function DataDisplay(props: { data: unknown }) { return <div>{String(props.data)}</div>; }`,
    },
    {
      name: "using unknown in array",
      code: `function List(props: { items: unknown[] }) { return <ul />; }`,
    },

    // ============================================
    // GENERIC COMPONENTS
    // ============================================
    {
      name: "generic component with constraint",
      code: `function List<T extends object>(props: { items: T[] }) { return <ul />; }`,
    },
    {
      name: "generic component with multiple type params",
      code: `function Select<T, K extends keyof T>(props: { options: T[]; labelKey: K }) { return <select />; }`,
    },

    // ============================================
    // NON-COMPONENT FUNCTIONS (lowercase)
    // ============================================
    {
      name: "non-component function with any (lowercase name)",
      code: `function helper(data: any) { return data; }`,
    },
    {
      name: "non-component arrow function with any",
      code: `const processData = (input: any) => input;`,
    },

    // ============================================
    // FC WITH PROPER TYPES
    // ============================================
    {
      name: "FC with proper props type",
      code: `const Button: FC<{ label: string }> = ({ label }) => <button>{label}</button>;`,
    },
    {
      name: "React.FC with proper props type",
      code: `const Button: React.FC<{ label: string }> = ({ label }) => <button>{label}</button>;`,
    },
    {
      name: "FC without type parameter (empty props)",
      code: `const Divider: FC = () => <hr />;`,
    },

    // ============================================
    // COMPLEX TYPES WITHOUT ANY
    // ============================================
    {
      name: "union type in props",
      code: `function Status(props: { status: 'loading' | 'success' | 'error' }) { return <span />; }`,
    },
    {
      name: "intersection type in props",
      code: `function Component(props: { a: string } & { b: number }) { return <div />; }`,
    },
    {
      name: "array type in props",
      code: `function List(props: { items: string[] }) { return <ul />; }`,
    },
    {
      name: "Record type in props",
      code: `function Config(props: { settings: Record<string, boolean> }) { return <div />; }`,
    },
    {
      name: "tuple type in props",
      code: `function Coord(props: { position: [number, number] }) { return <div />; }`,
    },
    {
      name: "function type in props",
      code: `function Button(props: { onClick: () => void }) { return <button />; }`,
    },
    {
      name: "callback with typed params",
      code: `function Input(props: { onChange: (value: string) => void }) { return <input />; }`,
    },

    // ============================================
    // NO PROPS
    // ============================================
    {
      name: "component with no props",
      code: `function Logo() { return <svg />; }`,
    },
    {
      name: "arrow component with no props",
      code: `const Logo = () => <svg />;`,
    },

    // ============================================
    // HOOKS (should be skipped - start with Use)
    // ============================================
    {
      name: "custom hook with any (should be skipped)",
      code: `function UseData(options: any) { return {}; }`,
    },
  ],

  invalid: [
    // ============================================
    // DIRECT ANY IN PROPS
    // ============================================
    {
      name: "function with any props",
      code: `function Button(props: any) { return <button />; }`,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "Button" },
        },
      ],
    },
    {
      name: "arrow function with any props",
      code: `const Card = (props: any) => <div />;`,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "Card" },
        },
      ],
    },
    {
      name: "function expression with any props",
      code: `const Modal = function(props: any) { return <div />; };`,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "Modal" },
        },
      ],
    },

    // ============================================
    // ANY IN DESTRUCTURED PROPS
    // ============================================
    {
      name: "destructured props with any type",
      code: `function Button({ label }: any) { return <button>{label}</button>; }`,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "Button" },
        },
      ],
    },

    // ============================================
    // ANY IN PROPS PROPERTY
    // ============================================
    {
      name: "any in a single property",
      code: `function DataView({ data }: { data: any }) { return <div />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "DataView", location: "property 'data'" },
        },
      ],
    },
    {
      name: "any in one of multiple properties",
      code: `function Form({ value, onChange }: { value: any; onChange: () => void }) { return <form />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Form", location: "property 'value'" },
        },
      ],
    },
    {
      name: "props object type with any property",
      code: `function Display(props: { title: string; content: any }) { return <div />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Display", location: "property 'content'" },
        },
      ],
    },

    // ============================================
    // ANY IN ARRAY TYPE
    // ============================================
    {
      name: "any[] in props",
      code: `function List(props: { items: any[] }) { return <ul />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "List", location: "property 'items'" },
        },
      ],
    },

    // ============================================
    // ANY IN GENERIC TYPE ARGUMENT
    // ============================================
    {
      name: "Array<any> in props",
      code: `function List(props: { items: Array<any> }) { return <ul />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "List", location: "property 'items'" },
        },
      ],
    },
    {
      name: "Record<string, any> in props",
      code: `function Config(props: { settings: Record<string, any> }) { return <div />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Config", location: "property 'settings'" },
        },
      ],
    },

    // ============================================
    // ANY IN UNION TYPE
    // ============================================
    {
      name: "any in union type",
      code: `function Value(props: { value: string | any }) { return <span />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Value", location: "property 'value'" },
        },
      ],
    },

    // ============================================
    // ANY IN TUPLE TYPE
    // ============================================
    {
      name: "any in tuple type",
      code: `function Pair(props: { coords: [any, number] }) { return <div />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Pair", location: "property 'coords'" },
        },
      ],
    },

    // ============================================
    // ANY IN FUNCTION TYPE
    // ============================================
    {
      name: "any in callback return type",
      code: `function Button(props: { onClick: () => any }) { return <button />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Button", location: "property 'onClick'" },
        },
      ],
    },
    {
      name: "any in callback parameter",
      code: `function Input(props: { onChange: (value: any) => void }) { return <input />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Input", location: "property 'onChange'" },
        },
      ],
    },

    // ============================================
    // ANY IN INDEX SIGNATURE
    // ============================================
    {
      name: "any in index signature",
      code: `function Dynamic(props: { [key: string]: any }) { return <div />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Dynamic", location: "index signature" },
        },
      ],
    },

    // ============================================
    // FC<any> PATTERNS
    // ============================================
    {
      name: "FC<any>",
      code: `const Button: FC<any> = (props) => <button />;`,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "Button" },
        },
      ],
    },
    {
      name: "React.FC<any>",
      code: `const Card: React.FC<any> = (props) => <div />;`,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "Card" },
        },
      ],
    },
    {
      name: "FunctionComponent<any>",
      code: `const Modal: FunctionComponent<any> = (props) => <div />;`,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "Modal" },
        },
      ],
    },
    {
      name: "FC with any in props object",
      code: `const Form: FC<{ data: any }> = ({ data }) => <form />;`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Form", location: "property 'data'" },
        },
      ],
    },

    // ============================================
    // MULTIPLE COMPONENTS WITH VIOLATIONS
    // ============================================
    {
      name: "multiple components with any",
      code: `
        function A(props: any) { return <div />; }
        const B = (props: any) => <span />;
      `,
      errors: [
        {
          messageId: "anyInProps",
          data: { componentName: "A" },
        },
        {
          messageId: "anyInProps",
          data: { componentName: "B" },
        },
      ],
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "nested any in complex type",
      code: `function Table(props: { columns: Array<{ render: (data: any) => React.ReactNode }> }) { return <table />; }`,
      errors: [
        {
          messageId: "anyInPropsProperty",
          data: { componentName: "Table", location: "property 'columns'" },
        },
      ],
    },
  ],
});
