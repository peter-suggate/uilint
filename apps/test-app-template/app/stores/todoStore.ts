import { create } from "zustand";

export type Priority = "low" | "medium" | "high";

export type Todo = {
  id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  category: string;
  description?: string;
  dueDate?: string;
  tags?: string[];
  notes?: string;
};

type TodoState = {
  todos: Todo[];
  addTodo: (todo: Omit<Todo, "id">) => void;
  toggleTodo: (id: number) => void;
  deleteTodo: (id: number) => void;
  updateTodo: (id: number, updates: Partial<Omit<Todo, "id">>) => void;
  getTodoById: (id: number) => Todo | undefined;
};

const initialTodos: Todo[] = [
  {
    id: 1,
    title: "Design new landing page",
    completed: false,
    priority: "high",
    category: "Work",
    description:
      "Create a modern, responsive landing page with hero section, features, and testimonials",
    dueDate: "2024-02-15",
    tags: ["design", "frontend", "urgent"],
    notes: "Remember to use the new brand colors and typography guidelines.",
  },
  {
    id: 2,
    title: "Review pull requests",
    completed: true,
    priority: "medium",
    category: "Work",
    description: "Review and merge pending PRs from the team",
    dueDate: "2024-02-10",
    tags: ["code-review"],
  },
  {
    id: 3,
    title: "Buy groceries",
    completed: false,
    priority: "medium",
    category: "Personal",
    description: "Weekly grocery shopping",
    tags: ["shopping"],
  },
  {
    id: 4,
    title: "Call dentist",
    completed: false,
    priority: "low",
    category: "Personal",
    description: "Schedule annual checkup appointment",
    dueDate: "2024-02-20",
  },
  {
    id: 5,
    title: "Finish quarterly report",
    completed: false,
    priority: "high",
    category: "Work",
    description: "Complete Q1 financial analysis and projections",
    dueDate: "2024-02-28",
    tags: ["finance", "urgent", "reporting"],
    notes: "Include YoY comparison charts",
  },
  {
    id: 6,
    title: "Plan weekend trip",
    completed: true,
    priority: "low",
    category: "Personal",
    description: "Research destinations and book accommodation",
    tags: ["travel", "leisure"],
  },
];

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: initialTodos,

  addTodo: (todo) =>
    set((state) => ({
      todos: [
        ...state.todos,
        {
          ...todo,
          id: Math.max(...state.todos.map((t) => t.id), 0) + 1,
        },
      ],
    })),

  toggleTodo: (id) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ),
    })),

  deleteTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== id),
    })),

  updateTodo: (id, updates) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo
      ),
    })),

  getTodoById: (id) => get().todos.find((todo) => todo.id === id),
}));

// Selectors for derived state
export const selectCompletedCount = (state: TodoState) =>
  state.todos.filter((t) => t.completed).length;

export const selectPendingCount = (state: TodoState) =>
  state.todos.filter((t) => !t.completed).length;

export const selectTodosByCategory = (state: TodoState, category: string) =>
  state.todos.filter((t) => t.category === category);

export const selectTodosByPriority = (state: TodoState, priority: Priority) =>
  state.todos.filter((t) => t.priority === priority);
