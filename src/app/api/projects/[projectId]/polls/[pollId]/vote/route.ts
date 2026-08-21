import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const voteSchema = z.object({
  optionIndexes: z.array(z.number().int().min(0)).min(1),
});

async function requireMember(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!member;
}

// POST /api/projects/[projectId]/polls/[pollId]/vote
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; pollId: string }> }
) {
  const session = await auth();
  const { projectId, pollId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await requireMember(projectId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId, projectId },
    select: { isMultiChoice: true, options: true, closedAt: true },
  });

  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  if (poll.closedAt && new Date(poll.closedAt) < new Date()) {
    return NextResponse.json({ error: "Poll is closed" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  // Validate option indexes
  const validIndexes = parsed.data.optionIndexes.every(
    (i) => i >= 0 && i < poll.options.length
  );
  if (!validIndexes) {
    return NextResponse.json({ error: "Invalid option indexes" }, { status: 400 });
  }

  // For single-choice, only one index allowed
  if (!poll.isMultiChoice && parsed.data.optionIndexes.length > 1) {
    return NextResponse.json(
      { error: "This poll only allows one selection" },
      { status: 400 }
    );
  }

  // Upsert vote (allow changing vote)
  const vote = await prisma.pollVote.upsert({
    where: { pollId_userId: { pollId, userId: session.user.id } },
    create: {
      pollId,
      userId: session.user.id,
      optionIndexes: parsed.data.optionIndexes,
    },
    update: {
      optionIndexes: parsed.data.optionIndexes,
    },
  });

  return NextResponse.json({ vote });
}
