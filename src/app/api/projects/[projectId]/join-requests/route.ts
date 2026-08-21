import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  message: z.string().max(500).optional(),
});

// GET — list join requests for a project (leader only)
export async function GET(
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

  if (!project || project.leaderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.joinRequest.findMany({
    where: { projectId, status: "PENDING" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          image: true,
          bio: true,
          skills: true,
          school: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ requests });
}

// POST — submit a join request (rate limited: 5/hour/user)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: max 5 join requests per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRequests = await prisma.joinRequest.count({
    where: {
      userId: session.user.id,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentRequests >= 5) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  // Check if already a member
  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: session.user.id },
    },
  });

  if (existingMember) {
    return NextResponse.json(
      { error: "Already a member of this project" },
      { status: 409 }
    );
  }

  // Check for existing request
  const existingRequest = await prisma.joinRequest.findUnique({
    where: {
      projectId_userId: { projectId, userId: session.user.id },
    },
  });

  if (existingRequest) {
    return NextResponse.json(
      { error: "Join request already submitted" },
      { status: 409 }
    );
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const joinRequest = await prisma.joinRequest.create({
    data: {
      projectId,
      userId: session.user.id,
      message: parsed.data.message,
    },
  });

  // Notify leader
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { leaderId: true, name: true },
  });

  if (project) {
    await prisma.notification.create({
      data: {
        userId: project.leaderId,
        type: "JOIN_REQUEST",
        payload: {
          projectId,
          projectName: project.name,
          requestId: joinRequest.id,
          userId: session.user.id,
          userName: session.user.name,
        },
      },
    });
  }

  return NextResponse.json({ joinRequest }, { status: 201 });
}
