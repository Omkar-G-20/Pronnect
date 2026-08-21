"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Compass, Search, Tag, GraduationCap, Users, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DOMAIN_TAGS } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface Project {
  id: string;
  name: string;
  description: string;
  tags: string[];
  visibility: string;
  createdAt: string;
  leader: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    image: string | null;
    school: string | null;
  };
  _count: { members: number };
}

export default function ExplorePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "");
  const [school, setSchool] = useState(searchParams.get("school") || "");
  const [page, setPage] = useState(1);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedTag) params.set("tag", selectedTag);
    if (school) params.set("school", school);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/projects?${params}`);
      const data = await res.json();
      setProjects(data.projects || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [search, selectedTag, school, page]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProjects();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Compass className="text-indigo-400" size={28} />
          <h1 className="text-3xl font-bold">Explore Projects</h1>
        </div>
        <p className="text-gray-400">
          Discover open projects and request to join a team
        </p>
      </div>

      {/* Search + Filters */}
      <div className="glass-card p-5 mb-8 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              id="explore-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name or description..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
          <Button type="submit" id="explore-search-btn">Search</Button>
        </form>

        <div className="flex flex-wrap gap-3">
          {/* School filter */}
          <div className="relative flex-1 min-w-48">
            <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              id="explore-school-filter"
              type="text"
              value={school}
              onChange={(e) => { setSchool(e.target.value); setPage(1); }}
              placeholder="Filter by school..."
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Tag filters */}
        <div className="flex flex-wrap gap-2">
          <button
            id="tag-all"
            onClick={() => { setSelectedTag(""); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
              !selectedTag
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
            }`}
          >
            All
          </button>
          {DOMAIN_TAGS.map((tag) => (
            <button
              key={tag}
              id={`tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              onClick={() => { setSelectedTag(tag === selectedTag ? "" : tag); setPage(1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                selectedTag === tag
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          {loading ? "Loading..." : `${total} project${total !== 1 ? "s" : ""} found`}
        </p>
        {session && (
          <Link href="/projects/new">
            <Button size="sm" id="create-project-btn">
              <Plus size={14} />
              New Project
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={32} />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <Compass className="mx-auto text-gray-700 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No projects found</h3>
          <p className="text-gray-600 text-sm">
            Try different filters or{" "}
            {session ? (
              <Link href="/projects/new" className="text-indigo-400 hover:text-indigo-300">
                create the first one
              </Link>
            ) : (
              <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300">
                sign up to create one
              </Link>
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} session={session} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-3 mt-10">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-400">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= Math.ceil(total / 20)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

import type { Session } from "next-auth";

function ProjectCard({
  project,
  session,
}: {
  project: Project;
  session: Session | null;
}) {
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestJoin = async () => {
    if (!session) return;
    setLoading(true);
    try {
      await fetch(`/api/projects/${project.id}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      });
      setRequested(true);
    } finally {
      setLoading(false);
    }
  };

  const isLeader = session?.user?.id === project.leader.id;

  return (
    <div className="glass-card p-5 flex flex-col hover:border-indigo-500/30 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <Link
          href={`/projects/${project.id}`}
          className="font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors line-clamp-1 flex-1 mr-2"
        >
          {project.name}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
          <Users size={12} />
          {project._count.members}
        </div>
      </div>

      <p className="text-sm text-gray-400 line-clamp-2 mb-4 flex-1">
        {project.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {project.tags.slice(0, 4).map((tag) => (
          <Badge key={tag} variant="indigo">
            {tag}
          </Badge>
        ))}
      </div>

      {/* Leader info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {project.leader.name?.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-gray-300">{project.leader.name}</p>
            {project.leader.school && (
              <p className="text-[10px] text-gray-500">{project.leader.school}</p>
            )}
          </div>
        </div>

        {session && !isLeader && (
          requested ? (
            <span className="text-xs text-green-400 font-medium">Requested ✓</span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              loading={loading}
              onClick={handleRequestJoin}
              id={`join-${project.id}`}
            >
              Request to Join
            </Button>
          )
        )}

        {isLeader && (
          <Link href={`/projects/${project.id}`}>
            <Button size="sm" variant="secondary">
              Manage
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
