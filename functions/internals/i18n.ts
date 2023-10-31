import { Label } from "./constants.ts";

const labels: Record<string, Record<string, string>> = {};
labels[Label.AppName] = { "ja": "タイムシート" };
labels[Label.AddEntry] = { "ja": "自由入力" };
labels[Label.EditEntry] = { "ja": "入力編集" };
labels[Label.Back] = { "ja": "戻る" };
labels[Label.Next] = { "ja": "次へ" };
labels[Label.QuitApp] = { "ja": "アプリを終了する" };
labels[Label.Submit] = { "ja": "送信する" };
labels[Label.Save] = { "ja": "保存する" };
labels[Label.RefreshButton] = { "ja": "更新" };
labels[Label.Language] = { "ja": "言語" };
labels[Label.Country] = { "ja": "国" };
labels[Label.Japan] = { "ja": "日本" };
labels[Label.Work] = { "ja": "勤務" };
labels[Label.BreakTime] = { "ja": "休憩" };
labels[Label.TimeOff] = { "ja": "休暇" };
labels[Label.Holiday] = { "ja": "祝日" };
labels[Label.BackToToday] = { "ja": "今日の画面へ移動" };
labels[Label.UserSettings] = { "ja": "ユーザー設定" };
labels[Label.Calendar] = { "ja": "カレンダー" };
labels[Label.MonthlyReport] = { "ja": "月次レポート" };
labels[Label.AdminMenu] = { "ja": "管理者メニュー" };
labels[Label.ProjectSettings] = { "ja": "プロジェクト設定" };
labels[Label.OrganizationPolicies] = { "ja": "組織ポリシー" };
labels[Label.AdminReportDownload] = { "ja": "管理者向けレポートダウンロード" };
labels[Label.ProjectMain] = { "ja": "プロジェクト" };
labels[Label.ProjectSummary] = { "ja": "プロジェクトのサマリー" };
labels[Label.AddProject] = { "ja": "プロジェクト追加" };
labels[Label.EditProject] = { "ja": "プロジェクト編集" };
labels[Label.StartWork] = { "ja": "勤務開始" };
labels[Label.FinishWork] = { "ja": "勤務終了" };
labels[Label.StartBreakTime] = { "ja": "休憩開始" };
labels[Label.FinishBreakTime] = { "ja": "休憩終了" };
labels[Label.Start] = { "ja": "開始" };
labels[Label.End] = { "ja": "終了" };
labels[Label.Add] = { "ja": "追加" };
labels[Label.Edit] = { "ja": "編集" };
labels[Label.Delete] = { "ja": "削除" };
labels[Label.Date] = { "ja": "年月日" };
labels[Label.AddAnEntry] = { "ja": "自由入力" };
labels[Label.InputType] = { "ja": "種別" };
labels[Label.Year] = { "ja": "年" };
labels[Label.Month] = { "ja": "月" };
labels[Label.SendThisInDM] = { "ja": "このレポートを DM で送る" };
labels[Label.ReceiveReportInDM] = { "ja": "レポートを DM で受け取る" };
labels[Label.HereIsTheReportYouRequested] = {
  "ja": "こちらがご希望の月次レポートです！",
};
labels[Label.days] = { "ja": "日" };
labels[Label.hours] = { "ja": "時間" };
labels[Label.minutes] = { "ja": "分" };
labels[Label.day] = { "ja": "日" };
labels[Label.hour] = { "ja": "時間" };
labels[Label.minute] = { "ja": "分" };
labels[Label.ConflictErrorMessage] = { "ja": "入力済の時間帯と重複しています" };
labels[Label.InvalidStartAndEnd] = {
  "ja": "開始と終了の時刻の組み合わせが不正です",
};
labels[Label.ProjectMainPageGuide] = {
  "ja":
    ":wave: 管理者はこのページでプロジェクトを管理できます。一つ以上有効なコードがある場合、ユーザーは勤務登録時に指定するよう促されます。",
};
labels[Label.ReportHasBeenSentInDM] = {
  "ja": ":wave: 作成したレポートを DM でお送りしました！",
};
labels[Label.FailedToGenerateReport] = {
  "ja":
    ":x: レポートの作成に失敗しました。このアプリのメンテナーにご連絡ください。",
};
labels[Label.ProjectCode] = { "ja": "プロジェクトコード" };
labels[Label.ProjectName] = { "ja": "プロジェクト名" };
labels[Label.ProjectIsActive] = { "ja": "利用可能" };
labels[Label.ProjectDescription] = { "ja": "説明・メモ" };
labels[Label.TooLongInput] = { "ja": "入力が長すぎます" };
labels[Label.CodeAlreadyExists] = { "ja": "このコードはすでに存在しています" };
labels[Label.ProjectCodeTextValidationError] = {
  "ja": "コードには英数字か '-', '_' のみを使用できます",
};
labels[Label.ManualEntryPermitted] = { "ja": "履歴の手入力・編集を許可する" };
labels[Label.OrganizationPolicyValue_Permitted] = { "ja": "可" };
labels[Label.OrganizationPolicyValue_Restricted] = { "ja": "不可" };

export function i18n(english: string, language: string): string {
  const entry = labels[english];
  const found = entry ? entry[language] : undefined;
  return found ? found : english;
}
