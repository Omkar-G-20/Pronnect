"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/ui/Toaster";
import { SKILL_OPTIONS, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Edit3,
  GraduationCap,
  Save,
  X,
  Folder,
  Calendar,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  tags: string[];
  visibility: string;
}

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  bio: string | null;
  githubUrl: string | null;
  school: string | null;
  skills: string[];
  avatarUrl: string | null;
  image: string | null;
  createdAt: Date;
  projectMembers: {
    project: Project;
  }[];
}

interface ProfileViewProps {
  user: UserProfile;
  isOwner: boolean;
}

export function ProfileView({ user, isOwner }: ProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(user.name || "");
  const [bio, setBio] = useState(user.bio || "");
  const [githubUrl, setGithubUrl] = useState(user.githubUrl || "");
  const [school, setSchool] = useState(user.school || "");
  const [skills, setSkills] = useState<string[]>(user.skills);

  const toggleSkill = (skill: string) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, githubUrl, school, skills }),
      });
      if (res.ok) {
        toast({ title: "Profile saved!", variant: "success" });
        setEditing(false);
      } else {
        const data = await res.json();
        toast({ title: data.error || "Save failed", variant: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  const initials = (user.name || user.email).slice(0, 2).toUpperCase();
  const avatar = user.avatarUrl || user.image;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Profile header */}
      <div className="glass-card p-8 mb-6 relative">
        {isOwner && !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="absolute top-5 right-5"
            id="edit-profile-btn"
          >
            <Edit3 size={14} />
            Edit Profile
          </Button>
        )}

        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-indigo-700 flex items-center justify-center text-2xl font-bold text-white glow-indigo shrink-0 overflow-hidden">
            {avatar ? (
              <img src={avatar} alt={user.name || ""} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <div className="flex-1">
            {editing ? (
              <div className="space-y-4">
                <Input
                  label="Name"
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Textarea
                  label="Bio"
                  id="profile-bio"
                  rows={3}
                  value={bio}
                  placeholder="Tell people about yourself..."
                  onChange={(e) => setBio(e.target.value)}
                />
                <Input
                  label="GitHub URL"
                  id="profile-github"
                  value={githubUrl}
                  placeholder="https://github.com/username"
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
                <Input
                  label="School / College"
                  id="profile-school"
                  value={school}
                  placeholder="MIT, IIT, Stanford..."
                  onChange={(e) => setSchool(e.target.value)}
                />

                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">
                    Skills (select all that apply)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SKILL_OPTIONS.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium transition-all border",
                          skills.includes(skill)
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                        )}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(false)}
                  >
                    <X size={13} /> Cancel
                  </Button>
                  <Button
                    size="sm"
                    loading={saving}
                    onClick={saveProfile}
                    id="save-profile-btn"
                  >
                    <Save size={13} /> Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-gray-100 mb-1">
                  {user.name || "Anonymous"}
                </h1>
                {isOwner && (
                  <p className="text-sm text-gray-500 mb-2">{user.email}</p>
                )}
                {user.bio && (
                  <p className="text-sm text-gray-300 mb-3 max-w-xl">{user.bio}</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                  {user.school && (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap size={14} className="text-indigo-400" />
                      {user.school}
                    </span>
                  )}
                  {user.githubUrl && (
                    <a
                      href={user.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:text-gray-200 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                      GitHub
                    </a>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    Joined {formatDate(user.createdAt)}
                  </span>
                </div>

                {user.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {user.skills.map((skill) => (
                      <Badge key={skill} variant="indigo">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Folder className="text-indigo-400" size={18} />
          <h2 className="font-semibold text-gray-100">
            Projects ({user.projectMembers.length})
          </h2>
        </div>

        {user.projectMembers.length === 0 ? (
          <p className="text-sm text-gray-600">
            {isOwner
              ? "You haven't joined any projects yet."
              : "No public projects."}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {user.projectMembers.map(({ project }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-indigo-500/30 transition-all group"
              >
                <h3 className="font-medium text-gray-200 group-hover:text-indigo-300 transition-colors mb-1">
                  {project.name}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {project.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="indigo">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
