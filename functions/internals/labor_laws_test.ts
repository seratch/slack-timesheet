import { assertEquals } from "std/assert/assert_equals.ts";
import { i18n } from "./i18n.ts";
import { CountryCode, Label, LanguageCode } from "./constants.ts";
import { LaborLawComplianceValidator } from "./labor_laws.ts";
import { DailyReport } from "./reports.ts";

Deno.test("LaborLawComplianceValidator: Japan", () => {
  const validator = new LaborLawComplianceValidator(CountryCode.Japan);
  const report: DailyReport = {
    date: "2023-11-01",
    work_hours: 0,
    overtime_work_hours: undefined,
    night_shift_work_hours: undefined,
    break_time_hours: 0,
    time_off_hours: 0,
    work_minutes: 0,
    overtime_work_minutes: undefined,
    night_shift_work_minutes: undefined,
    break_time_minutes: 0,
    time_off_minutes: 0,
    entries: [],
    projects: undefined,
  };
  const language = LanguageCode.Japanese;

  report.work_minutes = 6 * 60;
  report.break_time_minutes = 0;
  assertEquals(
    validator.validateDailyReport({ report, language }),
    [],
  );
  report.work_minutes = 6 * 60 + 1;
  report.break_time_minutes = 0;
  assertEquals(
    validator.validateDailyReport({ report, language }),
    [i18n(Label.LaborLawOfJapan_BreakTimeFor6WorkHours, language)],
  );
  report.work_minutes = 8 * 60;
  report.break_time_minutes = 0;
  assertEquals(
    validator.validateDailyReport({ report, language }),
    [i18n(Label.LaborLawOfJapan_BreakTimeFor6WorkHours, language)],
  );
  report.work_minutes = 8 * 60 + 1;
  report.break_time_minutes = 0;
  assertEquals(
    validator.validateDailyReport({ report, language }),
    [i18n(Label.LaborLawOfJapan_BreakTimeFor8WorkHours, language)],
  );
});
