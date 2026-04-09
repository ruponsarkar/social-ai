import dayjs from "dayjs";

export const computeNextRunAt = (scheduledAt: string, everyOtherDay: boolean) => {
  const base = dayjs(scheduledAt);
  return everyOtherDay ? base.add(2, "day").format("YYYY-MM-DD HH:mm:ss") : base.format("YYYY-MM-DD HH:mm:ss");
};

