import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import appCss from "../styles.css?url";

const APP_NAME = "Roomies";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { title: "Roomies" },
      { name: "description", content: "Share a cozy room with strangers for 7 days. Chat, play music, and leave notes." },
      { name: "theme-color", content: "#0e0d0b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Roomies" },
      { property: "og:title", content: "Roomies" },
      { property: "og:description", content: "Share a cozy room with strangers for 7 days. Chat, play music, and leave notes." },
      { property: "og:image", content: "/og.jpg" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Roomies" },
      { name: "twitter:description", content: "Share a cozy room with strangers for 7 days. Chat, play music, and leave notes." },
      { name: "twitter:image", content: "/og.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
          <PWAInstallPrompt />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
