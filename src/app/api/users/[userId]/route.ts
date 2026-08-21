import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  githubUrl: z.string().url().optional().or(z.literal("")),
  school: z.string().max(200).optional(),
  skills: z.array(z.string()).max(20).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
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

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Filter private projects from public view
  const session = await auth();
  const isOwner = session?.user?.id === userId;

  if (!isOwner) {
    user.projectMembers = user.projectMembers.filter(
      (pm) => pm.project.visibility === "PUBLIC"
    );
  }

  return NextResponse.json({ user });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  const { userId } = await params;

  if (!session?.user?.id || session.user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      githubUrl: true,
      school: true,
      skills: true,
      avatarUrl: true,
    },
  });

  return NextResponse.json({ user: updated });
}
