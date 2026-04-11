import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { env } from "../config/env.js";
import type { RepeatInterval } from "../types/index.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const getCurrentAppTime = () => dayjs().tz(env.APP_TIMEZONE);
export const formatAppDateTime = (value?: string | Date) =>
  (value ? dayjs(value) : getCurrentAppTime()).tz(env.APP_TIMEZONE).format("YYYY-MM-DD HH:mm:ss");

export const normalizeRepeatInterval = (
  repeatInterval?: RepeatInterval | null,
  publishEveryOtherDay?: boolean | number | null
): RepeatInterval => {
  if (repeatInterval && repeatInterval !== "none") {
    return repeatInterval;
  }

  return publishEveryOtherDay ? "every_other_day" : "none";
};

export const computeNextRunAt = (
  scheduledAt: string,
  repeatInterval?: RepeatInterval | null,
  publishEveryOtherDay?: boolean | number | null
) => {
  const normalizedInterval = normalizeRepeatInterval(repeatInterval, publishEveryOtherDay);
  const base = dayjs.tz(scheduledAt, env.APP_TIMEZONE);

  switch (normalizedInterval) {
    case "every_3_hours":
      return base.add(3, "hour").format("YYYY-MM-DD HH:mm:ss");
    case "every_day":
      return base.add(1, "day").format("YYYY-MM-DD HH:mm:ss");
    case "every_other_day":
      return base.add(2, "day").format("YYYY-MM-DD HH:mm:ss");
    default:
      return null;
  }
};
