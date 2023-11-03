import { SavedAttributes } from "deno-slack-data-mapper/mod.ts";
import { i18n } from "./i18n.ts";
import {
  dayDuration,
  hourDuration,
  minuteDuration,
  nowHHMM,
  timeToNumber,
  toDateFormat,
  todayYYYYMMDD,
} from "./datetime.ts";
import { L, PH, TE } from "./datastore.ts";
import { CountryCode, Emoji, EntryType, Label } from "./constants.ts";
import { deserializeEntry } from "./entries.ts";

export interface ReportTimeEntry {
  type: string;
  type_label: string;
  type_emoji: string;
  start: string;
  end: string;
  minutes: number;
  project_code: string | undefined; // time entry
  what_to_do: string | undefined; // lifelog
}

export interface ProjectWork {
  project_code: string;
  work_hours: number;
  work_minutes: number;
}

export interface Lifelog {
  what_to_do: string;
  spent_hours: number;
  spent_minutes: number;
}

export interface DailyReport {
  date: string;
  work_hours: number;
  overtime_work_hours: number | undefined;
  night_shift_work_hours: number | undefined;
  break_time_hours: number;
  time_off_hours: number;
  work_minutes: number;
  overtime_work_minutes: number | undefined;
  night_shift_work_minutes: number | undefined;
  break_time_minutes: number;
  time_off_minutes: number;
  entries: ReportTimeEntry[];
  projects: ProjectWork[] | undefined;
  lifelogs: Lifelog[] | undefined;
}

export interface AdminMonthlyReport {
  month: string;
  reports: MonthlyReport[];
  generated_at: string;
}

export interface MonthlyReport {
  month: string;
  user_id: string;
  user_email: string;
  holidays: number;
  num_of_working_days: number;
  entry_hours: number;
  work_hours: number;
  overtime_work_hours: number | undefined;
  night_shift_work_hours: number | undefined;
  break_time_hours: number;
  time_off_hours: number;
  entry_minutes: number;
  work_minutes: number;
  overtime_work_minutes: number | undefined;
  night_shift_work_minutes: number | undefined;
  break_time_minutes: number;
  time_off_minutes: number;
  daily_reports: DailyReport[];
  projects: ProjectWork[] | undefined;
  lifelogs: Lifelog[] | undefined;
}

interface generateReportArgs {
  user: string;
  email: string;
  month: string;
  entries: SavedAttributes<TE>[];
  lifelogs: SavedAttributes<L>[];
  offset: number;
  language: string;
  country: string | undefined;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
}
export async function generateReport({
  user,
  email,
  month,
  entries,
  lifelogs,
  offset,
  language,
  country,
  holidays,
}: generateReportArgs): Promise<MonthlyReport> {
  const yyyymm = month.replace("/", "");
  const days = (await holidays())?.holidays || [];
  const numOfHolidays = days.filter((h) => h.startsWith(yyyymm)).length || 0;
  const report: MonthlyReport = {
    month,
    user_id: user,
    user_email: email,
    num_of_working_days: 0,
    holidays: numOfHolidays,
    entry_hours: 0,
    work_hours: 0,
    overtime_work_hours: undefined,
    night_shift_work_hours: undefined,
    break_time_hours: 0,
    time_off_hours: 0,
    entry_minutes: 0,
    work_minutes: 0,
    overtime_work_minutes: undefined,
    night_shift_work_minutes: undefined,
    break_time_minutes: 0,
    time_off_minutes: 0,
    daily_reports: [],
    projects: undefined,
    lifelogs: undefined,
  };
  for (const entry of entries) {
    const lifelog = lifelogs.find((l) =>
      l.user_and_date === entry.user_and_date
    );
    const dailyReport = generateDailyReport({
      entry,
      lifelog,
      offset,
      country,
      language,
    });
    if (dailyReport) {
      if (dailyReport.work_minutes > 0) {
        report.num_of_working_days += 1;
      }
      report.daily_reports.push(dailyReport);
      report.work_minutes += dailyReport.work_minutes;
      if (dailyReport.overtime_work_minutes) {
        if (report.overtime_work_minutes === undefined) {
          report.overtime_work_minutes = 0;
        }
        report.overtime_work_minutes += dailyReport.overtime_work_minutes;
      }
      if (dailyReport.night_shift_work_minutes) {
        if (report.night_shift_work_minutes === undefined) {
          report.night_shift_work_minutes = 0;
        }
        report.night_shift_work_minutes += dailyReport.night_shift_work_minutes;
      }
      report.break_time_minutes += dailyReport.break_time_minutes;
      report.time_off_minutes += dailyReport.time_off_minutes;
      report.entry_minutes = report.work_minutes +
        report.break_time_minutes +
        report.time_off_minutes;
      if (dailyReport.projects) {
        if (!report.projects) report.projects = [];
        for (const d of dailyReport.projects) {
          if (report.projects) {
            let found = false;
            for (const m of report.projects) {
              if (m.project_code === d.project_code) {
                m.work_minutes = (m.work_minutes || 0) + d.work_minutes;
                found = true;
                break;
              }
            }
            if (!found) report.projects.push(d);
          }
        }
      }
      if (dailyReport.lifelogs) {
        if (!report.lifelogs) report.lifelogs = [];
        for (const d of dailyReport.lifelogs) {
          if (report.lifelogs) {
            let found = false;
            for (const m of report.lifelogs) {
              if (m.what_to_do === d.what_to_do) {
                m.spent_minutes = (m.spent_minutes || 0) + d.spent_minutes;
                found = true;
                break;
              }
            }
            if (!found) report.lifelogs.push(d);
          }
        }
      }
    }
  }
  report.work_hours = Math.floor(report.work_minutes / 6) / 10;
  if (report.overtime_work_minutes) {
    report.overtime_work_hours = Math.floor(
      report.overtime_work_minutes / 6,
    ) / 10;
  }
  if (report.night_shift_work_minutes) {
    report.night_shift_work_hours = Math.floor(
      report.night_shift_work_minutes / 6,
    ) / 10;
  }
  report.work_hours = Math.floor(report.work_minutes / 6) / 10;
  report.break_time_hours = Math.floor(report.break_time_minutes / 6) / 10;
  report.time_off_hours = Math.floor(report.time_off_minutes / 6) / 10;
  report.entry_hours = (
    Math.floor(report.work_minutes / 6) +
    Math.floor(report.break_time_minutes / 6) +
    Math.floor(report.time_off_minutes / 6)
  ) / 10;
  if (report.projects) {
    for (const p of report.projects) {
      p.work_hours = Math.floor(p.work_minutes / 6) / 10;
    }
    report.projects.sort((a, b) => a.work_minutes > b.work_minutes ? -1 : 1);
  }
  if (report.lifelogs) {
    for (const log of report.lifelogs) {
      log.spent_hours = Math.floor(log.spent_minutes / 6) / 10;
    }
    report.lifelogs.sort((a, b) => a.spent_minutes > b.spent_minutes ? -1 : 1);
  }
  return report;
}

function calculateDuratinMinutes(start: string, end: string): number {
  if (start === "" || end === undefined || end === "") {
    return 0;
  }
  const startHHMM = start.split(":");
  const s = new Date("2023-01-01T00:00:00.000Z");
  s.setUTCHours(Number.parseInt(startHHMM[0]));
  s.setUTCMinutes(Number.parseInt(startHHMM[1]));

  const endHHMM = end.split(":");
  const e = new Date("2023-01-01T00:00:00.000Z");
  e.setUTCHours(Number.parseInt(endHHMM[0]));
  e.setUTCMinutes(Number.parseInt(endHHMM[1]));

  const minutes = (e.getTime() - s.getTime()) / 1000 / 60;
  return minutes;
}

interface generateDailyReportArgs {
  entry: SavedAttributes<TE>;
  lifelog: SavedAttributes<L> | undefined;
  offset: number;
  country: string | undefined;
  language: string;
}
export function generateDailyReport({
  entry,
  lifelog,
  offset,
  country,
  language,
}: generateDailyReportArgs): DailyReport | undefined {
  if (!entry.user_and_date && !lifelog?.user_and_date) {
    return undefined;
  }
  const id = entry.user_and_date;
  const isToday = id && id.endsWith(todayYYYYMMDD(offset));

  const workType = i18n(Label.Work, language);
  const breakTimeType = i18n(Label.BreakTime, language);
  const timeOffType = i18n(Label.TimeOff, language);
  const lifelogType = i18n(Label.Lifelog, language);
  const rawEntries: ReportTimeEntry[] = (
    (entry.work_entries || []).map((e) => {
      const entry = deserializeEntry(e);
      if (!entry) {
        throw new Error(
          `Unexpected entry detected (entry: ${e}, item: ${entry}`,
        );
      }
      if (entry.end === "") {
        // For real-time updates on the main view
        if (isToday) entry.end = nowHHMM(offset);
      }
      return {
        start: entry.start,
        end: entry.end,
        type: EntryType.Work,
        type_label: workType,
        type_emoji: Emoji.Work,
        minutes: calculateDuratinMinutes(entry.start, entry.end),
        project_code: entry.project_code,
        what_to_do: undefined,
      };
    })
  ).concat(
    (entry.break_time_entries || []).map((e) => {
      const entry = deserializeEntry(e);
      if (!entry) {
        throw new Error(
          `Unexpected entry detected (entry: ${e}, item: ${entry}`,
        );
      }
      if (entry.end === "") {
        // For real-time updates on the main view
        if (isToday) entry.end = nowHHMM(offset);
      }
      return {
        start: entry.start,
        end: entry.end,
        type: EntryType.BreakTime,
        type_label: breakTimeType,
        type_emoji: Emoji.BreakTime,
        minutes: calculateDuratinMinutes(entry.start, entry.end),
        project_code: entry.project_code,
        what_to_do: undefined,
      };
    }),
  ).concat(
    (entry.time_off_entries || []).map((e) => {
      const entry = deserializeEntry(e);
      if (!entry) {
        throw new Error(
          `Unexpected entry detected (entry: ${e}, item: ${entry}`,
        );
      }
      if (entry.end === "") {
        // For real-time updates on the main view
        if (isToday) entry.end = nowHHMM(offset);
      }
      return {
        start: entry.start,
        end: entry.end,
        type: EntryType.TimeOff,
        type_label: timeOffType,
        type_emoji: Emoji.TimeOff,
        minutes: calculateDuratinMinutes(entry.start, entry.end),
        project_code: entry.project_code,
        what_to_do: undefined,
      };
    }),
  );
  rawEntries.sort((a, b) =>
    timeToNumber(a.start) > timeToNumber(b.start) ? 1 : -1
  );

  const entries: ReportTimeEntry[] = [];
  let ongoingWorkEnd: string | undefined = undefined;
  let ongoingWork: ReportTimeEntry | undefined = undefined;
  for (let i = 0; i < rawEntries.length; i++) {
    const e = rawEntries[i];
    if (ongoingWorkEnd === undefined) {
      entries.push(e);
      if (e.type === EntryType.Work) {
        ongoingWork = e;
        ongoingWorkEnd = ongoingWork.end;
      }
    } else {
      if (ongoingWork) {
        if (
          e.type !== EntryType.Work &&
          timeToNumber(ongoingWorkEnd) > timeToNumber(e.start)
        ) {
          ongoingWork.end = e.start;
          ongoingWork.minutes = calculateDuratinMinutes(
            ongoingWork.start,
            ongoingWork.end,
          );
          entries.push(e); // break_time / time_off
          if (ongoingWorkEnd !== undefined && e.end !== ongoingWorkEnd) {
            const [start, end] = [e.end, ongoingWorkEnd];
            ongoingWork = {
              start,
              end,
              type: EntryType.Work,
              type_label: workType,
              type_emoji: Emoji.Work,
              minutes: calculateDuratinMinutes(start, end),
              project_code: ongoingWork.project_code,
              what_to_do: undefined,
            };
            entries.push(ongoingWork);
          }
        } else if (e.type === EntryType.Work) {
          ongoingWork = e;
          ongoingWorkEnd = ongoingWork.end;
          entries.push(e);
        } else {
          ongoingWork = undefined;
          ongoingWorkEnd = undefined;
          entries.push(e); // break_time / time_off
        }
      }
    }
  }

  if (lifelog) {
    for (const l of lifelog.logs || []) {
      const entry = deserializeEntry(l);
      if (!entry) {
        throw new Error(
          `Unexpected entry detected (entry: ${l}, item: ${entry}`,
        );
      }
      if (entry.end === "") {
        // For real-time updates on the main view
        if (isToday) entry.end = nowHHMM(offset);
      }
      entries.push({
        start: entry.start,
        end: entry.end,
        type: EntryType.Lifelog,
        type_label: lifelogType,
        type_emoji: Emoji.Lifelog,
        minutes: calculateDuratinMinutes(entry.start, entry.end),
        project_code: undefined,
        what_to_do: entry.what_to_do,
      });
    }
  }
  entries.sort((a, b) =>
    timeToNumber(a.start) > timeToNumber(b.start) ? 1 : -1
  );

  const projectMinutes: Record<string, number> = {};
  for (const e of entries) {
    if (e.type === EntryType.Work && e.project_code) {
      const current = projectMinutes[e.project_code] || 0;
      projectMinutes[e.project_code] = current + e.minutes;
    }
  }
  const lifelogMinutes: Record<string, number> = {};
  for (const e of entries) {
    if (e.type === EntryType.Lifelog && e.what_to_do) {
      const current = lifelogMinutes[e.what_to_do] || 0;
      lifelogMinutes[e.what_to_do] = current + e.minutes;
    }
  }

  let overtimeWorkMinutes: number | undefined = undefined;
  let nightShiftWorkMinutes: number | undefined = undefined;
  let workMinutes = 0;
  let breakTimeMinutes = 0;
  let timeOffMinutes = 0;
  for (const e of entries) {
    if (e.end !== undefined && e.end !== "") {
      const minutes = calculateDuratinMinutes(e.start, e.end);
      if (e.type === EntryType.Work) {
        workMinutes += minutes;
        if (country === CountryCode.Japan) {
          if (timeToNumber(e.end) > 2200) {
            if (nightShiftWorkMinutes === undefined) nightShiftWorkMinutes = 0;
            nightShiftWorkMinutes += calculateDuratinMinutes("22:00", e.end);
          }
          if (timeToNumber(e.start) < 500) {
            if (nightShiftWorkMinutes === undefined) nightShiftWorkMinutes = 0;
            const now = nowHHMM(offset);
            let end = timeToNumber(now) < timeToNumber("05:00") ? now : "05:00";
            if (timeToNumber(e.end) <= timeToNumber(end)) end = e.end;
            nightShiftWorkMinutes += calculateDuratinMinutes(e.start, end);
          }
        }
      } else if (e.type === EntryType.BreakTime) {
        breakTimeMinutes += minutes;
      } else if (e.type === EntryType.TimeOff) {
        timeOffMinutes += minutes;
      }
    }
  }
  if (workMinutes > 8 * 60) {
    if (overtimeWorkMinutes === undefined) overtimeWorkMinutes = 0;
    overtimeWorkMinutes += workMinutes - 8 * 60;
  }
  const yyyymmdd =
    (entry.user_and_date || lifelog!.user_and_date!).split("-")[1];
  const date = toDateFormat(offset, yyyymmdd);

  let projects: ProjectWork[] | undefined = undefined;
  if (projectMinutes && Object.keys(projectMinutes).length > 0) {
    projects = [];
    for (const [project_code, work_minutes] of Object.entries(projectMinutes)) {
      projects.push({
        project_code,
        work_minutes,
        work_hours: Math.floor(work_minutes / 6) / 10,
      });
    }
    projects.sort((a, b) => a.work_minutes > b.work_minutes ? -1 : 1);
  }

  let lifelogs: Lifelog[] | undefined = undefined;
  if (lifelogMinutes && Object.keys(lifelogMinutes).length > 0) {
    lifelogs = [];
    for (const [what_to_do, spent_minutes] of Object.entries(lifelogMinutes)) {
      lifelogs.push({
        what_to_do,
        spent_minutes,
        spent_hours: Math.floor(spent_minutes / 6) / 10,
      });
    }
    lifelogs.sort((a, b) => a.spent_minutes > b.spent_minutes ? -1 : 1);
  }

  return {
    date,
    work_minutes: workMinutes,
    overtime_work_minutes: overtimeWorkMinutes,
    night_shift_work_minutes: nightShiftWorkMinutes,
    break_time_minutes: breakTimeMinutes,
    time_off_minutes: timeOffMinutes,
    work_hours: Math.floor(workMinutes / 6) / 10,
    overtime_work_hours: overtimeWorkMinutes !== undefined
      ? Math.floor(overtimeWorkMinutes / 6) / 10
      : undefined,
    night_shift_work_hours: nightShiftWorkMinutes !== undefined
      ? Math.floor(nightShiftWorkMinutes / 6) / 10
      : undefined,
    break_time_hours: Math.floor(breakTimeMinutes / 6) / 10,
    time_off_hours: Math.floor(timeOffMinutes / 6) / 10,
    entries,
    projects,
    lifelogs,
  };
}

import {
  AnyMessageBlock,
  AnyModalBlock,
  MrkdwnTextField,
  SlackAPIClient,
} from "slack-web-api-client/mod.ts";
import { LaborLawComplianceValidator } from "./labor_laws.ts";

interface shareReportJSONFileArgs {
  report: MonthlyReport;
  user: string;
  country: string | undefined;
  language: string;
  yyyymmdd: string;
  slackApi: SlackAPIClient;
}
export async function shareReportJSONFile({
  report,
  country,
  language,
  user,
  yyyymmdd,
  slackApi,
}: shareReportJSONFileArgs) {
  const json: string = JSON.stringify(report, null, 2);
  const jsonBytes: Uint8Array = new TextEncoder().encode(json);
  const blocks: AnyMessageBlock[] = toReportResultBlocks(
    report,
    [],
    country,
    language,
  ) as AnyMessageBlock[];
  const filename = `${user}-${yyyymmdd.substring(0, 6)}.json`;
  const uploadUrl = await slackApi.files.getUploadURLExternal({
    filename,
    length: jsonBytes.length,
    snippet_type: "json",
  });
  const { upload_url, file_id } = uploadUrl;
  const upload = await fetch(upload_url!, {
    method: "POST",
    body: jsonBytes,
  });
  if (upload.status !== 200) {
    const error = `Failed to upload a JSON file (response: ${upload})`;
    console.log(error);
    return { error };
  }
  const completion = await slackApi.files.completeUploadExternal({
    files: [{ "id": file_id!, "title": filename }],
  });
  const fileUrl = completion.files![0].permalink;
  await slackApi.chat.postMessage({
    channel: user,
    text: `Here is the monthly report's JSON file: ${fileUrl}`,
    blocks,
  });
}

export function toReportResultBlocks(
  report: MonthlyReport,
  blocks: (AnyMessageBlock | AnyModalBlock)[],
  country: string | undefined,
  language: string,
): (AnyMessageBlock | AnyModalBlock)[] {
  const wDuration = [
    hourDuration(report.work_hours, language),
    minuteDuration(report.work_minutes, language),
  ].filter((e) => e).join(" ");
  const owDuration =
    (report.overtime_work_hours && report.overtime_work_minutes
      ? [
        hourDuration(report.overtime_work_hours, language),
        minuteDuration(report.overtime_work_minutes, language),
      ].filter((e) => e)
      : []).join(" ");
  const nswDuration =
    (report.night_shift_work_hours && report.night_shift_work_minutes
      ? [
        hourDuration(report.night_shift_work_hours, language),
        minuteDuration(report.night_shift_work_minutes, language),
      ].filter((e) => e)
      : []).join(" ");
  const btDuration = [
    hourDuration(report.break_time_hours, language),
    minuteDuration(report.break_time_minutes, language),
  ].filter((e) => e).join(" ");
  const toDuration = [
    hourDuration(report.time_off_hours, language),
    minuteDuration(report.time_off_minutes, language),
  ].filter((e) => e).join(" ");

  const summary = [];
  summary.push(
    Emoji.Work + " " + i18n(Label.NumOfWorkingDays, language) + ": " +
      dayDuration(report.num_of_working_days, language),
  );
  if (wDuration) {
    summary.push(
      Emoji.Work + " " + i18n(Label.Work, language) + ": " + wDuration,
    );
  }
  if (owDuration) {
    summary.push(
      Emoji.Work + " " + i18n(Label.OvertimeWork, language) + ": " + owDuration,
    );
  }
  if (nswDuration) {
    summary.push(
      Emoji.Work + " " + i18n(Label.NightShiftWork, language) + ": " +
        nswDuration,
    );
  }
  if (btDuration) {
    summary.push(
      Emoji.BreakTime + " " + i18n(Label.BreakTime, language) + ": " +
        btDuration,
    );
  }
  if (toDuration) {
    summary.push(
      Emoji.TimeOff + " " + i18n(Label.TimeOff, language) + ": " + toDuration,
    );
  }
  if (report.holidays > 0) {
    const holidayInfo = Emoji.Holiday + " " + i18n(Label.Holiday, language) +
      ": " + dayDuration(report.holidays, language);
    summary.push(holidayInfo);
  }
  if (report.projects && report.projects.length > 0) {
    summary.push("");
    summary.push("*" + i18n(Label.ProjectSummary, language) + "*");
    for (const p of report.projects) {
      summary.push(
        "*" + p.project_code + "*: " +
          hourDuration(p.work_hours, language) + " " +
          minuteDuration(p.work_minutes, language),
      );
    }
  }
  if (report.lifelogs && report.lifelogs.length > 0) {
    summary.push("");
    summary.push(
      "*" + Emoji.Lifelog + " " + i18n(Label.LifelogSummary, language) + "*",
    );
    for (const p of report.lifelogs) {
      summary.push(
        "*" + p.what_to_do + "*: " +
          hourDuration(p.spent_hours, language) + " " +
          minuteDuration(p.spent_minutes, language),
      );
    }
  }
  let warnings: string[] = [];
  if (report && country) {
    const validator = new LaborLawComplianceValidator(country);
    warnings = validator.validateMonthlyReport({ report, language });
  }
  if (warnings && warnings.length > 0) {
    const elements: MrkdwnTextField[] = warnings.map((w) => {
      return { "type": "mrkdwn", "text": Emoji.Warning + " " + w };
    });
    summary.push({ "type": "context", "elements": elements });
  }

  blocks.push({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": `*${report.month} ${
        i18n(Label.MonthlyReport, language)
      } <@${report.user_id}>*

${summary.join("\n")}
`,
    },
  });
  for (const daily of report.daily_reports) {
    const entries = daily.entries
      .map((e) => {
        let label = e.type_label;
        if (e.type == EntryType.Work && e.project_code) {
          label = e.type_label + " [" + e.project_code + "]";
        } else if (e.type === EntryType.Lifelog && e.what_to_do) {
          label = e.what_to_do;
        }
        return `${e.type_emoji} ${label}: ${e.start} - ${e.end}`;
      })
      .join("\n");
    blocks.push({
      "type": "section",
      "text": { "type": "mrkdwn", "text": `*${daily.date}*\n${entries}` },
    });
  }
  return blocks;
}

interface shareAdminReportJSONFileArgs {
  report: AdminMonthlyReport;
  adminUserId: string;
  language: string;
  yyyymmdd: string;
  slackApi: SlackAPIClient;
}
export async function shareAdminReportJSONFile({
  report,
  language,
  adminUserId,
  yyyymmdd,
  slackApi,
}: shareAdminReportJSONFileArgs) {
  const json: string = JSON.stringify(report);
  const jsonBytes: Uint8Array = new TextEncoder().encode(json);
  const filename = `all-members-${yyyymmdd.substring(0, 6)}.json`;
  const uploadUrl = await slackApi.files.getUploadURLExternal({
    filename,
    length: jsonBytes.length,
    snippet_type: "json",
  });
  const { upload_url, file_id } = uploadUrl;
  const upload = await fetch(upload_url!, {
    method: "POST",
    body: jsonBytes,
  });
  if (upload.status !== 200) {
    const error = `Failed to upload a JSON file (response: ${upload})`;
    console.log(error);
    return { error };
  }
  const completion = await slackApi.files.completeUploadExternal({
    files: [{ "id": file_id!, "title": filename }],
  });
  const fileUrl = completion.files![0].permalink;
  const message = i18n(Label.HereIsTheReportYouRequested, language);
  await slackApi.chat.postMessage({
    channel: adminUserId,
    text: `:wave: ${message} ${fileUrl}`,
  });
}
