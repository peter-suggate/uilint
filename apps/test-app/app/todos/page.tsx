"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import {
  Button as MuiButton,
  IconButton,
  Chip,
  TextField,
  Checkbox as MuiCheckbox,
  FormControlLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import { Trash2, Plus, CheckCircle2 } from "lucide-react";
import {
  useTodoStore,
  selectCompletedCount,
  selectPendingCount,
} from "../stores/todoStore";

export default function TodosPage() {
  const todos = useTodoStore((state) => state.todos);
  const addTodoToStore = useTodoStore((state) => state.addTodo);
  const toggleTodo = useTodoStore((state) => state.toggleTodo);
  const deleteTodo = useTodoStore((state) => state.deleteTodo);
  const completedCount = useTodoStore(selectCompletedCount);
  const pendingCount = useTodoStore(selectPendingCount);

  const [newTodo, setNewTodo] = useState("");

  const addTodo = () => {
    if (newTodo.trim()) {
      addTodoToStore({
        title: newTodo,
        completed: false,
        priority: "medium",
        category: "Work",
      });
      setNewTodo("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header with mixed styles */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Todos</h1>
          <p className="text-gray-600 text-lg">Manage your tasks efficiently</p>
        </div>

        {/* Stats cards with inconsistent designs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1 - Shadcn style */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">{todos.length}</p>
            </CardContent>
          </Card>

          {/* Card 2 - Different padding and colors */}
          <div className="bg-white rounded-xl shadow-md p-6 border-2 border-green-200">
            <h3 className="text-md font-semibold text-gray-700 mb-2">
              Completed
            </h3>
            <p className="text-4xl font-extrabold text-green-500">
              {completedCount}
            </p>
          </div>

          {/* Card 3 - Yet another style */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow p-5">
            <div className="text-base font-medium text-orange-900">Pending</div>
            <div className="text-3xl font-bold text-orange-600 mt-1">
              {pendingCount}
            </div>
          </div>
        </div>

        {/* Add todo section with mixed components */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Add New Task</CardTitle>
              <CardDescription>Create a new todo item</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {/* Mix of shadcn Input and MUI components */}
                <Input
                  placeholder="Enter task title..."
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addTodo()}
                  className="flex-1"
                />
                <Button onClick={addTodo}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
                {/* MUI button with different styling */}
                <MuiButton
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={addTodo}
                  sx={{ textTransform: "none" }}
                >
                  Add
                </MuiButton>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Todo list with extremely inconsistent item styles */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Tasks</h2>

          {todos.map((todo, idx) => {
            // Each todo item has deliberately different styling
            if (idx % 4 === 0) {
              // Style 1: Shadcn Card
              return (
                <Card
                  key={todo.id}
                  className={todo.completed ? "opacity-60" : ""}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={todo.completed}
                        onChange={() => {
                          toggleTodo(todo.id);
                        }}
                      />
                      <div>
                        <Link href={`/todos/${todo.id}`}>
                          <h3
                            className={`text-lg font-medium ${
                              todo.completed
                                ? "line-through text-gray-500"
                                : "text-gray-900"
                            }`}
                          >
                            {todo.title}
                          </h3>
                        </Link>
                        <div className="flex gap-2 mt-1">
                          <Chip label={todo.category} size="small" />
                          <Chip
                            label={todo.priority}
                            size="small"
                            color={
                              todo.priority === "high"
                                ? "error"
                                : todo.priority === "medium"
                                ? "warning"
                                : "default"
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteTodo(todo.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            } else if (idx % 4 === 1) {
              // Style 2: Plain div with border
              return (
                <div
                  key={todo.id}
                  className="bg-white border border-gray-200 rounded p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <MuiCheckbox
                        checked={todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        color="primary"
                      />
                      <div>
                        <Link href={`/todos/${todo.id}`}>
                          <p
                            className={`text-base font-semibold ${
                              todo.completed
                                ? "line-through text-gray-400"
                                : "text-gray-800"
                            }`}
                          >
                            {todo.title}
                          </p>
                        </Link>
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {todo.category}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              todo.priority === "high"
                                ? "bg-red-100 text-red-800"
                                : todo.priority === "medium"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {todo.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <IconButton color="primary" size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        size="small"
                        onClick={() => deleteTodo(todo.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </div>
                  </div>
                </div>
              );
            } else if (idx % 4 === 2) {
              // Style 3: Colorful background
              return (
                <div
                  key={todo.id}
                  className={`rounded-lg p-6 ${
                    todo.completed
                      ? "bg-gray-100"
                      : "bg-gradient-to-r from-blue-50 to-purple-50"
                  } border-l-4 ${
                    todo.priority === "high"
                      ? "border-red-500"
                      : todo.priority === "medium"
                      ? "border-yellow-500"
                      : "border-green-500"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => toggleTodo(todo.id)}
                        className="mt-1 w-5 h-5 text-blue-600 rounded"
                      />
                      <div>
                        <Link href={`/todos/${todo.id}`}>
                          <h4
                            className={`text-xl font-bold ${
                              todo.completed
                                ? "line-through text-gray-500"
                                : "text-gray-900"
                            }`}
                          >
                            {todo.title}
                          </h4>
                        </Link>
                        <div className="flex gap-2 mt-3">
                          <span className="inline-block bg-white border-2 border-blue-300 text-blue-700 text-xs font-semibold px-3 py-1 rounded-md">
                            {todo.category}
                          </span>
                          <span className="inline-block bg-white text-gray-700 text-xs font-medium px-3 py-1 rounded-md shadow-sm">
                            Priority: {todo.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            } else {
              // Style 4: Compact style
              return (
                <div
                  key={todo.id}
                  className="bg-white rounded-md shadow border-2 border-gray-100 p-3 flex items-center justify-between hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {todo.completed && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                    <FormControlLabel
                      control={
                        <MuiCheckbox
                          checked={todo.completed}
                          onChange={() => toggleTodo(todo.id)}
                          size="small"
                        />
                      }
                      label={
                        <Link href={`/todos/${todo.id}`}>
                          <span
                            className={`${
                              todo.completed
                                ? "line-through text-gray-400"
                                : "text-gray-700"
                            } font-medium`}
                          >
                            {todo.title}
                          </span>
                        </Link>
                      }
                    />
                    <Chip
                      label={todo.category}
                      size="small"
                      variant="outlined"
                    />
                  </div>
                  <div className="flex gap-1">
                    <MuiButton size="small" variant="text">
                      Edit
                    </MuiButton>
                    <MuiButton
                      size="small"
                      variant="text"
                      color="error"
                      onClick={() => deleteTodo(todo.id)}
                    >
                      Delete
                    </MuiButton>
                  </div>
                </div>
              );
            }
          })}
        </div>

        {/* Empty state */}
        {todos.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-gray-500 text-lg">
                No todos yet. Add one to get started!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
