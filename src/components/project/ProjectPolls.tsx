"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toaster";
import { Plus, Loader2, BarChart3, X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { cn } from "@/lib/utils";

interface Poll {
  id: string;
  question: string;
  options: string[];
  isMultiChoice: boolean;
  closedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; avatarUrl: string | null };
  voteCounts: number[];
  userVote: number[];
  totalVoters: number;
}

interface ProjectPollsProps {
  projectId: string;
  currentUserId: string;
  isLeader: boolean;
}

export function ProjectPolls({ projectId, currentUserId, isLeader }: ProjectPollsProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [isMultiChoice, setIsMultiChoice] = useState(false);
  const [creating, setCreating] = useState(false);
  const { socket } = useSocket();

  useEffect(() => {
    fetch(`/api/projects/${projectId}/polls`)
      .then((r) => r.json())
      .then((data) => setPolls(data.polls || []))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!socket) return;
    const handlePollUpdate = (updatedPoll: Poll) => {
      setPolls((prev) =>
        prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p))
      );
    };
    socket.on("poll-updated", handlePollUpdate);
    return () => { socket.off("poll-updated", handlePollUpdate); };
  }, [socket]);

  const addOption = () => setOptions((prev) => [...prev, ""]);
  const removeOption = (i: number) =>
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  const updateOption = (i: number, val: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));

  const createPoll = async () => {
    if (!question.trim() || options.filter((o) => o.trim()).length < 2) {
      toast({ title: "Fill in question and at least 2 options", variant: "error" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          options: options.filter((o) => o.trim()),
          isMultiChoice,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPolls((prev) => [data.poll, ...prev]);
        setQuestion(""); setOptions(["", ""]); setIsMultiChoice(false);
        setShowForm(false);
        toast({ title: "Poll created!", variant: "success" });
      }
    } finally {
      setCreating(false);
    }
  };

  const vote = async (pollId: string, optionIndex: number, isMulti: boolean, currentVote: number[]) => {
    let newVote: number[];
    if (isMulti) {
      newVote = currentVote.includes(optionIndex)
        ? currentVote.filter((i) => i !== optionIndex)
        : [...currentVote, optionIndex];
    } else {
      newVote = [optionIndex];
    }

    const res = await fetch(`/api/projects/${projectId}/polls/${pollId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionIndexes: newVote }),
    });

    if (res.ok) {
      // Refetch polls to get updated counts
      const pollRes = await fetch(`/api/projects/${projectId}/polls`);
      const data = await pollRes.json();
      const updatedPoll = data.polls?.find((p: Poll) => p.id === pollId);
      if (updatedPoll) {
        setPolls((prev) => prev.map((p) => (p.id === pollId ? updatedPoll : p)));
        if (socket) socket.emit("poll-update", { projectId, poll: updatedPoll });
      }
    }
  };

  return (
    <div>
      {/* Create Poll */}
      <div className="glass-card p-5 mb-5">
        {!showForm ? (
          <Button size="sm" onClick={() => setShowForm(true)} id="create-poll-btn">
            <Plus size={14} /> New Poll
          </Button>
        ) : (
          <div className="space-y-4">
            <h3 className="font-medium text-gray-200">Create Poll</h3>
            <Input
              placeholder="What would you like to ask?"
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    id={`poll-option-${i}`}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 10 && (
                <Button variant="ghost" size="sm" onClick={addOption}>
                  <Plus size={13} /> Add option
                </Button>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                id="poll-multi-choice"
                checked={isMultiChoice}
                onChange={(e) => setIsMultiChoice(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-400">Allow multiple selections</span>
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={creating} onClick={createPoll} id="poll-create-submit">
                Create Poll
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Polls */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-600" size={28} />
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <BarChart3 className="mx-auto mb-3" size={32} />
          <p className="text-sm">No polls yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              onVote={(optionIndex) => vote(poll.id, optionIndex, poll.isMultiChoice, poll.userVote)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PollCard({ poll, onVote }: { poll: Poll; onVote: (index: number) => void }) {
  const isClosed = poll.closedAt && new Date(poll.closedAt) < new Date();
  const totalVotes = poll.voteCounts.reduce((a, b) => a + b, 0);

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-100">{poll.question}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {poll.totalVoters} voter{poll.totalVoters !== 1 ? "s" : ""} ·{" "}
            by {poll.createdBy.name} ·{" "}
            {poll.isMultiChoice ? "Multi-choice" : "Single choice"}
            {isClosed && " · Closed"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {poll.options.map((option, i) => {
          const count = poll.voteCounts[i] || 0;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const voted = poll.userVote.includes(i);

          return (
            <button
              key={i}
              onClick={() => !isClosed && onVote(i)}
              disabled={!!isClosed}
              className={cn(
                "w-full text-left rounded-lg border transition-all overflow-hidden relative",
                voted ? "border-indigo-500" : "border-gray-700 hover:border-gray-600",
                isClosed && "cursor-default"
              )}
            >
              {/* Progress fill */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg transition-all duration-500",
                  voted ? "bg-indigo-500/20" : "bg-gray-800/50"
                )}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-gray-200">{option}</span>
                <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0 ml-2">
                  <span>{count} vote{count !== 1 ? "s" : ""}</span>
                  <span className="font-medium text-gray-300">{pct}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
