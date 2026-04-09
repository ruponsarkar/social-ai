import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import { env } from "../config/env.js";

dayjs.extend(utc);
dayjs.extend(timezone);

export const getCurrentAppTime = () => dayjs().tz(env.APP_TIMEZONE);
export const formatAppDateTime = (value?: string | Date) =>
  (value ? dayjs(value) : getCurrentAppTime()).tz(env.APP_TIMEZONE).format("YYYY-MM-DD HH:mm:ss");

export const computeNextRunAt = (scheduledAt: string, everyOtherDay: boolean) => {
  const base = dayjs.tz(scheduledAt, env.APP_TIMEZONE);
  return everyOtherDay ? base.add(2, "day").format("YYYY-MM-DD HH:mm:ss") : base.format("YYYY-MM-DD HH:mm:ss");
};
