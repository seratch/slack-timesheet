import { DataMapper, SavedAttributes } from "deno-slack-data-mapper/mod.ts";
import {
  AnyActionBlockElementType,
  AnyModalBlock,
  Button,
  Checkboxes,
  ExternalSelect,
  ModalView,
  MrkdwnTextField,
  PlainTextField,
  PlainTextInput,
  PlainTextOption,
  RichTextBlock,
  SlackAPIClient,
} from "slack-web-api-client/mod.ts";

import { i18n } from "./i18n.ts";
import {
  clockEmoji,
  hourDuration,
  minuteDuration,
  nowHHMM,
  toDateFormat,
  todayForDatepicker,
  todayYYYYMMDD,
} from "./datetime.ts";
import {
  C,
  deserializeTimeEntry,
  EnhancedTimeEntry,
  OP,
  P,
  PH,
  serializeTimeEntry,
  TE,
  US,
} from "./datastore.ts";
import {
  generateDailyReport,
  generateReport,
  MonthlyReport,
  toReportResultBlocks,
} from "./reports.ts";
import {
  ActionId,
  AdminMenuItem,
  BlockId,
  CallbackId,
  Emoji,
  EntryType,
  Label,
  MenuItem,
} from "./constants.ts";
import {
  AddEntryPrivateMetadata,
  EditEntryPrivateMetadata,
  EditProjectPrivateMetadata,
  MainViewPrivateMetadata,
  ReportPrivateMetadata,
} from "./private_metadata.ts";

import { View } from "deno-slack-sdk/functions/interactivity/view_types.ts";
import { OrganizationPolices } from "./organization_policies.ts";
import { LaborLawComplianceValidator } from "./labor_laws.ts";

// -----------------------------------------
// view.state.values utility
// -----------------------------------------

export interface ViewStateSelectedOption {
  text: PlainTextField;
  value: string;
}

export interface ViewStateValue {
  type: AnyActionBlockElementType;
  value?: string;
  selected_date?: string;
  selected_time?: string;
  selected_date_time?: number;
  selected_conversation?: string;
  selected_channel?: string;
  selected_user?: string;
  selected_option?: ViewStateSelectedOption;
  selected_conversations?: string[];
  selected_channels?: string[];
  selected_users?: string[];
  selected_options?: ViewStateSelectedOption[];
  timezone?: string; // timepicker
  rich_text_value?: RichTextBlock; // rich_text_input
}

export function stateValue(
  view: View,
  blockId: string,
  actionId: string = ActionId.Input,
): ViewStateValue | undefined {
  const values = view.state.values;
  if (values[blockId]) {
    if (values[blockId][actionId]) {
      return values[blockId][actionId] as ViewStateValue;
    }
  }
  return undefined;
}

// -----------------------------------------
// Modal parts
// -----------------------------------------

export function newView(language: string): ModalView {
  return {
    "type": "modal",
    "title": TitleMain(language),
    "close": QuitThisApp(language),
    "blocks": [],
  };
}

function buildTitle(text: string): PlainTextField {
  return { "type": "plain_text", "text": text };
}
export function TitleMain(language: string): PlainTextField {
  return buildTitle(i18n(Label.AppName, language));
}

// ----------------------
// Time Entry
// ----------------------

export function TitleStartWorkWithProjectCode(
  language: string,
): PlainTextField {
  return buildTitle(i18n(Label.StartWork, language));
}

export function TitleAddEntry(language: string): PlainTextField {
  return buildTitle(i18n(Label.AddEntry, language));
}
export function TitleEditEntry(language: string): PlainTextField {
  return buildTitle(i18n(Label.EditEntry, language));
}

// ----------------------
// Menu
// ----------------------

export function TitleUserSettings(language: string): PlainTextField {
  return buildTitle(i18n(Label.UserSettings, language));
}

export function TitleMonthlyReport(language: string): PlainTextField {
  return buildTitle(i18n(Label.MonthlyReport, language));
}

// ----------------------
// Admin Menu
// ----------------------

export function TitleAdminMenu(language: string): PlainTextField {
  return buildTitle(i18n(Label.AdminMenu, language));
}

export function TitleAdminReportDownload(language: string): PlainTextField {
  return buildTitle(i18n(Label.AdminReportDownload, language));
}

export function TitleProjectMain(language: string): PlainTextField {
  return buildTitle(i18n(Label.ProjectMain, language));
}
export function TitleAddProject(language: string): PlainTextField {
  return buildTitle(i18n(Label.AddProject, language));
}
export function TitleEditProject(language: string): PlainTextField {
  return buildTitle(i18n(Label.EditProject, language));
}

export function TitleOrganizationPolicies(language: string): PlainTextField {
  return buildTitle(i18n(Label.OrganizationPolicies, language));
}

// ----------------------
// Close/Submit buttons
// ----------------------

export function Back(language: string): PlainTextField {
  return { "type": "plain_text", "text": i18n(Label.Back, language) };
}
export function ReceiveReportInDM(language: string): PlainTextField {
  return {
    "type": "plain_text",
    "text": i18n(Label.ReceiveReportInDM, language),
  };
}
export function QuitThisApp(language: string): PlainTextField {
  return { "type": "plain_text", "text": i18n(Label.QuitApp, language) };
}
export function Submit(language: string): PlainTextField {
  return { "type": "plain_text", "text": i18n(Label.Submit, language) };
}
export function Next(language: string): PlainTextField {
  return { "type": "plain_text", "text": i18n(Label.Next, language) };
}
export function Save(language: string): PlainTextField {
  return { "type": "plain_text", "text": i18n(Label.Save, language) };
}

// ----------------------
// Language options
// ----------------------

export const LanguageOptions: PlainTextOption[] = [
  {
    "text": { "type": "plain_text", "text": "English" },
    "value": "en",
  },
  {
    "text": { "type": "plain_text", "text": "日本語" },
    "value": "ja",
  },
];

// ----------------------
// Country options
// ----------------------

export function CountryOptions(
  coutries: SavedAttributes<C>[],
  language: string,
): PlainTextOption[] {
  const options: PlainTextOption[] = [];
  for (const country of coutries) {
    options.push({
      "text": { "type": "plain_text", "text": i18n(country.label, language) },
      "value": country.id,
    });
  }
  return options;
}

// -----------------------------------------
// Main view
// -----------------------------------------

interface syncMainViewArgs {
  isDebugMode: boolean;
  manualEntryPermitted: boolean;
  viewId: string;
  entryForTheDay: SavedAttributes<TE>;
  slackApi: SlackAPIClient;
  offset: number;
  language: string;
  country: string | undefined;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  canAccessAdminFeature: () => Promise<boolean>;
  yyyymmdd: string | undefined;
}
export async function syncMainView({
  viewId,
  entryForTheDay,
  slackApi,
  offset,
  language,
  country,
  holidays,
  yyyymmdd,
  canAccessAdminFeature,
  isDebugMode,
  manualEntryPermitted,
}: syncMainViewArgs) {
  const privateMetadata: MainViewPrivateMetadata = { yyyymmdd };
  await slackApi.views.update({
    view_id: viewId,
    view: {
      "type": "modal",
      "callback_id": CallbackId.MainView,
      "private_metadata": JSON.stringify(privateMetadata),
      "title": TitleMain(language),
      "close": QuitThisApp(language),
      "blocks": await mainViewBlocks({
        isDebugMode,
        manualEntryPermitted,
        item: entryForTheDay,
        offset,
        language,
        country,
        holidays,
        canAccessAdminFeature,
        yyyymmdd,
      }),
    },
  });
}

interface toMainViewArgs {
  isDebugMode: boolean;
  manualEntryPermitted: boolean;
  canAccessAdminFeature: () => Promise<boolean>;
  view: ModalView;
  offset: number;
  language: string;
  country: string | undefined;
  item: SavedAttributes<TE>;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  yyyymmdd: string | undefined;
}
export async function toMainView(
  {
    isDebugMode,
    manualEntryPermitted,
    canAccessAdminFeature,
    view,
    offset,
    language,
    country,
    item,
    holidays,
    yyyymmdd,
  }: toMainViewArgs,
): Promise<ModalView> {
  view.callback_id = CallbackId.MainView;
  const privateMedata: MainViewPrivateMetadata = { yyyymmdd };
  view.private_metadata = JSON.stringify(privateMedata);
  view.blocks = await mainViewBlocks({
    isDebugMode,
    manualEntryPermitted,
    canAccessAdminFeature,
    offset,
    language,
    country,
    item,
    holidays,
    yyyymmdd,
  });
  return view;
}

interface mainViewBlocksArgs {
  isDebugMode: boolean;
  manualEntryPermitted: boolean;
  canAccessAdminFeature: () => Promise<boolean>;
  offset: number;
  language: string;
  country: string | undefined;
  item: SavedAttributes<TE>;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  yyyymmdd: string | undefined;
}
export async function mainViewBlocks({
  isDebugMode,
  manualEntryPermitted,
  canAccessAdminFeature,
  offset,
  language,
  country,
  item,
  holidays,
  yyyymmdd,
}: mainViewBlocksArgs): Promise<AnyModalBlock[]> {
  const entries = (item.work_entries || []).map((e) => {
    const entry = deserializeTimeEntry(e)!;
    return entry.start + "," +
      (entry.end || "") + "," +
      (entry.project_code || "") + "," +
      EntryType.Work;
  })
    .concat(
      (item.break_time_entries || []).map((e) => {
        const entry = deserializeTimeEntry(e)!;
        return entry.start + "," +
          (entry.end || "") + "," +
          (entry.project_code || "") + "," +
          EntryType.BreakTime;
      }),
    )
    .concat(
      (item.time_off_entries || []).map((e) => {
        const entry = deserializeTimeEntry(e)!;
        return entry.start + "," +
          (entry.end || "") + "," +
          (entry.project_code || "") + "," +
          EntryType.TimeOff;
      }),
    )
    .sort();

  const entryBlocks: AnyModalBlock[] = [];
  let businessHours = false;
  let breakTime = false;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const entryWithType = deserializeTimeEntry(entry);
    if (!entryWithType) continue;
    const { start, end, project_code, type } = entryWithType;
    let typeLabel = "";
    let emoji = "";
    if (type === EntryType.Work) {
      if (project_code) {
        typeLabel = i18n(Label.Work, language) + " [" + project_code + "]";
      } else {
        typeLabel = i18n(Label.Work, language);
      }
      emoji = Emoji.Work;
    } else if (type === EntryType.BreakTime) {
      typeLabel = i18n(Label.BreakTime, language);
      emoji = Emoji.BreakTime;
    } else if (type === EntryType.TimeOff) {
      typeLabel = i18n(Label.TimeOff, language);
      emoji = Emoji.TimeOff;
    }
    const options: PlainTextOption[] = [];
    if (manualEntryPermitted) {
      options.push({
        "text": { "type": "plain_text", "text": i18n(Label.Edit, language) },
        "value": `edit___${entry}`,
      });
    }
    options.push({
      "text": { "type": "plain_text", "text": i18n(Label.Delete, language) },
      "value": `delete___${entry}`,
    });
    if (end === undefined) end === "";
    const label = `*${emoji} ${typeLabel}:* ${start} - ${end}`;
    entryBlocks.push({
      "type": "section",
      "text": { "type": "mrkdwn", "text": label },
      "accessory": {
        "type": "overflow",
        "action_id": ActionId.EditOrDeleteEntry,
        "options": options,
      },
    });
    if (end === "" || end === undefined) {
      if (type === EntryType.BreakTime) {
        breakTime = true;
      }
      businessHours = true;
    }
  }

  const isToday = yyyymmdd === undefined ||
    todayYYYYMMDD(offset) === yyyymmdd;

  const time = nowHHMM(offset);
  const _yyyymmdd = yyyymmdd ?? todayYYYYMMDD(offset);
  const ph = await holidays();
  const isHoliday = (ph?.holidays || []).includes(_yyyymmdd);
  const emoji = isHoliday ? Emoji.Holiday : clockEmoji(time);
  const timeOnlyForToday = isToday ? " " + time : "";
  const datetime = toDateFormat(offset, _yyyymmdd) + timeOnlyForToday;

  const menuItems: PlainTextOption[] = [];
  if (!isToday) {
    menuItems.push({
      "text": {
        "type": "plain_text",
        "text": Emoji.BackToToday + " " + i18n(Label.BackToToday, language),
      },
      "value": MenuItem.BackToToday,
    });
  }

  menuItems.push({
    "text": {
      "type": "plain_text",
      "text": Emoji.Calendar + " " + i18n(Label.Calendar, language),
    },
    "value": MenuItem.Calendar,
  });
  menuItems.push({
    "text": {
      "type": "plain_text",
      "text": Emoji.MonthlyReport + " " + i18n(Label.MonthlyReport, language),
    },
    "value": MenuItem.MonthlyReport,
  });
  menuItems.push({
    "text": {
      "type": "plain_text",
      "text": Emoji.UserSettings + " " + i18n(Label.UserSettings, language),
    },
    "value": MenuItem.UserSettings,
  });

  if (await canAccessAdminFeature()) {
    menuItems.push({
      "text": {
        "type": "plain_text",
        "text": Emoji.AdminOnly + " " + i18n(Label.AdminMenu, language),
      },
      "value": MenuItem.AdminMenu,
    });
  }

  const topBlocks: AnyModalBlock[] = [
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": `${emoji}  *${datetime}*  ${emoji}` },
      "accessory": {
        "type": "overflow",
        "action_id": ActionId.Menu,
        "options": menuItems,
      },
    },
  ];

  const r = generateDailyReport({ item, offset, language, country });

  let report = " ";
  if (r && r.work_minutes + r.break_time_hours + r.time_off_minutes > 0) {
    if (isDebugMode) {
      console.log(
        "### The daily report for the main view:\n" +
          JSON.stringify(r, null, 2),
      );
    }
    const workDuration = [
      hourDuration(r.work_hours, language),
      minuteDuration(r.work_minutes, language),
    ].filter((e) => e).join(" ");
    const overtimeWorkDuration =
      (r.overtime_work_hours && r.overtime_work_minutes
        ? [
          hourDuration(r.overtime_work_hours, language),
          minuteDuration(r.overtime_work_minutes, language),
        ].filter((e) => e)
        : []).join(" ");
    const nightShiftWorkDuration =
      (r.night_shift_work_hours && r.night_shift_work_minutes
        ? [
          hourDuration(r.night_shift_work_hours, language),
          minuteDuration(r.night_shift_work_minutes, language),
        ].filter((e) => e)
        : []).join(" ");
    const breakTimeDuration = [
      hourDuration(r.break_time_hours, language),
      minuteDuration(r.break_time_minutes, language),
    ].filter((e) => e).join(" ");
    const timeOffDuration = [
      hourDuration(r.time_off_hours, language),
      minuteDuration(r.time_off_minutes, language),
    ].filter((e) => e).join(" ");
    const reportItems = [];
    if (workDuration) {
      reportItems.push(
        Emoji.Work + " *" + i18n(Label.Work, language) + ":* " + workDuration,
      );
    }
    if (overtimeWorkDuration) {
      reportItems.push(
        Emoji.Work + " *" + i18n(Label.OvertimeWork, language) + ":* " +
          overtimeWorkDuration,
      );
    }
    if (nightShiftWorkDuration) {
      reportItems.push(
        Emoji.Work + " *" + i18n(Label.NightShiftWork, language) + ":* " +
          nightShiftWorkDuration,
      );
    }
    if (breakTimeDuration) {
      reportItems.push(
        Emoji.BreakTime + " *" + i18n(Label.BreakTime, language) + ":* " +
          breakTimeDuration,
      );
    }
    if (timeOffDuration) {
      reportItems.push(
        Emoji.TimeOff + " *" + i18n(Label.TimeOff, language) + ":* " +
          timeOffDuration,
      );
    }
    if (r.projects && r.projects.length > 0) {
      reportItems.push("");
      reportItems.push("*" + i18n(Label.ProjectSummary, language) + "*");
      for (const p of r.projects) {
        reportItems.push(
          "*" + p.project_code + "*: " +
            hourDuration(p.work_hours, language) + " " +
            minuteDuration(p.work_minutes, language),
        );
      }
    }
    report = reportItems.join("\n");
  }

  topBlocks.push({
    "type": "section",
    "text": { "type": "mrkdwn", "text": report },
    "accessory": {
      "type": "button",
      "action_id": ActionId.Refresh,
      "text": {
        "type": "plain_text",
        "text": Emoji.Refresh + " " + i18n(Label.RefreshButton, language),
      },
      "value": "1",
    },
  });

  let warnings: string[] = [];
  if (r && country) {
    const validator = new LaborLawComplianceValidator(country);
    warnings = validator.validateDailyReport({ report: r, language });
  }
  if (warnings && warnings.length > 0) {
    const elements: MrkdwnTextField[] = warnings.map((w) => {
      return { "type": "mrkdwn", "text": Emoji.Warning + " " + w };
    });
    topBlocks.push({ "type": "context", "elements": elements });
  }

  if (entryBlocks.length > 0) {
    topBlocks.push({ "type": "divider" });
  }

  if (isToday) {
    const StartWorkButton = quickButton({
      action_id: ActionId.StartWork,
      emoji: Emoji.Work,
      label: Label.StartWork,
      style: "primary",
      language,
    });
    const FinishWorkButton = quickButton({
      action_id: ActionId.FinishWork,
      emoji: Emoji.Work,
      label: Label.FinishWork,
      style: "danger",
      language,
    });
    const StartBreakTimeButton = quickButton({
      action_id: ActionId.StartBreakTime,
      emoji: Emoji.BreakTime,
      label: Label.StartBreakTime,
      style: "primary",
      language,
    });
    const FinishBreakTimeButton = quickButton({
      action_id: ActionId.FinishBreakTime,
      emoji: Emoji.BreakTime,
      label: Label.FinishBreakTime,
      style: "danger",
      language,
    });

    if (businessHours) {
      if (breakTime) {
        topBlocks.push({
          "type": "actions",
          "elements": [FinishBreakTimeButton],
        });
      } else {
        topBlocks.push({
          "type": "actions",
          "elements": [StartBreakTimeButton, FinishWorkButton],
        });
      }
    } else {
      topBlocks.push({
        "type": "actions",
        "elements": [StartWorkButton, StartBreakTimeButton],
      });
    }
  }
  const blocks = topBlocks.concat(entryBlocks);
  if (manualEntryPermitted) {
    if (entryBlocks.length != 0) {
      blocks.push({ "type": "divider" });
    }
    blocks.push({
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "action_id": ActionId.AddEntry,
          "text": {
            "type": "plain_text",
            "text": i18n(Label.AddAnEntry, language),
          },
          "value": "1",
        },
      ],
    });
  }
  return blocks;
}

interface quickButtonArgs {
  action_id: string;
  emoji: string;
  label: string;
  style: "primary" | "danger" | undefined;
  language: string;
}
function quickButton(
  { action_id, emoji, label, style, language }: quickButtonArgs,
): Button {
  const button: Button = {
    "type": "button",
    "action_id": action_id,
    "text": {
      "type": "plain_text",
      "text": emoji + " " + i18n(label, language),
    },
    "value": "1",
  };
  if (style) button.style = style;
  return button;
}

// -----------------------------------------
// User Setings view
// -----------------------------------------

interface toUserSettingsViewArgs {
  view: ModalView;
  settings: SavedAttributes<US>;
  countries: SavedAttributes<C>[];
  language: string;
  country: string | undefined;
}

export function toUserSettingsView({
  view,
  settings,
  countries,
  language,
  country,
}: toUserSettingsViewArgs): ModalView {
  view.callback_id = CallbackId.UserSettings;
  view.title = TitleUserSettings(language);
  view.submit = Save(language);
  view.close = Back(language);
  let selectedLanguage = LanguageOptions.find((l) =>
    l.value === settings.language
  );
  if (!selectedLanguage) {
    selectedLanguage = LanguageOptions.find((l) => l.value === language);
  }
  view.blocks.push({
    "type": "input",
    "block_id": BlockId.Language,
    "label": { "type": "plain_text", "text": i18n(Label.Language, language) },
    "element": {
      "type": "static_select",
      "action_id": ActionId.Input,
      "options": LanguageOptions,
      "initial_option": selectedLanguage,
    },
  });
  const options = CountryOptions(countries, language);
  if (options && options.length > 0) {
    let selectedOption = options.find((c) => c.value === settings.country_id);
    if (!selectedOption) {
      selectedOption = options.find((c) => c.value === country);
    }
    view.blocks.push({
      "type": "input",
      "block_id": BlockId.Country,
      "label": { "type": "plain_text", "text": i18n(Label.Country, language) },
      "element": {
        "type": "static_select",
        "action_id": ActionId.Input,
        "options": options,
        "initial_option": selectedOption,
      },
      "optional": true,
    });
  }
  return view;
}

// -----------------------------------------
// StartWork view
// -----------------------------------------

interface toStartWorkWithProjectCodeViewArgs {
  view: ModalView;
  language: string;
}
export function toStartWorkWithProjectCodeView({
  view,
  language,
}: toStartWorkWithProjectCodeViewArgs): ModalView {
  view.callback_id = CallbackId.StartWorkWithProjectCode;
  view.title = TitleStartWorkWithProjectCode(language);
  view.submit = Submit(language);
  view.close = Back(language);
  view.blocks.push({
    "type": "input",
    "block_id": BlockId.ProjectCode,
    "label": {
      "type": "plain_text",
      "text": i18n(Label.ProjectCode, language),
    },
    "element": {
      "type": "external_select",
      "action_id": ActionId.ProjectCodeSearch,
      "min_query_length": 0,
    },
    "optional": true,
  });
  return view;
}

// -----------------------------------------
// Calendar view
// -----------------------------------------

export function toCalendarView(
  view: ModalView,
  offset: number,
  language: string,
): ModalView {
  view.callback_id = CallbackId.Calendar;
  view.submit = Next(language);
  view.close = Back(language);
  view.blocks.push({
    "type": "input",
    "block_id": BlockId.Date,
    "label": { "type": "plain_text", "text": i18n(Label.Date, language) },
    "element": {
      "type": "datepicker",
      "action_id": ActionId.Input,
      "initial_date": todayForDatepicker(offset),
    },
  });
  return view;
}

// -----------------------------------------
// Report view
// -----------------------------------------

interface toReportStartViewArgs {
  view: ModalView;
  offset: number;
  language: string;
}
export function toReportStartView({
  view,
  offset,
  language,
}: toReportStartViewArgs): ModalView {
  const yyyymmdd = todayYYYYMMDD(offset);
  view.callback_id = CallbackId.ReportStart;
  view.title = TitleMonthlyReport(language);
  view.close = Back(language);
  view.submit = Next(language);
  const currentYear = Number.parseInt(yyyymmdd.substring(0, 4));
  const years: PlainTextOption[] = [];
  for (let i = -20; i < 20; i++) {
    const year = currentYear + i;
    years.push({
      text: { type: "plain_text", text: year.toString() },
      value: year.toString(),
    });
  }
  reportStartBlocks(
    { language, offset, blocks: view.blocks },
  );
  return view;
}

interface reportStartBlocksArgs {
  language: string;
  offset: number;
  blocks: AnyModalBlock[];
}
function reportStartBlocks(
  { language, offset, blocks }: reportStartBlocksArgs,
) {
  const yyyymmdd = todayYYYYMMDD(offset);
  const currentYear = Number.parseInt(yyyymmdd.substring(0, 4));
  const years: PlainTextOption[] = [];
  for (let i = -20; i < 20; i++) {
    const year = currentYear + i;
    years.push({
      text: { type: "plain_text", text: year.toString() },
      value: year.toString(),
    });
  }
  blocks.push({
    "type": "input",
    "block_id": BlockId.Year,
    "label": { "type": "plain_text", "text": i18n(Label.Year, language) },
    "element": {
      "type": "static_select",
      "action_id": ActionId.Input,
      "options": years,
      "initial_option": {
        text: { type: "plain_text", text: currentYear.toString() },
        value: currentYear.toString(),
      },
    },
  });

  const months: PlainTextOption[] = [];
  for (let i = 1; i <= 12; i++) {
    months.push({
      text: { type: "plain_text", text: i.toString() },
      value: i.toString(),
    });
  }
  const month = yyyymmdd.substring(4, 6);
  blocks.push({
    "type": "input",
    "block_id": BlockId.Month,
    "label": { "type": "plain_text", "text": i18n(Label.Month, language) },
    "element": {
      "type": "static_select",
      "action_id": ActionId.Input,
      "options": months,
      "initial_option": {
        text: { type: "plain_text", text: month },
        value: month,
      },
    },
  });
}

interface toReportResultViewArgs {
  view: ModalView;
  month: string;
  user: string;
  email: string;
  items: SavedAttributes<TE>[];
  offset: number;
  language: string;
  country: string | undefined;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  isDebugMode: boolean;
}
export async function toReportResultView({
  view,
  user,
  email,
  month,
  items,
  offset,
  language,
  country,
  holidays,
  isDebugMode,
}: toReportResultViewArgs): Promise<ModalView> {
  const report: MonthlyReport = await generateReport({
    user,
    email,
    month,
    items,
    offset,
    language,
    country,
    holidays,
  });
  if (isDebugMode) {
    console.log("### Report:\n" + JSON.stringify(report, null, 2));
  }

  view.callback_id = CallbackId.ReportResult;
  view.title = TitleMonthlyReport(language);
  view.close = Back(language);
  const privateMetadata: ReportPrivateMetadata = {
    "yyyymmdd": month.replace("/", "") + "01",
  };
  view.private_metadata = JSON.stringify(privateMetadata);
  view.blocks.push({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": ":wave: " +
        i18n(Label.HereIsTheReportYouRequested, language),
    },
    "accessory": {
      "type": "button",
      "action_id": ActionId.SendReportInDM,
      "style": "primary",
      "text": {
        "type": "plain_text",
        "text": i18n(Label.SendThisInDM, language),
      },
      "value": JSON.stringify({ "user_id": user, "month": month }),
    },
  });
  view.blocks.push({ "type": "divider" });
  toReportResultBlocks(report, view.blocks, country, language);
  return view;
}

// -----------------------------------------
// Time Entry view
// -----------------------------------------

interface newAddEntryViewArgs {
  language: string;
  blocks: AnyModalBlock[];
  yyyymmdd: string | undefined;
}
export function newAddEntryView({
  language,
  blocks,
  yyyymmdd,
}: newAddEntryViewArgs): ModalView {
  const privateMetadata: AddEntryPrivateMetadata = { "yyyymmdd": yyyymmdd };
  return {
    "type": "modal",
    "callback_id": CallbackId.AddEntry,
    "title": TitleAddEntry(language),
    "submit": Submit(language),
    "close": Back(language),
    "private_metadata": JSON.stringify(privateMetadata),
    "blocks": blocks,
  };
}

interface newEditEntryViewArgs {
  entry: EnhancedTimeEntry;
  type: string;
  language: string;
  blocks: AnyModalBlock[];
  yyyymmdd: string | undefined;
}
export function newEditEntryView({
  entry,
  type,
  language,
  blocks,
  yyyymmdd,
}: newEditEntryViewArgs): ModalView {
  const privateMetadata: EditEntryPrivateMetadata = {
    "edit_target": serializeTimeEntry(entry),
    "type": type,
    "yyyymmdd": yyyymmdd,
  };
  return {
    "type": "modal",
    "callback_id": CallbackId.EditEntry,
    "title": TitleEditEntry(language),
    "submit": Submit(language),
    "close": Back(language),
    "private_metadata": JSON.stringify(privateMetadata),
    "blocks": blocks,
  };
}

interface newAddEntryBlocksArgs {
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  projects: SavedAttributes<P>[] | undefined;
  offset: number;
  language: string;
  yyyymmdd: string;
}
export async function newAddEntryBlocks({
  holidays,
  projects,
  offset,
  language,
  yyyymmdd,
}: newAddEntryBlocksArgs): Promise<AnyModalBlock[]> {
  const time = nowHHMM(offset);
  const isHoliday = ((await holidays())?.holidays || []).includes(yyyymmdd);
  const emoji = isHoliday ? Emoji.Holiday : clockEmoji(time);
  const entryTypeOptions: PlainTextOption[] = [
    {
      "text": {
        "type": "plain_text",
        "text": Emoji.Work + " " + i18n(Label.Work, language),
      },
      "value": EntryType.Work,
    },
    {
      "text": {
        "type": "plain_text",
        "text": Emoji.BreakTime + " " + i18n(Label.BreakTime, language),
      },
      "value": EntryType.BreakTime,
    },
    {
      "text": {
        "type": "plain_text",
        "text": Emoji.TimeOff + " " + i18n(Label.TimeOff, language),
      },
      "value": EntryType.TimeOff,
    },
  ];
  const blocks: AnyModalBlock[] = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `${emoji}  *${toDateFormat(offset, yyyymmdd)}*  ${emoji}`,
      },
    },
    { "type": "divider" },
    {
      "type": "input",
      "block_id": BlockId.Type,
      "label": {
        "type": "plain_text",
        "text": i18n(Label.InputType, language),
      },
      "element": {
        "type": "radio_buttons",
        "action_id": ActionId.Input,
        "options": entryTypeOptions,
        "initial_option": entryTypeOptions[0],
      },
    },
    {
      "type": "input",
      "block_id": BlockId.Start,
      "label": { "type": "plain_text", "text": i18n(Label.Start, language) },
      "element": { "type": "timepicker", "action_id": ActionId.Input },
    },
    {
      "type": "input",
      "block_id": BlockId.End,
      "label": { "type": "plain_text", "text": i18n(Label.End, language) },
      "element": { "type": "timepicker", "action_id": ActionId.Input },
    },
  ];
  if (projects && projects.length > 0) {
    blocks.push({
      "type": "input",
      "block_id": BlockId.ProjectCode,
      "label": {
        "type": "plain_text",
        "text": i18n(Label.ProjectCode, language),
      },
      "element": {
        "type": "external_select",
        "action_id": ActionId.ProjectCodeSearch,
        "min_query_length": 0,
      },
      "optional": true,
    });
  }
  return blocks;
}

interface newEditEntryBlocksArgs {
  p: DataMapper<P>;
  entry: EnhancedTimeEntry;
  language: string;
  projectCodeEnabled: boolean;
}
export async function newEditEntryBlocks(
  { p, entry, language, projectCodeEnabled }: newEditEntryBlocksArgs,
) {
  let workTypeLabel = " ";
  if (entry.type === EntryType.Work) {
    workTypeLabel = Emoji.Work + " " + i18n(Label.Work, language);
  } else if (entry.type === EntryType.BreakTime) {
    workTypeLabel = Emoji.BreakTime + " " + i18n(Label.BreakTime, language);
  } else if (entry.type === EntryType.TimeOff) {
    workTypeLabel = Emoji.TimeOff + " " + i18n(Label.TimeOff, language);
  }
  const blocks: AnyModalBlock[] = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*" + workTypeLabel + "*",
      },
    },
    { "type": "divider" },
    {
      "type": "input",
      "block_id": BlockId.Start,
      "label": { "type": "plain_text", "text": i18n(Label.Start, language) },
      "element": {
        "type": "timepicker",
        "action_id": ActionId.Input,
        "initial_time": entry.start,
      },
    },
  ];
  if (entry.end !== "") {
    blocks.push({
      "type": "input",
      "block_id": BlockId.End,
      "label": { "type": "plain_text", "text": i18n(Label.End, language) },
      "element": {
        "type": "timepicker",
        "action_id": ActionId.Input,
        "initial_time": entry.end,
      },
    });
  }
  if (entry.type === EntryType.Work && projectCodeEnabled) {
    const element: ExternalSelect = {
      "type": "external_select",
      "action_id": ActionId.ProjectCodeSearch,
      "min_query_length": 0,
    };
    if (entry.project_code) {
      const project = (await p.findById(entry.project_code)).item;
      element.initial_option = {
        text: { type: "plain_text", text: `${project.code}: ${project.name}` },
        value: project.code,
      };
    }
    blocks.push({
      "type": "input",
      "block_id": BlockId.ProjectCode,
      "label": {
        "type": "plain_text",
        "text": i18n(Label.ProjectCode, language),
      },
      "element": element,
      "optional": true,
    });
  }
  return blocks;
}

// -----------------------------------------
// Admin Menu view
// -----------------------------------------

interface toAdminMenuViewArgs {
  view: ModalView;
  language: string;
}
export function toAdminMenuView({
  view,
  language,
}: toAdminMenuViewArgs): ModalView {
  view.callback_id = CallbackId.AdminMenu;
  view.title = TitleAdminMenu(language);
  view.close = Back(language);
  view.blocks.push({
    "type": "actions",
    "block_id": BlockId.AdminMenu,
    "elements": [
      {
        "type": "static_select",
        "action_id": ActionId.AdminMenu,
        "options": [
          {
            text: {
              type: "plain_text",
              text: i18n(Label.AdminReportDownload, language),
            },
            value: AdminMenuItem.AdminReportDownload,
          },
          {
            text: {
              type: "plain_text",
              text: i18n(Label.OrganizationPolicies, language),
            },
            value: AdminMenuItem.OrganizationPolicies,
          },
          {
            text: {
              type: "plain_text",
              text: i18n(Label.ProjectSettings, language),
            },
            value: AdminMenuItem.ProjectSettings,
          },
        ],
      },
    ],
  });
  return view;
}

// -----------------------------------------
// Projects
// -----------------------------------------

interface syncProjectMainViewArgs {
  viewId: string;
  projects: SavedAttributes<P>[];
  slackApi: SlackAPIClient;
  language: string;
}
export async function syncProjectMainView({
  viewId,
  projects,
  slackApi,
  language,
}: syncProjectMainViewArgs) {
  await slackApi.views.update({
    view_id: viewId,
    view: toProjectMainView({ view: newView(language), projects, language }),
  });
}

interface toProjectMainViewArgs {
  view: ModalView;
  projects: SavedAttributes<P>[];
  language: string;
}
export function toProjectMainView({
  view,
  projects,
  language,
}: toProjectMainViewArgs): ModalView {
  view.callback_id = CallbackId.ProjectMainView;
  view.title = TitleProjectMain(language);
  view.close = Back(language);

  view.blocks.push({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": i18n(Label.ProjectMainPageGuide, language),
    },
    "accessory": {
      "type": "button",
      "action_id": ActionId.AddProject,
      "text": { "type": "plain_text", "text": i18n(Label.Add, language) },
      "style": "primary",
      "value": "1",
    },
  });

  if (projects && projects.length > 0) {
    view.blocks.push({ "type": "divider" });
    for (const project of projects) {
      const emoji = project.is_active
        ? Emoji.ActiveProject
        : Emoji.SuspendedProject;
      view.blocks.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `*${emoji} ${project.code}:*  ${project.name}`,
        },
        "accessory": {
          "type": "button",
          "action_id": ActionId.EditProject,
          "text": { "type": "plain_text", "text": i18n(Label.Edit, language) },
          "style": "primary",
          "value": project.code,
        },
      });
    }
  }
  return view;
}

interface newAddProjectBlocksArgs {
  language: string;
}
export function newAddProjectBlocks(
  { language }: newAddProjectBlocksArgs,
): AnyModalBlock[] {
  function label(label: string): PlainTextField {
    return { "type": "plain_text", "text": i18n(label, language) };
  }
  function plainTextInput(multiline: boolean): PlainTextInput {
    return {
      "type": "plain_text_input",
      "action_id": ActionId.Input,
      "multiline": multiline,
    };
  }
  const isActiveOption: PlainTextOption = {
    "text": {
      "type": "plain_text",
      "text": i18n(Label.ProjectIsActive, language),
    },
    "value": "1",
  };
  const blocks: AnyModalBlock[] = [
    {
      "type": "input",
      "block_id": BlockId.ProjectCode,
      "label": label(Label.ProjectCode),
      "element": plainTextInput(false),
      "optional": false,
    },
    {
      "type": "input",
      "block_id": BlockId.ProjectName,
      "label": label(Label.ProjectName),
      "element": plainTextInput(false),
      "optional": false,
    },
    {
      "type": "input",
      "block_id": BlockId.ProjectIsActive,
      "label": label(Label.ProjectIsActive),
      "element": {
        "type": "checkboxes",
        "action_id": ActionId.Input,
        "options": [isActiveOption],
        "initial_options": [isActiveOption],
      },
      "optional": true,
    },
    {
      "type": "input",
      "block_id": BlockId.ProjectDescription,
      "label": label(Label.ProjectDescription),
      "element": plainTextInput(true),
      "optional": true,
    },
  ];
  return blocks;
}

interface newAddProjectViewArgs {
  language: string;
  blocks: AnyModalBlock[];
}
export function newAddProjectView({
  language,
  blocks,
}: newAddProjectViewArgs): ModalView {
  return {
    "type": "modal",
    "callback_id": CallbackId.AddProject,
    "title": TitleAddProject(language),
    "submit": Submit(language),
    "close": Back(language),
    "blocks": blocks,
  };
}

interface newEditProjectBlocksArgs {
  item: SavedAttributes<P>;
  language: string;
}
export function newEditProjectBlocks(
  { item, language }: newEditProjectBlocksArgs,
): AnyModalBlock[] {
  function label(label: string): PlainTextField {
    return { "type": "plain_text", "text": i18n(label, language) };
  }
  function plainTextInput(
    initialValue: string,
    multiline: boolean,
  ): PlainTextInput {
    return {
      "type": "plain_text_input",
      "action_id": ActionId.Input,
      "initial_value": initialValue,
      "multiline": multiline,
    };
  }
  const isActiveOption: PlainTextOption = {
    "text": {
      "type": "plain_text",
      "text": i18n(Label.ProjectIsActive, language),
    },
    "value": "1",
  };
  const blocks: AnyModalBlock[] = [];
  blocks.push({
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": i18n(Label.ProjectCode, language) + ": " + item.code,
    },
  });
  blocks.push({
    "type": "input",
    "block_id": BlockId.ProjectName,
    "label": label(Label.ProjectName),
    "element": plainTextInput(item.name, false),
    "optional": false,
  });

  const isActiveBlockElement: Checkboxes = {
    "type": "checkboxes",
    "action_id": ActionId.Input,
    "options": [isActiveOption],
  };
  if (item.is_active) {
    isActiveBlockElement.initial_options = [isActiveOption];
  }
  blocks.push({
    "type": "input",
    "block_id": BlockId.ProjectIsActive,
    "label": label(Label.ProjectIsActive),
    "element": isActiveBlockElement,
    "optional": true,
  });

  blocks.push({
    "type": "input",
    "block_id": BlockId.ProjectDescription,
    "label": label(Label.ProjectDescription),
    "element": plainTextInput(item.description || "", true),
    "optional": true,
  });
  return blocks;
}

interface newEditProjectViewArgs {
  code: string;
  language: string;
  blocks: AnyModalBlock[];
}
export function newEditProjectView({
  code,
  language,
  blocks,
}: newEditProjectViewArgs): ModalView {
  const privateMetaedata: EditProjectPrivateMetadata = { code };
  return {
    "type": "modal",
    "callback_id": CallbackId.EditProject,
    "title": TitleAddProject(language),
    "submit": Submit(language),
    "close": Back(language),
    "private_metadata": JSON.stringify(privateMetaedata),
    "blocks": blocks,
  };
}

// -----------------------------------------
// Organization Policies view
// -----------------------------------------

interface toOrganizationPoliciesViewArgs {
  view: ModalView;
  policies: SavedAttributes<OP>[];
  language: string;
}
export function toOrganizationPoliciesView({
  view,
  policies,
  language,
}: toOrganizationPoliciesViewArgs): ModalView {
  view.callback_id = CallbackId.OrganizationPolicies;
  view.title = TitleOrganizationPolicies(language);
  view.close = Back(language);

  for (const [key, details] of Object.entries(OrganizationPolices)) {
    const options: PlainTextOption[] = [];
    for (const v of details.values) {
      options.push({
        text: { type: "plain_text", text: i18n(v.label, language) },
        value: key + "___" + v.value,
      });
    }
    let selectedOption = options[0];
    const saved = policies.find((p) => p.key === key);
    if (saved) {
      const savedOption = options.find((o) =>
        o.value === key + "___" + saved.value
      );
      if (savedOption) selectedOption = savedOption;
    }
    view.blocks.push({
      "type": "section",
      "text": { "type": "mrkdwn", "text": i18n(details.label, language) },
      "accessory": {
        "type": "static_select",
        "action_id": ActionId.OrganizationPolicyChange,
        "options": options,
        "initial_option": selectedOption,
      },
    });
  }
  return view;
}

// -----------------------------------------
// Admin Report Download view
// -----------------------------------------

interface toAdminReportDownloadViewArgs {
  view: ModalView;
  offset: number;
  language: string;
}
export function toAdminReportDownloadView({
  view,
  offset,
  language,
}: toAdminReportDownloadViewArgs): ModalView {
  view.callback_id = CallbackId.AdminReportDownload;
  view.title = TitleAdminReportDownload(language);
  view.submit = ReceiveReportInDM(language);
  view.close = Back(language);

  const yyyymmdd = todayYYYYMMDD(offset);
  const currentYear = Number.parseInt(yyyymmdd.substring(0, 4));
  const years: PlainTextOption[] = [];
  for (let i = -20; i < 20; i++) {
    const year = currentYear + i;
    years.push({
      text: { type: "plain_text", text: year.toString() },
      value: year.toString(),
    });
  }
  reportStartBlocks(
    { language, offset, blocks: view.blocks },
  );
  return view;
}

interface toAdminReportDownloadCompletionViewArgs {
  view: ModalView;
  language: string;
  message: string;
}
export function toAdminReportDownloadCompletionView(
  { view, language, message }: toAdminReportDownloadCompletionViewArgs,
): ModalView {
  view.callback_id = CallbackId.AdminReportDownload;
  view.title = TitleAdminReportDownload(language);
  view.close = Back(language);
  view.blocks.push({
    "type": "section",
    "text": { "type": "mrkdwn", "text": message },
  });
  return view;
}

interface projectSearchResultOptionsArgs {
  keyword: string;
  recentEntries: SavedAttributes<TE>[];
  allProjects: SavedAttributes<P>[];
}
export function projectSearchResultOptions({
  keyword,
  recentEntries,
  allProjects,
}: projectSearchResultOptionsArgs): ExternalSelectOption[] {
  const ranking: Record<string, number> = {};
  for (const entry of recentEntries) {
    for (const w of entry.work_entries) {
      const e = deserializeTimeEntry(w);
      if (e && e.project_code) {
        ranking[e.project_code] = (ranking[e.project_code] || 0) + 1;
      }
    }
  }
  const matchedProjects = allProjects
    .filter((p) =>
      p.code.includes(keyword) ||
      p.name.includes(keyword) ||
      (p.description || "").includes(keyword)
    )
    .sort((a, b) => {
      return (ranking[a.code] || 0) > (ranking[b.code] || 0) ? -1 : 1;
    })
    .slice(0, 100);

  const options: ExternalSelectOption[] = matchedProjects.map((p) => {
    return {
      text: { type: "plain_text", text: `${p.code}: ${p.name}` },
      value: p.code,
    };
  });
  return options;
}

interface ExternalSelectOption {
  text: {
    type: "plain_text";
    text: string;
    emoji?: boolean;
  };
  value: string;
}
