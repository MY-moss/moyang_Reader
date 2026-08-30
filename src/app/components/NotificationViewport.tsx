import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { visibleNotifications, type AppNotification, type NotificationLevel } from "../notification-queue";

type NotificationViewportProps = {
  notifications: readonly AppNotification[];
  updateNotice: ReactNode | null;
  onDismiss: (id: number) => void;
};

function roleForLevel(level: NotificationLevel): "alert" | "status" {
  return level === "error" || level === "action" ? "alert" : "status";
}

export function NotificationViewport({ notifications, updateNotice, onDismiss }: NotificationViewportProps) {
  const timersRef = useRef(new Map<number, number>());
  const visibleMessages = useMemo(
    () => visibleNotifications(notifications, updateNotice ? 1 : 0),
    [notifications, updateNotice],
  );

  useEffect(() => {
    const visibleIds = new Set(visibleMessages.map((notification) => notification.id));
    for (const [id, timer] of timersRef.current) {
      if (visibleIds.has(id)) continue;
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }

    for (const notification of visibleMessages) {
      if (notification.level === "error" || notification.level === "action") continue;
      if (timersRef.current.has(notification.id)) continue;

      const timer = window.setTimeout(() => {
        timersRef.current.delete(notification.id);
        onDismiss(notification.id);
      }, 6_000);
      timersRef.current.set(notification.id, timer);
    }
  }, [onDismiss, visibleMessages]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) window.clearTimeout(timer);
      timersRef.current.clear();
    },
    [],
  );

  if (!updateNotice && visibleMessages.length === 0) return null;

  return (
    <div className="notification-viewport" data-testid="notification-viewport">
      {updateNotice}
      {visibleMessages.map((notification) => (
        <section
          key={notification.id}
          className={`app-notification app-notification-${notification.level}`}
          data-notification-level={notification.level}
          role={roleForLevel(notification.level)}
          aria-live={roleForLevel(notification.level) === "alert" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <span className="app-notification-message">{notification.message}</span>
          <button
            type="button"
            className="app-notification-dismiss"
            aria-label={`关闭通知：${notification.message}`}
            title="关闭通知"
            onClick={() => onDismiss(notification.id)}
          >
            ×
          </button>
        </section>
      ))}
    </div>
  );
}
