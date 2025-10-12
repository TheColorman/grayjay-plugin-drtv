import { API_V1_URL } from "./const";
import { AccountResult, PluginState, TokenResult } from "./types";
import { generateUUIDv4, throwIfNotOk } from "./util";

/**
 * Checks whether the state token and userId are valid, and refreshes them if
 * they are not.
 */
export function checkToken(state: PluginState): asserts state is {
  [K in keyof PluginState]-?: NonNullable<PluginState[K]>;
} {
  const threeHoursAgo = new Date(
    new Date().setUTCHours(new Date().getUTCHours() - 3),
  );

  if (!state.token || threeHoursAgo >= new Date(state.token.expirationDate)) {
    state.token = getToken();
    // Delete userId as it only applies to old token
    delete state.userId;
  }

  if (!state.userId) state.userId = getUserId(state.token);
}

/**
 * Gets an anonymous token from the DRTV API.
 * See: https://github.com/yt-dlp/yt-dlp/blob/c0a7c594a9e67ac2ee4cde38fa4842a0b2d675e8/yt_dlp/extractor/drtv.py#L141
 */
function getToken(): NonNullable<PluginState["token"]> {
  const url = new URL(`${API_V1_URL}/authorization/anonymous-sso`);
  url.searchParams.set("device", "phone_android");
  url.searchParams.set("lang", "da");
  url.searchParams.set("supportFallbackToken", "true");

  const tokenResponse: TokenResult = JSON.parse(
    throwIfNotOk(
      http.POST(
        url.toString(),
        JSON.stringify({
          deviceId: generateUUIDv4(),
          scopes: ["Catalog"],
          optout: true,
        }),
        {
          "Content-Type": "application/json",
        },
        false,
      ),
    ).body,
  );

  const accountToken = tokenResponse.find((t) => t.type === "UserAccount");
  if (!accountToken) {
    console.error(
      "Unable to get anonymous token from response:",
      tokenResponse,
    );
    throw new ScriptException("Unable to get anonymous token");
  }

  return accountToken;
}

/** Get the userId given an Account token */
function getUserId(token: NonNullable<PluginState["token"]>) {
  const account: AccountResult = JSON.parse(
    throwIfNotOk(
      http.GET(
        `${API_V1_URL}/account`,
        { "X-Authorization": `Bearer ${token.value}` },
        false,
      ),
    ).body,
  );

  return account.id;
}
