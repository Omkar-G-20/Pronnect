"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { formatRelativeTime } from "@/lib/utils";
import { Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  content: string;
  fileUrl: string | null;
  isDeleted: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    image: string | null;
  };
}

interface ProjectChatProps {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
}

export function ProjectChat({ projectId, currentUserId, currentUserName }: ProjectChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const { socket } = useSocket();

  // Load history
  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/messages`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Socket.IO events
  useEffect(() => {
    if (!socket) return;
    socket.emit("join-project", projectId);

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      setTypingUsers((prev) => prev.filter((u) => u !== msg.sender.name));
    };

    const handleTyping = ({ userName }: { userName: string }) => {
      if (userName === currentUserName) return;
      setTypingUsers((prev) => (prev.includes(userName) ? prev : [...prev, userName]));
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== userName));
      }, 3000);
    };

    socket.on("new-project-message", handleNewMessage);
    socket.on("user-typing", handleTyping);

    return () => {
      socket.off("new-project-message", handleNewMessage);
      socket.off("user-typing", handleTyping);
      socket.emit("leave-project", projectId);
    };
  }, [socket, projectId, currentUserName]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (socket) {
      socket.emit("typing", { room: "project", projectId });
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => {}, 2000);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.message && socket) {
        socket.emit("project-message", { projectId, message: data.message });
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="glass-card flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-soft" />
        <span className="text-sm font-medium text-gray-300">Team Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-600" size={24} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No messages yet. Be the first to say hi! 👋
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.sender.id === currentUserId;
            const showAvatar =
              i === 0 || messages[i - 1].sender.id !== msg.sender.id;

            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                {showAvatar && !isOwn ? (
                  <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mb-1">
                    {msg.sender.name?.slice(0, 1).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-7 shrink-0" />
                )}

                <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                  {showAvatar && !isOwn && (
                    <p className="text-[11px] text-gray-500 mb-1 px-1">
                      {msg.sender.name}
                    </p>
                  )}
                  <div
                    className={`px-3 py-2 rounded-2xl text-sm ${
                      isOwn
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-gray-800 text-gray-100 rounded-bl-sm"
                    }`}
                  >
                    {msg.isDeleted ? (
                      <span className="italic text-gray-400 text-xs">
                        Message deleted
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-0.5 px-1">
                    {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Send a message…"
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
          />
          <button
            id="chat-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white disabled:opacity-50 transition-all"
          >
            {sending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
