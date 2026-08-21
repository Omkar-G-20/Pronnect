import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterMessage, sanitizeText } from "@/lib/utils";

// Rate limit: 30 messages/min per user (in-memory, per server instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

async function requireMember(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  return !!member;
}

// GET /api/projects/[projectId]/messages — fetch message history
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

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = 50;

  const messages = await prisma.message.findMany({
    where: {
      projectId,
      room: "PROJECT",
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ messages: messages.reverse() });
}

// POST /api/projects/[projectId]/messages — save a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check rate limit
  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Rate limit: 30 messages/minute" },
      { status: 429 }
    );
  }

  const isMember = await requireMember(projectId, session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { content, fileUrl } = await req.json();

  if (!content?.trim() && !fileUrl) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  const sanitized = content ? sanitizeText(filterMessage(content.slice(0, 2000))) : "";

  const message = await prisma.message.create({
    data: {
      room: "PROJECT",
      projectId,
      senderId: session.user.id,
      content: sanitized,
      fileUrl: fileUrl || null,
    },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true, image: true },
      },
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
