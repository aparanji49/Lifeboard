import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prismaTaskToClient, clientTaskToPrismaPayload } from "@/lib/taskMapper";
import type { Task } from "@/types/tasks";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.task.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  const tasks = rows.map(prismaTaskToClient);
  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Task;
  const payload = clientTaskToPrismaPayload(body);

  const row = await prisma.task.create({
    data: {
      userId: session.user.id,
      ...payload,
    },
  });

  return NextResponse.json(prismaTaskToClient(row));
}
