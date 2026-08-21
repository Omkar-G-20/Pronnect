import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Mark all as read
  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="text-indigo-400" size={24} />
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      {notifications.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Bell className="mx-auto text-gray-700 mb-3" size={32} />
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <NotificationItem key={notif.id} notif={notif} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notif }: { notif: { id: string; type: string; payload: unknown; read: boolean; createdAt: Date } }) {
  const payload = notif.payload as Record<string, string>;

  let title = "";
  let description = "";
  let href = "/";

  switch (notif.type) {
    case "JOIN_REQUEST":
      title = "New join request";
      description = `${payload.userName} wants to join "${payload.projectName}"`;
      href = `/projects/${payload.projectId}`;
      break;
    case "JOIN_REQUEST_RESPONSE":
      title = payload.status === "APPROVED" ? "Join request approved! 🎉" : "Join request denied";
      description = `Your request to join "${payload.projectName}" was ${payload.status === "APPROVED" ? "approved" : "denied"}`;
      href = payload.status === "APPROVED" ? `/projects/${payload.projectId}` : "/explore";
      break;
    case "TASK_ASSIGNED":
      title = "Task assigned to you";
      description = `"${payload.taskTitle}" assigned by ${payload.assignedBy}`;
      href = `/projects/${payload.projectId}`;
      break;
    default:
      title = notif.type;
      description = JSON.stringify(notif.payload);
  }

  return (
    <Link
      href={href}
      className={`flex items-start gap-4 p-4 rounded-xl border transition-all hover:border-indigo-500/30 ${
        notif.read ? "glass-card opacity-70" : "glass-card border-indigo-500/30 bg-indigo-500/5"
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        notif.read ? "bg-gray-800" : "bg-indigo-500/20"
      }`}>
        <Bell size={14} className={notif.read ? "text-gray-500" : "text-indigo-400"} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-200">{title}</p>
        <p className="text-sm text-gray-400 mt-0.5">{description}</p>
        <p className="text-xs text-gray-600 mt-1">{formatRelativeTime(notif.createdAt)}</p>
      </div>
    </Link>
  );
}
