"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProjectChat } from "./ProjectChat";
import { ProjectTasks } from "./ProjectTasks";
import { ProjectPolls } from "./ProjectPolls";
import { ProjectMedia } from "./ProjectMedia";
import { ProjectProgress } from "./ProjectProgress";
import { JoinRequests } from "./JoinRequests";
import { Globe, Lock, Users, MessageSquare, CheckSquare, BarChart3, PieChart, Image, UserCheck, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/Toaster";

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

interface ProjectDashboardProps {
  project: {
    id: string;
    name: string;
    description: string;
    visibility: string;
    tags: string[];
    inviteCode: string | null;
    leaderId: string;
    leader: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
      image: string | null;
      school: string | null;
    };
    members: Member[];
    _count: { members: number; tasks: number };
  };
  isMember: boolean;
  isLeader: boolean;
  currentUserId: string | null;
}

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "polls", label: "Polls", icon: BarChart3 },
  { id: "media", label: "Media", icon: Image },
  { id: "progress", label: "Progress", icon: PieChart },
  { id: "members", label: "Members", icon: Users },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProjectDashboard({
  project,
  isMember,
  isLeader,
  currentUserId,
}: ProjectDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [joinRequested, setJoinRequested] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  const handleRequestJoin = async () => {
    if (!currentUserId) return;
    setJoinLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      });
      if (res.ok) {
        setJoinRequested(true);
        toast({ title: "Join request sent!", variant: "success" });
      } else {
        const data = await res.json();
        toast({ title: data.error || "Error", variant: "error" });
      }
    } finally {
      setJoinLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (project.inviteCode) {
      navigator.clipboard.writeText(
        `${window.location.origin}/invite/${project.inviteCode}`
      );
      toast({ title: "Invite link copied!", variant: "success" });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-100">{project.name}</h1>
              <Badge variant={project.visibility === "PUBLIC" ? "green" : "yellow"}>
                {project.visibility === "PUBLIC" ? (
                  <><Globe size={10} className="mr-1" /> Public</>
                ) : (
                  <><Lock size={10} className="mr-1" /> Private</>
                )}
              </Badge>
            </div>

            <p className="text-gray-400 text-sm mb-4 max-w-2xl">{project.description}</p>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="indigo">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-indigo-700 flex items-center justify-center text-[10px] font-bold text-white">
                  {project.leader.name?.slice(0, 1).toUpperCase()}
                </div>
                Led by {project.leader.name}
                {project.leader.school && (
                  <span className="text-gray-600">· {project.leader.school}</span>
                )}
              </span>
              <span className="flex items-center gap-1">
                <Users size={14} />
                {project._count.members} members
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isLeader && (
              <Button
                variant="secondary"
                size="sm"
                onClick={copyInviteLink}
                id="copy-invite-link"
              >
                <Share2 size={14} />
                Invite Link
              </Button>
            )}
            {!isMember && currentUserId && (
              joinRequested ? (
                <Button variant="secondary" size="sm" disabled>
                  <UserCheck size={14} />
                  Requested
                </Button>
              ) : (
                <Button
                  size="sm"
                  loading={joinLoading}
                  onClick={handleRequestJoin}
                  id="project-join-request-btn"
                >
                  Request to Join
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Not a member — show limited view */}
      {!isMember ? (
        <div className="glass-card p-10 text-center">
          <Users className="mx-auto text-gray-600 mb-4" size={40} />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Members-only content</h3>
          <p className="text-gray-500 text-sm">
            Join this project to access the team chat, tasks, polls, and media.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                id={`tab-${id}`}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  activeTab === id
                    ? "bg-indigo-600 text-white glow-indigo"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
            {isLeader && (
              <button
                id="tab-requests"
                onClick={() => setActiveTab("members" as TabId)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                  "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                )}
              >
                <UserCheck size={15} />
                Requests
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="animate-fade-in">
            {activeTab === "chat" && (
              <ProjectChat
                projectId={project.id}
                currentUserId={currentUserId!}
                currentUserName={
                  project.members.find((m) => m.user.id === currentUserId)?.user.name || "You"
                }
              />
            )}
            {activeTab === "tasks" && (
              <ProjectTasks
                projectId={project.id}
                members={project.members}
                currentUserId={currentUserId!}
                isLeader={isLeader}
              />
            )}
            {activeTab === "polls" && (
              <ProjectPolls
                projectId={project.id}
                currentUserId={currentUserId!}
                isLeader={isLeader}
              />
            )}
            {activeTab === "media" && (
              <ProjectMedia
                projectId={project.id}
                currentUserId={currentUserId!}
              />
            )}
            {activeTab === "progress" && (
              <ProjectProgress projectId={project.id} />
            )}
            {activeTab === "members" && (
              <div className="space-y-4">
                {isLeader && (
                  <JoinRequests projectId={project.id} />
                )}
                <MembersList members={project.members} leaderId={project.leaderId} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MembersList({ members, leaderId }: { members: Member[]; leaderId: string }) {
  return (
    <div className="glass-card p-6">
      <h3 className="font-semibold text-gray-100 mb-4">Team Members ({members.length})</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-indigo-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {member.user.name?.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-200 truncate">
                  {member.user.name}
                </p>
                {member.user.id === leaderId && (
                  <Badge variant="indigo">Leader</Badge>
                )}
              </div>
              {member.user.school && (
                <p className="text-xs text-gray-500">{member.user.school}</p>
              )}
              <div className="flex flex-wrap gap-1 mt-1">
                {member.user.skills.slice(0, 3).map((skill) => (
                  <span key={skill} className="text-[10px] text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
