import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const pollSchema = z.object({
  question: z.string().min(5).max(300),
  options: z.array(z.string().min(1).max(100)).min(2).max(10),
  isMultiChoice: z.boolean().default(false),
  closedAt: z.string().datetime().optional().nullable(),
});

const voteSchema = z.object({
  optionIndexes: z.array(z.number().int().min(0)).min(1),
});

async function requireMember(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!member;
}

// GET /api/projects/[projectId]/polls
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

  const polls = await prisma.poll.findMany({
    where: { projectId },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      votes: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Attach vote counts per option and whether current user voted
  const enriched = polls.map((poll) => ({
    ...poll,
    voteCounts: poll.options.map((_, i) =>
      poll.votes.filter((v) => v.optionIndexes.includes(i)).length
    ),
    userVote: poll.votes.find((v) => v.userId === session.user!.id)?.optionIndexes || [],
    totalVoters: new Set(poll.votes.map((v) => v.userId)).size,
  }));

  return NextResponse.json({ polls: enriched });
}

// POST /api/projects/[projectId]/polls
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

  // Rate limit: 10 polls per day per project
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentPolls = await prisma.poll.count({
    where: {
      projectId,
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentPolls >= 10) {
    return NextResponse.json(
      { error: "Poll creation rate limit exceeded (10/day)" },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = pollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const poll = await prisma.poll.create({
    data: {
      projectId,
      createdById: session.user.id,
      question: parsed.data.question,
      options: parsed.data.options,
      isMultiChoice: parsed.data.isMultiChoice,
      closedAt: parsed.data.closedAt ? new Date(parsed.data.closedAt) : null,
    },
    include: {
      createdBy: { select: { id: true, name: true, avatarUrl: true } },
      votes: true,
    },
  });

  return NextResponse.json({
    poll: { ...poll, voteCounts: poll.options.map(() => 0), userVote: [], totalVoters: 0 },
  }, { status: 201 });
}
