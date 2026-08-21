"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { DOMAIN_TAGS } from "@/lib/utils";
import { Folder, Globe, Lock } from "lucide-react";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/utils";

const createProjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  tags: z.array(z.string()).min(1, "Select at least one tag").max(10),
});

type CreateProjectForm = z.infer<typeof createProjectSchema>;

export default function NewProjectPage() {
  const router = useRouter();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { visibility: "PUBLIC", tags: [] },
  });

  const visibility = watch("visibility");

  const toggleTag = (tag: string) => {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(next);
    setValue("tags", next, { shouldValidate: true });
  };

  const onSubmit = async (data: CreateProjectForm) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      toast({
        title: "Error creating project",
        description: body.error || "Something went wrong",
        variant: "error",
      });
      return;
    }

    const { project } = await res.json();
    toast({ title: "Project created!", variant: "success" });
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Folder size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Create a New Project</h1>
          <p className="text-sm text-gray-400">
            You&apos;ll be the leader — others can request to join
          </p>
        </div>
      </div>

      <div className="glass-card p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input
            label="Project Name"
            id="project-name"
            placeholder="My Awesome Project"
            {...register("name")}
            error={errors.name?.message}
          />

          <Textarea
            label="Description"
            id="project-description"
            placeholder="What is this project about? What will you build? Who are you looking for?"
            rows={4}
            {...register("description")}
            error={errors.description?.message}
          />

          {/* Visibility */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Visibility</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="visibility-public"
                onClick={() => setValue("visibility", "PUBLIC")}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border text-left transition-all",
                  visibility === "PUBLIC"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-600"
                )}
              >
                <Globe size={18} className="shrink-0" />
                <div>
                  <div className="font-medium text-sm">Public</div>
                  <div className="text-xs text-gray-500">Anyone can discover and request to join</div>
                </div>
              </button>
              <button
                type="button"
                id="visibility-private"
                onClick={() => setValue("visibility", "PRIVATE")}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border text-left transition-all",
                  visibility === "PRIVATE"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                    : "border-gray-700 text-gray-400 hover:border-gray-600"
                )}
              >
                <Lock size={18} className="shrink-0" />
                <div>
                  <div className="font-medium text-sm">Private</div>
                  <div className="text-xs text-gray-500">Hidden from explore; invite-link only</div>
                </div>
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Domain / Tags
              <span className="text-gray-500 font-normal ml-2">
                (select up to 10)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {DOMAIN_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  id={`tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                    selectedTags.includes(tag)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            {errors.tags && (
              <p className="text-xs text-red-400">{errors.tags.message}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isSubmitting}
              className="flex-1"
              id="create-project-submit"
            >
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
