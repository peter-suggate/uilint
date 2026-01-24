import { describe, it, expect, beforeEach } from "vitest";
import { useTodoStore, selectCompletedCount, selectPendingCount } from "./todoStore";

describe("todoStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTodoStore.setState({
      todos: [
        { id: 1, title: "Test todo 1", completed: false, priority: "high", category: "Work" },
        { id: 2, title: "Test todo 2", completed: true, priority: "low", category: "Personal" },
      ],
    });
  });

  describe("addTodo", () => {
    it("should add a new todo with auto-generated id", () => {
      const store = useTodoStore.getState();

      store.addTodo({
        title: "New todo",
        completed: false,
        priority: "medium",
        category: "Work",
      });

      const todos = useTodoStore.getState().todos;
      expect(todos).toHaveLength(3);
      expect(todos[2]).toMatchObject({
        id: 3,
        title: "New todo",
        completed: false,
        priority: "medium",
        category: "Work",
      });
    });

    it("should add todo with optional fields", () => {
      const store = useTodoStore.getState();

      store.addTodo({
        title: "Todo with details",
        completed: false,
        priority: "high",
        category: "Work",
        description: "A detailed description",
        tags: ["urgent", "important"],
      });

      const todos = useTodoStore.getState().todos;
      const newTodo = todos[todos.length - 1];
      expect(newTodo.description).toBe("A detailed description");
      expect(newTodo.tags).toEqual(["urgent", "important"]);
    });
  });

  describe("toggleTodo", () => {
    it("should toggle todo from incomplete to complete", () => {
      const store = useTodoStore.getState();

      store.toggleTodo(1);

      const todo = useTodoStore.getState().todos.find((t) => t.id === 1);
      expect(todo?.completed).toBe(true);
    });

    it("should toggle todo from complete to incomplete", () => {
      const store = useTodoStore.getState();

      store.toggleTodo(2);

      const todo = useTodoStore.getState().todos.find((t) => t.id === 2);
      expect(todo?.completed).toBe(false);
    });
  });

  describe("deleteTodo", () => {
    it("should remove todo by id", () => {
      const store = useTodoStore.getState();

      store.deleteTodo(1);

      const todos = useTodoStore.getState().todos;
      expect(todos).toHaveLength(1);
      expect(todos.find((t) => t.id === 1)).toBeUndefined();
    });
  });

  // NOTE: updateTodo and getTodoById are intentionally not tested
  // to demonstrate partial test coverage

  describe("selectors", () => {
    it("selectCompletedCount returns count of completed todos", () => {
      const state = useTodoStore.getState();
      expect(selectCompletedCount(state)).toBe(1);
    });

    it("selectPendingCount returns count of pending todos", () => {
      const state = useTodoStore.getState();
      expect(selectPendingCount(state)).toBe(1);
    });

    // NOTE: selectTodosByCategory and selectTodosByPriority are intentionally
    // not tested to demonstrate partial coverage
  });
});
