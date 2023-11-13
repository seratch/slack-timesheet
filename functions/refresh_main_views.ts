import { DefineFunction, SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  SlackAPIClient,
  SlackAPIClient as SlackAPI,
  SlackAPIError,
} from "slack-web-api-client/mod.ts";
import { DataMapper, SavedAttributes } from "deno-slack-data-mapper/mod.ts";

import {
  AU,
  AUMapper,
  AV,
  AVMapper,
  cleanUpOldActiveViews,
  fetchLifelog,
  fetchTimeEntry,
  L,
  LMapper,
  OP,
  OPMapper,
  PH,
  PHMapper,
  saveLastActiveView,
  TE,
  TEMapper,
  US,
  USMapper,
} from "./internals/datastore.ts";
import {
  AppModeCode,
  CallbackId,
  LanguageCode,
} from "./internals/constants.ts";
import { isManualEntryPermitted } from "./internals/organization_policies.ts";
import { newView, toMainView } from "./internals/views.ts";
import {
  determineIsDebugMode,
  determineLogLevel,
} from "./internals/debug_mode.ts";
import { todayYYYYMMDD } from "./internals/datetime.ts";
import {
  buildCanAccessAdminFeature,
  buildHolidays,
} from "./internals/components.ts";

export const def = DefineFunction({
  callback_id: "refresh_main_views",
  title: "Refresh active main views",
  source_file: "functions/refresh_main_views.ts",
  input_parameters: { properties: {}, required: [] },
  output_parameters: { properties: {}, required: [] },
});

export default SlackFunction(def, async ({ token, env, client }) => {
  const start = new Date();
  const isDebugMode: boolean = determineIsDebugMode(env);
  const logLevel = determineLogLevel(env);
  const slackApi = new SlackAPI(token, { logLevel });
  const [us, av, te, l, op, au, ph] = [
    USMapper(client, logLevel),
    AVMapper(client, logLevel),
    TEMapper(client, logLevel),
    LMapper(client, logLevel),
    OPMapper(client, logLevel),
    AUMapper(client, logLevel),
    PHMapper(client, logLevel),
  ];

  let activeViews: SavedAttributes<AV>[] = [];
  try {
    activeViews = (await av.findAll()).items;
    if (activeViews) {
      activeViews.sort((a, b) =>
        a.user_id + a.last_updated_at > b.user_id + b.last_updated_at ? -1 : 1
      );
    }
    console.log(`${activeViews.length} active views found`);
    if (isDebugMode) {
      console.log(activeViews);
    }
  } catch (e) {
    const error = `Failed to fetch active view data (error: ${e})`;
    return { error };
  }
  if (activeViews) {
    const foundUsers: string[] = [];
    const tasks: Promise<void>[] = [];
    try {
      for (const activeView of activeViews) {
        tasks.push(updateActiveView({
          isDebugMode,
          activeView,
          foundUsers,
          slackApi,
          us,
          av,
          te,
          l,
          op,
          au,
          ph,
        }));
      }
      for (const user_id of foundUsers) {
        tasks.push(cleanUpOldActiveViews({ av, user_id }));
      }
      const all = Promise.all(tasks);
      await Promise.race([
        all,
        new Promise((resolve) => setTimeout(resolve, 14000)),
      ]);
      const end = new Date();
      const spentMillis = end.getTime() - start.getTime();
      const seconds = Math.floor(spentMillis / 100) / 10;
      console.log(`!!! All updates completed within ${seconds} seconds`);
    } catch (e) {
      console.log(`!!! Failed to complete the tasks: ${e}`);
    }
  }

  return { outputs: {} };
});

interface updateActiveViewArgs {
  isDebugMode: boolean;
  foundUsers: string[];
  activeView: SavedAttributes<AV>;
  slackApi: SlackAPIClient;
  us: DataMapper<US>;
  av: DataMapper<AV>;
  te: DataMapper<TE>;
  l: DataMapper<L>;
  op: DataMapper<OP>;
  au: DataMapper<AU>;
  ph: DataMapper<PH>;
}
async function updateActiveView({
  isDebugMode,
  foundUsers,
  activeView,
  slackApi,
  us,
  av,
  te,
  l,
  op,
  au,
  ph,
}: updateActiveViewArgs) {
  const now = Math.floor(new Date().getTime() / 1000);
  // this view has been kept open for a while
  const minutes = 5 * 60;
  try {
    if (!foundUsers.includes(activeView.user_id)) {
      foundUsers.push(activeView.user_id);
    }
    if (activeView.last_updated_callback_id === CallbackId.MainView) {
      if (activeView.last_updated_at < now - minutes) {
        const user = activeView.user_id;
        const settings = (await us.findById(user)).item;
        const [language, country, offset, isLifelogEnabled] = [
          settings.language || LanguageCode.English,
          settings.country_id,
          settings.offset || 0,
          settings.app_mode === AppModeCode.WorkAndLifelogs,
        ];
        const yyyymmdd = todayYYYYMMDD(offset);
        try {
          const result = await slackApi.views.update({
            view_id: activeView.view_id,
            view: await toMainView({
              view: newView(language),
              entry: await fetchTimeEntry({ te, user, offset, yyyymmdd }),
              lifelog: isLifelogEnabled
                ? await fetchLifelog({ l, user, offset, yyyymmdd })
                : undefined,
              isDebugMode,
              isLifelogEnabled,
              offset,
              language,
              country,
              manualEntryPermitted: await isManualEntryPermitted({ op }),
              canAccessAdminFeature: buildCanAccessAdminFeature(au, user),
              holidays: buildHolidays(ph, country, yyyymmdd),
              yyyymmdd,
            }),
          });
          await saveLastActiveView({
            av,
            callback_id: result.view!.callback_id!,
            view_id: result.view!.id!,
            user_id: user,
          });
        } catch (e) {
          console.log(`Failed to update an active view: ${e}`);
          if (e instanceof SlackAPIError) {
            const apiError = e as SlackAPIError;
            if (apiError.error === "not_found") {
              // The modal view seems to be already closed
              await av.deleteById(activeView.view_id);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(
      `Failed to handle ${JSON.stringify(activeView)} due to ${e}`,
    );
  }
}
