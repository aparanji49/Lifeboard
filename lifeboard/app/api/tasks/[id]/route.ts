import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import type { SchedulingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prismaTaskToClient, clientTaskToPrismaPayload } from "@/lib/taskMapper";
import type { Task } from "@/types/tasks";

async function getTaskOr404(id: string, userId: string) {
  const row = await prisma.task.findFirst({
    where: { id, userId },
  });
  if (!row) return null;
  return row;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await getTaskOr404(id, session.user.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(prismaTaskToClient(row));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await getTaskOr404(id, session.user.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Partial<Task>;
  const merged = { ...prismaTaskToClient(row), ...body };
  const payload = clientTaskToPrismaPayload(merged);

  // When marking incomplete (completed → not completed), keep DB scheduling status
  // so the task restores to "scheduled" / "conflict" / etc. instead of "unscheduled".
  if (row.isCompleted && !payload.isCompleted) {
    (payload as { schedulingStatus: SchedulingStatus }).schedulingStatus =
      row.schedulingStatus;
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { ...payload, updatedAt: new Date() },
  });

  return NextResponse.json(prismaTaskToClient(updated));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const row = await getTaskOr404(id, session.user.id);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
