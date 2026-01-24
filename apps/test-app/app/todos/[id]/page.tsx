"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import {
  Button as MuiButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextareaAutosize,
  Switch,
  FormControlLabel,
  Chip,
  Stack,
} from "@mui/material";
import { ArrowLeft, Save, Trash2, Calendar } from "lucide-react";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTodoStore, type Todo, type Priority } from "../../stores/todoStore";

export default function TodoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const todoId = parseInt(params.id as string);

  const storeTodo = useTodoStore((state) => state.getTodoById(todoId));
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const deleteTodoFromStore = useTodoStore((state) => state.deleteTodo);

  // Local state for editing (mirrors store data)
  const [todo, setTodo] = useState<Todo & { description?: string; dueDate?: string; tags?: string[]; notes?: string }>({
    id: todoId,
    title: "",
    description: "",
    completed: false,
    priority: "medium",
    category: "Work",
    dueDate: "",
    tags: [],
    notes: "",
  });

  const [isEditing, setIsEditing] = useState(false);

  // Sync local state with store
  useEffect(() => {
    if (storeTodo) {
      setTodo({
        ...storeTodo,
        description: storeTodo.description || "",
        dueDate: storeTodo.dueDate || "",
        tags: storeTodo.tags || [],
        notes: storeTodo.notes || "",
      });
    }
  }, [storeTodo]);

  const handleSave = () => {
    updateTodo(todoId, {
      title: todo.title,
      description: todo.description,
      completed: todo.completed,
      priority: todo.priority,
      category: todo.category,
      dueDate: todo.dueDate,
      tags: todo.tags,
      notes: todo.notes,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    deleteTodoFromStore(todoId);
    router.push("/todos");
  };

  if (!storeTodo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Todo not found</h1>
          <Link href="/todos">
            <Button>Back to Todos</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back button with inconsistent styles */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/todos">
            <button className="flex items-center text-blue-600 hover:text-blue-800 font-medium">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Todos
            </button>
          </Link>
          <div className="flex gap-3">
            {isEditing ? (
              <>
                <Button onClick={handleSave} variant="default">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <MuiButton
                  variant="contained"
                  color="primary"
                  onClick={() => setIsEditing(true)}
                  sx={{ textTransform: "none" }}
                >
                  Edit Task
                </MuiButton>
                <MuiButton
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                  sx={{ textTransform: "none" }}
                >
                  Delete
                </MuiButton>
              </>
            )}
          </div>
        </div>

        {/* Main content with mixed styles */}
        <div className="space-y-6">
          {/* Title section - inconsistent header styles */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {isEditing ? (
                    <Input
                      value={todo.title}
                      onChange={(e) =>
                        setTodo({ ...todo, title: e.target.value })
                      }
                      className="text-2xl font-bold mb-2"
                    />
                  ) : (
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {todo.title}
                    </h1>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Chip
                      label={todo.completed ? "Completed" : "Pending"}
                      color={todo.completed ? "success" : "default"}
                      size="small"
                    />
                    <Chip
                      label={`Priority: ${todo.priority}`}
                      color={
                        todo.priority === "high"
                          ? "error"
                          : todo.priority === "medium"
                          ? "warning"
                          : "success"
                      }
                      size="small"
                    />
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                      {todo.category}
                    </span>
                  </div>
                </div>
                <div>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={todo.completed}
                        onChange={(e) =>
                          setTodo({ ...todo, completed: e.target.checked })
                        }
                        color="success"
                      />
                    }
                    label="Mark Complete"
                  />
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Description card - different padding style */}
          <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Description
            </h2>
            {isEditing ? (
              <TextField
                multiline
                rows={4}
                fullWidth
                value={todo.description}
                onChange={(e) =>
                  setTodo({ ...todo, description: e.target.value })
                }
                variant="outlined"
              />
            ) : (
              <p className="text-gray-700 leading-relaxed text-base">
                {todo.description}
              </p>
            )}
          </div>

          {/* Details grid with inconsistent layouts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Priority card - different style */}
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
              <h3 className="font-bold text-gray-700 mb-3 text-lg">Priority</h3>
              {isEditing ? (
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={todo.priority}
                    label="Priority"
                    onChange={(e) =>
                      setTodo({ ...todo, priority: e.target.value as any })
                    }
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              ) : (
                <div
                  className={`inline-block px-4 py-2 rounded-full font-semibold ${
                    todo.priority === "high"
                      ? "bg-red-100 text-red-800"
                      : todo.priority === "medium"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {todo.priority.toUpperCase()}
                </div>
              )}
            </div>

            {/* Category card - yet another style */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category</CardTitle>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <select
                    value={todo.category}
                    onChange={(e) =>
                      setTodo({ ...todo, category: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Work">Work</option>
                    <option value="Personal">Personal</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Health">Health</option>
                  </select>
                ) : (
                  <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md font-medium">
                    {todo.category}
                  </span>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Due date section - inconsistent date styling */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-purple-900 mb-2">
                  Due Date
                </h3>
                {isEditing ? (
                  <input
                    type="date"
                    value={todo.dueDate}
                    onChange={(e) =>
                      setTodo({ ...todo, dueDate: e.target.value })
                    }
                    className="px-4 py-2 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                ) : (
                  <div className="flex items-center text-purple-700 font-medium text-base">
                    <Calendar className="w-5 h-5 mr-2" />
                    {todo.dueDate
                      ? new Date(todo.dueDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "No due date set"}
                  </div>
                )}
              </div>
              <div className="text-sm text-purple-600 bg-white px-4 py-2 rounded-full shadow">
                5 days left
              </div>
            </div>
          </div>

          {/* Tags section - completely different approach */}
          <div className="bg-white p-5 rounded-md shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-3">Tags</h3>
            {isEditing ? (
              <TextField
                fullWidth
                size="small"
                placeholder="Add tags (comma-separated)"
                value={(todo.tags || []).join(", ")}
                onChange={(e) =>
                  setTodo({
                    ...todo,
                    tags: e.target.value.split(",").map((t) => t.trim()),
                  })
                }
              />
            ) : (
              <Stack direction="row" spacing={1}>
                {(todo.tags || []).map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-block bg-gray-200 text-gray-700 text-sm px-3 py-1 rounded hover:bg-gray-300 transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </Stack>
            )}
          </div>

          {/* Notes section - textarea with different styles */}
          <Card className="shadow-lg">
            <CardHeader className="bg-gray-50">
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isEditing ? (
                <textarea
                  value={todo.notes}
                  onChange={(e) => setTodo({ ...todo, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 min-h-[120px] font-sans text-gray-700"
                  placeholder="Add any additional notes here..."
                />
              ) : (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                  <p className="text-gray-800 italic">{todo.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action buttons at bottom - different from top */}
          {isEditing && (
            <div className="flex justify-end gap-4 pt-4">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 border-2 border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2"
              >
                <SaveIcon />
                Save Changes
              </button>
              <MuiButton
                variant="contained"
                color="error"
                startIcon={<Trash2 />}
                onClick={handleDelete}
              >
                Delete Task
              </MuiButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
