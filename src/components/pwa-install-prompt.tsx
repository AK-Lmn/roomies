import React, { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as unknown as { standalone?: boolean }).standalone) {
      setIsStandalone(true);
      return;
    }

    const wasDismissed = localStorage.getItem("roomies_pwa_dismissed");
    if (wasDismissed) {
      const dismissTime = parseInt(wasDismissed, 10);
      if (Date.now() - dismissTime < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }
    setDismissed(false);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSSafari = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios/.test(userAgent);
    setIsIOS(isIOSSafari);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  if (isStandalone || dismissed || (!deferredPrompt && !isIOS)) {
    return null;
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("roomies_pwa_dismissed", Date.now().toString());
  }

  return (
    <aside
      aria-label="Install Roomies app"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-40 max-w-sm rounded-2xl p-3.5 border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-300"
      style={{
        background: "rgba(20, 19, 17, 0.92)",
        borderColor: "var(--color-border)",
        boxShadow: "0 16px 36px rgba(0, 0, 0, 0.6)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Smartphone size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">Install Roomies</div>
            <div className="text-[11px] opacity-70 truncate">
              {isIOS ? "Tap Share → Add to Home Screen" : "Add to home screen for full app mode"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isIOS && deferredPrompt && (
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:scale-105 shadow-xs inline-flex items-center gap-1"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-primary-fg)",
              }}
            >
              <Download size={13} />
              <span>Install</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 opacity-50 hover:opacity-100 text-neutral-400 hover:text-white rounded-lg transition-colors"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
