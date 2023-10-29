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
import { deserializeTimeEntry, PH, TE } from "./datastore.ts";
import { Emoji, EntryType, Label } from "./constants.ts";

export interface ReportTimeEntry {
  type: string;
  type_label: string;
  type_emoji: string;
  start: string;
  end: string;
  minutes: number;
  project_code: string | undefined;
}

export interface ProjectWork {
  project_code: string;
  work_hours: number;
  work_minutes: number;
}

export interface DailyReport {
  date: string;
  work_hours: number;
  break_time_hours: number;
  time_off_hours: number;
  work_minutes: number;
  break_time_minutes: number;
  time_off_minutes: number;
  entries: ReportTimeEntry[];
  projects: ProjectWork[] | undefined;
}

export interface MonthlyReport {
  month: string;
  user_id: string;
  holidays: number;
  entry_hours: number;
  work_hours: number;
  break_time_hours: number;
  time_off_hours: number;
  entry_minutes: number;
  work_minutes: number;
  break_time_minutes: number;
  time_off_minutes: number;
  daily_reports: DailyReport[];
  projects: ProjectWork[] | undefined;
}

interface generateReportArgs {
  userId: string;
  month: string;
  items: SavedAttributes<TE>[];
  offset: number;
  language: string;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
}
export async function generateReport({
  userId,
  month,
  items,
  offset,
  language,
  holidays,
}: generateReportArgs): Promise<MonthlyReport> {
  const yyyymm = month.replace("/", "");
  const days = (await holidays())?.holidays || [];
  const numOfHolidays = days.filter((h) => h.startsWith(yyyymm)).length || 0;
  const report: MonthlyReport = {
    month,
    user_id: userId,
    holidays: numOfHolidays,
    entry_hours: 0,
    work_hours: 0,
    break_time_hours: 0,
    time_off_hours: 0,
    entry_minutes: 0,
    work_minutes: 0,
    break_time_minutes: 0,
    time_off_minutes: 0,
    daily_reports: [],
    projects: undefined,
  };
  for (const item of items) {
    const dailyReport = generateDailyReport({
      item,
      offset,
      language,
    });
    if (dailyReport) {
      report.daily_reports.push(dailyReport);
      report.work_minutes += dailyReport.work_minutes;
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
    }
  }
  report.work_hours = Math.round(report.work_minutes / 6) / 10;
  report.break_time_hours = Math.round(report.break_time_minutes / 6) / 10;
  report.time_off_hours = Math.round(report.time_off_minutes / 6) / 10;
  report.entry_hours = (
    Math.round(report.work_minutes / 6) +
    Math.round(report.break_time_minutes / 6) +
    Math.round(report.time_off_minutes / 6)
  ) / 10;
  if (report.projects) {
    for (const p of report.projects) {
      p.work_hours = Math.round(p.work_minutes / 6) / 10;
    }
    report.projects.sort((a, b) => a.work_minutes > b.work_minutes ? -1 : 1);
  }
  return report;
}

function calculateDuratinMinutes(start: string, end: string): number {
  if (start === "" || end === "") {
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
  item: SavedAttributes<TE>;
  offset: number;
  language: string;
}
export function generateDailyReport({
  item,
  offset,
  language,
}: generateDailyReportArgs): DailyReport | undefined {
  if (!item.user_and_date) {
    return undefined;
  }
  const id = item.user_and_date;
  const isToday = id && id.endsWith(todayYYYYMMDD(offset));

  const workType = i18n(Label.Work, language);
  const breakTimeType = i18n(Label.BreakTime, language);
  const timeOffType = i18n(Label.TimeOff, language);
  const rawEntries: ReportTimeEntry[] = (
    (item.work_entries || []).map((e) => {
      const entry = deserializeTimeEntry(e);
      if (!entry) {
        throw new Error(
          `Unexpected entry detected (entry: ${e}, item: ${item}`,
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
      };
    })
  ).concat(
    (item.break_time_entries || []).map((e) => {
      const entry = deserializeTimeEntry(e);
      if (!entry) {
        throw new Error(
          `Unexpected entry detected (entry: ${e}, item: ${item}`,
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
      };
    }),
  ).concat(
    (item.time_off_entries || []).map((e) => {
      const entry = deserializeTimeEntry(e);
      if (!entry) {
        throw new Error(
          `Unexpected entry detected (entry: ${e}, item: ${item}`,
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
      };
    }),
  ).sort((a, b) => {
    return timeToNumber(a.start) > timeToNumber(b.start) ? 1 : -1;
  });
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
              end: ongoingWorkEnd,
              type: EntryType.Work,
              type_label: workType,
              type_emoji: Emoji.Work,
              minutes: calculateDuratinMinutes(start, end),
              project_code: ongoingWork.project_code,
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
  const projectMinutes: Record<string, number> = {};
  for (const e of entries) {
    if (e.type === EntryType.Work && e.project_code) {
      const current = projectMinutes[e.project_code] || 0;
      projectMinutes[e.project_code] = current + e.minutes;
    }
  }

  let workMinutes = 0;
  let breakTimeMinutes = 0;
  let timeOffMinutes = 0;
  for (const e of entries) {
    if (e.end !== "") {
      const minutes = calculateDuratinMinutes(e.start, e.end);
      if (e.type === EntryType.Work) {
        workMinutes += minutes;
      } else if (e.type === EntryType.BreakTime) {
        breakTimeMinutes += minutes;
      } else if (e.type === EntryType.TimeOff) {
        timeOffMinutes += minutes;
      }
    }
  }
  const yyyymmdd = item.user_and_date.split("-")[1];
  const date = toDateFormat(offset, yyyymmdd);

  const projects: ProjectWork[] = [];
  for (const [project_code, work_minutes] of Object.entries(projectMinutes)) {
    projects.push({
      project_code,
      work_minutes,
      work_hours: Math.round(work_minutes / 6) / 10,
    });
  }
  projects.sort((a, b) => a.work_minutes > b.work_minutes ? -1 : 1);

  return {
    date,
    work_minutes: workMinutes,
    break_time_minutes: breakTimeMinutes,
    time_off_minutes: timeOffMinutes,
    work_hours: Math.round(workMinutes / 60 * 10) / 10,
    break_time_hours: Math.round(breakTimeMinutes / 60 * 10) / 10,
    time_off_hours: Math.round(timeOffMinutes / 60 * 10) / 10,
    entries,
    projects,
  };
}

import {
  AnyMessageBlock,
  AnyModalBlock,
  SlackAPIClient,
} from "slack-web-api-client/mod.ts";

interface shareReportJSONFileArgs {
  report: MonthlyReport;
  user_id: string;
  language: string;
  yyyymmdd: string;
  slackApi: SlackAPIClient;
}
export async function shareReportJSONFile({
  report,
  language,
  user_id,
  yyyymmdd,
  slackApi,
}: shareReportJSONFileArgs) {
  const json: string = JSON.stringify(report, null, 2);
  const jsonBytes: Uint8Array = new TextEncoder().encode(json);
  const blocks: AnyMessageBlock[] = toReportResultBlocks(
    report,
    [],
    language,
  ) as AnyMessageBlock[];
  const filename = `${user_id}-${yyyymmdd.substring(0, 6)}.json`;
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
    channel: user_id,
    text: `Here is the monthly report's JSON file: ${fileUrl}`,
    blocks,
  });
}

export function toReportResultBlocks(
  report: MonthlyReport,
  blocks: (AnyMessageBlock | AnyModalBlock)[],
  language: string,
): (AnyMessageBlock | AnyModalBlock)[] {
  const wDuration = [
    hourDuration(report.work_hours, language),
    minuteDuration(report.work_minutes, language),
  ].filter((e) => e).join(" ");
  const btDuration = [
    hourDuration(report.break_time_hours, language),
    minuteDuration(report.break_time_minutes, language),
  ].filter((e) => e).join(" ");
  const toDuration = [
    hourDuration(report.time_off_hours, language),
    minuteDuration(report.time_off_minutes, language),
  ].filter((e) => e).join(" ");

  const summary = [];
  if (wDuration) {
    summary.push(
      Emoji.Work + " " + i18n(Label.Work, language) + ": " + wDuration,
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
        const label = e.type == EntryType.Work && e.project_code
          ? e.type_label + " [" + e.project_code + "]"
          : e.type_label;
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
