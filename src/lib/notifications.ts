export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

export function sendBackgroundNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || !document.hidden) return;

  try {
    new Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: "roomies-activity",
    });
  } catch {
    // ignore
  }
}
