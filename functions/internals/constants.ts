export class CallbackId {
  // Main
  static MainView = "main_view";
  // Time entries
  static StartWorkWithProject = "start_work_with_project";
  static ManualEntry = "manual_entry";
  static AddEntry = "add_entry";
  static EditEntry = "edit_entry";
  static StartLifelog = "start_lifelog";
  static AddLifelog = "add_lifelog";
  // Menu
  static UserSettings = "user_settings";
  static Calendar = "calendar";
  static ReportStart = "report_start";
  static ReportResult = "report_result";
  static AdminMenu = "admin_menu";
  // Admin Menu
  static ProjectMainView = "project_main_view";
  static AddProject = "add_project";
  static EditProject = "edit_project";
  static OrganizationPolicies = "organization_policies";
  static AdminReportDownload = "admin_report_download";
}

export class BlockId {
  // User settings
  static Language = "language";
  static Country = "country";
  static AppMode = "app_mode";
  // Time entries / Lifelogs
  static Date = "date";
  static Type = "type";
  static WhatToDo = "what_to_do";
  static Start = "start";
  static End = "end";
  // Monthly report
  static IncludeLifelogs = "include_lifelogs";
  static Year = "year";
  static Month = "month";
  // Admin menu
  static AdminMenu = "admin_menu";
  // Projects
  static ProjectCode = "code";
  static ProjectName = "name";
  static ProjectIsActive = "is_active";
  static ProjectDescription = "description";
}

export class ActionId {
  // input blocks
  static Input = "input"; // default placehoder
  static ProjectCodeSearch = "project_code_search";
  static LifelogSearch = "lifelog_search";

  // section/actions blocks
  // Time entries / Lifelogs
  static ManualEntry = "manual_entry";
  static SelectManualEntryType = "select_manual_entry_type";
  static AddLifelog = "add_lifelog";
  static EditOrFinishOrDeleteEntry = "edit_or_finish_or_delete_entry";
  static StartWork = "start_work";
  static FinishWork = "finish_work";
  static StartBreakTime = "start_break_time";
  static FinishBreakTime = "finish_break_time";
  static StartLifelogInput = "start_lifelog_input";
  static FinishLifelog = "finish_lifelog";
  // Menu
  static Menu = "menu";
  static Refresh = "refresh";
  static SendReportInDM = "send_report_in_dm";
  // Admin menu
  static AdminMenu = "admin_menu";
  static AddProject = "add_project";
  static EditProject = "edit_project";
  static OrganizationPolicyChange = "organization_policy_change";
}

export class MenuItem {
  static BackToToday = "back_to_today";
  static UserSettings = "user_settings";
  static Calendar = "calendar";
  static MonthlyReport = "monthly_report";
  static AdminMenu = "admin_menu";
}

export class AdminMenuItem {
  static AdminReportDownload = "admin_report_download";
  static OrganizationPolicies = "organization_policies";
  static ProjectSettings = "project_settings";
}

export class Emoji {
  static Work = ":briefcase:";
  static BreakTime = ":knife_fork_plate:";
  static TimeOff = ":no_bell:";
  static Holiday = ":palm_tree:";
  static Lifelog = ":ledger:";
  static Writing = ":writing_hand:";
  static ActiveProject = ":white_check_mark:";
  static SuspendedProject = ":ballot_box_with_check:";
  static Refresh = ":arrows_counterclockwise:";
  static BackToToday = ":leftwards_arrow_with_hook:";
  static Calendar = ":calendar:";
  static MonthlyReport = ":bookmark_tabs:";
  static UserSettings = ":gear:";
  static AdminOnly = ":lock:";
  static Warning = ":warning:";
}

export class Label {
  static AppName = "Timesheet";
  static AddEntry = "Add Entry";
  static EditEntry = "Edit Entry";
  static Back = "Back";
  static Next = "Next";
  static QuitApp = "Quit App";
  static Submit = "Submit";
  static Save = "Save";
  static RefreshButton = "Refresh";
  static Language = "Language";
  static Country = "Country";
  static AppMode = "App Mode";
  static Work = "Work";
  static OvertimeWork = "Overtime Work";
  static NightShiftWork = "Night Shift Work";
  static BreakTime = "Break time";
  static TimeOff = "Time off";
  static Holiday = "Holiday";
  static Lifelog = "Lifelog";
  static NumOfWorkingDays = "# of Working Days";
  static BackToToday = "Today";
  static UserSettings = "User Settings";
  static Calendar = "Calendar";
  static MonthlyReport = "Monthly Report";
  static AdminMenu = "Admin Menu";
  static ProjectMain = "Projects";
  static ProjectSummary = "Projects";
  static LifelogSummary = "Lifelogs";
  static AddProject = "Add Project";
  static EditProject = "Edit Project";
  static ProjectSettings = "Project Settings";
  static OrganizationPolicies = "Organization Policies";
  static AdminReportDownload = "Admin Report Download";
  static StartWork = "Start work";
  static FinishWork = "Finish work";
  static StartBreakTime = "Start break time";
  static FinishBreakTime = "Finish break time";
  static StartLifelog = "Start lifelog";
  static FinishLifelog = "Finish lifelog";
  static Start = "Start";
  static End = "End";
  static WhatToDo = "What to do";
  static IncludeLifelogs = "Include lifelogs";
  static Add = "Add";
  static Edit = "Edit";
  static Delete = "Delete";
  static Finish = "Finish";
  static ManualEntry = "Manual entry";
  static EntryType = "Entry Type";
  static Year = "Year";
  static Month = "Month";
  static Date = "Date";
  static SendThisInDM = "Send this in DM";
  static ReceiveReportInDM = "Receive report in DM";
  static days = "days";
  static hours = "hours";
  static minutes = "minutes";
  static day = "day";
  static hour = "hour";
  static minute = "minute";

  // Countries
  static Japan = "Japan";
  static UnitedStates = "United States";

  // AppMode
  static AppMode_WorkOnly = "Work management";
  static AppMode_WorkAndLifelogs = "Work and lifelogs";

  // Manual entry
  static SelectManualEntryType = "Select entry type:";

  // Report UI messages
  static HereIsTheReportYouRequested =
    "Here is the monthly report you requested!";
  // Admin features
  static ProjectMainPageGuide =
    ":wave: As an admin, you have the capability to manage project codes, setting them for each work entry. When there is at least one active code, app users will be prompted to assign a project code to their entry.";
  static ProjectCode = "Project Code";
  static ProjectName = "project Name";
  static ProjectIsActive = "Is Active";
  static ProjectDescription = "Description";
  static ManualEntryPermitted = "Manual Entry Permitted";
  static OrganizationPolicyValue_Permitted = "Permitted";
  static OrganizationPolicyValue_Restricted = "Restricted";
  // Admin report UI messages
  static ReportHasBeenSentInDM =
    ":wave: The report file has been sent to you in DM!";
  static FailedToGenerateReport =
    ":x: Failed to generate a report for you! Please contact the maintainers of this app.";

  // Error messages
  static InvalidStartAndEnd =
    "The combination of start and end seems to be incorrect";
  static ConflictErrorMessage = "There may be a conflict with existing entries";
  static TooLongInput = "Too long input";
  static ProjectCodeTextValidationError =
    "A project code can consist of alphanumeric characters, dashes (-), and underscores(_).";
  static CodeAlreadyExists = "The code already exists";

  // Labor laws
  static LaborLawOfJapan_BreakTimeFor6WorkHours =
    "Under the Labor Laws of Japan, you are entitled to a 45-minute break if your working time exceeds 6 hours.";
  static LaborLawOfJapan_BreakTimeFor8WorkHours =
    "Under the Labor Laws of Japan, you are entitled to a 1-hour break if your working time exceeds 8 hours.";
}

export class LanguageCode {
  static Japanese = "ja";
  static English = "en";
}

export class EntryType {
  static Work = "work";
  static BreakTime = "break_time";
  static TimeOff = "time_off";
  static Lifelog = "lifelog";
}

export class CountryCode {
  static UnitedStates = "us";
  static Japan = "jp";
}

export class AppModeCode {
  static Work = "work";
  static WorkAndLifelogs = "work_and_lifelogs";
}
