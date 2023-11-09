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
  StaticSelect,
  ViewsUpdateResponse,
} from "slack-web-api-client/mod.ts";

import { i18n } from "./i18n.ts";
import {
  clockEmoji,
  hourDuration,
  minuteDuration,
  nowHHMM,
  timeToNumber,
  toDateFormat,
  todayForDatepicker,
  todayYYYYMMDD,
} from "./datetime.ts";
import { C, L, OP, P, PH, TE, US } from "./datastore.ts";
import { deserializeEntry, Entry, Lifelog, serializeEntry } from "./entries.ts";

import {
  generateDailyReport,
  generateReport,
  MonthlyReport,
  toReportResultBlocks,
} from "./reports.ts";
import {
  ActionId,
  AdminMenuItem,
  AppModeCode,
  BlockId,
  CallbackId,
  Emoji,
  EntryType,
  Label,
  MenuItem,
} from "./constants.ts";
import {
  AddEntryPrivateMetadata,
  AddLifelogPrivateMetadata,
  EditEntryPrivateMetadata,
  EditProjectPrivateMetadata,
  MainViewPrivateMetadata,
  ManualEntryPrivateMetadata,
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
    "close": QuitApp(language),
    "notify_on_close": true,
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

export function TitleManualEntry(language: string): PlainTextField {
  return buildTitle(i18n(Label.ManualEntry, language));
}
export function TitleAddEntry(language: string): PlainTextField {
  return buildTitle(i18n(Label.AddEntry, language));
}
export function TitleEditEntry(language: string): PlainTextField {
  return buildTitle(i18n(Label.EditEntry, language));
}

export function TitleStartLifelog(language: string): PlainTextField {
  return buildTitle(i18n(Label.StartLifelog, language));
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
export function QuitApp(language: string): PlainTextField {
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

// ----------------------
// AppMode options
// ----------------------

export function AppModeOptions(language: string): PlainTextOption[] {
  const options: PlainTextOption[] = [];
  for (
    const appMode of [
      { code: AppModeCode.Work, label: Label.AppMode_WorkOnly },
      {
        code: AppModeCode.WorkAndLifelogs,
        label: Label.AppMode_WorkAndLifelogs,
      },
    ]
  ) {
    options.push({
      "text": { "type": "plain_text", "text": i18n(appMode.label, language) },
      "value": appMode.code,
    });
  }
  return options;
}

// -----------------------------------------
// Main view
// -----------------------------------------

interface syncMainViewArgs {
  isDebugMode: boolean;
  isLifelogEnabled: boolean;
  manualEntryPermitted: boolean;
  viewId: string;
  entry: SavedAttributes<TE>;
  lifelog: SavedAttributes<L> | undefined;
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
  entry,
  lifelog,
  slackApi,
  offset,
  language,
  country,
  holidays,
  yyyymmdd,
  canAccessAdminFeature,
  isDebugMode,
  isLifelogEnabled,
  manualEntryPermitted,
}: syncMainViewArgs): Promise<ViewsUpdateResponse> {
  const privateMetadata: MainViewPrivateMetadata = { yyyymmdd };
  const view: ModalView = {
    "type": "modal",
    "callback_id": CallbackId.MainView,
    "private_metadata": JSON.stringify(privateMetadata),
    "title": TitleMain(language),
    "close": QuitApp(language),
    "blocks": await mainViewBlocks({
      isDebugMode,
      isLifelogEnabled,
      manualEntryPermitted,
      entry: entry,
      lifelog: lifelog,
      offset,
      language,
      country,
      holidays,
      canAccessAdminFeature,
      yyyymmdd,
    }),
  };
  return await slackApi.views.update({ view_id: viewId, view });
}

interface toMainViewArgs {
  isDebugMode: boolean;
  manualEntryPermitted: boolean;
  canAccessAdminFeature: () => Promise<boolean>;
  isLifelogEnabled: boolean;
  view: ModalView;
  offset: number;
  language: string;
  country: string | undefined;
  entry: SavedAttributes<TE>;
  lifelog: SavedAttributes<L> | undefined;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  yyyymmdd: string | undefined;
}
export async function toMainView(
  {
    isDebugMode,
    manualEntryPermitted,
    canAccessAdminFeature,
    isLifelogEnabled,
    view,
    offset,
    language,
    country,
    entry,
    lifelog,
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
    isLifelogEnabled,
    canAccessAdminFeature,
    offset,
    language,
    country,
    entry,
    lifelog,
    holidays,
    yyyymmdd,
  });
  return view;
}

interface mainViewBlocksArgs {
  isDebugMode: boolean;
  isLifelogEnabled: boolean;
  manualEntryPermitted: boolean;
  canAccessAdminFeature: () => Promise<boolean>;
  offset: number;
  language: string;
  country: string | undefined;
  entry: SavedAttributes<TE>;
  lifelog: SavedAttributes<L> | undefined;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  yyyymmdd: string | undefined;
}
export async function mainViewBlocks({
  isDebugMode,
  isLifelogEnabled,
  manualEntryPermitted,
  canAccessAdminFeature,
  offset,
  language,
  country,
  entry,
  lifelog,
  holidays,
  yyyymmdd,
}: mainViewBlocksArgs): Promise<AnyModalBlock[]> {
  interface MainViewItem {
    type: string;
    start: string;
    end?: string;
    what_to_do?: string | undefined;
    project_code?: string | undefined;
  }
  const entries: MainViewItem[] = (entry.work_entries || []).map((e) => {
    const entry = deserializeEntry(e)!;
    const item: MainViewItem = { ...entry, type: EntryType.Work };
    return item;
  })
    .concat((entry.break_time_entries || []).map((e) => {
      const entry = deserializeEntry(e)!;
      const item: MainViewItem = { ...entry, type: EntryType.BreakTime };
      return item;
    }))
    .concat((entry.time_off_entries || []).map((e) => {
      const entry = deserializeEntry(e)!;
      const item: MainViewItem = { ...entry, type: EntryType.TimeOff };
      return item;
    }))
    .concat((lifelog && lifelog.logs || []).map((raw) => {
      const entry = deserializeEntry(raw!) as Lifelog;
      const item: MainViewItem = { ...entry, type: EntryType.Lifelog };
      return item;
    }))
    .sort((a, b) => timeToNumber(a.start) > timeToNumber(b.start) ? 1 : -1);

  const entryBlocks: AnyModalBlock[] = [];
  let businessHours = false;
  let breakTime = false;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const { start, project_code, what_to_do, type } = entry;
    const end = entry.end ?? "";

    let typeLabel = "";
    let emoji = "";
    if (type === EntryType.Work) {
      const workTypeLabel = i18n(Label.Work, language);
      typeLabel = workTypeLabel;
      if (project_code) typeLabel += " [" + project_code + "]";
      emoji = Emoji.Work;
    } else if (type === EntryType.BreakTime) {
      typeLabel = i18n(Label.BreakTime, language);
      emoji = Emoji.BreakTime;
    } else if (type === EntryType.TimeOff) {
      typeLabel = i18n(Label.TimeOff, language);
      emoji = Emoji.TimeOff;
    } else if (type === EntryType.Lifelog) {
      typeLabel = what_to_do!;
      emoji = Emoji.Lifelog;
    }
    const options: PlainTextOption[] = [];
    if (end === "") {
      options.push({
        "text": { "type": "plain_text", "text": i18n(Label.Finish, language) },
        "value": `finish___${JSON.stringify(entry)}`,
      });
    }
    if (manualEntryPermitted) {
      options.push({
        "text": { "type": "plain_text", "text": i18n(Label.Edit, language) },
        "value": `edit___${JSON.stringify(entry)}`,
      });
    }
    options.push({
      "text": { "type": "plain_text", "text": i18n(Label.Delete, language) },
      "value": `delete___${JSON.stringify(entry)}`,
    });

    const label = `*${emoji} ${typeLabel}:* ${start} - ${end || ""}`;
    entryBlocks.push({
      "type": "section",
      "text": { "type": "mrkdwn", "text": label },
      "accessory": {
        "type": "overflow",
        "action_id": ActionId.EditOrFinishOrDeleteEntry,
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

  const r = generateDailyReport({ entry, lifelog, offset, language, country });
  if (isDebugMode) {
    console.log(`### Generated daily report: ${JSON.stringify(r, null, 2)}`);
  }

  const reportItems = [];
  if (r && r.work_minutes + r.break_time_hours + r.time_off_minutes > 0) {
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
  }
  if (r && r.lifelogs && r.lifelogs.length > 0) {
    reportItems.push("");
    for (const log of r.lifelogs) {
      if (log.spent_minutes) {
        reportItems.push(
          "*" + Emoji.Lifelog + " " + log.what_to_do + "*: " +
            hourDuration(log.spent_hours, language) + " " +
            minuteDuration(log.spent_minutes, language),
        );
      }
    }
  }
  const report = reportItems.join("\n");

  topBlocks.push({
    "type": "section",
    "text": { "type": "mrkdwn", "text": report + " " },
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
    const StartLifelogButton = quickButton({
      action_id: ActionId.StartLifelogInput,
      emoji: Emoji.Lifelog,
      label: Label.StartLifelog,
      style: "primary",
      language,
    });
    const FinishLifelogButton = quickButton({
      action_id: ActionId.FinishLifelog,
      emoji: Emoji.Lifelog,
      label: Label.FinishLifelog,
      style: "danger",
      language,
    });

    const workingOnLifelogItem = (lifelog?.logs)
      ? (lifelog.logs.filter((l) => {
        const end = deserializeEntry(l)?.end;
        return end === undefined || end === "";
      })?.length === 1)
      : false;

    if (businessHours) {
      if (breakTime) {
        topBlocks.push({
          "type": "actions",
          "elements": isLifelogEnabled
            ? workingOnLifelogItem
              ? [FinishBreakTimeButton, FinishLifelogButton]
              : [FinishBreakTimeButton, StartLifelogButton]
            : [FinishBreakTimeButton],
        });
      } else {
        topBlocks.push({
          "type": "actions",
          "elements": isLifelogEnabled
            ? workingOnLifelogItem
              ? [StartBreakTimeButton, FinishWorkButton, FinishLifelogButton]
              : [StartBreakTimeButton, FinishWorkButton, StartLifelogButton]
            : [StartBreakTimeButton, FinishWorkButton],
        });
      }
    } else {
      topBlocks.push({
        "type": "actions",
        "elements": isLifelogEnabled
          ? workingOnLifelogItem
            ? [StartWorkButton, StartBreakTimeButton, FinishLifelogButton]
            : [StartWorkButton, StartBreakTimeButton, StartLifelogButton]
          : [StartWorkButton, StartBreakTimeButton],
      });
    }
  }
  const blocks = topBlocks.concat(entryBlocks);

  if (manualEntryPermitted || isLifelogEnabled) {
    blocks.push({ "type": "divider" });
    blocks.push({
      "type": "section",
      "text": { "type": "mrkdwn", "text": " " },
      "accessory": {
        "type": "button",
        "action_id": ActionId.ManualEntry,
        "text": {
          "type": "plain_text",
          "text": Emoji.Writing + " " + i18n(Label.ManualEntry, language),
        },
        "value": "1",
      },
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
  defaultCountryId: string | undefined;
  language: string;
  country: string | undefined;
}

export function toUserSettingsView({
  view,
  settings,
  countries,
  defaultCountryId,
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
  const countryOptions = CountryOptions(countries, language);
  const countryId = settings.country_id ?? defaultCountryId;
  if (countryOptions && countryOptions.length > 0) {
    let selectedOption = countryOptions.find((c) => c.value === countryId);
    if (!selectedOption) {
      selectedOption = countryOptions.find((c) => c.value === country);
    }
    view.blocks.push({
      "type": "input",
      "block_id": BlockId.Country,
      "label": { "type": "plain_text", "text": i18n(Label.Country, language) },
      "element": {
        "type": "static_select",
        "action_id": ActionId.Input,
        "options": countryOptions,
        "initial_option": selectedOption,
      },
      "optional": true,
    });
  }

  const appModeOptions: PlainTextOption[] = AppModeOptions(language);
  const selectedAppModeOption =
    appModeOptions.find((c) => c.value === settings.app_mode) ||
    appModeOptions[0];
  view.blocks.push({
    "type": "input",
    "block_id": BlockId.AppMode,
    "label": { "type": "plain_text", "text": i18n(Label.AppMode, language) },
    "element": {
      "type": "static_select",
      "action_id": ActionId.Input,
      "options": appModeOptions,
      "initial_option": selectedAppModeOption,
    },
  });
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
  view.callback_id = CallbackId.StartWorkWithProject;
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
// StartLifelog view
// -----------------------------------------

interface toStartLifelogViewArgs {
  view: ModalView;
  language: string;
}
export function toStartLifelogView(
  { view, language }: toStartLifelogViewArgs,
): ModalView {
  view.callback_id = CallbackId.StartLifelog;
  view.title = TitleStartLifelog(language);
  view.submit = Submit(language);
  view.close = Back(language);
  view.blocks.push({
    "type": "input",
    "block_id": BlockId.WhatToDo,
    "label": { "type": "plain_text", "text": i18n(Label.WhatToDo, language) },
    "element": {
      "type": "external_select",
      "action_id": ActionId.LifelogSearch,
      "min_query_length": 0,
    },
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
  isLifelogEnabled: boolean;
}
export function toReportStartView({
  view,
  offset,
  language,
  isLifelogEnabled,
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
    { language, offset, isLifelogEnabled, blocks: view.blocks },
  );
  return view;
}

interface reportStartBlocksArgs {
  language: string;
  offset: number;
  blocks: AnyModalBlock[];
  isLifelogEnabled: boolean;
}
function reportStartBlocks(
  { language, offset, blocks, isLifelogEnabled }: reportStartBlocksArgs,
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

  if (isLifelogEnabled) {
    const option: PlainTextOption = {
      "text": {
        "type": "plain_text",
        "text": i18n(Label.IncludeLifelogs, language),
      },
      "value": "1",
    };
    blocks.push({
      "type": "input",
      "block_id": BlockId.IncludeLifelogs,
      "label": {
        "type": "plain_text",
        "text": i18n(Label.IncludeLifelogs, language),
      },
      "element": {
        "type": "checkboxes",
        "action_id": ActionId.Input,
        "options": [option],
        "initial_options": [option],
      },
      "optional": true,
    });
  }
}

interface toReportResultViewArgs {
  view: ModalView;
  month: string;
  user: string;
  email: string;
  entries: SavedAttributes<TE>[];
  lifelogs: SavedAttributes<L>[];
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
  entries,
  lifelogs,
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
    entries,
    lifelogs,
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
// Manual Entry view
// -----------------------------------------

interface newManualEntryViewArgs {
  isLifelogEnabled: boolean;
  manualEntryPermitted: boolean;
  language: string;
  yyyymmdd: string | undefined;
}
export function newManualEntryView({
  isLifelogEnabled,
  manualEntryPermitted,
  language,
  yyyymmdd,
}: newManualEntryViewArgs): ModalView {
  const privateMetadata: ManualEntryPrivateMetadata = { yyyymmdd };
  const options: PlainTextOption[] = [];
  if (manualEntryPermitted) {
    options.push({
      "text": {
        "type": "plain_text",
        "text": Emoji.Work + " " + i18n(Label.Work, language),
      },
      "value": EntryType.Work,
    });
    options.push({
      "text": {
        "type": "plain_text",
        "text": Emoji.BreakTime + " " + i18n(Label.BreakTime, language),
      },
      "value": EntryType.BreakTime,
    });
    options.push({
      "text": {
        "type": "plain_text",
        "text": Emoji.TimeOff + " " + i18n(Label.TimeOff, language),
      },
      "value": EntryType.TimeOff,
    });
  }
  if (isLifelogEnabled) {
    options.push({
      "text": {
        "type": "plain_text",
        "text": Emoji.Lifelog + " " + i18n(Label.Lifelog, language),
      },
      "value": EntryType.Lifelog,
    });
  }
  return {
    "type": "modal",
    "callback_id": CallbackId.ManualEntry,
    "title": TitleManualEntry(language),
    "close": Back(language),
    "private_metadata": JSON.stringify(privateMetadata),
    "blocks": [
      {
        "type": "section",
        "block_id": BlockId.Type,
        "text": {
          "type": "mrkdwn",
          "text": Emoji.Writing + " *" +
            i18n(Label.SelectManualEntryType, language) + "*",
        },
        "accessory": {
          "type": "radio_buttons",
          "action_id": ActionId.SelectManualEntryType,
          "options": options,
        },
      },
    ],
  };
}

// -----------------------------------------
// Add Lifelog view
// -----------------------------------------

interface newAddLifelogViewArgs {
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  offset: number;
  language: string;
  yyyymmdd: string;
}
export async function newAddLifelogView({
  holidays,
  offset,
  language,
  yyyymmdd,
}: newAddLifelogViewArgs): Promise<ModalView> {
  const privateMetadata: AddLifelogPrivateMetadata = { yyyymmdd };
  const time = nowHHMM(offset);
  const isHoliday = ((await holidays())?.holidays || []).includes(yyyymmdd);
  const emoji = isHoliday ? Emoji.Holiday : clockEmoji(time);
  return {
    "type": "modal",
    "callback_id": CallbackId.AddLifelog,
    "title": TitleAddEntry(language),
    "submit": Submit(language),
    "close": Back(language),
    "private_metadata": JSON.stringify(privateMetadata),
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `${emoji}  *${toDateFormat(offset, yyyymmdd)}*  ${emoji}`,
        },
      },
      {
        "type": "section",
        "block_id": BlockId.Type,
        "text": {
          "type": "mrkdwn",
          "text": Emoji.Lifelog + " *" + i18n(Label.Lifelog, language) + "*",
        },
      },
      {
        "type": "input",
        "block_id": BlockId.WhatToDo,
        "label": {
          "type": "plain_text",
          "text": i18n(Label.WhatToDo, language),
        },
        "element": {
          "type": "external_select",
          "action_id": ActionId.LifelogSearch,
          "min_query_length": 0,
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
    ],
  };
}

// -----------------------------------------
// Time Entry view
// -----------------------------------------

interface newAddEntryViewArgs {
  language: string;
  yyyymmdd: string;
  holidays: () => Promise<SavedAttributes<PH> | undefined>;
  projects: SavedAttributes<P>[] | undefined;
  entryType: string;
  offset: number;
}
export async function newAddEntryView({
  holidays,
  projects,
  entryType,
  offset,
  language,
  yyyymmdd,
}: newAddEntryViewArgs): Promise<ModalView> {
  const privateMetadata: AddEntryPrivateMetadata = {
    entry_type: entryType,
    yyyymmdd,
  };
  const view: ModalView = {
    "type": "modal",
    "callback_id": CallbackId.AddEntry,
    "title": TitleAddEntry(language),
    "submit": Submit(language),
    "close": Back(language),
    "private_metadata": JSON.stringify(privateMetadata),
    "blocks": [],
  };

  const time = nowHHMM(offset);
  const isHoliday = ((await holidays())?.holidays || []).includes(yyyymmdd);
  const emoji = isHoliday ? Emoji.Holiday : clockEmoji(time);
  let entryTypeLabel = `*${i18n(Label.EntryType, language)}*\n`;
  if (entryType === EntryType.Work) {
    entryTypeLabel += Emoji.Work + " " + i18n(Label.Work, language);
  } else if (entryType === EntryType.BreakTime) {
    entryTypeLabel += Emoji.BreakTime + " " + i18n(Label.BreakTime, language);
  } else if (entryType === EntryType.TimeOff) {
    entryTypeLabel += Emoji.TimeOff + " " + i18n(Label.TimeOff, language);
  }
  view.blocks = [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": `${emoji}  *${toDateFormat(offset, yyyymmdd)}*  ${emoji}`,
      },
    },
    { "type": "divider" },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": entryTypeLabel },
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
  }
  return view;
}

interface newEditEntryViewArgs {
  entry: Entry;
  type: string;
  language: string;
  yyyymmdd: string | undefined;
  p: DataMapper<P>;
  projectCodeEnabled: boolean;
}
export async function newEditEntryView({
  entry,
  type,
  language,
  yyyymmdd,
  p,
  projectCodeEnabled,
}: newEditEntryViewArgs): Promise<ModalView> {
  const privateMetadata: EditEntryPrivateMetadata = {
    "edit_target": serializeEntry(entry),
    "type": type,
    "yyyymmdd": yyyymmdd,
  };
  const view: ModalView = {
    "type": "modal",
    "callback_id": CallbackId.EditEntry,
    "title": TitleEditEntry(language),
    "submit": Submit(language),
    "close": Back(language),
    "private_metadata": JSON.stringify(privateMetadata),
    "blocks": [],
  };

  let entryTypeLabel = `*${i18n(Label.EntryType, language)}*\n`;
  if (entry.type === EntryType.Work) {
    entryTypeLabel += Emoji.Work + " " + i18n(Label.Work, language);
  } else if (entry.type === EntryType.BreakTime) {
    entryTypeLabel += Emoji.BreakTime + " " + i18n(Label.BreakTime, language);
  } else if (entry.type === EntryType.TimeOff) {
    entryTypeLabel += Emoji.TimeOff + " " + i18n(Label.TimeOff, language);
  } else if (entry.type === EntryType.Lifelog) {
    entryTypeLabel += Emoji.Lifelog + " " + i18n(Label.Lifelog, language);
  }
  view.blocks = [
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": entryTypeLabel },
    },
    { "type": "divider" },
  ];

  if (entry.type === EntryType.Lifelog) {
    view.blocks.push({
      "type": "input",
      "block_id": BlockId.WhatToDo,
      "label": { "type": "plain_text", "text": i18n(Label.WhatToDo, language) },
      "element": {
        "type": "external_select",
        "action_id": ActionId.LifelogSearch,
        "min_query_length": 0,
        "initial_option": {
          text: { type: "plain_text", text: entry.what_to_do! },
          value: entry.what_to_do!,
        },
      },
    });
  }
  view.blocks.push({
    "type": "input",
    "block_id": BlockId.Start,
    "label": { "type": "plain_text", "text": i18n(Label.Start, language) },
    "element": {
      "type": "timepicker",
      "action_id": ActionId.Input,
      "initial_time": entry.start,
    },
  });
  if (entry.end !== undefined && entry.end !== "") {
    view.blocks.push({
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
    view.blocks.push({
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
  return view;
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
// Lifelogs
// -----------------------------------------

interface lifelogSearchResultOptionsArgs {
  keyword: string;
  recentLogs: SavedAttributes<L>[];
}
export function lifelogSearchResultOptions(
  { keyword, recentLogs }: lifelogSearchResultOptionsArgs,
): ExternalSelectOption[] {
  const ranking: Record<string, number> = {};
  for (const dailyLogs of recentLogs) {
    for (const log of dailyLogs.logs) {
      const e: Lifelog = JSON.parse(log);
      if (e && e.what_to_do) {
        ranking[e.what_to_do] = (ranking[e.what_to_do] || 0) + 1;
      }
    }
  }
  let exactlyMatched = false;
  const matched = Object.entries(ranking)
    .filter(([what, _]) => {
      if (keyword === "") return true;
      if (!exactlyMatched) exactlyMatched = what === keyword;
      return what.includes(keyword);
    })
    .sort((a, b) => {
      return a[1] > b[1] ? -1 : 1;
    })
    .slice(0, 50);

  const options: ExternalSelectOption[] = matched.map(([what, _]) => {
    return {
      text: { type: "plain_text", text: what },
      value: what,
    };
  });
  if (keyword && !exactlyMatched) {
    options.push({
      text: { type: "plain_text", text: keyword },
      value: keyword,
    });
  }
  return options;
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
}: syncProjectMainViewArgs): Promise<ViewsUpdateResponse> {
  return await slackApi.views.update({
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

interface newAddProjectViewArgs {
  language: string;
}
export function newAddProjectView({
  language,
}: newAddProjectViewArgs): ModalView {
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
  return {
    "type": "modal",
    "callback_id": CallbackId.AddProject,
    "title": TitleAddProject(language),
    "submit": Submit(language),
    "close": Back(language),
    "blocks": blocks,
  };
}

interface newEditProjectViewArgs {
  code: string;
  language: string;
  project: SavedAttributes<P>;
}
export function newEditProjectView({
  code,
  language,
  project,
}: newEditProjectViewArgs): ModalView {
  const privateMetaedata: EditProjectPrivateMetadata = { code };
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
      "text": i18n(Label.ProjectCode, language) + ": " + project.code,
    },
  });
  blocks.push({
    "type": "input",
    "block_id": BlockId.ProjectName,
    "label": label(Label.ProjectName),
    "element": plainTextInput(project.name, false),
    "optional": false,
  });

  const isActiveBlockElement: Checkboxes = {
    "type": "checkboxes",
    "action_id": ActionId.Input,
    "options": [isActiveOption],
  };
  if (project.is_active) {
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
    "element": plainTextInput(project.description || "", true),
    "optional": true,
  });
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
    let selectedOption = details.mustSelectOne ? options[0] : undefined;
    const saved = policies.find((p) => p.key === key);
    if (saved) {
      const savedOption = options.find((o) =>
        o.value === key + "___" + saved.value
      );
      if (savedOption) selectedOption = savedOption;
    }
    const element: StaticSelect = {
      "type": "static_select",
      "action_id": ActionId.OrganizationPolicyChange,
      "options": options,
    };
    if (selectedOption) element.initial_option = selectedOption;
    view.blocks.push({
      "type": "section",
      "text": { "type": "mrkdwn", "text": i18n(details.label, language) },
      "accessory": element,
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
    { language, offset, isLifelogEnabled: false, blocks: view.blocks },
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
      const e = deserializeEntry(w);
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
