"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toaster";
import { Image as ImageIcon, Link as LinkIcon, File, Plus, Loader2, ExternalLink } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface MediaItem {
  id: string;
  url: string;
  type: "IMAGE" | "FILE" | "LINK";
  name: string;
  size: number | null;
  createdAt: string;
  uploader: {
    id: string;
    name: string | null;
  };
}

interface ProjectMediaProps {
  projectId: string;
  currentUserId: string;
}

export function ProjectMedia({ projectId, currentUserId }: ProjectMediaProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/media`)
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, [projectId]);

  const shareLink = async () => {
    if (!linkUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: linkUrl.trim(),
          name: linkName.trim() || linkUrl.trim(),
          type: "LINK",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setItems((prev) => [data.item, ...prev]);
        setLinkUrl(""); setLinkName(""); setShowForm(false);
        toast({ title: "Link shared!", variant: "success" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="glass-card p-5 mb-5">
        {!showForm ? (
          <Button size="sm" onClick={() => setShowForm(true)} id="add-media-btn">
            <Plus size={14} /> Share Link / Resource
          </Button>
        ) : (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-200">Share a Link</h3>
            <Input
              placeholder="https://..."
              id="media-url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <Input
              placeholder="Name / description"
              id="media-name"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={submitting} onClick={shareLink} id="media-submit">
                Share
              </Button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-600" size={28} />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <ImageIcon className="mx-auto mb-3" size={32} />
          <p className="text-sm">No media shared yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({ item }: { item: MediaItem }) {
  const Icon = item.type === "IMAGE" ? ImageIcon : item.type === "LINK" ? LinkIcon : File;

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="glass-card p-4 flex items-start gap-3 hover:border-indigo-500/30 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate group-hover:text-indigo-300 transition-colors flex items-center gap-1">
          {item.name}
          <ExternalLink size={11} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{item.url}</p>
        <p className="text-[11px] text-gray-600 mt-1">
          by {item.uploader.name} · {formatRelativeTime(item.createdAt)}
        </p>
      </div>
    </a>
  );
}
