/**
 * Tests for: no-prop-drilling-depth
 *
 * Tests the detection of prop drilling through multiple components.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll, beforeEach } from "vitest";
import rule, { clearPropCache } from "./no-prop-drilling-depth.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

// Clear cache between tests
beforeEach(() => {
  clearPropCache();
});

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run("no-prop-drilling-depth", rule, {
  valid: [
    // ============================================
    // PROP USED DIRECTLY
    // ============================================
    {
      name: "prop used directly in component",
      code: `
        function UserProfile({ user }) {
          return <div>{user.name}</div>;
        }
      `,
    },
    {
      name: "prop used in multiple places",
      code: `
        function UserCard({ user }) {
          return (
            <div>
              <h1>{user.name}</h1>
              <p>{user.email}</p>
            </div>
          );
        }
      `,
    },

    // ============================================
    // PROP PASSED ONCE (within threshold)
    // ============================================
    {
      name: "prop passed to one child (within default threshold)",
      code: `
        function Parent({ user }) {
          return <Child user={user} />;
        }
        function Child({ user }) {
          return <div>{user.name}</div>;
        }
      `,
    },
    {
      name: "prop passed and used",
      code: `
        function Parent({ user }) {
          console.log(user.id);
          return <Child user={user} />;
        }
        function Child({ user }) {
          return <div>{user.name}</div>;
        }
      `,
    },

    // ============================================
    // IGNORED PROPS
    // ============================================
    {
      name: "className is ignored by default",
      code: `
        function Wrapper({ className }) {
          return <Container className={className} />;
        }
        function Container({ className }) {
          return <Inner className={className} />;
        }
        function Inner({ className }) {
          return <Deep className={className} />;
        }
      `,
    },
    {
      name: "style is ignored by default",
      code: `
        function A({ style }) {
          return <B style={style} />;
        }
        function B({ style }) {
          return <C style={style} />;
        }
        function C({ style }) {
          return <D style={style} />;
        }
      `,
    },
    {
      name: "children is ignored by default",
      code: `
        function Layout({ children }) {
          return <Wrapper children={children} />;
        }
        function Wrapper({ children }) {
          return <Container children={children} />;
        }
        function Container({ children }) {
          return <div>{children}</div>;
        }
      `,
    },

    // ============================================
    // WITHIN CUSTOM THRESHOLD
    // ============================================
    {
      name: "drilling within custom higher threshold",
      code: `
        function A({ data }) {
          return <B data={data} />;
        }
        function B({ data }) {
          return <C data={data} />;
        }
        function C({ data }) {
          return <D data={data} />;
        }
        function D({ data }) {
          return <div>{data.value}</div>;
        }
      `,
      options: [{ maxDepth: 3 }],
    },

    // ============================================
    // IGNORED COMPONENT PATTERNS
    // ============================================
    {
      name: "ignored component pattern - Layout",
      code: `
        function MainLayout({ user }) {
          return <InnerLayout user={user} />;
        }
        function InnerLayout({ user }) {
          return <Content user={user} />;
        }
        function Content({ user }) {
          return <Display user={user} />;
        }
      `,
      options: [{ ignoreComponents: ["^.*Layout$"] }],
    },

    // ============================================
    // NO PROPS
    // ============================================
    {
      name: "component without props",
      code: `
        function Header() {
          return <div>Header</div>;
        }
      `,
    },

    // ============================================
    // NON-COMPONENT FUNCTIONS
    // ============================================
    {
      name: "non-component function (lowercase)",
      code: `
        function helper({ data }) {
          return data.value;
        }
      `,
    },

    // ============================================
    // PROP USED SOMEWHERE IN CHAIN
    // ============================================
    {
      name: "prop used in middle of chain",
      code: `
        function A({ user }) {
          return <B user={user} />;
        }
        function B({ user }) {
          console.log(user.id);  // Used here
          return <C user={user} />;
        }
        function C({ user }) {
          return <div>{user.name}</div>;
        }
      `,
    },

    // ============================================
    // CUSTOM IGNORED PROPS
    // ============================================
    {
      name: "custom ignored prop",
      code: `
        function A({ theme }) {
          return <B theme={theme} />;
        }
        function B({ theme }) {
          return <C theme={theme} />;
        }
        function C({ theme }) {
          return <D theme={theme} />;
        }
      `,
      options: [{ ignoredProps: ["theme"] }],
    },

    // ============================================
    // DIFFERENT PROPS TO DIFFERENT CHILDREN
    // ============================================
    {
      name: "different props to different children",
      code: `
        function Parent({ user, settings }) {
          return (
            <div>
              <UserView user={user} />
              <SettingsView settings={settings} />
            </div>
          );
        }
        function UserView({ user }) {
          return <div>{user.name}</div>;
        }
        function SettingsView({ settings }) {
          return <div>{settings.theme}</div>;
        }
      `,
    },
  ],

  invalid: [
    // ============================================
    // DRILLING EXCEEDS DEFAULT THRESHOLD (2)
    // ============================================
    {
      name: "prop drilled through 3 components",
      code: `
        function Grandparent({ user }) {
          return <Parent user={user} />;
        }
        function Parent({ user }) {
          return <Child user={user} />;
        }
        function Child({ user }) {
          return <Grandchild user={user} />;
        }
        function Grandchild({ user }) {
          return <div>{user.name}</div>;
        }
      `,
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "user",
            depth: "3",
            path: "Grandparent → Parent → Child → Grandchild",
          },
        },
      ],
    },
    {
      name: "prop drilled through 4 components",
      code: `
        function A({ data }) {
          return <B data={data} />;
        }
        function B({ data }) {
          return <C data={data} />;
        }
        function C({ data }) {
          return <D data={data} />;
        }
        function D({ data }) {
          return <E data={data} />;
        }
        function E({ data }) {
          return <div>{data.value}</div>;
        }
      `,
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "data",
            depth: "3",
            path: "A → B → C → D",
          },
        },
        {
          messageId: "propDrilling",
          data: {
            propName: "data",
            depth: "3",
            path: "B → C → D → E",
          },
        },
      ],
    },

    // ============================================
    // MULTIPLE DRILLED PROPS
    // ============================================
    {
      name: "multiple props drilled",
      code: `
        function Top({ user, settings }) {
          return <Middle user={user} settings={settings} />;
        }
        function Middle({ user, settings }) {
          return <Bottom user={user} settings={settings} />;
        }
        function Bottom({ user, settings }) {
          return <Final user={user} settings={settings} />;
        }
        function Final({ user, settings }) {
          return <div>{user.name} - {settings.theme}</div>;
        }
      `,
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "user",
            depth: "3",
            path: "Top → Middle → Bottom → Final",
          },
        },
        {
          messageId: "propDrilling",
          data: {
            propName: "settings",
            depth: "3",
            path: "Top → Middle → Bottom → Final",
          },
        },
      ],
    },

    // ============================================
    // CUSTOM LOWER THRESHOLD
    // ============================================
    {
      name: "drilling exceeds custom threshold of 1",
      code: `
        function Parent({ config }) {
          return <Child config={config} />;
        }
        function Child({ config }) {
          return <Grandchild config={config} />;
        }
        function Grandchild({ config }) {
          return <div>{config.value}</div>;
        }
      `,
      options: [{ maxDepth: 1 }],
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "config",
            depth: "2",
            path: "Parent → Child → Grandchild",
          },
        },
      ],
    },

    // ============================================
    // ARROW FUNCTION COMPONENTS
    // ============================================
    {
      name: "arrow function components drilling",
      code: `
        const A = ({ item }) => <B item={item} />;
        const B = ({ item }) => <C item={item} />;
        const C = ({ item }) => <D item={item} />;
        const D = ({ item }) => <div>{item.value}</div>;
      `,
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "item",
            depth: "3",
            path: "A → B → C → D",
          },
        },
      ],
    },

    // ============================================
    // MIXED FUNCTION STYLES
    // ============================================
    {
      name: "mixed function declaration and arrow",
      code: `
        function Container({ data }) {
          return <Wrapper data={data} />;
        }
        const Wrapper = ({ data }) => <Inner data={data} />;
        function Inner({ data }) {
          return <Deep data={data} />;
        }
        const Deep = ({ data }) => <div>{data.value}</div>;
      `,
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "data",
            depth: "3",
            path: "Container → Wrapper → Inner → Deep",
          },
        },
      ],
    },

    // ============================================
    // PROP NOT IN IGNORED LIST
    // ============================================
    {
      name: "custom prop not in default ignored list",
      code: `
        function A({ theme }) {
          return <B theme={theme} />;
        }
        function B({ theme }) {
          return <C theme={theme} />;
        }
        function C({ theme }) {
          return <D theme={theme} />;
        }
        function D({ theme }) {
          return <div>{theme}</div>;
        }
      `,
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "theme",
            depth: "3",
            path: "A → B → C → D",
          },
        },
      ],
    },

    // ============================================
    // DRILLING IN NESTED JSX
    // ============================================
    {
      name: "drilling through nested JSX structure",
      code: `
        function Page({ user }) {
          return (
            <div>
              <Header />
              <Main user={user} />
              <Footer />
            </div>
          );
        }
        function Main({ user }) {
          return (
            <section>
              <Sidebar />
              <Content user={user} />
            </section>
          );
        }
        function Content({ user }) {
          return <Profile user={user} />;
        }
        function Profile({ user }) {
          return <div>{user.name}</div>;
        }
      `,
      errors: [
        {
          messageId: "propDrilling",
          data: {
            propName: "user",
            depth: "3",
            path: "Page → Main → Content → Profile",
          },
        },
      ],
    },
  ],
});
