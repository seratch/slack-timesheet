export class CallbackId {
  static MainView = "main_view";
  static AddEntry = "add_entry";
  static EditEntry = "edit_entry";
  static UserSettings = "user_settings";
  static StartWorkWithProjectCode = "start_work_with_project_code";
  static Calendar = "calendar";
  static ReportStart = "report_start";
  static ReportResult = "report_result";
  static ProjectMainView = "project_main_view";
  static AddProject = "add_project";
  static EditProjct = "edit_project";
}

export class BlockId {
  static Language = "language";
  static Country = "country";
  static Date = "date";
  static Year = "year";
  static Month = "month";
  static Type = "type";
  static Start = "start";
  static End = "end";
  static ProjectCode = "code";
  static ProjectName = "name";
  static ProjectIsActive = "is_active";
  static ProjectDescription = "description";
}

export class ActionId {
  // input blocks
  static Input = "input";
  static ProjectCodeSearch = "project_code_search";
  // section/actions blocks
  static SendReportInDM = "send_report_in_dm";
  static AddEntry = "add_entry";
  static EditOrDeleteEntry = "edit_or_delete_entry";
  static Menu = "menu";
  static StartBreakTime = "start_break_time";
  static FinishBreakTime = "finish_break_time";
  static StartWork = "start_work";
  static FinishWork = "finish_work";
  static Refresh = "refresh";
  static AddProject = "add_project";
  static EditProject = "edit_project";
}

export class MenuItem {
  static MoveToToday = "move_to_today";
  static UserSettings = "user_settings";
  static Calendar = "calendar";
  static MonthlyReport = "monthly_report";
  static ProjectSettings = "project_settings";
}

export class Emoji {
  static Work = ":briefcase:";
  static BreakTime = ":knife_fork_plate:";
  static TimeOff = ":no_bell:";
  static Holiday = ":palm_tree:";
  static ActiveProject = ":white_check_mark:";
  static SuspendedProject = ":ballot_box_with_check:";
  static Refresh = ":arrows_counterclockwise:";
}

export class Label {
  static AppName = "Timesheet";
  static AddEntry = "Add Entry";
  static EditEntry = "Edit Entry";
  static Back = "Back";
  static Next = "Next";
  static GenerateReport = "Generate Report";
  static QuitApp = "Quit App";
  static Submit = "Submit";
  static Save = "Save";
  static RefreshButton = "Refresh";
  static Language = "Language";
  static Country = "Country";
  static Japan = "Japan";
  static Work = "Work";
  static BreakTime = "Break time";
  static TimeOff = "Time off";
  static Holiday = "Holiday";
  static MoveToToday = "Today";
  static UserSettings = "User Settings";
  static Calendar = "Calendar";
  static MonthlyReport = "Monthly Report";
  static ProjectMain = "Projects";
  static ProjectSummary = "Project Summary";
  static AddProject = "Add Project";
  static EditProject = "Edit Project";
  static ProjectSettings = "Project Settings";
  static StartWork = "Start work";
  static FinishWork = "Finish work";
  static StartBreakTime = "Start break time";
  static FinishBreakTime = "Finish break time";
  static Start = "Start";
  static End = "End";
  static Add = "Add";
  static Edit = "Edit";
  static Delete = "Delete";
  static AddAnEntry = "Add an entry";
  static InputType = "Input Type";
  static Year = "Year";
  static Month = "Month";
  static Date = "Date";
  static SendThisInDM = "Send this in DM";
  static HereIsTheReportYouRequested =
    "Here is the monthly report you requested!";
  static days = "days";
  static hours = "hours";
  static minutes = "minutes";
  static day = "day";
  static hour = "hour";
  static minute = "minute";
  static InvalidStartAndEnd =
    "The combination of start and end seems to be incorrect";
  static ConflictErrorMessage = "There may be a conflict with existing entries";
  static ProjectMainPageGuide =
    ":wave: As an admin, you have the capability to manage project codes, setting them for each work entry. When there is at least one active code, app users will be prompted to assign a project code to their entry.";
  static ProjectCode = "Project Code";
  static ProjectName = "project Name";
  static ProjectIsActive = "Is Active";
  static ProjectDescription = "Description";
  static TooLongInput = "Too long input";
  static ProjectCodeTextValidationError =
    "A project code can consist of alphanumeric characters, dashes (-), and underscores(_).";
  static CodeAlreadyExists = "The code already exists";
}

export class EntryType {
  static Work = "work";
  static BreakTime = "break_time";
  static TimeOff = "time_off";
}
