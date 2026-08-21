"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import { formatRelativeTime } from "@/lib/utils";
import { Send, Globe, Loader2, Flag } from "lucide-react";
import { toast } from "@/components/ui/Toaster";

interface Message {
  id: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    image: string | null;
  };
}

export default function GlobalChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { socket } = useSocket();

  useEffect(() => {
    fetch("/api/global-chat")
      .then((r) => r.json())
      .then((data) => setMessages(data.messages || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit("join-global");

    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleTyping = ({ userName }: { userName: string }) => {
      if (userName === session?.user?.name) return;
      setTypingUsers((prev) => (prev.includes(userName) ? prev : [...prev, userName]));
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== userName));
      }, 3000);
    };

    socket.on("new-global-message", handleNewMessage);
    socket.on("user-typing", handleTyping);

    return () => {
      socket.off("new-global-message", handleNewMessage);
      socket.off("user-typing", handleTyping);
    };
  }, [socket, session?.user?.name]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !session) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    try {
      const res = await fetch("/api/global-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok && socket) {
        socket.emit("global-message", data.message);
      } else if (!res.ok) {
        toast({ title: data.error || "Failed to send", variant: "error" });
        setInput(content);
      }
    } finally {
      setSending(false);
    }
  };

  const reportMessage = async (messageId: string) => {
    await fetch("/api/global-chat/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, reason: "User reported" }),
    });
    toast({ title: "Message reported", variant: "default" });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Globe className="text-indigo-400" size={24} />
        <h1 className="text-xl font-bold">Global Chat</h1>
        <div className="flex items-center gap-1.5 ml-auto text-xs text-green-400">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" />
          Live
        </div>
      </div>

      <div className="glass-card flex flex-col" style={{ height: "calc(100vh - 200px)" }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-gray-600" size={24} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              No messages yet. Start the conversation! 🌐
            </div>
          ) : (
            messages.map((msg, i) => {
              const isOwn = msg.sender.id === session?.user?.id;
              const showAvatar =
                i === 0 || messages[i - 1].sender.id !== msg.sender.id;

              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}
                >
                  {showAvatar && !isOwn ? (
                    <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mb-1">
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
                    <div className={`relative px-3 py-2 rounded-2xl text-sm ${
                      isOwn
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-gray-800 text-gray-100 rounded-bl-sm"
                    }`}>
                      {msg.isDeleted ? (
                        <span className="italic text-gray-400 text-xs">Message deleted</span>
                      ) : (
                        msg.content
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-gray-600 mt-0.5 px-1">
                        {formatRelativeTime(msg.createdAt)}
                      </p>
                      {!isOwn && session && !msg.isDeleted && (
                        <button
                          onClick={() => reportMessage(msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 mt-0.5"
                        >
                          <Flag size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

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
          {session ? (
            <div className="flex items-center gap-2">
              <input
                id="global-chat-input"
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (socket) socket.emit("typing", { room: "global" });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Say something to the world…"
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              />
              <button
                id="global-chat-send"
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
          ) : (
            <p className="text-sm text-center text-gray-500">
              <a href="/auth/login" className="text-indigo-400 hover:text-indigo-300">
                Sign in
              </a>{" "}
              to join the conversation
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
