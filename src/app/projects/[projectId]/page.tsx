import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProjectDashboard } from "@/components/project/ProjectDashboard";

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { projectId } = await params;
  const session = await auth();
  const currentUserId = session?.user?.id;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      leader: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          image: true,
          school: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              image: true,
              skills: true,
              school: true,
            },
          },
        },
      },
      _count: {
        select: { members: true, tasks: true },
      },
    },
  });

  if (!project) notFound();

  // Private project: must be logged in and a member
  if (project.visibility === "PRIVATE") {
    if (!currentUserId) redirect("/auth/login");
    const isMember = project.members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return (
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold mb-4">Private Project</h1>
          <p className="text-gray-400">
            You need an invite link or join request approval to access this project.
          </p>
        </div>
      );
    }
  }

  const isMember = currentUserId
    ? project.members.some((m) => m.userId === currentUserId)
    : false;
  const isLeader = currentUserId === project.leaderId;

  // Strip encrypted fields before passing to client
  const { encryptedSettings, settingsIv, settingsTag, ...safeProject } = project;

  return (
    <ProjectDashboard
      project={safeProject as typeof safeProject & { leader: typeof project.leader; members: typeof project.members; _count: typeof project._count }}
      isMember={isMember}
      isLeader={isLeader}
      currentUserId={currentUserId || null}
    />
  );
}
