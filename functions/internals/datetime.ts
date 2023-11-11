import { Label } from "./constants.ts";
import { i18n } from "./i18n.ts";

export function clockEmoji(time: string): string {
  let h = Number.parseInt(time.substring(0, 2));
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `:clock${h}:`;
}

export function timeToNumber(time: string): number {
  return Number.parseInt(time.replace(":", ""));
}

export function todayForDatepicker(offset: number): string {
  const d = new Date();
  d.setTime(d.getTime() + offset * 1000);
  return d.getFullYear() + "-" +
    String(d.getUTCMonth() + 1) + "-" +
    String(d.getUTCDate());
}

export function toDateFormat(
  offset: number,
  yyyymmdd: string | undefined,
): string {
  const date = yyyymmdd?.substring(0, 4) +
    "-" + yyyymmdd?.substring(4, 6) +
    "-" + yyyymmdd?.substring(6, 8);
  const d = yyyymmdd ? new Date(date) : new Date();
  d.setTime(d.getTime() + offset * 1000);
  const year = d.getFullYear();
  const month = ("0" + String(d.getUTCMonth() + 1)).slice(-2);
  const day = ("0" + String(d.getUTCDate())).slice(-2);
  return `${year}/${month}/${day}`;
}

export function todayYYYYMMDD(timeOffset: number): string {
  return toDateFormat(timeOffset, undefined).replaceAll("/", "");
}

export function nowHHMM(timeOffset: number): string {
  const d = new Date();
  d.setTime(d.getTime() + timeOffset * 1000);
  const hh = ("0" + String(d.getUTCHours())).slice(-2);
  const mm = ("0" + String(d.getUTCMinutes())).slice(-2);
  return `${hh}:${mm}`;
}

export function dayDuration(days: number, language: string): string {
  if (days >= 1) {
    const unit = i18n(days >= 2 ? Label.days : Label.day, language);
    return Math.floor(days) + " " + unit;
  }
  return "";
}

export function timeDuration(
  hours: number,
  minutes: number,
  language: string,
  returnZero: true | false = false,
): string {
  const h = hourDuration(hours, language);
  let zeroMinuteAllowed = returnZero;
  if (zeroMinuteAllowed) {
    zeroMinuteAllowed = hours === undefined || hours === 0;
  }
  const m = minuteDuration(minutes, language, zeroMinuteAllowed);
  return [h, m].filter((e) => e.length > 0).join(" ");
}

export function hourDuration(hours: number, language: string): string {
  if (hours >= 1) {
    const unit = i18n(hours >= 2 ? Label.hours : Label.hour, language);
    return Math.floor(hours) + " " + unit;
  }
  return "";
}

export function minuteDuration(
  minutes: number,
  language: string,
  returnZero: true | false = false,
): string {
  const m = Math.floor(minutes) % 60;
  if (returnZero || m !== 0) {
    const unit = i18n(m >= 2 ? Label.minutes : Label.minute, language);
    return m + " " + unit;
  }
  return "";
}
