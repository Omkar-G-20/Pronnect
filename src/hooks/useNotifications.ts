"use client";

import { useEffect, useState } from "react";

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (data.notifications) {
          setUnreadCount(data.notifications.filter((n: { read: boolean }) => !n.read).length);
        }
      })
      .catch(() => {});

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((data) => {
          if (data.notifications) {
            setUnreadCount(data.notifications.filter((n: { read: boolean }) => !n.read).length);
          }
        })
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  return { unreadCount, setUnreadCount };
}
