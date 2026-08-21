import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";

// GET /api/projects/[projectId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      leader: {
        select: { id: true, name: true, avatarUrl: true, image: true, school: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true, image: true, skills: true },
          },
        },
      },
      _count: {
        select: { members: true, tasks: true },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Private projects: only members can view
  if (project.visibility === "PRIVATE") {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const isMember = project.members.some((m) => m.userId === session.user!.id);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Only return member check for caller
  const isMember = session?.user?.id
    ? project.members.some((m) => m.userId === session.user!.id)
    : false;
  const isLeader = session?.user?.id === project.leaderId;

  // Strip encrypted settings from response (never expose raw ciphertext to frontend)
  const { encryptedSettings, settingsIv, settingsTag, ...safeProject } = project;

  return NextResponse.json({
    project: safeProject,
    isMember,
    isLeader,
  });
}

// PATCH /api/projects/[projectId] — update project (leader only)
const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().min(10).max(2000).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { leaderId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.leaderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: parsed.data,
  });

  return NextResponse.json({ project: updated });
}

// DELETE /api/projects/[projectId] — delete project (leader only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { leaderId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (project.leaderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.project.delete({ where: { id: projectId } });
  return NextResponse.json({ success: true });
}
