"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { UserCheck, UserX, Loader2, Users } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface JoinRequest {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    bio: string | null;
    skills: string[];
    school: string | null;
  };
}

interface JoinRequestsProps {
  projectId: string;
}

export function JoinRequests({ projectId }: JoinRequestsProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/join-requests`)
      .then((r) => r.json())
      .then((data) => setRequests(data.requests || []))
      .finally(() => setLoading(false));
  }, [projectId]);

  const respond = async (requestId: string, action: "APPROVED" | "DENIED") => {
    setProcessing(requestId);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/join-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        toast({
          title: action === "APPROVED" ? "Member approved!" : "Request denied",
          variant: action === "APPROVED" ? "success" : "default",
        });
      }
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 flex justify-center">
        <Loader2 className="animate-spin text-gray-600" size={24} />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <UserCheck className="text-gray-600" size={18} />
          <h3 className="font-medium text-gray-400">Join Requests</h3>
        </div>
        <p className="text-sm text-gray-600">No pending join requests</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="text-indigo-400" size={18} />
        <h3 className="font-semibold text-gray-100">
          Join Requests ({requests.length})
        </h3>
      </div>

      <div className="space-y-4">
        {requests.map((req) => (
          <div
            key={req.id}
            className="flex items-start gap-4 p-4 bg-gray-900 rounded-xl border border-gray-800"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {req.user.name?.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-gray-200">{req.user.name}</p>
                {req.user.school && (
                  <span className="text-xs text-gray-500">{req.user.school}</span>
                )}
                <span className="text-xs text-gray-600">
                  {formatRelativeTime(req.createdAt)}
                </span>
              </div>
              {req.user.bio && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{req.user.bio}</p>
              )}
              {req.user.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {req.user.skills.slice(0, 5).map((skill) => (
                    <span
                      key={skill}
                      className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
              {req.message && (
                <p className="text-sm text-gray-500 mt-2 italic">
                  &quot;{req.message}&quot;
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                loading={processing === req.id}
                onClick={() => respond(req.id, "DENIED")}
                id={`deny-${req.id}`}
              >
                <UserX size={13} />
                Deny
              </Button>
              <Button
                size="sm"
                loading={processing === req.id}
                onClick={() => respond(req.id, "APPROVED")}
                id={`approve-${req.id}`}
              >
                <UserCheck size={13} />
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
