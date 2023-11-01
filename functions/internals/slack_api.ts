import { SlackAPIClient, UsersInfoResponse } from "slack-web-api-client/mod.ts";

let _fetchUserDetails: UsersInfoResponse | undefined;
interface fetchUserDetailsArgs {
  slackApi: SlackAPIClient;
  user: string;
}
export async function fetchUserDetails(
  { slackApi, user }: fetchUserDetailsArgs,
): Promise<UsersInfoResponse> {
  if (_fetchUserDetails) return _fetchUserDetails;
  _fetchUserDetails = await slackApi.users.info({
    user,
    include_locale: true,
  });
  return _fetchUserDetails;
}
