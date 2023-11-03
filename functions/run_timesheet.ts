import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { Attributes, SavedAttributes } from "deno-slack-data-mapper/mod.ts";
import { ModalView } from "slack-web-api-client/mod.ts";

import { injectComponents } from "./internals/components.ts";
import {
  ActionId,
  AdminMenuItem,
  AppModeCode,
  BlockId,
  CallbackId,
  EntryType,
  Label,
  MenuItem,
} from "./internals/constants.ts";
import {
  generateReport,
  MonthlyReport,
  shareAdminReportJSONFile,
  shareReportJSONFile,
} from "./internals/reports.ts";
import { nowHHMM, toDateFormat, todayYYYYMMDD } from "./internals/datetime.ts";
import {
  lifelogSearchResultOptions,
  newAddEntryView,
  newAddLifelogView,
  newAddProjectView,
  newEditEntryView,
  newEditProjectView,
  newManualEntryView,
  newView,
  projectSearchResultOptions,
  stateValue,
  syncMainView,
  syncProjectMainView,
  toAdminMenuView,
  toAdminReportDownloadCompletionView,
  toAdminReportDownloadView,
  toCalendarView,
  toMainView,
  toOrganizationPoliciesView,
  toProjectMainView,
  toReportResultView,
  toReportStartView,
  toStartLifelogView,
  toStartWorkWithProjectCodeView,
  toUserSettingsView,
} from "./internals/views.ts";
import {
  fetchAllActiveProjects,
  fetchAllCountries,
  fetchAllMemberMonthTimeEntries,
  fetchAllProjects,
  fetchLifelog,
  fetchMonthLifelogs,
  fetchMonthTimeEntries,
  fetchProject,
  fetchRecentLifelogs,
  fetchRecentTimeEntries,
  fetchTimeEntry,
  hasActiveProjects,
  isLifelogRecord,
  L,
  P,
  saveLifelog,
  saveProject,
  saveTimeEntry,
  saveUserSettings,
  setupCountriesAndHolidaysIfNecessary,
  TE,
  US,
} from "./internals/datastore.ts";
import {
  deserializeEntry,
  Lifelog,
  serializeEntry,
  toComparable,
} from "./internals/entries.ts";
import {
  AddEntryPrivateMetadata,
  AddLifelogPrivateMetadata,
  EditEntryPrivateMetadata,
  EditProjectPrivateMetadata,
  ReportPrivateMetadata,
} from "./internals/private_metadata.ts";
import {
  validateLifelog,
  validateProjectSubmission,
  validateTimeEntrySubmission,
} from "./internals/validation.ts";
import {
  fetchOrganizationCountryId,
  isManualEntryPermitted,
  OrganizationPolices,
} from "./internals/organization_policies.ts";
import { i18n } from "./internals/i18n.ts";
import { fetchUserDetails } from "./internals/slack_api.ts";

export const def = DefineFunction({
  callback_id: "run_timesheet",
  title: "Run Timesheet App",
  source_file: "functions/run_timesheet.ts",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      user_id: { type: Schema.slack.types.user_id },
    },
    required: ["interactivity", "user_id"],
  },
  output_parameters: { properties: {}, required: [] },
});

export default SlackFunction(
  def,
  async (args) => {
    // --------------------------------------------
    // Launch the app
    // --------------------------------------------
    const {
      inputs: {
        user_id,
        interactivity: { interactivity_pointer },
      },
    } = args;
    const components = await injectComponents({ ...args });
    const { language, settings, isDebugMode, isLifelogEnabled } = components;
    let view: ModalView = newView(language);
    if (!settings.user) {
      if (isDebugMode) {
        console.log(`### First time user (settings: ${p(settings)})`);
      }
      let countries = await fetchAllCountries({ ...components });
      countries = await setupCountriesAndHolidaysIfNecessary({
        ...components,
        countries,
      });
      const defaultCountryId = await fetchOrganizationCountryId({
        ...components,
      });
      view = toUserSettingsView({
        view,
        countries,
        defaultCountryId,
        ...components,
      });
    } else {
      const entry = await fetchTimeEntry({ ...components });
      const lifelog = isLifelogEnabled
        ? await fetchLifelog({ ...components })
        : undefined;
      const manualEntryPermitted = await isManualEntryPermitted({
        ...components,
      });
      if (isDebugMode) {
        console.log(
          `### Main view (entry: ${p(entry)}, settings: ${p(settings)})`,
        );
      }
      view = await toMainView(
        { view, entry, lifelog, manualEntryPermitted, ...components },
      );
    }
    try {
      await components.slackApi.views.open(
        { trigger_id: interactivity_pointer, view },
      );
    } catch (e) {
      const error =
        `Failed to open a modal to <@${user_id}> (error: ${e.stack})`;
      console.log(error);
      return { error };
    }
    return { completed: false };
  },
)
  // --------------------------------------------
  // Manual Entry
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.ManualEntry,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi, isLifelogEnabled } = components;
      try {
        const manualEntryPermitted = await isManualEntryPermitted({
          ...components,
        });
        if (!manualEntryPermitted && !isLifelogEnabled) {
          // the organization policies do not allow manual inputs
          return {};
        }
        let view = await newManualEntryView({
          manualEntryPermitted,
          ...components,
        });
        if (!manualEntryPermitted && isLifelogEnabled) {
          view = await newAddLifelogView({ ...components });
        }
        const trigger_id = body.interactivity.interactivity_pointer;
        await slackApi.views.push({ trigger_id, view });
        return {};
      } catch (e) {
        const error =
          `Failed to open the manual entry modal (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.SelectManualEntryType,
    async (args) => {
      const { body, action } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi, isLifelogEnabled } = components;
      try {
        if (
          !await isManualEntryPermitted({ ...components }) &&
          !isLifelogEnabled
        ) {
          // the organization policies do not allow manual inputs
          return {};
        }
        const selected = action.selected_option.value;
        if (selected === EntryType.Lifelog) {
          await slackApi.views.update({
            view_id: body.view.id,
            view: await newAddLifelogView({ ...components }),
          });
        } else {
          let projects: SavedAttributes<P>[] = [];
          if (selected === EntryType.Work) {
            projects = await fetchAllActiveProjects({ ...components });
          }
          await slackApi.views.update({
            view_id: body.view.id,
            view: await newAddEntryView(
              { projects, entryType: selected, ...components },
            ),
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to show an add-entry modal (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.AddEntry,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user, yyyymmdd, isDebugMode, isLifelogEnabled } = components;
      try {
        const manualEntryPermitted = await isManualEntryPermitted({
          ...components,
        });
        if (!manualEntryPermitted) return {};

        const privateMetadata: AddEntryPrivateMetadata = JSON.parse(
          view.private_metadata!,
        );
        const type = privateMetadata.entry_type;
        const start = stateValue(view, BlockId.Start)!.selected_time!;
        const end = stateValue(view, BlockId.End)!.selected_time!;
        const project_code = stateValue(
          view,
          BlockId.ProjectCode,
          ActionId.ProjectCodeSearch,
        )?.selected_option?.value;
        const entry = await fetchTimeEntry({ ...components });
        const edit_target = undefined;
        const errors = validateTimeEntrySubmission(
          { type, start, end, project_code, entry, edit_target, ...components },
        );
        if (isDebugMode) {
          console.log(
            `### Main view (state.values: ${p(view.state.values)}, entry: ${
              p(entry)
            }, errors: ${p(errors)})`,
          );
        }
        if (Object.keys(errors).length > 0) {
          return { response_action: "errors", errors };
        }

        const attributes = { ...entry };
        if (!attributes.user_and_date) {
          attributes.user_and_date = `${user}-${yyyymmdd}`;
        }
        let entries: string[] = [];
        if (type === EntryType.Work) {
          if (!attributes.work_entries) attributes.work_entries = [];
          entries = attributes.work_entries;
        } else if (type === EntryType.BreakTime) {
          if (!attributes.break_time_entries) {
            attributes.break_time_entries = [];
          }
          entries = attributes.break_time_entries;
        } else if (type === EntryType.TimeOff) {
          if (!attributes.time_off_entries) attributes.time_off_entries = [];
          entries = attributes.time_off_entries;
        }
        const newEntry = serializeEntry({ start, end, project_code });
        entries.push(newEntry);
        const saved = await saveTimeEntry({ attributes, ...components });

        if (saved) {
          await syncMainView({
            viewId: view.root_view_id,
            manualEntryPermitted,
            entry: saved,
            lifelog: isLifelogEnabled
              ? await fetchLifelog({ ...components })
              : undefined,
            ...components,
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to add an entry (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.AddLifelog,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user, l, isLifelogEnabled } = components;
      try {
        if (!isLifelogEnabled) return {};

        const { yyyymmdd }: AddLifelogPrivateMetadata = JSON.parse(
          view.private_metadata!,
        );
        const start = stateValue(view, BlockId.Start)!.selected_time!;
        const end = stateValue(view, BlockId.End)!.selected_time!;
        const what_to_do =
          stateValue(view, BlockId.WhatToDo, ActionId.LifelogSearch)!
            .selected_option!.value;
        const errors = validateLifelog(
          { start, end, what_to_do, ...components },
        );
        if (Object.keys(errors).length > 0) {
          return { response_action: "errors", errors };
        }
        const log: Lifelog = { start, end, what_to_do };
        const user_and_date = `${user}-${yyyymmdd}`;
        const row = (await l.findById(user_and_date)).item;
        const attributes = { ...row };
        if (attributes.logs === undefined) attributes.logs = [];
        if (!attributes.user_and_date) {
          attributes.user_and_date = `${user}-${yyyymmdd}`;
        }
        attributes.logs.push(serializeEntry(log));
        const saved = await saveLifelog({ attributes, ...components });
        if (saved) {
          const manualEntryPermitted = await isManualEntryPermitted({
            ...components,
          });
          await syncMainView({
            viewId: view.root_view_id,
            manualEntryPermitted,
            entry: await fetchTimeEntry({
              ...components,
              yyyymmdd, // override
            }),
            lifelog: saved,
            ...components,
            yyyymmdd, // override
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to add an entry (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  )
  // --------------------------------------------
  // Edit/Delete Entries
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.EditOrDeleteEntry,
    async (args) => {
      const { body, action } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi } = components;
      try {
        const value: string = action.selected_option.value;
        let entries: string[] = [];
        const manualEntryPermitted = await isManualEntryPermitted({
          ...components,
        });
        if (value.startsWith("delete___")) {
          // Delete the time entry
          const sent = value.split("___")[1];
          const entryWithType = deserializeEntry(sent);
          if (!entryWithType) return {}; // invalid data in datastore
          const rawEntry = serializeEntry(entryWithType);
          if (!rawEntry) return {}; // invalid data in datastore
          let entry = await fetchTimeEntry({ ...components });
          let lifelog = await fetchLifelog({ ...components });
          if (entryWithType.type === EntryType.Lifelog) {
            const attributes = { ...lifelog };
            entries = attributes.logs || [];
            const idxToDel = entries.indexOf(rawEntry);
            if (idxToDel > -1) entries.splice(idxToDel, 1);
            lifelog = await saveLifelog({ attributes, ...components });
          } else {
            const attributes = { ...entry };
            if (entryWithType.type === EntryType.Work) {
              entries = attributes.work_entries || [];
            } else if (entryWithType.type === EntryType.BreakTime) {
              entries = attributes.break_time_entries || [];
            } else if (entryWithType.type === EntryType.TimeOff) {
              entries = attributes.time_off_entries || [];
            }
            const idxToDel = entries.indexOf(rawEntry);
            if (idxToDel > -1) entries.splice(idxToDel, 1);
            entry = await saveTimeEntry({ attributes, ...components });
          }
          await syncMainView({
            viewId: body.view.id,
            entry,
            lifelog,
            manualEntryPermitted,
            ...components,
          });
        } else {
          if (!manualEntryPermitted) return {};

          // Open a new modal view to edit the entry
          const entry = deserializeEntry(value.split("___")[1]);
          if (!entry || !entry.type) return {};

          let projectCodeEnabled = false;
          if (entry.type === EntryType.Work) {
            projectCodeEnabled = entry.project_code !== undefined &&
              entry.project_code !== "";
            if (!projectCodeEnabled) {
              projectCodeEnabled = await hasActiveProjects({ ...components });
            }
          }
          await slackApi.views.push({
            trigger_id: body.interactivity.interactivity_pointer,
            view: await newEditEntryView(
              { type: entry.type, entry, projectCodeEnabled, ...components },
            ),
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to open the edit-entry modal (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.EditEntry,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user } = components;
      try {
        const manualEntryPermitted = await isManualEntryPermitted({
          ...components,
        });
        if (!manualEntryPermitted) return {};

        const what_to_do = stateValue(
          view,
          BlockId.WhatToDo,
          ActionId.LifelogSearch,
        )?.selected_option?.value;
        const start = stateValue(view, BlockId.Start)!.selected_time!;
        const end = stateValue(view, BlockId.End)?.selected_time || "";
        const project_code = stateValue(
          view,
          BlockId.ProjectCode,
          ActionId.ProjectCodeSearch,
        )?.selected_option?.value;
        const { edit_target, type, yyyymmdd }: EditEntryPrivateMetadata = JSON
          .parse(view.private_metadata!);
        const updatedEntry = serializeEntry({
          start,
          end,
          project_code,
          what_to_do,
        });
        const entry: SavedAttributes<L> | SavedAttributes<TE> =
          type === EntryType.Lifelog
            ? await fetchLifelog({ ...components, yyyymmdd })
            : await fetchTimeEntry({ ...components, yyyymmdd });
        if (type !== EntryType.Lifelog) {
          const timeEntry = entry as SavedAttributes<TE>;
          const errors = validateTimeEntrySubmission({
            type,
            start,
            end,
            project_code,
            entry: timeEntry,
            edit_target,
            ...components,
          });
          if (Object.keys(errors).length > 0) {
            return { response_action: "errors", errors };
          }
        }
        let entries: string[] = [];
        if (isLifelogRecord(entry)) {
          entries = entry.logs || [];
        } else {
          if (type === EntryType.Work) {
            entries = entry.work_entries || [];
          } else if (type === EntryType.BreakTime) {
            entries = entry.break_time_entries || [];
          } else if (type === EntryType.TimeOff) {
            entries = entry.time_off_entries || [];
          }
        }
        const editTarget = toComparable(deserializeEntry(edit_target, true));
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i];
          if (toComparable(deserializeEntry(e, true)) === editTarget) {
            entries[i] = updatedEntry;
            break;
          }
        }
        const attributes = { ...entry };
        let lifelog: SavedAttributes<L>;
        let timeEntry: SavedAttributes<TE>;
        if (type === EntryType.Lifelog) {
          timeEntry = await fetchTimeEntry({ ...components });
          lifelog = await saveLifelog({ attributes, ...components });
        } else {
          timeEntry = await saveTimeEntry({ attributes, ...components });
          lifelog = await fetchLifelog({ ...components });
        }
        await syncMainView({
          viewId: view.root_view_id,
          manualEntryPermitted,
          entry: timeEntry,
          lifelog: lifelog,
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to edit an entry (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  )
  // --------------------------------------------
  // Quick buttons on the main view
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.StartWork,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const {
        user,
        offset,
        yyyymmdd,
        slackApi,
        language,
        isLifelogEnabled,
      } = components;
      try {
        if (await hasActiveProjects({ ...components })) {
          await slackApi.views.push({
            trigger_id: body.interactivity.interactivity_pointer,
            view: toStartWorkWithProjectCodeView({
              view: newView(language),
              ...components,
            }),
          });
          return;
        }
        const entry = await fetchTimeEntry({ ...components });
        const attributes: Attributes<TE> = {
          ...entry,
          user_and_date: entry.user_and_date ?? `${user}-${yyyymmdd}`,
          work_entries: entry.work_entries ?? [],
        };
        attributes.work_entries!.push(
          serializeEntry({
            start: nowHHMM(offset),
            end: "",
            project_code: undefined,
          }),
        );
        const saved = await saveTimeEntry({ attributes, ...components });
        await syncMainView({
          viewId: body.view.id,
          entry: saved,
          lifelog: isLifelogEnabled
            ? await fetchLifelog({ ...components })
            : undefined,
          manualEntryPermitted: await isManualEntryPermitted({
            ...components,
          }),
          ...components,
        });
        return {};
      } catch (e) {
        const error = `Failed to start work (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.StartWorkWithProject,
    async (args) => {
      const { body, view } = args;
      const components = await injectComponents({ ...args });
      const { user, yyyymmdd, offset, isLifelogEnabled } = components;
      try {
        const project_code = stateValue(
          view,
          BlockId.ProjectCode,
          ActionId.ProjectCodeSearch,
        )?.selected_option?.value;
        const entry = await fetchTimeEntry({ ...components });
        const attributes: Attributes<TE> = {
          ...entry,
          user_and_date: entry.user_and_date ?? `${user}-${yyyymmdd}`,
          work_entries: entry.work_entries ?? [],
        };
        const newEntry = serializeEntry(
          { start: nowHHMM(offset), end: "", project_code },
        );
        attributes.work_entries!.push(newEntry);
        const saved = await saveTimeEntry({ attributes, ...components });
        await syncMainView({
          viewId: body.view.previous_view_id,
          entry: saved,
          lifelog: isLifelogEnabled
            ? await fetchLifelog({ ...components })
            : undefined,
          manualEntryPermitted: await isManualEntryPermitted({
            ...components,
          }),
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to add an entry (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.FinishWork,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, offset, isLifelogEnabled } = components;
      try {
        const entry = await fetchTimeEntry({ ...components });
        const attributes = { ...entry };
        if (attributes.work_entries) {
          const lastIdx = attributes.work_entries.length - 1;
          const w = attributes.work_entries[lastIdx];
          const entry = deserializeEntry(w);
          if (entry && entry.end === "") {
            const end = nowHHMM(offset);
            attributes.work_entries[lastIdx] = serializeEntry({
              ...entry,
              end, // override
            });
            const saved = await saveTimeEntry({ attributes, ...components });
            await syncMainView({
              viewId: body.view.id,
              entry: saved,
              lifelog: isLifelogEnabled
                ? await fetchLifelog({ ...components })
                : undefined,
              manualEntryPermitted: await isManualEntryPermitted({
                ...components,
              }),
              ...components,
            });
          }
        }
        return {};
      } catch (e) {
        const error =
          `Failed to finish work (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.StartBreakTime,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, offset, yyyymmdd, isLifelogEnabled } = components;
      try {
        const entry = await fetchTimeEntry({ ...components });
        const attributes: Attributes<TE> = {
          ...entry,
          user_and_date: entry.user_and_date ?? `${user}-${yyyymmdd}`,
          break_time_entries: entry.break_time_entries ?? [],
        };
        attributes.break_time_entries!.push(serializeEntry(
          { start: nowHHMM(offset), end: "", project_code: undefined },
        ));
        const saved = await saveTimeEntry({ attributes, ...components });
        await syncMainView({
          viewId: body.view.root_view_id,
          entry: saved,
          lifelog: isLifelogEnabled
            ? await fetchLifelog({ ...components })
            : undefined,
          manualEntryPermitted: await isManualEntryPermitted({
            ...components,
          }),
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to start break time (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.FinishBreakTime,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, offset, isLifelogEnabled } = components;
      try {
        const item = await fetchTimeEntry({ ...components });
        const attributes = { ...item };
        if (attributes.break_time_entries) {
          for (let i = 0; i < attributes.break_time_entries.length; i++) {
            const entry = deserializeEntry(
              attributes.break_time_entries[i],
            );
            if (entry && entry.end === "") {
              const end = nowHHMM(offset);
              attributes.break_time_entries[i] = serializeEntry({
                ...entry,
                end, // override
              });
              const saved = await saveTimeEntry({ attributes, ...components });
              await syncMainView({
                viewId: body.view.id,
                entry: saved,
                lifelog: isLifelogEnabled
                  ? await fetchLifelog({ ...components })
                  : undefined,
                manualEntryPermitted: await isManualEntryPermitted({
                  ...components,
                }),
                ...components,
              });
            }
          }
        }
        return {};
      } catch (e) {
        const error =
          `Failed to finish break time (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.StartLifelogInput,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi, language } = components;
      try {
        await slackApi.views.push({
          trigger_id: body.interactivity.interactivity_pointer,
          view: toStartLifelogView({ view: newView(language), ...components }),
        });
        return {};
      } catch (e) {
        const error =
          `Failed to start lifelog (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.StartLifelog,
    async (args) => {
      const { body, view } = args;
      const components = await injectComponents({ ...args });
      const { user, yyyymmdd, offset, isLifelogEnabled } = components;
      try {
        if (!isLifelogEnabled) return {};

        const what_to_do = stateValue(
          view,
          BlockId.WhatToDo,
          ActionId.LifelogSearch,
        )!.selected_option!.value;
        const entry = await fetchLifelog({ ...components });
        const attributes = { ...entry };
        if (attributes.user_and_date === undefined) {
          attributes.user_and_date = `${user}-${yyyymmdd}`;
        }
        if (attributes.logs === undefined) attributes.logs = [];
        const log: Lifelog = { start: nowHHMM(offset), what_to_do };
        attributes.logs.push(serializeEntry(log));
        const saved = await saveLifelog({ attributes, ...components });
        await syncMainView({
          viewId: body.view.root_view_id,
          entry: await fetchTimeEntry({ ...components }),
          lifelog: saved,
          manualEntryPermitted: await isManualEntryPermitted({
            ...components,
          }),
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to add a lifelog (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.FinishLifelog,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, offset } = components;
      try {
        let lifelog = await fetchLifelog({ ...components });
        const attributes = { ...lifelog };
        if (attributes.logs) {
          const lastIdx = attributes.logs.length - 1;
          const w = attributes.logs[lastIdx];
          const entry = deserializeEntry(w);
          if (entry && (entry.end === undefined || entry.end === "")) {
            const end = nowHHMM(offset);
            attributes.logs[lastIdx] = serializeEntry({
              ...entry,
              end, // override
            });
            lifelog = await saveLifelog({ attributes, ...components });
            await syncMainView({
              viewId: body.view.id,
              entry: await fetchTimeEntry({ ...components }),
              lifelog,
              manualEntryPermitted: await isManualEntryPermitted({
                ...components,
              }),
              ...components,
            });
          }
        }
        return {};
      } catch (e) {
        const error =
          `Failed to finish work (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockSuggestionHandler(
    ActionId.LifelogSearch,
    async (args) => {
      const { body } = args;
      const keyword = body.value;
      const components = await injectComponents({ ...args });
      const { user, offset } = components;
      try {
        const recentLogs = await fetchRecentLifelogs({
          limit: 50,
          yyyymm: todayYYYYMMDD(offset).substring(0, 6),
          ...components,
        });
        const options = lifelogSearchResultOptions({ keyword, recentLogs });
        return { options };
      } catch (e) {
        const error =
          `Failed to return search results (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { options: [] };
      }
    },
  )
  // --------------------------------------------
  // Refresh
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.Refresh,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, isLifelogEnabled } = components;
      try {
        await syncMainView({
          viewId: body.view.id,
          entry: await fetchTimeEntry({ ...components }),
          lifelog: isLifelogEnabled
            ? await fetchLifelog({ ...components })
            : undefined,
          manualEntryPermitted: await isManualEntryPermitted({
            ...components,
          }),
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to refresh the main view (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  )
  // --------------------------------------------
  // Menu
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.Menu,
    async (args) => {
      const { body: { interactivity, view }, action } = args;
      const trigger_id = interactivity.interactivity_pointer;
      const components = await injectComponents({ ...args });
      const {
        slackApi,
        language,
        user,
        offset,
        canAccessAdminFeature,
        isLifelogEnabled,
      } = components;
      try {
        const selectedMenu: string = action.selected_option.value;
        if (selectedMenu === MenuItem.UserSettings) {
          await slackApi.views.push({
            trigger_id: interactivity.interactivity_pointer,
            view: toUserSettingsView({
              view: newView(language),
              countries: await fetchAllCountries({ ...components }),
              defaultCountryId: undefined, // no need to use this here
              ...components,
            }),
          });
        } else if (selectedMenu === MenuItem.BackToToday) {
          const yyyymmdd = todayYYYYMMDD(offset);
          await slackApi.views.update({
            view_id: view.id,
            view: await toMainView({
              view: newView(language),
              entry: await fetchTimeEntry({
                ...components,
                yyyymmdd, // overrite
              }),
              lifelog: isLifelogEnabled
                ? await fetchLifelog({
                  ...components,
                  yyyymmdd, // overrite
                })
                : undefined,
              manualEntryPermitted: await isManualEntryPermitted({
                ...components,
              }),
              ...components,
              yyyymmdd, // overrite
            }),
          });
        } else if (selectedMenu === MenuItem.Calendar) {
          await slackApi.views.push({
            view: toCalendarView(newView(language), offset, language),
            trigger_id,
          });
        } else if (selectedMenu === MenuItem.MonthlyReport) {
          await slackApi.views.push({
            view: toReportStartView({ view: newView(language), ...components }),
            trigger_id,
          });
        } else if (selectedMenu === MenuItem.AdminMenu) {
          if (!await canAccessAdminFeature()) return {};
          await slackApi.views.push({
            view: toAdminMenuView({ view: newView(language), ...components }),
            trigger_id,
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to handle menu event (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  )
  // --------------------------------------------
  // User Settings
  // --------------------------------------------
  .addViewSubmissionHandler(
    CallbackId.UserSettings,
    async (args) => {
      const { view } = args;
      const language = stateValue(view, BlockId.Language)!
        .selected_option!.value;
      const components = await injectComponents({ ...args });
      const { user, isLifelogEnabled } = components;
      try {
        let country_id = "";
        let app_mode = AppModeCode.Work;
        const country = stateValue(view, BlockId.Country)?.selected_option;
        if (country) country_id = country.value;
        const appMode = stateValue(view, BlockId.AppMode)?.selected_option;
        if (appMode) app_mode = appMode.value;
        const attributes: Attributes<US> = {
          user,
          language,
          country_id,
          app_mode,
        };
        const saved = await saveUserSettings({ attributes, ...components });
        const manualEntryPermitted = await isManualEntryPermitted({
          ...components,
        });
        const entry = await fetchTimeEntry({ ...components });
        const lifelog = isLifelogEnabled
          ? await fetchLifelog({ ...components })
          : undefined;
        if (view.root_view_id !== view.id) {
          await syncMainView({
            viewId: view.root_view_id,
            entry,
            lifelog,
            ...components,
            manualEntryPermitted,
            language: saved.language,
            isLifelogEnabled: app_mode === AppModeCode.WorkAndLifelogs,
          });
          return {};
        } else {
          // When an end-user submits the initial UserSettings
          return {
            response_action: "update",
            view: await toMainView({
              view: newView(language),
              entry,
              lifelog,
              ...components,
              manualEntryPermitted,
              language: saved.language,
            }),
          };
        }
      } catch (e) {
        const error =
          `Failed to save the settings (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  )
  // --------------------------------------------
  // Calendar
  // --------------------------------------------
  .addViewSubmissionHandler(
    CallbackId.Calendar,
    async (args) => {
      const { body, view } = args;
      const selectedDate = stateValue(view, BlockId.Date)!.selected_date!;
      const yyyymmdd = selectedDate.replaceAll("-", "");
      const components = await injectComponents({ ...args });
      const { user, language, slackApi, isLifelogEnabled } = components;
      try {
        await slackApi.views.update({
          view_id: body.view.root_view_id,
          view: await toMainView({
            view: newView(language),
            entry: await fetchTimeEntry({
              ...components,
              yyyymmdd, // overrite with the sent one
            }),
            lifelog: isLifelogEnabled
              ? await fetchLifelog({
                ...components,
                yyyymmdd, // overrite with the sent one
              })
              : undefined,
            manualEntryPermitted: await isManualEntryPermitted({
              ...components,
            }),
            ...components,
            yyyymmdd, // overrite with the sent one
          }),
        });
        return {};
      } catch (e) {
        const error =
          `Failed to select a date (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  )
  // --------------------------------------------
  // Monthly Report
  // --------------------------------------------
  .addViewSubmissionHandler(
    CallbackId.ReportStart,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user, language } = components;
      try {
        const year = stateValue(view, BlockId.Year)!.selected_option!.value;
        const month = stateValue(view, BlockId.Month)!.selected_option!.value;
        const mm = ("00" + month).slice(-2);
        const yyyymm = `${year}${mm}`;
        const sentIncludeLifelogs = stateValue(view, BlockId.IncludeLifelogs)
          ?.selected_options;
        const includeLifelogs = sentIncludeLifelogs !== undefined &&
            sentIncludeLifelogs.length > 0 || false;
        const entries = await fetchMonthTimeEntries({ yyyymm, ...components });
        const lifelogs = includeLifelogs
          ? await fetchMonthLifelogs({ yyyymm, ...components })
          : [];
        return {
          response_action: "update",
          view: await toReportResultView({
            view: newView(language),
            entries,
            lifelogs,
            month: `${year}/${mm}`,
            ...components,
          }),
        };
      } catch (e) {
        const error =
          `Failed to generate a report (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.SendReportInDM,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user } = components;
      try {
        const { yyyymmdd }: ReportPrivateMetadata = JSON.parse(
          body.view.private_metadata,
        );
        const yyyymm = yyyymmdd.substring(0, 6);
        const report: MonthlyReport = await generateReport({
          month: yyyymmdd.substring(0, 4) + "/" + yyyymmdd.substring(4, 6),
          entries: (await fetchMonthTimeEntries({ yyyymm, ...components })),
          lifelogs: (await fetchMonthLifelogs({ yyyymm, ...components })),
          ...components,
        });
        await shareReportJSONFile({ report, ...components });
        return {};
      } catch (e) {
        const error =
          `Failed to send a report (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  )
  // --------------------------------------------
  // Admin Menu
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.AdminMenu,
    async (args) => {
      const { body: { view }, action } = args;
      const components = await injectComponents({ ...args });
      const { slackApi, language, user, op, canAccessAdminFeature } =
        components;
      try {
        if (!await canAccessAdminFeature()) return {};
        const selectedMenu: string = action.selected_option.value;
        if (selectedMenu === AdminMenuItem.AdminReportDownload) {
          await slackApi.views.update({
            view_id: view.id,
            view: toAdminReportDownloadView({
              view: newView(language),
              ...components,
            }),
          });
        } else if (selectedMenu === AdminMenuItem.ProjectSettings) {
          await slackApi.views.update({
            view_id: view.id,
            view: toProjectMainView({
              view: newView(language),
              projects: await fetchAllProjects({ ...components }),
              ...components,
            }),
          });
        } else if (selectedMenu === AdminMenuItem.OrganizationPolicies) {
          await slackApi.views.update({
            view_id: view.id,
            view: toOrganizationPoliciesView({
              view: newView(language),
              policies: (await op.findAll()).items,
              ...components,
            }),
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to handle menu event (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.AdminReportDownload,
    async (args) => {
      const { view, inputs: { user_id } } = args;
      const components = await injectComponents({ ...args });
      const { user, offset, language, canAccessAdminFeature, isDebugMode } =
        components;
      try {
        if (!await canAccessAdminFeature()) return {};
        const year = stateValue(view, BlockId.Year)!.selected_option!.value;
        const month = stateValue(view, BlockId.Month)!.selected_option!.value;
        const mm = ("00" + month).slice(-2);
        const userToEntries = await fetchAllMemberMonthTimeEntries({
          yyyymm: `${year}${mm}`,
          ...components,
        });
        const tasks: Promise<MonthlyReport>[] = [];
        for (const [reportUser, entries] of Object.entries(userToEntries)) {
          tasks.push(
            new Promise((resolve, reject) => {
              fetchUserDetails({
                slackApi: components.slackApi,
                user: reportUser,
              }).then(async (userInfo) => {
                const reportUserEmail = userInfo.user?.profile?.email;
                if (reportUserEmail) {
                  try {
                    const report = await generateReport({
                      month: `${year}/${mm}`,
                      entries,
                      lifelogs: [], // An admin report does not include any lifelogs
                      ...components,
                      user: reportUser, // override the components
                      email: reportUserEmail, // override the components
                    });
                    resolve(report);
                  } catch (e) {
                    reject(e);
                  }
                }
              });
            }),
          );
        }
        const userReports: MonthlyReport[] = await Promise.all(tasks);
        const report = {
          month: `${year}/${mm}`,
          reports: userReports,
          generated_at: toDateFormat(offset, undefined) + " " + nowHHMM(offset),
        };
        if (isDebugMode) {
          console.log(`### Admin report: ${JSON.stringify(report, null, 2)}`);
        }
        await shareAdminReportJSONFile({
          adminUserId: user_id,
          report,
          ...components,
        });
        return {
          response_action: "update",
          view: toAdminReportDownloadCompletionView({
            view: newView(language),
            message: i18n(Label.ReportHasBeenSentInDM, language),
            ...components,
          }),
        };
      } catch (e) {
        const error =
          `Failed to send an admin report (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return {
          response_action: "update",
          view: toAdminReportDownloadCompletionView({
            view: newView(language),
            message: i18n(Label.ReportHasBeenSentInDM, language),
            ...components,
          }),
        };
      }
    },
  )
  // --------------------------------------------
  // Project Settings
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.AddProject,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi, canAccessAdminFeature } = components;
      try {
        if (!await canAccessAdminFeature()) return {};
        await slackApi.views.push({
          trigger_id: body.interactivity.interactivity_pointer,
          view: newAddProjectView({ ...components }),
        });
        return {};
      } catch (e) {
        const error =
          `Failed to open the add-project modal (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.AddProject,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user, canAccessAdminFeature } = components;
      try {
        if (!await canAccessAdminFeature()) return {};
        const [code, name, description] = [
          stateValue(view, BlockId.ProjectCode)!.value!,
          stateValue(view, BlockId.ProjectName)!.value!,
          stateValue(view, BlockId.ProjectDescription)?.value,
        ];
        const sentIsActive = stateValue(view, BlockId.ProjectIsActive)
          ?.selected_options;
        const is_active: boolean = sentIsActive !== undefined &&
          sentIsActive.length > 0;

        const errors = await validateProjectSubmission({
          code,
          name,
          is_active,
          description,
          ...components,
        });
        if (Object.keys(errors).length > 0) {
          return { response_action: "errors", errors };
        }
        const attributes = { code, name, is_active, description };
        const saved = await saveProject({ attributes, ...components });
        const projects = await fetchAllProjects({ ...components });
        // To deal with the eventual consistency of datastore
        if (!projects.find((p) => p.code === saved.code)) projects.push(saved);
        projects.sort((a, b) => a.code > b.code ? 1 : -1);
        await syncProjectMainView(
          { viewId: view.previous_view_id, projects, ...components },
        );
        return {};
      } catch (e) {
        const error =
          `Failed to add a project (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.EditProject,
    async (args) => {
      const { body, action } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi, canAccessAdminFeature } = components;
      try {
        if (!await canAccessAdminFeature()) return {};
        const code: string = action.value;
        const project = await fetchProject({ code, ...components });
        if (!project.code) return {};
        await slackApi.views.push({
          trigger_id: body.interactivity.interactivity_pointer,
          view: newEditProjectView({ code, project, ...components }),
        });
        return {};
      } catch (e) {
        const error =
          `Failed to open the edit-project modal (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.EditProject,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user, canAccessAdminFeature } = components;
      try {
        if (!await canAccessAdminFeature()) return {};
        const privateMetadata: EditProjectPrivateMetadata = JSON.parse(
          view.private_metadata || "{}",
        );
        const code = privateMetadata.code;
        const [name, description] = [
          stateValue(view, BlockId.ProjectName)!.value!,
          stateValue(view, BlockId.ProjectDescription)?.value,
        ];
        const sentIsActive = stateValue(view, BlockId.ProjectIsActive)
          ?.selected_options;
        const is_active: boolean = sentIsActive !== undefined &&
          sentIsActive.length > 0;

        const errors = await validateProjectSubmission({
          code: undefined, // skip code validation
          name,
          is_active,
          description,
          ...components,
        });
        if (Object.keys(errors).length > 0) {
          return { response_action: "errors", errors };
        }
        const attributes = { code, name, is_active, description };
        const saved = await saveProject({ attributes, ...components });
        const rows = await fetchAllProjects({ ...components });
        const projects: SavedAttributes<P>[] = [];
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].code === saved.code) projects.push(saved);
          else projects.push(rows[i]);
        }
        projects.sort((a, b) => a.code > b.code ? 1 : -1);

        await syncProjectMainView(
          { viewId: view.previous_view_id, projects, ...components },
        );
        return {};
      } catch (e) {
        const error =
          `Failed to save project changes (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockSuggestionHandler(
    ActionId.ProjectCodeSearch,
    async (args) => {
      const { body } = args;
      const keyword = body.value;
      const components = await injectComponents({ ...args });
      const { user, offset } = components;
      try {
        const recentEntries = await fetchRecentTimeEntries(
          { limit: 100, yyyymm: todayYYYYMMDD(offset), ...components },
        );
        const allProjects = await fetchAllActiveProjects({ ...components });
        const options = projectSearchResultOptions({
          keyword,
          recentEntries,
          allProjects,
        });
        return { options };
      } catch (e) {
        const error =
          `Failed to return search results (user: ${user}, error: ${e.stack})`;
        console.log(error);
        return { options: [] };
      }
    },
  )
  // --------------------------------------------
  // Organization Policies
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.OrganizationPolicyChange,
    async (args) => {
      const { body, action } = args;
      const components = await injectComponents({ ...args });
      const {
        user,
        slackApi,
        language,
        canAccessAdminFeature,
        op,
        isLifelogEnabled,
      } = components;
      try {
        if (!await canAccessAdminFeature()) return {};
        const [key, value] = action.selected_option.value.split("___");
        if (!Object.keys(OrganizationPolices).includes(key)) {
          return {};
        }
        await op.save({ attributes: { key, value } });
        await slackApi.views.update({
          view_id: body.view.id,
          view: toOrganizationPoliciesView({
            view: newView(language),
            policies: (await op.findAll()).items,
            ...components,
          }),
        });
        const lifelog = isLifelogEnabled
          ? await fetchLifelog({ ...components })
          : undefined;
        await syncMainView({
          viewId: body.view.previous_view_id,
          entry: await fetchTimeEntry({ ...components }),
          lifelog: lifelog,
          manualEntryPermitted: await isManualEntryPermitted({ ...components }),
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to save organization policy change (user: ${user}, action: ${
            p(action)
          } error: ${e.stack})`;
        console.log(error);
        return { error };
      }
    },
  );

export function p(obj: unknown): string {
  return JSON.stringify(obj);
}
