/**
 * Tests for: prefer-store-selectors
 *
 * Tests the detection of useMemo patterns that should be refactored to
 * Zustand store selectors for better performance and code organization.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./prefer-store-selectors.js";

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

ruleTester.run("prefer-store-selectors", rule, {
  valid: [
    // ============================================
    // USING SELECTORS DIRECTLY
    // ============================================
    {
      name: "using selector directly - named function",
      code: `const items = useStore(selectFilteredItems);`,
    },
    {
      name: "using selector directly - inline arrow",
      code: `const count = useStore((s) => s.count);`,
    },
    {
      name: "using selector with computation inside",
      code: `const activeItems = useStore((s) => s.items.filter(i => i.active));`,
    },
    {
      name: "using selector from object",
      code: `const data = useDataStore(selectors.getData);`,
    },

    // ============================================
    // USEMEMO WITH LOCAL STATE ONLY
    // ============================================
    {
      name: "useMemo with useState - local state only",
      code: `
        const [count, setCount] = useState(0);
        const doubled = useMemo(() => count * 2, [count]);
      `,
    },
    {
      name: "useMemo with multiple local state values",
      code: `
        const [items, setItems] = useState([]);
        const [filter, setFilter] = useState('');
        const filtered = useMemo(() => items.filter(i => i.name.includes(filter)), [items, filter]);
      `,
    },
    {
      name: "useMemo with local state array methods",
      code: `
        const [numbers, setNumbers] = useState([1, 2, 3]);
        const sum = useMemo(() => numbers.reduce((a, b) => a + b, 0), [numbers]);
      `,
    },

    // ============================================
    // USEMEMO WITH PROPS
    // ============================================
    {
      name: "useMemo with props - sorting",
      code: `
        function Component(props) {
          const sorted = useMemo(() => props.items.sort((a, b) => a.name.localeCompare(b.name)), [props.items]);
          return <List items={sorted} />;
        }
      `,
    },
    {
      name: "useMemo with props - filtering",
      code: `
        function Component({ data }) {
          const active = useMemo(() => data.filter(d => d.isActive), [data]);
          return <List items={active} />;
        }
      `,
    },
    {
      name: "useMemo with props - mapping",
      code: `
        const Component = ({ users }) => {
          const names = useMemo(() => users.map(u => u.name), [users]);
          return <ul>{names.map(n => <li key={n}>{n}</li>)}</ul>;
        };
      `,
    },

    // ============================================
    // STORE DATA USED DIRECTLY (NO USEMEMO)
    // ============================================
    {
      name: "store data used directly without transformation",
      code: `
        const items = useItemStore((s) => s.items);
        return <List items={items} />;
      `,
    },
    {
      name: "store data passed to component directly",
      code: `
        const count = useCounterStore((s) => s.count);
        const increment = useCounterStore((s) => s.increment);
        return <Counter count={count} onIncrement={increment} />;
      `,
    },

    // ============================================
    // USEMEMO NOT DEPENDING ON STORE VARIABLES
    // ============================================
    {
      name: "useMemo with constants only",
      code: `
        const items = useStore((s) => s.items);
        const config = useMemo(() => ({ pageSize: 10, sortOrder: 'asc' }), []);
      `,
    },
    {
      name: "useMemo with external variable not from store",
      code: `
        const items = useStore((s) => s.items);
        const externalData = fetchedData;
        const processed = useMemo(() => externalData.map(d => d.value), [externalData]);
      `,
    },
    {
      name: "useMemo with ref dependency",
      code: `
        const items = useStore((s) => s.items);
        const ref = useRef([]);
        const cached = useMemo(() => ref.current.slice(), [ref.current]);
      `,
    },

    // ============================================
    // NON-TRANSFORMATION USEMEMO
    // ============================================
    {
      name: "useMemo creating object from store value",
      code: `
        const count = useStore((s) => s.count);
        const obj = useMemo(() => ({ current: count }), [count]);
      `,
    },
    {
      name: "useMemo with simple computation (no array methods)",
      code: `
        const total = useStore((s) => s.total);
        const tax = useMemo(() => total * 0.1, [total]);
      `,
    },

    // ============================================
    // CUSTOM STORE PATTERN
    // ============================================
    {
      name: "custom pattern - non-matching hook with useMemo",
      code: `
        const items = useData();
        const filtered = useMemo(() => items.filter(i => i.active), [items]);
      `,
      options: [{ storeHookPattern: "^use.*Store$" }],
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "empty useMemo",
      code: `
        const items = useStore((s) => s.items);
        const empty = useMemo(() => [], []);
      `,
    },
    {
      name: "useMemo with unrelated array literal",
      code: `
        const items = useStore((s) => s.items);
        const defaults = useMemo(() => [1, 2, 3].filter(x => x > 1), []);
      `,
    },
    {
      name: "useMemo in different scope than store",
      code: `
        function Parent() {
          const items = useStore((s) => s.items);
          return <Child items={items} />;
        }
        function Child({ items }) {
          const filtered = useMemo(() => items.filter(i => i.active), [items]);
          return <List items={filtered} />;
        }
      `,
    },
  ],

  invalid: [
    // ============================================
    // SINGLE USEMEMO WITH STORE DATA
    // ============================================
    {
      name: "useMemo filtering store data",
      code: `
        const items = useComposedStore((s) => s.items);
        const filtered = useMemo(() => items.filter(x => x.active), [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "useMemo mapping store data",
      code: `
        const users = useUserStore((s) => s.users);
        const names = useMemo(() => users.map(u => u.name), [users]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "users" },
        },
      ],
    },
    {
      name: "useMemo reducing store data",
      code: `
        const items = useCartStore((s) => s.items);
        const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "useMemo sorting store data",
      code: `
        const products = useProductStore((s) => s.products);
        const sorted = useMemo(() => products.sort((a, b) => a.price - b.price), [products]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "products" },
        },
      ],
    },
    {
      name: "useMemo with find on store data",
      code: `
        const users = useUserStore((s) => s.users);
        const admin = useMemo(() => users.find(u => u.role === 'admin'), [users]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "users" },
        },
      ],
    },
    {
      name: "useMemo with some on store data",
      code: `
        const tasks = useTaskStore((s) => s.tasks);
        const hasCompleted = useMemo(() => tasks.some(t => t.completed), [tasks]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "tasks" },
        },
      ],
    },
    {
      name: "useMemo with every on store data",
      code: `
        const items = useItemStore((s) => s.items);
        const allActive = useMemo(() => items.every(i => i.isActive), [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "useMemo with flat on store data",
      code: `
        const nested = useDataStore((s) => s.nested);
        const flattened = useMemo(() => nested.flat(), [nested]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "nested" },
        },
      ],
    },
    {
      name: "useMemo with flatMap on store data",
      code: `
        const groups = useGroupStore((s) => s.groups);
        const allItems = useMemo(() => groups.flatMap(g => g.items), [groups]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "groups" },
        },
      ],
    },
    {
      name: "useMemo with slice on store data",
      code: `
        const items = useItemStore((s) => s.items);
        const first10 = useMemo(() => items.slice(0, 10), [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "useMemo with concat on store data",
      code: `
        const items = useItemStore((s) => s.items);
        const extended = useMemo(() => items.concat([{ id: 'new' }]), [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "useMemo with join on store data",
      code: `
        const tags = useTagStore((s) => s.tags);
        const tagString = useMemo(() => tags.join(', '), [tags]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "tags" },
        },
      ],
    },

    // ============================================
    // ARRAY TRANSFORMATION FUNCTIONS
    // ============================================
    {
      name: "useMemo with Array.from on store data",
      code: `
        const itemSet = useStore((s) => s.itemSet);
        const itemArray = useMemo(() => Array.from(itemSet), [itemSet]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "itemSet" },
        },
      ],
    },
    {
      name: "useMemo with Object.keys on store data",
      code: `
        const data = useDataStore((s) => s.data);
        const keys = useMemo(() => Object.keys(data), [data]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "data" },
        },
      ],
    },
    {
      name: "useMemo with Object.values on store data",
      code: `
        const dataMap = useStore((s) => s.dataMap);
        const values = useMemo(() => Object.values(dataMap), [dataMap]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "dataMap" },
        },
      ],
    },
    {
      name: "useMemo with Object.entries on store data",
      code: `
        const config = useConfigStore((s) => s.config);
        const entries = useMemo(() => Object.entries(config), [config]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "config" },
        },
      ],
    },

    // ============================================
    // CHAINED DERIVATIONS FROM STORE
    // ============================================
    {
      name: "chained useMemo - filter then map",
      code: `
        const items = useItemStore((s) => s.items);
        const active = useMemo(() => items.filter(i => i.isActive), [items]);
        const names = useMemo(() => active.map(i => i.name), [active]);
      `,
      errors: [
        {
          messageId: "chainedDerivedState",
        },
      ],
    },
    {
      name: "chained useMemo - complex dashboard example",
      code: `
        const issues = useComposedStore((s) => s.issues);
        const all = useMemo(() => issues.flat(), [issues]);
        const counts = useMemo(() => all.filter(i => i.severity === 'error'), [all]);
      `,
      errors: [
        {
          messageId: "chainedDerivedState",
        },
      ],
    },
    {
      name: "chained useMemo - filter, sort, then slice",
      code: `
        const data = useDataStore((s) => s.data);
        const filtered = useMemo(() => data.filter(d => d.valid), [data]);
        const sorted = useMemo(() => filtered.sort((a, b) => b.date - a.date), [filtered]);
        const top10 = useMemo(() => sorted.slice(0, 10), [sorted]);
      `,
      errors: [
        {
          messageId: "chainedDerivedState",
        },
      ],
    },
    {
      name: "chained useMemo - Set to array then filter",
      code: `
        const itemsSet = useStore((s) => s.itemsSet);
        const itemsArray = useMemo(() => Array.from(itemsSet), [itemsSet]);
        const activeItems = useMemo(() => itemsArray.filter(i => i.active), [itemsArray]);
      `,
      errors: [
        {
          messageId: "chainedDerivedState",
        },
      ],
    },

    // ============================================
    // MULTIPLE INDEPENDENT USEMEMO FROM STORE
    // ============================================
    {
      name: "multiple independent useMemo from same store variable",
      code: `
        const items = useItemStore((s) => s.items);
        const active = useMemo(() => items.filter(i => i.active), [items]);
        const total = useMemo(() => items.reduce((sum, i) => sum + i.price, 0), [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "multiple useMemo from different store variables",
      code: `
        const users = useUserStore((s) => s.users);
        const products = useProductStore((s) => s.products);
        const adminUsers = useMemo(() => users.filter(u => u.role === 'admin'), [users]);
        const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "users" },
        },
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "products" },
        },
      ],
    },

    // ============================================
    // BLOCK BODY USEMEMO
    // ============================================
    {
      name: "useMemo with block body returning filtered data",
      code: `
        const items = useStore((s) => s.items);
        const filtered = useMemo(() => {
          return items.filter(i => i.active);
        }, [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "useMemo with block body and intermediate variable",
      code: `
        const data = useDataStore((s) => s.data);
        const processed = useMemo(() => {
          const filtered = data.filter(d => d.valid);
          return filtered;
        }, [data]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "data" },
        },
      ],
    },

    // ============================================
    // IN COMPONENT CONTEXT
    // ============================================
    {
      name: "useMemo in function component",
      code: `
        function ProductList() {
          const products = useProductStore((s) => s.products);
          const activeProducts = useMemo(
            () => products.filter((p) => p.isActive),
            [products]
          );
          return <List items={activeProducts} />;
        }
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "products" },
        },
      ],
    },
    {
      name: "useMemo in arrow function component",
      code: `
        const TaskList = () => {
          const tasks = useTaskStore((s) => s.tasks);
          const completedTasks = useMemo(() => tasks.filter(t => t.done), [tasks]);
          return <ul>{completedTasks.map(t => <li key={t.id}>{t.title}</li>)}</ul>;
        };
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "tasks" },
        },
      ],
    },

    // ============================================
    // CUSTOM STORE PATTERN
    // ============================================
    {
      name: "custom store pattern - useGlobalStore",
      code: `
        const items = useGlobalStore((s) => s.items);
        const filtered = useMemo(() => items.filter(i => i.visible), [items]);
      `,
      options: [{ storeHookPattern: "^useGlobal.*$" }],
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "custom store pattern - useAppData",
      code: `
        const users = useAppData((s) => s.users);
        const activeUsers = useMemo(() => users.filter(u => u.active), [users]);
      `,
      options: [{ storeHookPattern: "^useApp.*$" }],
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "users" },
        },
      ],
    },

    // ============================================
    // CHAINED METHOD CALLS
    // ============================================
    {
      name: "chained methods in single useMemo - filter then map",
      code: `
        const items = useItemStore((s) => s.items);
        const result = useMemo(() => items.filter(i => i.active).map(i => i.name), [items]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "chained methods - filter, sort, slice",
      code: `
        const products = useStore((s) => s.products);
        const topProducts = useMemo(
          () => products.filter(p => p.rating > 4).sort((a, b) => b.sales - a.sales).slice(0, 5),
          [products]
        );
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "products" },
        },
      ],
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "useMemo with includes check on store array",
      code: `
        const favorites = useFavoritesStore((s) => s.favorites);
        const isFavorite = useMemo(() => favorites.includes(currentId), [favorites, currentId]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "favorites" },
        },
      ],
    },
    {
      name: "useMemo with findIndex on store data",
      code: `
        const items = useItemStore((s) => s.items);
        const index = useMemo(() => items.findIndex(i => i.id === selectedId), [items, selectedId]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "items" },
        },
      ],
    },
    {
      name: "useMemo with reverse on store data",
      code: `
        const messages = useMessageStore((s) => s.messages);
        const reversed = useMemo(() => messages.reverse(), [messages]);
      `,
      errors: [
        {
          messageId: "useMemoWithStoreData",
          data: { varName: "messages" },
        },
      ],
    },
  ],
});
