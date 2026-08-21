import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mediaSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(200),
  type: z.enum(["IMAGE", "FILE", "LINK"]).default("LINK"),
  size: z.number().optional(),
});

async function requireMember(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!member;
}

// GET /api/projects/[projectId]/media
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await requireMember(projectId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await prisma.mediaItem.findMany({
    where: { projectId },
    include: {
      uploader: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}

// POST /api/projects/[projectId]/media
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await requireMember(projectId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = mediaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const item = await prisma.mediaItem.create({
    data: {
      projectId,
      uploaderId: session.user.id,
      url: parsed.data.url,
      name: parsed.data.name,
      type: parsed.data.type,
      size: parsed.data.size || null,
    },
    include: {
      uploader: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
