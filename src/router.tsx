import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: () => (
      <div className="grid min-h-dvh place-items-center p-6" style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}>
        <div className="text-center space-y-3">
          <h1 className="text-xl font-semibold">Page Not Found</h1>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>The page you are looking for does not exist.</p>
          <a href="/" className="inline-block text-sm font-medium hover:underline" style={{ color: "var(--color-primary)" }}>
            Go back home
          </a>
        </div>
      </div>
    ),
  });
}
