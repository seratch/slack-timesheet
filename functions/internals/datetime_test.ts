import { assertEquals } from "std/assert/assert_equals.ts";
import {
  clockEmoji,
  dayDuration,
  hourDuration,
  minuteDuration,
  timeToNumber,
  toDateFormat,
} from "./datetime.ts";

Deno.test("timeToNumber", () => {
  assertEquals(timeToNumber("00:01"), 1);
  assertEquals(timeToNumber("01:02"), 102);
  assertEquals(timeToNumber("12:34"), 1234);
  assertEquals(timeToNumber("23:45"), 2345);
});

Deno.test("clockEmoji", () => {
  assertEquals(clockEmoji("00:01"), ":clock12:");
  assertEquals(clockEmoji("01:02"), ":clock1:");
  assertEquals(clockEmoji("04:55"), ":clock4:");
  assertEquals(clockEmoji("12:34"), ":clock12:");
  assertEquals(clockEmoji("23:45"), ":clock11:");
});

Deno.test("toDateFormat", () => {
  const plusNineHours = 9 * 60 * 60;
  // Note that offset here can affect only when the second arg is undefined (= calculating today)
  assertEquals(toDateFormat(plusNineHours, "20231030"), "2023/10/30");
});

Deno.test("dayDuration", () => {
  assertEquals(dayDuration(1.4, "en"), "1 day");
  assertEquals(dayDuration(1.6, "en"), "1 day");
  assertEquals(dayDuration(2.1, "en"), "2 days");
  assertEquals(dayDuration(3, "en"), "3 days");

  assertEquals(dayDuration(1.4, "ja"), "1 日");
  assertEquals(dayDuration(1.6, "ja"), "1 日");
  assertEquals(dayDuration(2.1, "ja"), "2 日");
  assertEquals(dayDuration(3, "ja"), "3 日");
});

Deno.test("hourDuration", () => {
  assertEquals(hourDuration(1.4, "en"), "1 hour");
  assertEquals(hourDuration(1.6, "en"), "1 hour");
  assertEquals(hourDuration(2.1, "en"), "2 hours");
  assertEquals(hourDuration(3, "en"), "3 hours");
  assertEquals(hourDuration(24, "en"), "24 hours");
  assertEquals(hourDuration(25, "en"), "25 hours");

  assertEquals(hourDuration(1.4, "ja"), "1 時間");
  assertEquals(hourDuration(1.6, "ja"), "1 時間");
  assertEquals(hourDuration(2.1, "ja"), "2 時間");
  assertEquals(hourDuration(3, "ja"), "3 時間");
  assertEquals(hourDuration(24, "ja"), "24 時間");
  assertEquals(hourDuration(25, "ja"), "25 時間");
});

Deno.test("minuteDuration", () => {
  assertEquals(minuteDuration(1.4, "en"), "1 minute");
  assertEquals(minuteDuration(1.6, "en"), "1 minute");
  assertEquals(minuteDuration(2.1, "en"), "2 minutes");
  assertEquals(minuteDuration(3, "en"), "3 minutes");
  assertEquals(minuteDuration(60, "en"), "");
  assertEquals(minuteDuration(61, "en"), "1 minute");

  assertEquals(minuteDuration(1.4, "ja"), "1 分");
  assertEquals(minuteDuration(1.6, "ja"), "1 分");
  assertEquals(minuteDuration(2.1, "ja"), "2 分");
  assertEquals(minuteDuration(3, "ja"), "3 分");
  assertEquals(minuteDuration(60, "ja"), "");
  assertEquals(minuteDuration(61, "ja"), "1 分");
});
