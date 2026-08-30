export type NotificationLevel = "info" | "success" | "error" | "action";

export type AppNotification = {
  id: number;
  level: NotificationLevel;
  message: string;
};

export const MAX_VISIBLE_NOTIFICATIONS = 3;

export function appendNotification(
  queue: readonly AppNotification[],
  notification: AppNotification,
): AppNotification[] {
  return [...queue, notification];
}

export function removeNotification(queue: readonly AppNotification[], id: number): AppNotification[] {
  return queue.filter((notification) => notification.id !== id);
}

export function visibleNotifications(queue: readonly AppNotification[], reservedSlots = 0): AppNotification[] {
  return queue.slice(0, Math.max(0, MAX_VISIBLE_NOTIFICATIONS - reservedSlots));
}
