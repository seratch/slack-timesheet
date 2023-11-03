import { DataMapper, SavedAttributes } from "deno-slack-data-mapper/mod.ts";

import { BlockId, EntryType, Label } from "./constants.ts";
import { P, TE } from "./datastore.ts";
import { timeToNumber } from "./datetime.ts";
import { deserializeEntry, serializeEntry } from "./entries.ts";
import { i18n } from "./i18n.ts";

// -----------------------------------------
// Lifelog
// -----------------------------------------

interface validateLifelogArgs {
  start: string;
  end: string;
  what_to_do: string;
  language: string;
}
export function validateLifelog(
  { start, end, what_to_do, language }: validateLifelogArgs,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const _start = timeToNumber(start);
  const _end = end && end !== "" ? timeToNumber(end) : undefined;
  if (_end && _start >= _end) {
    errors[BlockId.End] = i18n(Label.InvalidStartAndEnd, language);
    return errors;
  }
  if (what_to_do.length > 50) {
    // You can customize as necessary
    errors[BlockId.WhatToDo] = i18n(Label.TooLongInput, language);
  }
  return errors;
}

// -----------------------------------------
// Time Entry
// -----------------------------------------

interface validateTimeEntrySubmissionArgs {
  type: string;
  start: string;
  end: string;
  project_code: string | undefined;
  edit_target: string | undefined;
  entry: SavedAttributes<TE>;
  language: string;
}

export function validateTimeEntrySubmission(
  { type, start, end, edit_target, entry, language }:
    validateTimeEntrySubmissionArgs,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const editTarget = edit_target ? serializeEntry(edit_target) : undefined;
  const _start = timeToNumber(start);
  const _end = end && end !== "" ? timeToNumber(end) : undefined;
  if (_end && _start >= _end) {
    errors[BlockId.End] = i18n(Label.InvalidStartAndEnd, language);
    return errors;
  }
  if (_end && type === EntryType.Work) {
    for (const e of (entry.work_entries || [])) {
      if (editTarget && serializeEntry(e) === editTarget) {
        continue;
      }
      const errors = detectTimeEntryConflicts({
        language,
        rawEntry: e,
        start: _start,
        end: _end,
      });
      if (errors && Object.keys(errors).length > 0) {
        return errors;
      }
    }
  } else if (_end && type === EntryType.BreakTime) {
    for (const e of (entry.break_time_entries || [])) {
      if (editTarget && serializeEntry(e) === editTarget) {
        continue;
      }
      const errors = detectTimeEntryConflicts({
        language,
        rawEntry: e,
        start: _start,
        end: _end,
      });
      if (errors && Object.keys(errors).length > 0) {
        return errors;
      }
    }
  } else if (_end && type === EntryType.TimeOff) {
    for (const e of (entry.time_off_entries || [])) {
      if (editTarget && serializeEntry(e) === editTarget) {
        continue;
      }
      const errors = detectTimeEntryConflicts({
        language,
        rawEntry: e,
        start: _start,
        end: _end,
      });
      if (errors && Object.keys(errors).length > 0) {
        return errors;
      }
    }
  }
  return errors;
}

interface detectTimeEntryConflictsArgs {
  language: string;
  rawEntry: string;
  start: number;
  end: number;
}
function detectTimeEntryConflicts(
  { language, rawEntry, start, end }: detectTimeEntryConflictsArgs,
): Record<string, string> | undefined {
  const errors: Record<string, string> = {};
  const entry = deserializeEntry(rawEntry);
  if (!entry) return undefined;

  const [s, e] = [timeToNumber(entry.start), timeToNumber(entry.end)];
  if (start >= s && start < e) {
    errors[BlockId.Start] = i18n(Label.ConflictErrorMessage, language);
  }
  if (end > s && end <= e) {
    errors[BlockId.End] = i18n(Label.ConflictErrorMessage, language);
  }
  if (Object.keys(errors).length > 0) return errors;
  else return undefined;
}

// -----------------------------------------
// Projects
// -----------------------------------------

interface validateProjectSubmissionArgs {
  code: string | undefined;
  name: string;
  is_active: boolean;
  description: string | null | undefined;
  p: DataMapper<P>;
  language: string;
}
export async function validateProjectSubmission(
  { code, name, description, p, language }: validateProjectSubmissionArgs,
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (code !== undefined && code.length > 20) {
    // You can customize as necessary
    errors[BlockId.ProjectCode] = i18n(Label.TooLongInput, language);
  } else if (code !== undefined && !areAllCharsAllowedForProjectCode(code)) {
    errors[BlockId.ProjectCode] = i18n(
      Label.ProjectCodeTextValidationError,
      language,
    );
  } else if (code && (await p.findById(code)).item.code != undefined) {
    errors[BlockId.ProjectCode] = i18n(Label.CodeAlreadyExists, language);
  }
  if (name.length > 50) {
    // You can customize as necessary
    errors[BlockId.ProjectName] = i18n(Label.TooLongInput, language);
  }
  if (description && description.length > 500) {
    errors[BlockId.ProjectDescription] = i18n(Label.TooLongInput, language);
  }
  return errors;
}

const PROJECT_CODE_PATTERN = /^[a-zA-Z0-9_-]*$/;
export function areAllCharsAllowedForProjectCode(code: string): boolean {
  return PROJECT_CODE_PATTERN.test(code);
}
