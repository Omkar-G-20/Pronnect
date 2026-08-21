"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/Toaster";
import { Plus, Check, Clock, Loader2, Trash2, Calendar } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  creatorId: string;
  assignee: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    image: string | null;
  } | null;
  creator: { id: string; name: string | null };
}

interface Member {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    image: string | null;
    skills: string[];
    school: string | null;
  };
}

interface ProjectTasksProps {
  projectId: string;
  members: Member[];
  currentUserId: string;
  isLeader: boolean;
}

const STATUS_STYLES = {
  TODO: { label: "To Do", variant: "default" as const, icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "yellow" as const, icon: Loader2 },
  DONE: { label: "Done", variant: "green" as const, icon: Check },
};

export function ProjectTasks({ projectId, members, currentUserId, isLeader }: ProjectTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;
    const handleTaskUpdate = (updatedTask: Task) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
      );
    };
    socket.on("task-updated", handleTaskUpdate);
    return () => { socket.off("task-updated", handleTaskUpdate); };
  }, [socket]);

  const createTask = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assigneeId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks((prev) => [...prev, data.task]);
        setTitle(""); setDescription(""); setAssigneeId(""); setDueDate("");
        setShowForm(false);
        toast({ title: "Task created", variant: "success" });
      }
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (taskId: string, status: Task["status"]) => {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
      if (socket) socket.emit("task-update", { projectId, task: data.task });
    }
  };

  const deleteTask = async (taskId: string) => {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({ title: "Task deleted" });
    }
  };

  const grouped = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    DONE: tasks.filter((t) => t.status === "DONE"),
  };

  return (
    <div>
      {/* Create Task */}
      <div className="glass-card p-5 mb-5">
        {!showForm ? (
          <Button size="sm" onClick={() => setShowForm(true)} id="create-task-btn">
            <Plus size={14} /> New Task
          </Button>
        ) : (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-200">Create Task</h3>
            <Input
              placeholder="Task title"
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)"
              id="task-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-400">Assign to</label>
                <select
                  id="task-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.user.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Due Date"
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={creating}
                onClick={createTask}
                id="task-create-submit"
              >
                Create
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Kanban-style columns */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-600" size={28} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["TODO", "IN_PROGRESS", "DONE"] as const).map((status) => {
            const { label, variant, icon: Icon } = STATUS_STYLES[status];
            return (
              <div key={status} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={variant}>{label}</Badge>
                  <span className="text-xs text-gray-600">
                    {grouped[status].length}
                  </span>
                </div>
                <div className="space-y-3">
                  {grouped[status].length === 0 && (
                    <p className="text-xs text-gray-600 text-center py-4">
                      No tasks
                    </p>
                  )}
                  {grouped[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      currentUserId={currentUserId}
                      isLeader={isLeader}
                      onStatusChange={updateStatus}
                      onDelete={deleteTask}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  currentUserId,
  isLeader,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  currentUserId: string;
  isLeader: boolean;
  onStatusChange: (id: string, status: Task["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const canDelete = task.creatorId === currentUserId || isLeader;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 group hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-200 flex-1">{task.title}</p>
        {canDelete && (
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
      )}

      {task.dueDate && (
        <p className="text-[11px] text-gray-600 flex items-center gap-1 mb-2">
          <Calendar size={10} />
          {formatDate(task.dueDate)}
        </p>
      )}

      {task.assignee && (
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-4 h-4 rounded-full bg-indigo-700 flex items-center justify-center text-[8px] font-bold text-white">
            {task.assignee.name?.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-[11px] text-gray-500">{task.assignee.name}</span>
        </div>
      )}

      {/* Status change buttons */}
      <div className="flex gap-1">
        {(["TODO", "IN_PROGRESS", "DONE"] as const)
          .filter((s) => s !== task.status)
          .map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(task.id, s)}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-all"
            >
              → {STATUS_STYLES[s].label}
            </button>
          ))}
      </div>
    </div>
  );
}
