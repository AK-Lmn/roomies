import React, { useEffect } from "react";
import { X, Download, ExternalLink } from "lucide-react";

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <a
          href={src}
          download="roomies-image.jpg"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 transition-colors"
          title="Open / Download"
        >
          <Download size={16} />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="max-w-4xl max-h-[85vh] p-2 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt || "Wall post image"}
          className="max-w-full max-h-[80vh] rounded-2xl object-contain shadow-2xl border border-neutral-800"
        />
      </div>
    </div>
  );
}
