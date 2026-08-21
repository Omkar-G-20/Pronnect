import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "@/components/profile/ProfileView";

interface Props {
  params: Promise<{ userId: string }>;
}

export default async function ProfilePage({ params }: Props) {
  const { userId } = await params;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      githubUrl: true,
      school: true,
      skills: true,
      avatarUrl: true,
      image: true,
      createdAt: true,
      projectMembers: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              description: true,
              tags: true,
              visibility: true,
            },
          },
        },
      },
    },
  });

  if (!user) notFound();

  const isOwner = session?.user?.id === userId;

  // Non-owners don't see private projects
  const filteredUser = {
    ...user,
    projectMembers: isOwner
      ? user.projectMembers
      : user.projectMembers.filter(
          (pm) => pm.project.visibility === "PUBLIC"
        ),
  };

  return <ProfileView user={filteredUser} isOwner={isOwner} />;
}
