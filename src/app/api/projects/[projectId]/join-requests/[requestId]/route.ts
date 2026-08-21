import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const respondSchema = z.object({
  action: z.enum(["APPROVED", "DENIED"]),
});

// PATCH /api/projects/[projectId]/join-requests/[requestId] — approve or deny
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; requestId: string }> }
) {
  const session = await auth();
  const { projectId, requestId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only the leader can respond
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { leaderId: true, name: true },
  });

  if (!project || project.leaderId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const joinRequest = await prisma.joinRequest.findUnique({
    where: { id: requestId },
    select: { userId: true, status: true, projectId: true },
  });

  if (!joinRequest || joinRequest.projectId !== projectId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (joinRequest.status !== "PENDING") {
    return NextResponse.json(
      { error: "Request already processed" },
      { status: 409 }
    );
  }

  const updated = await prisma.joinRequest.update({
    where: { id: requestId },
    data: { status: parsed.data.action },
  });

  // If approved, add to members
  if (parsed.data.action === "APPROVED") {
    await prisma.projectMember.create({
      data: {
        projectId,
        userId: joinRequest.userId,
        role: "MEMBER",
      },
    });

    await prisma.activityLog.create({
      data: {
        projectId,
        actorId: session.user.id,
        action: "MEMBER_JOINED",
        metadata: { userId: joinRequest.userId },
      },
    });
  }

  // Notify the requester
  await prisma.notification.create({
    data: {
      userId: joinRequest.userId,
      type: "JOIN_REQUEST_RESPONSE",
      payload: {
        projectId,
        projectName: project.name,
        status: parsed.data.action,
      },
    },
  });

  return NextResponse.json({ joinRequest: updated });
}
