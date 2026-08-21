"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useSession } from "next-auth/react";

type ClientSocket = ReturnType<typeof io>;

let socketInstance: ClientSocket | null = null;

export function useSocket() {
  const { data: session } = useSession();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<ClientSocket | null>(null);

  useEffect(() => {
    const user = session?.user;
    if (!user?.id) return;

    if (!socketInstance) {
      socketInstance = io(window.location.origin, {
        transports: ["websocket"],
      });
    }

    socketRef.current = socketInstance;

    const handleConnect = () => {
      setConnected(true);
      socketInstance?.emit("authenticate", {
        userId: user.id,
        userName: user.name || "Anonymous",
      });
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    socketInstance.on("connect", handleConnect);
    socketInstance.on("disconnect", handleDisconnect);

    if (socketInstance.connected) {
      setConnected(true);
      socketInstance.emit("authenticate", {
        userId: user.id,
        userName: user.name || "Anonymous",
      });
    }

    return () => {
      socketInstance?.off("connect", handleConnect);
      socketInstance?.off("disconnect", handleDisconnect);
    };
  }, [session?.user?.id, session?.user]);

  return { socket: socketRef.current, connected };
}
