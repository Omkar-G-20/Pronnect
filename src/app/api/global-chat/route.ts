import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterMessage, sanitizeText } from "@/lib/utils";

// Rate limit: 30 messages/min per user (in-memory)
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

// GET /api/global-chat — fetch recent global messages
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const messages = await prisma.message.findMany({
    where: {
      room: "GLOBAL",
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true, image: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ messages: messages.reverse() });
}

// POST /api/global-chat — send a global message
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is muted or banned
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isBanned: true, mutedUntil: true },
  });

  if (user?.isBanned) {
    return NextResponse.json({ error: "Account banned" }, { status: 403 });
  }

  if (user?.mutedUntil && new Date(user.mutedUntil) > new Date()) {
    return NextResponse.json(
      { error: "You are muted until " + user.mutedUntil },
      { status: 403 }
    );
  }

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Rate limit: 30 messages/minute" },
      { status: 429 }
    );
  }

  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  const sanitized = sanitizeText(filterMessage(content.slice(0, 2000)));

  const message = await prisma.message.create({
    data: {
      room: "GLOBAL",
      senderId: session.user.id,
      content: sanitized,
    },
    include: {
      sender: {
        select: { id: true, name: true, avatarUrl: true, image: true },
      },
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
