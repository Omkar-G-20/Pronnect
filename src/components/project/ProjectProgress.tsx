"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Loader2, TrendingUp } from "lucide-react";

interface Task {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  title: string;
  assignee?: { name: string | null } | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectProgressProps {
  projectId: string;
}

const STATUS_COLORS = {
  TODO: "#6b7280",
  IN_PROGRESS: "#eab308",
  DONE: "#22c55e",
};

export function ProjectProgress({ projectId }: ProjectProgressProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tasks`)
      .then((r) => r.json())
      .then((data) => setTasks(data.tasks || []))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-gray-600" size={28} />
      </div>
    );
  }

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const todo = tasks.filter((t) => t.status === "TODO").length;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const pieData = [
    { name: "To Do", value: todo, color: STATUS_COLORS.TODO },
    { name: "In Progress", value: inProgress, color: STATUS_COLORS.IN_PROGRESS },
    { name: "Done", value: done, color: STATUS_COLORS.DONE },
  ].filter((d) => d.value > 0);

  // Member contribution chart
  const memberContrib: Record<string, number> = {};
  for (const task of tasks) {
    if (task.status === "DONE" && task.assignee?.name) {
      memberContrib[task.assignee.name] = (memberContrib[task.assignee.name] || 0) + 1;
    }
  }
  const contribData = Object.entries(memberContrib).map(([name, count]) => ({
    name,
    completed: count,
  }));

  return (
    <div className="space-y-5">
      {/* Overall progress */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="text-indigo-400" size={20} />
          <h3 className="font-semibold text-gray-100">Overall Progress</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Tasks", value: total, color: "text-gray-300" },
            { label: "To Do", value: todo, color: "text-gray-400" },
            { label: "In Progress", value: inProgress, color: "text-yellow-400" },
            { label: "Done", value: done, color: "text-green-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Completion</span>
            <span className="text-sm font-bold text-green-400">{completionPct}%</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all duration-700"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="glass-card p-10 text-center">
          <TrendingUp className="mx-auto text-gray-700 mb-3" size={32} />
          <p className="text-gray-500 text-sm">
            Add tasks to see progress charts
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pie chart */}
          <div className="glass-card p-5">
            <h4 className="font-medium text-gray-200 mb-4">Task Status Distribution</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f9fafb",
                  }}
                />
                <Legend
                  formatter={(val) => (
                    <span style={{ color: "#9ca3af", fontSize: "12px" }}>{val}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Member contributions */}
          {contribData.length > 0 && (
            <div className="glass-card p-5">
              <h4 className="font-medium text-gray-200 mb-4">Tasks Completed by Member</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={contribData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111827",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#f9fafb",
                    }}
                  />
                  <Bar
                    dataKey="completed"
                    name="Tasks Done"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
