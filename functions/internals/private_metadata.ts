export type PrivateMetadata =
  | MainViewPrivateMetadata
  | ReportPrivateMetadata
  | AddEntryPrivateMetadata
  | EditEntryPrivateMetadata;

export interface MainViewPrivateMetadata {
  yyyymmdd: string | undefined;
}

export interface ReportPrivateMetadata {
  yyyymmdd: string;
}

export interface ManualEntryPrivateMetadata {
  yyyymmdd: string | undefined;
}

export interface AddLifelogPrivateMetadata {
  yyyymmdd: string | undefined;
}

export interface AddEntryPrivateMetadata {
  yyyymmdd: string | undefined;
  entry_type: string;
}

export interface EditEntryPrivateMetadata {
  edit_target: string;
  type: string;
  yyyymmdd: string | undefined;
}

export interface EditProjectPrivateMetadata {
  code: string;
}
