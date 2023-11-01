import { CountryCode, Label } from "./constants.ts";
import { i18n } from "./i18n.ts";
import { DailyReport, MonthlyReport } from "./reports.ts";

interface DailyReportValidationArgs {
  report: DailyReport;
  language: string;
}
interface MonthReportValidationArgs {
  report: MonthlyReport;
  language: string;
}
export class LaborLawComplianceValidator {
  #country: string;
  constructor(country: string) {
    this.#country = country;
  }

  validateDailyReport(
    { report, language }: DailyReportValidationArgs,
  ): string[] {
    const warnings: string[] = [];
    if (this.#country === CountryCode.Japan) {
      if (report.work_minutes > 8 * 60 && report.break_time_minutes < 60) {
        warnings.push(
          i18n(Label.LaborLawOfJapan_BreakTimeFor8WorkHours, language),
        );
      } else if (
        report.work_minutes > 6 * 60 && report.break_time_minutes < 45
      ) {
        warnings.push(
          i18n(Label.LaborLawOfJapan_BreakTimeFor6WorkHours, language),
        );
      }
    }
    return warnings;
  }

  validateMonthlyReport(
    {}: MonthReportValidationArgs,
  ): string[] {
    const warnings: string[] = [];
    return warnings;
  }
}
