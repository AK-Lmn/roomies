import { useEffect } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert, RotateCw } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const isChunkError =
    error?.message?.includes("dynamically imported module") ||
    error?.message?.includes("Failed to load module script") ||
    error?.message?.includes("Loading chunk");

  useEffect(() => {
    if (isChunkError) {
      const hasReloaded = sessionStorage.getItem("chunk_reload");
      if (!hasReloaded) {
        sessionStorage.setItem("chunk_reload", "true");
        window.location.reload();
      }
    }
  }, [isChunkError]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center bg-neutral-950 text-neutral-50">
      <span className="text-amber-400 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
        <TriangleAlert className="size-8" />
      </span>
      <div className="space-y-1 max-w-md">
        <h1 className="text-lg font-semibold">
          {isChunkError ? "App updated" : "Something went wrong"}
        </h1>
        <p className="text-xs leading-relaxed text-neutral-400">
          {isChunkError
            ? "A new update for Roomies was deployed while your browser tab was open. Please reload to load the latest features."
            : error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem("chunk_reload");
          window.location.reload();
        }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 cursor-pointer transition-colors shadow-xs"
      >
        <RotateCw size={13} />
        <span>Reload Roomies</span>
      </button>
    </main>
  );
}
