import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const reportSchema = z.object({
  messageId: z.string(),
  reason: z.string().min(5).max(500),
});

// POST /api/global-chat/report
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const report = await prisma.report.create({
    data: {
      messageId: parsed.data.messageId,
      reporterId: session.user.id,
      reason: parsed.data.reason,
    },
  });

  return NextResponse.json({ report }, { status: 201 });
}
