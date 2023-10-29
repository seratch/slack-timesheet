import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { Attributes, SavedAttributes } from "deno-slack-data-mapper/mod.ts";
import { AnyModalBlock, ModalView } from "slack-web-api-client/mod.ts";

import { injectComponents } from "./internals/components.ts";
import {
  ActionId,
  BlockId,
  CallbackId,
  EntryType,
  MenuItem,
} from "./internals/constants.ts";
import {
  generateReport,
  MonthlyReport,
  shareReportJSONFile,
} from "./internals/reports.ts";
import { nowHHMM, todayYYYYMMDD } from "./internals/datetime.ts";
import {
  newAddEntryBlocks,
  newAddEntryView,
  newAddProjectBlocks,
  newAddProjectView,
  newEditEntryBlocks,
  newEditEntryView,
  newEditProjectBlocks,
  newEditProjectView,
  newView,
  stateValue,
  syncMainView,
  syncProjectMainView,
  toCalendarView,
  toMainView,
  toProjectMainView,
  toReportResultView,
  toReportStartView,
  toStartWorkWithProjectCodeView,
  toUserSettingsView,
} from "./internals/views.ts";
import {
  deserializeTimeEntry,
  fetchAllActiveProjects,
  fetchAllCountries,
  fetchAllProjects,
  fetchMonthTimeEntries,
  fetchProject,
  fetchRecentTimeEntries,
  fetchTimeEntry,
  hasActiveProjects,
  P,
  saveProject,
  saveTimeEntry,
  saveUserSettings,
  serializeTimeEntry,
  TE,
  US,
} from "./internals/datastore.ts";
import {
  EditEntryPrivateMetadata,
  EditProjectPrivateMetadata,
  ReportPrivateMetadata,
} from "./internals/private_metadata.ts";
import {
  validateProjectSubmission,
  validateTimeEntrySubmission,
} from "./internals/validation.ts";

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
    const { inputs: { user_id, interactivity: { interactivity_pointer } } } =
      args;
    const components = await injectComponents({ ...args });
    const { language, settings, isDebugMode } = components;
    let view: ModalView = newView(language);
    if (!settings.user) {
      if (isDebugMode) {
        console.log(`### First time user (settings: ${p(settings)})`);
      }
      view = toUserSettingsView({
        view,
        countries: await fetchAllCountries({ ...components }),
        ...components,
      });
    } else {
      const item = await fetchTimeEntry({ ...components });
      if (isDebugMode) {
        console.log(
          `### Main view (item: ${p(item)}, settings: ${p(settings)})`,
        );
      }
      view = await toMainView({ view, item, ...components });
    }
    try {
      await components.slackApi.views.open({
        trigger_id: interactivity_pointer,
        view,
      });
    } catch (e) {
      const error = `Failed to open a modal to <@${user_id}> (error: ${e})`;
      console.log(error);
      return { error };
    }
    return { completed: false };
  },
)
  // --------------------------------------------
  // Add/Edit/Delete Entries
  // --------------------------------------------
  .addBlockActionsHandler(
    ActionId.AddEntry,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi } = components;
      try {
        const projects = await fetchAllProjects({ ...components });
        const blocks = await newAddEntryBlocks({ projects, ...components });
        await slackApi.views.push({
          trigger_id: body.interactivity.interactivity_pointer,
          view: newAddEntryView({ blocks, ...components }),
        });
        return {};
      } catch (e) {
        const error =
          `Failed to open an add-entry modal (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.AddEntry,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user, yyyymmdd, isDebugMode } = components;
      console.log(view);
      try {
        const type = stateValue(view, BlockId.Type)!.selected_option!.value;
        const start = stateValue(view, BlockId.Start)!.selected_time!;
        const end = stateValue(view, BlockId.End)!.selected_time!;
        const project_code = stateValue(
          view,
          BlockId.ProjectCode,
          ActionId.ProjectCodeSearch,
        )?.selected_option?.value;
        const item = await fetchTimeEntry({ ...components });
        const errors = validateTimeEntrySubmission({
          type,
          start,
          end,
          project_code,
          item,
          edit_target: undefined,
          ...components,
        });
        if (isDebugMode) {
          console.log(
            `### Main view (state.values: ${p(view.state.values)}, entry: ${
              p(item)
            }, errors: ${p(errors)})`,
          );
        }
        if (Object.keys(errors).length > 0) {
          return { response_action: "errors", errors };
        }
        const attributes = { ...item };
        if (!attributes.user_and_date) {
          attributes.user_and_date = `${user}-${yyyymmdd}`;
        }
        let entries: string[] = [];
        if (type === EntryType.Work) {
          if (!attributes.work_entries) {
            attributes.work_entries = [];
          }
          entries = attributes.work_entries;
        } else if (type === EntryType.BreakTime) {
          if (!attributes.break_time_entries) {
            attributes.break_time_entries = [];
          }
          entries = attributes.break_time_entries;
        } else if (type === EntryType.TimeOff) {
          if (!attributes.time_off_entries) {
            attributes.time_off_entries = [];
          }
          entries = attributes.time_off_entries;
        }
        const newEntry = serializeTimeEntry({ start, end, project_code });
        entries.push(newEntry);
        const saved = await saveTimeEntry({ attributes, ...components });
        if (saved) {
          await syncMainView({
            viewId: view.root_view_id,
            entryForTheDay: saved,
            ...components,
          });
        }
        return {};
      } catch (e) {
        const error = `Failed to add an entry (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.EditOrDeleteEntry,
    async (args) => {
      const { body, action } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi } = components;
      try {
        const item = await fetchTimeEntry({ ...components });
        const attributes = { ...item };
        const value: string = action.selected_option.value;
        let entries: string[] = [];
        if (value.startsWith("delete___")) {
          // Delete the time entry
          const sent = value.split("___")[1];
          const entryWithType = deserializeTimeEntry(sent);
          if (!entryWithType) return {}; // invalid data in datastore
          const rawEntry = serializeTimeEntry(entryWithType);
          if (!rawEntry) return {}; // invalid data in datastore

          if (entryWithType.type === EntryType.Work) {
            entries = attributes.work_entries || [];
          } else if (entryWithType.type === EntryType.BreakTime) {
            entries = attributes.break_time_entries || [];
          } else if (entryWithType.type === EntryType.TimeOff) {
            entries = attributes.time_off_entries || [];
          }

          const idxToDel = entries.indexOf(rawEntry);
          if (idxToDel > -1) entries.splice(idxToDel, 1);
          const saved = await saveTimeEntry({ attributes, ...components });
          await syncMainView({
            viewId: body.view.id,
            entryForTheDay: saved,
            ...components,
          });
        } else {
          // Open a new modal view to edit the entry
          const entry = deserializeTimeEntry(value.split("___")[1]);
          if (!entry || !entry.type) return {};

          let projectCodeEnabled = entry.project_code !== undefined &&
            entry.project_code !== "";
          if (!projectCodeEnabled) {
            projectCodeEnabled = await hasActiveProjects({ ...components });
          }
          const blocks: AnyModalBlock[] = await newEditEntryBlocks({
            entry,
            projectCodeEnabled,
            ...components,
          });
          await slackApi.views.push({
            trigger_id: body.interactivity.interactivity_pointer,
            view: newEditEntryView({
              type: entry.type,
              entry,
              blocks,
              ...components,
            }),
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to open the edit-entry modal (user: ${user}, error: ${e})`;
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
        const start = stateValue(view, BlockId.Start)!.selected_time!;
        const end = stateValue(view, BlockId.End)?.selected_time || "";
        const project_code = stateValue(
          view,
          BlockId.ProjectCode,
          ActionId.ProjectCodeSearch,
        )?.selected_option?.value;
        const { edit_target, type }: EditEntryPrivateMetadata = JSON.parse(
          view.private_metadata!,
        );
        const updatedEntry = serializeTimeEntry({ start, end, project_code });
        const item = await fetchTimeEntry({ ...components });
        const errors = validateTimeEntrySubmission({
          type,
          start,
          end,
          project_code,
          item,
          edit_target,
          ...components,
        });
        if (Object.keys(errors).length > 0) {
          return { response_action: "errors", errors };
        }
        const attributes = { ...item };
        let entries: string[] = [];
        if (type === EntryType.Work) {
          entries = attributes.work_entries;
        } else if (type === EntryType.BreakTime) {
          entries = attributes.break_time_entries || [];
        } else if (type === EntryType.TimeOff) {
          entries = attributes.time_off_entries || [];
        }
        for (let i = 0; i < entries.length; i++) {
          if (entries[i] === edit_target) entries[i] = updatedEntry;
        }
        const saved = await saveTimeEntry({ attributes, ...components });
        if (saved) {
          await syncMainView({
            viewId: view.root_view_id,
            entryForTheDay: saved,
            ...components,
          });
        }
        return {};
      } catch (e) {
        const error = `Failed to edit an entry (user: ${user}, error: ${e})`;
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
      const { user, offset, yyyymmdd, slackApi, language } = components;
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
        const item = await fetchTimeEntry({ ...components });
        const attributes: Attributes<TE> = {
          ...item,
          user_and_date: item.user_and_date ?? `${user}-${yyyymmdd}`,
          work_entries: item.work_entries ?? [],
        };
        attributes.work_entries!.push(
          serializeTimeEntry({
            start: nowHHMM(offset),
            end: "",
            project_code: undefined,
          }),
        );
        const saved = await saveTimeEntry({ attributes, ...components });
        await syncMainView({
          viewId: body.view.id,
          entryForTheDay: saved,
          ...components,
        });
        return {};
      } catch (e) {
        const error = `Failed to start work (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.StartWorkWithProjectCode,
    async (args) => {
      const { body, view } = args;
      const components = await injectComponents({ ...args });
      const { user, yyyymmdd, offset } = components;
      try {
        const project_code = stateValue(
          view,
          BlockId.ProjectCode,
          ActionId.ProjectCodeSearch,
        )?.selected_option?.value;
        const item = await fetchTimeEntry({ ...components });
        const attributes: Attributes<TE> = {
          ...item,
          user_and_date: item.user_and_date ?? `${user}-${yyyymmdd}`,
          work_entries: item.work_entries ?? [],
        };
        const newEntry = serializeTimeEntry({
          start: nowHHMM(offset),
          end: "",
          project_code,
        });
        attributes.work_entries!.push(newEntry);
        const saved = await saveTimeEntry({ attributes, ...components });
        await syncMainView({
          viewId: body.view.previous_view_id,
          entryForTheDay: saved,
          ...components,
        });
        return {};
      } catch (e) {
        const error = `Failed to add an entry (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.FinishWork,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, offset } = components;
      try {
        const item = await fetchTimeEntry({ ...components });
        const attributes = { ...item };
        if (attributes.work_entries) {
          const lastIdx = attributes.work_entries.length - 1;
          const w = attributes.work_entries[lastIdx];
          const entry = deserializeTimeEntry(w);
          if (entry && entry.end === "") {
            const end = nowHHMM(offset);
            attributes.work_entries[lastIdx] = serializeTimeEntry({
              ...entry,
              end, // override
            });
            const saved = await saveTimeEntry({ attributes, ...components });
            await syncMainView({
              viewId: body.view.id,
              entryForTheDay: saved,
              ...components,
            });
          }
        }
        return {};
      } catch (e) {
        const error = `Failed to finish work (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.StartBreakTime,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, offset, yyyymmdd } = components;
      try {
        const item = await fetchTimeEntry({ ...components });
        const attributes: Attributes<TE> = {
          ...item,
          user_and_date: item.user_and_date ?? `${user}-${yyyymmdd}`,
          break_time_entries: item.break_time_entries ?? [],
        };
        attributes.break_time_entries!.push(serializeTimeEntry({
          start: nowHHMM(offset),
          end: "",
          project_code: undefined,
        }));
        const saved = await saveTimeEntry({ attributes, ...components });
        await syncMainView({
          viewId: body.view.id,
          entryForTheDay: saved,
          ...components,
        });
        return {};
      } catch (e) {
        const error = `Failed to start break time (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.FinishBreakTime,
    async (args) => {
      const { body } = args;
      const components = await injectComponents({ ...args });
      const { user, offset } = components;
      try {
        const item = await fetchTimeEntry({ ...components });
        const attributes = { ...item };
        if (attributes.break_time_entries) {
          for (let i = 0; i < attributes.break_time_entries.length; i++) {
            const entry = deserializeTimeEntry(
              attributes.break_time_entries[i],
            );
            if (entry && entry.end === "") {
              const end = nowHHMM(offset);
              attributes.break_time_entries[i] = serializeTimeEntry({
                ...entry,
                end, // override
              });
              const saved = await saveTimeEntry({ attributes, ...components });
              await syncMainView({
                viewId: body.view.id,
                entryForTheDay: saved,
                ...components,
              });
            }
          }
        }
        return {};
      } catch (e) {
        const error =
          `Failed to finish break time (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
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
      const { user } = components;
      try {
        const saved = await fetchTimeEntry({ ...components });
        await syncMainView({
          viewId: body.view.id,
          entryForTheDay: saved,
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to refresh the main view (user: ${user}, error: ${e})`;
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
      const { slackApi, language, user, offset } = components;
      try {
        const selectedMenu: string = action.selected_option.value;
        if (selectedMenu === MenuItem.UserSettings) {
          await slackApi.views.push({
            trigger_id: interactivity.interactivity_pointer,
            view: toUserSettingsView({
              view: newView(language),
              countries: await fetchAllCountries({ ...components }),
              ...components,
            }),
          });
        } else if (selectedMenu === MenuItem.MoveToToday) {
          const yyyymmdd = todayYYYYMMDD(offset);
          await slackApi.views.update({
            view_id: view.id,
            view: await toMainView({
              view: newView(language),
              item: await fetchTimeEntry({
                ...components,
                yyyymmdd, // overrite
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
        } else if (selectedMenu === MenuItem.ProjectSettings) {
          await slackApi.views.push({
            view: toProjectMainView({
              view: newView(language),
              projects: await fetchAllProjects({ ...components }),
              ...components,
            }),
            trigger_id,
          });
        }
        return {};
      } catch (e) {
        const error =
          `Failed to handle menu event (user: ${user}, error: ${e})`;
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
      const { user } = components;
      try {
        let country_id = "";
        if (
          view.state.values[BlockId.Language]?.[ActionId.Input]
            ?.selected_option?.value
        ) {
          country_id = view.state.values[BlockId.Language][ActionId.Input]
            .selected_option.value;
        }
        const attributes: Attributes<US> = { user, language, country_id };
        const saved = await saveUserSettings({ attributes, ...components });
        const entryForTheDay = await fetchTimeEntry({ ...components });
        if (view.root_view_id !== view.id) {
          await syncMainView({
            viewId: view.root_view_id,
            entryForTheDay,
            ...components,
            language: saved.language,
          });
          return {};
        } else {
          // When an end-user submits the initial UserSettings
          return {
            response_action: "update",
            view: await toMainView({
              view: newView(language),
              item: entryForTheDay,
              ...components,
            }),
          };
        }
      } catch (e) {
        const error =
          `Failed to save the settings (user: ${user}, error: ${e})`;
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
      const { user, language, slackApi } = components;
      try {
        await slackApi.views.update({
          view_id: body.view.root_view_id,
          view: await toMainView({
            view: newView(language),
            item: await fetchTimeEntry({
              ...components,
              yyyymmdd, // overrite with the sent one
            }),
            ...components,
            yyyymmdd, // overrite with the sent one
          }),
        });
        return {};
      } catch (e) {
        const error = `Failed to select a date (user: ${user}, error: ${e})`;
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
      const { view, inputs: { user_id } } = args;
      const components = await injectComponents({ ...args });
      const { user, language } = components;
      try {
        const year = stateValue(view, BlockId.Year)!.selected_option!.value;
        const month = stateValue(view, BlockId.Month)!.selected_option!.value;
        const mm = ("00" + month).slice(-2);
        const items = await fetchMonthTimeEntries({
          yyyymm: `${year}${mm}`,
          ...components,
        });
        return {
          response_action: "update",
          view: await toReportResultView({
            view: newView(language),
            items,
            user_id,
            month: `${year}/${mm}`,
            ...components,
          }),
        };
      } catch (e) {
        const error =
          `Failed to generate a report (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.SendReportInDM,
    async (args) => {
      const { body, inputs: { user_id } } = args;
      const components = await injectComponents({ ...args });
      const { user } = components;
      try {
        const { yyyymmdd }: ReportPrivateMetadata = JSON.parse(
          body.view.private_metadata,
        );
        const report: MonthlyReport = await generateReport({
          userId: user_id,
          month: yyyymmdd.substring(0, 4) + "/" + yyyymmdd.substring(4, 6),
          items: (await fetchMonthTimeEntries({
            yyyymm: yyyymmdd.substring(0, 6),
            ...components,
          })),
          ...components,
        });
        await shareReportJSONFile({ report, user_id, ...components });
        return {};
      } catch (e) {
        const error = `Failed to send a report (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
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
      const { user, slackApi } = components;
      try {
        await slackApi.views.push({
          trigger_id: body.interactivity.interactivity_pointer,
          view: newAddProjectView({
            blocks: newAddProjectBlocks({ ...components }),
            ...components,
          }),
        });
        return {};
      } catch (e) {
        const error =
          `Failed to open the add-project modal (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.AddProject,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user } = components;
      try {
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
        if (!projects.find((p) => p.code === saved.code)) {
          projects.push(saved);
        }
        projects.sort((a, b) => a.code > b.code ? 1 : -1);
        await syncProjectMainView({
          viewId: view.previous_view_id,
          projects,
          ...components,
        });
        return {};
      } catch (e) {
        const error = `Failed to add a project (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addBlockActionsHandler(
    ActionId.EditProject,
    async (args) => {
      const { body, action } = args;
      const components = await injectComponents({ ...args });
      const { user, slackApi, language } = components;
      try {
        const code: string = action.value;
        const item = await fetchProject({ code, ...components });
        if (!item.code) {
          return {};
        }
        await slackApi.views.push({
          trigger_id: body.interactivity.interactivity_pointer,
          view: newEditProjectView({
            code,
            blocks: newEditProjectBlocks({ item, language }),
            ...components,
          }),
        });
        return {};
      } catch (e) {
        const error =
          `Failed to open the edit-project modal (user: ${user}, error: ${e})`;
        console.log(error);
        return { error };
      }
    },
  ).addViewSubmissionHandler(
    CallbackId.EditProjct,
    async (args) => {
      const { view } = args;
      const components = await injectComponents({ ...args });
      const { user } = components;
      try {
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
          if (rows[i].code === saved.code) {
            projects.push(saved);
          } else {
            projects.push(rows[i]);
          }
        }
        projects.sort((a, b) => a.code > b.code ? 1 : -1);

        await syncProjectMainView({
          viewId: view.previous_view_id,
          projects,
          ...components,
        });
        return {};
      } catch (e) {
        const error =
          `Failed to save project changes (user: ${user}, error: ${e})`;
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
        const recentEntries = await fetchRecentTimeEntries({
          limit: 100,
          yyyymm: todayYYYYMMDD(offset),
          ...components,
        });
        const ranking: Record<string, number> = {};
        for (const entry of recentEntries) {
          for (const w of entry.work_entries) {
            const e = deserializeTimeEntry(w);
            if (e && e.project_code) {
              ranking[e.project_code] = (ranking[e.project_code] || 0) + 1;
            }
          }
        }

        const allProjects = await fetchAllActiveProjects({ ...components });
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
        return { options };
      } catch (e) {
        const error =
          `Failed to return search results (user: ${user}, error: ${e})`;
        console.log(error);
        return { options: [] };
      }
    },
  );

interface ExternalSelectOption {
  text: {
    type: "plain_text";
    text: string;
    emoji?: boolean;
  };
  value: string;
}

export function p(obj: unknown): string {
  return JSON.stringify(obj);
}
