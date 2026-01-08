/**
 * Tests for: prefer-zustand-state-management
 *
 * Detects excessive use of React state hooks (useState, useReducer, useContext)
 * and suggests using Zustand stores for better state management.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./prefer-zustand-state-management";

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

ruleTester.run("prefer-zustand-state-management", rule, {
  valid: [
    // ============================================
    // NO STATE HOOKS
    // ============================================
    {
      name: "component with no hooks",
      code: `
        function MyComponent() {
          return <div>Hello</div>;
        }
      `,
    },
    {
      name: "component with only non-state hooks",
      code: `
        function MyComponent() {
          useEffect(() => {}, []);
          useMemo(() => computed, [dep]);
          useCallback(() => {}, []);
          useRef(null);
          return <div>Hello</div>;
        }
      `,
    },
    {
      name: "arrow function component with no state hooks",
      code: `
        const MyComponent = () => {
          useEffect(() => {}, []);
          return <div>Hello</div>;
        };
      `,
    },

    // ============================================
    // UNDER DEFAULT THRESHOLD (3)
    // ============================================
    {
      name: "single useState is fine",
      code: `
        function MyComponent() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `,
    },
    {
      name: "two useState calls is fine",
      code: `
        function MyComponent() {
          const [count, setCount] = useState(0);
          const [name, setName] = useState("");
          return <div>{count} {name}</div>;
        }
      `,
    },
    {
      name: "three useState calls is at threshold (valid)",
      code: `
        function MyComponent() {
          const [count, setCount] = useState(0);
          const [name, setName] = useState("");
          const [active, setActive] = useState(false);
          return <div>{count}</div>;
        }
      `,
    },
    {
      name: "single useReducer is fine",
      code: `
        function MyComponent() {
          const [state, dispatch] = useReducer(reducer, initialState);
          return <div>{state.value}</div>;
        }
      `,
    },
    {
      name: "single useContext is fine",
      code: `
        function MyComponent() {
          const theme = useContext(ThemeContext);
          return <div className={theme}></div>;
        }
      `,
    },
    {
      name: "mixed hooks under threshold",
      code: `
        function MyComponent() {
          const [count, setCount] = useState(0);
          const theme = useContext(ThemeContext);
          const [state, dispatch] = useReducer(reducer, init);
          return <div>{count}</div>;
        }
      `,
    },

    // ============================================
    // CUSTOM THRESHOLD CONFIGURATION
    // ============================================
    {
      name: "five useState with higher threshold (5)",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          const [e, setE] = useState(0);
          return <div>{a}</div>;
        }
      `,
      options: [{ maxStateHooks: 5 }],
    },
    {
      name: "ten useState with threshold of 10",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          const [e, setE] = useState(0);
          const [f, setF] = useState(0);
          const [g, setG] = useState(0);
          const [h, setH] = useState(0);
          const [i, setI] = useState(0);
          const [j, setJ] = useState(0);
          return <div>{a}</div>;
        }
      `,
      options: [{ maxStateHooks: 10 }],
    },

    // ============================================
    // SELECTIVE HOOK COUNTING
    // ============================================
    {
      name: "many useState but useState counting disabled",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          const [e, setE] = useState(0);
          return <div>{a}</div>;
        }
      `,
      options: [{ countUseState: false }],
    },
    {
      name: "many useReducer but useReducer counting disabled",
      code: `
        function MyComponent() {
          const [s1, d1] = useReducer(r, i);
          const [s2, d2] = useReducer(r, i);
          const [s3, d3] = useReducer(r, i);
          const [s4, d4] = useReducer(r, i);
          return <div>{s1}</div>;
        }
      `,
      options: [{ countUseReducer: false }],
    },
    {
      name: "many useContext but useContext counting disabled",
      code: `
        function MyComponent() {
          const a = useContext(A);
          const b = useContext(B);
          const c = useContext(C);
          const d = useContext(D);
          const e = useContext(E);
          return <div>{a}</div>;
        }
      `,
      options: [{ countUseContext: false }],
    },
    {
      name: "only count useState when others disabled",
      code: `
        function MyComponent() {
          const [count, setCount] = useState(0);
          const [s1, d1] = useReducer(r, i);
          const [s2, d2] = useReducer(r, i);
          const a = useContext(A);
          const b = useContext(B);
          return <div>{count}</div>;
        }
      `,
      options: [{ countUseReducer: false, countUseContext: false }],
    },

    // ============================================
    // MULTIPLE COMPONENTS (each counted separately)
    // ============================================
    {
      name: "multiple components each under threshold",
      code: `
        function ComponentA() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          return <div>{a}</div>;
        }
        
        function ComponentB() {
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{c}</div>;
        }
      `,
    },
    {
      name: "arrow and function components each under threshold",
      code: `
        const ComponentA = () => {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          return <div>{a}</div>;
        };
        
        function ComponentB() {
          const [c, setC] = useState(0);
          return <div>{c}</div>;
        }
      `,
    },

    // ============================================
    // CUSTOM HOOKS (not components - should be ignored)
    // ============================================
    {
      name: "custom hook with many useState (hooks can have more state)",
      code: `
        function useFormState() {
          const [name, setName] = useState("");
          const [email, setEmail] = useState("");
          const [phone, setPhone] = useState("");
          const [address, setAddress] = useState("");
          const [city, setCity] = useState("");
          return { name, email, phone, address, city };
        }
      `,
    },
    {
      name: "custom hook starting with use",
      code: `
        const useComplexState = () => {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return { a, b, c, d };
        };
      `,
    },

    // ============================================
    // REACT.useState CALLS
    // ============================================
    {
      name: "React.useState under threshold",
      code: `
        function MyComponent() {
          const [count, setCount] = React.useState(0);
          const [name, setName] = React.useState("");
          return <div>{count}</div>;
        }
      `,
    },

    // ============================================
    // NON-COMPONENT FUNCTIONS (should be ignored)
    // ============================================
    {
      name: "regular function (lowercase, no JSX) is ignored",
      code: `
        function processData() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return { a, b, c, d };
        }
      `,
    },

    // ============================================
    // NESTED FUNCTIONS (hooks in nested shouldn't count for parent)
    // ============================================
    {
      name: "hooks in event handlers don't count (though invalid React)",
      code: `
        function MyComponent() {
          const [count, setCount] = useState(0);
          
          const handleClick = () => {
            // These shouldn't be here in real code, but if they are,
            // they shouldn't count toward the component's total
          };
          
          return <div onClick={handleClick}>{count}</div>;
        }
      `,
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "empty function",
      code: `
        function MyComponent() {}
      `,
    },
    {
      name: "component returning null",
      code: `
        function MyComponent() {
          const [show, setShow] = useState(false);
          return null;
        }
      `,
    },
    {
      name: "forwardRef component under threshold",
      code: `
        const MyComponent = forwardRef(function MyComponent(props, ref) {
          const [count, setCount] = useState(0);
          const [name, setName] = useState("");
          return <div ref={ref}>{count}</div>;
        });
      `,
    },
    {
      name: "memo component under threshold",
      code: `
        const MyComponent = memo(function MyComponent() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        });
      `,
    },
  ],

  invalid: [
    // ============================================
    // EXCEEDING DEFAULT THRESHOLD (3)
    // ============================================
    {
      name: "four useState calls exceeds threshold",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "five useState calls",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          const [e, setE] = useState(0);
          return <div>{a}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 5, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "four useReducer calls exceeds threshold",
      code: `
        function MyComponent() {
          const [s1, d1] = useReducer(r, i);
          const [s2, d2] = useReducer(r, i);
          const [s3, d3] = useReducer(r, i);
          const [s4, d4] = useReducer(r, i);
          return <div>{s1}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "four useContext calls exceeds threshold",
      code: `
        function MyComponent() {
          const a = useContext(A);
          const b = useContext(B);
          const c = useContext(C);
          const d = useContext(D);
          return <div>{a}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "mixed hooks exceeding threshold",
      code: `
        function MyComponent() {
          const [count, setCount] = useState(0);
          const [name, setName] = useState("");
          const [state, dispatch] = useReducer(reducer, init);
          const theme = useContext(ThemeContext);
          return <div>{count}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },

    // ============================================
    // ARROW FUNCTION COMPONENTS
    // ============================================
    {
      name: "arrow function component exceeds threshold",
      code: `
        const MyComponent = () => {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        };
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "arrow function with implicit return exceeds threshold",
      code: `
        const MyComponent = () => {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        };
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },

    // ============================================
    // CUSTOM THRESHOLD
    // ============================================
    {
      name: "exceeds custom threshold of 2",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          return <div>{a}</div>;
        }
      `,
      options: [{ maxStateHooks: 2 }],
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 3, max: 2, component: "MyComponent" },
        },
      ],
    },
    {
      name: "exceeds custom threshold of 1",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          return <div>{a}</div>;
        }
      `,
      options: [{ maxStateHooks: 1 }],
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 2, max: 1, component: "MyComponent" },
        },
      ],
    },

    // ============================================
    // SELECTIVE COUNTING STILL EXCEEDS
    // ============================================
    {
      name: "useState only counting still exceeds",
      code: `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          const theme = useContext(ThemeContext);
          return <div>{a}</div>;
        }
      `,
      options: [{ countUseContext: false }],
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },

    // ============================================
    // MULTIPLE COMPONENTS (one exceeds)
    // ============================================
    {
      name: "one of multiple components exceeds threshold",
      code: `
        function ComponentA() {
          const [a, setA] = useState(0);
          return <div>{a}</div>;
        }
        
        function ComponentB() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "ComponentB" },
        },
      ],
    },
    {
      name: "multiple components both exceed threshold",
      code: `
        function ComponentA() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        }
        
        function ComponentB() {
          const [e, setE] = useState(0);
          const [f, setF] = useState(0);
          const [g, setG] = useState(0);
          const [h, setH] = useState(0);
          const [i, setI] = useState(0);
          return <div>{e}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "ComponentA" },
        },
        {
          messageId: "excessiveStateHooks",
          data: { count: 5, max: 3, component: "ComponentB" },
        },
      ],
    },

    // ============================================
    // REACT.useState / REACT.useReducer / REACT.useContext
    // ============================================
    {
      name: "React.useState exceeds threshold",
      code: `
        function MyComponent() {
          const [a, setA] = React.useState(0);
          const [b, setB] = React.useState(0);
          const [c, setC] = React.useState(0);
          const [d, setD] = React.useState(0);
          return <div>{a}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "mixed React.* and direct hook calls",
      code: `
        function MyComponent() {
          const [a, setA] = React.useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = React.useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },

    // ============================================
    // FORWARDREF / MEMO WRAPPED COMPONENTS
    // ============================================
    {
      name: "forwardRef component exceeds threshold",
      code: `
        const MyComponent = forwardRef(function MyComponent(props, ref) {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div ref={ref}>{a}</div>;
        });
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "memo component exceeds threshold",
      code: `
        const MyComponent = memo(function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        });
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "forwardRef with arrow function exceeds threshold",
      code: `
        const MyComponent = forwardRef((props, ref) => {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div ref={ref}>{a}</div>;
        });
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },

    // ============================================
    // ANONYMOUS COMPONENTS
    // ============================================
    {
      name: "anonymous arrow function component exceeds threshold",
      code: `
        export default () => {
          const [a, setA] = useState(0);
          const [b, setB] = useState(0);
          const [c, setC] = useState(0);
          const [d, setD] = useState(0);
          return <div>{a}</div>;
        };
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "AnonymousComponent" },
        },
      ],
    },

    // ============================================
    // REAL-WORLD PATTERNS
    // ============================================
    {
      name: "form component with too many state fields",
      code: `
        function ContactForm() {
          const [firstName, setFirstName] = useState("");
          const [lastName, setLastName] = useState("");
          const [email, setEmail] = useState("");
          const [phone, setPhone] = useState("");
          const [message, setMessage] = useState("");
          const [isSubmitting, setIsSubmitting] = useState(false);
          
          return (
            <form>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} />
              <input value={lastName} onChange={e => setLastName(e.target.value)} />
            </form>
          );
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 6, max: 3, component: "ContactForm" },
        },
      ],
    },
    {
      name: "dashboard component with too much local state",
      code: `
        function Dashboard() {
          const [user, setUser] = useState(null);
          const [projects, setProjects] = useState([]);
          const [notifications, setNotifications] = useState([]);
          const [settings, setSettings] = useState({});
          const [isLoading, setIsLoading] = useState(true);
          const [error, setError] = useState(null);
          const theme = useContext(ThemeContext);
          const auth = useContext(AuthContext);
          
          return <div>Dashboard</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 8, max: 3, component: "Dashboard" },
        },
      ],
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "useState with lazy initializer exceeds threshold",
      code: `
        function MyComponent() {
          const [a, setA] = useState(() => expensiveComputation());
          const [b, setB] = useState(() => anotherComputation());
          const [c, setC] = useState(() => yetAnother());
          const [d, setD] = useState(() => oneMore());
          return <div>{a}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
    {
      name: "useReducer with lazy init exceeds threshold",
      code: `
        function MyComponent() {
          const [s1, d1] = useReducer(r, arg, init);
          const [s2, d2] = useReducer(r, arg, init);
          const [s3, d3] = useReducer(r, arg, init);
          const [s4, d4] = useReducer(r, arg, init);
          return <div>{s1}</div>;
        }
      `,
      errors: [
        {
          messageId: "excessiveStateHooks",
          data: { count: 4, max: 3, component: "MyComponent" },
        },
      ],
    },
  ],
});
