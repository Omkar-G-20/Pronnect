import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowRight, Code2, Compass, MessageSquare, Zap } from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  // Get featured public projects
  const featuredProjects = await prisma.project.findMany({
    where: { visibility: "PUBLIC" },
    include: {
      leader: { select: { id: true, name: true, avatarUrl: true, image: true, school: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  }).catch(() => []);

  return (
    <div className="relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute -top-20 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm mb-8 animate-fade-in">
          <Zap size={14} />
          <span>The platform for project collaboration</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-slide-up">
          Find Your Team,{" "}
          <span className="gradient-text">Build Together</span>
        </h1>

        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 animate-fade-in">
          Pronnect brings together makers, developers, and creators. Discover exciting
          projects, join a team, and ship something great — with real-time chat,
          task management, and progress tracking all in one place.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
          {session ? (
            <>
              <Link
                href="/explore"
                id="hero-explore-btn"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all glow-indigo"
              >
                <Compass size={18} />
                Explore Projects
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/projects/new"
                id="hero-create-btn"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl font-semibold transition-all"
              >
                Create a Project
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/register"
                id="hero-register-btn"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all glow-indigo"
              >
                Get Started Free
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/explore"
                id="hero-explore-btn"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-xl font-semibold transition-all"
              >
                <Compass size={18} />
                Browse Projects
              </Link>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto animate-fade-in">
          {[
            { label: "Public Projects", value: featuredProjects.length + "+" },
            { label: "Real-time Chat", value: "✓" },
            { label: "Free to Use", value: "✓" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold gradient-text">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          Everything you need to{" "}
          <span className="gradient-text">collaborate</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="glass-card p-6 hover:border-indigo-500/30 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:bg-indigo-500/30 transition-all text-indigo-400">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-100 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent projects */}
      {featuredProjects.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold">Recent Projects</h2>
            <Link
              href="/explore"
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {featuredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="glass-card p-5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-100 group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {project.name}
                  </h3>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {project._count.members} member{project._count.members !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {project.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 text-xs rounded-md border border-indigo-500/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-5 h-5 rounded-full bg-indigo-700 flex items-center justify-center text-[10px] font-bold text-white">
                    {project.leader.name?.slice(0, 1).toUpperCase()}
                  </div>
                  <span>{project.leader.name}</span>
                  {project.leader.school && (
                    <span className="text-gray-600">· {project.leader.school}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const features = [
  {
    title: "Discover Projects",
    description:
      "Browse a feed of public projects. Filter by domain, tags, or school to find the perfect team to join.",
    icon: <Compass size={20} />,
  },
  {
    title: "Real-time Chat",
    description:
      "Every project has its own team chat powered by Socket.IO. Plus a global chat for the whole community.",
    icon: <MessageSquare size={20} />,
  },
  {
    title: "Tasks, Polls & Progress",
    description:
      "Create tasks, assign them, run polls, and visualize your project's progress with beautiful charts.",
    icon: <Code2 size={20} />,
  },
];
