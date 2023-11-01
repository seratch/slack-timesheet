import { SlackAPIClient, UsersInfoResponse } from "slack-web-api-client/mod.ts";

interface fetchUserDetailsArgs {
  slackApi: SlackAPIClient;
  user: string;
}
export async function fetchUserDetails(
  { slackApi, user }: fetchUserDetailsArgs,
): Promise<UsersInfoResponse> {
  return await slackApi.users.info({
    user,
    include_locale: true,
  });
}
