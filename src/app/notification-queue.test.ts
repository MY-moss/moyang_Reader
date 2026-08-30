import { describe, expect, it } from "vitest";

import {
  appendNotification,
  removeNotification,
  visibleNotifications,
  type AppNotification,
} from "./notification-queue";

const notifications: AppNotification[] = [
  { id: 1, level: "success", message: "第一条" },
  { id: 2, level: "info", message: "第二条" },
  { id: 3, level: "success", message: "第三条" },
  { id: 4, level: "success", message: "第四条" },
];

describe("notification queue", () => {
  it("keeps notifications in FIFO order and shows at most three", () => {
    expect(visibleNotifications(notifications).map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(visibleNotifications(notifications, 1).map(({ id }) => id)).toEqual([1, 2]);
    expect(appendNotification(notifications.slice(0, 1), notifications[1])).toEqual(notifications.slice(0, 2));
  });

  it("removes only the dismissed notification", () => {
    expect(removeNotification(notifications, 2)).toEqual([notifications[0], notifications[2], notifications[3]]);
  });
});
