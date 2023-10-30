import { Manifest } from "deno-slack-sdk/mod.ts";
import Timesheet from "./workflows/timesheet.ts";

import TimeEntries from "./datastores/time_entries.ts";
import UserSettings from "./datastores/user_settings.ts";
import Countries from "./datastores/countries.ts";
import PublicHolidays from "./datastores/public_holidays.ts";
import AdminUsers from "./datastores/admin_users.ts";
import Projects from "./datastores/projects.ts";
import OrganizationPolicies from "./datastores/organization_policies.ts";

export default Manifest({
  name: "Timesheet",
  description: "Timesheet, an app designed to manage work hours in Slack",
  icon: "assets/icon.png",
  outgoingDomains: [
    "files.slack.com", // for uploadng files
  ],
  workflows: [
    Timesheet,
  ],
  datastores: [
    TimeEntries,
    UserSettings,
    Countries,
    PublicHolidays,
    Projects,
    AdminUsers,
    OrganizationPolicies,
  ],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
    "users:read",
    "files:write",
  ],
});
