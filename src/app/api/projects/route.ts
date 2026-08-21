import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import crypto from "crypto";

const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(10).max(2000),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  tags: z.array(z.string()).max(10),
});

// GET /api/projects - List public projects (explore page)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get("tag");
  const school = searchParams.get("school");
  const search = searchParams.get("search");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 20;

  const where: Record<string, unknown> = {
    visibility: "PUBLIC",
  };

  if (tag) {
    where.tags = { has: tag };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  if (school) {
    where.leader = { school: { contains: school, mode: "insensitive" } };
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        visibility: true,
        createdAt: true,
        leader: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            image: true,
            school: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return NextResponse.json({ projects, total, page, limit });
}

// POST /api/projects - Create a new project
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, description, visibility, tags } = parsed.data;

  // Default settings object
  const defaultSettings = {
    allowInviteLinks: true,
    maxMembers: 50,
  };

  // Encrypt settings using leader's userId as the secret component
  const { encrypted, iv, tag } = encrypt(
    JSON.stringify(defaultSettings),
    session.user.id
  );

  const inviteCode = crypto.randomUUID().split("-")[0].toUpperCase();

  const project = await prisma.project.create({
    data: {
      name,
      description,
      visibility,
      tags,
      leaderId: session.user.id,
      encryptedSettings: encrypted,
      settingsIv: iv,
      settingsTag: tag,
      inviteCode,
      members: {
        create: {
          userId: session.user.id,
          role: "LEADER",
        },
      },
    },
    include: {
      leader: {
        select: { id: true, name: true, avatarUrl: true, image: true },
      },
      _count: { select: { members: true } },
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      projectId: project.id,
      actorId: session.user.id,
      action: "PROJECT_CREATED",
      metadata: { name, visibility },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
