export function throwIfNotOk<T>(
  response: BridgeHttpResponse<T>,
): BridgeHttpResponse<T> {
  if (!response.isOk)
    throw new ScriptException(
      `Request failed [${response.code}] for ${response.url}`,
    );

  return response;
}

/**
 * Generate a pseudo-random UUIDv4.
 * See: https://github.com/futo-org/grayjay-plugin-dailymotion/blob/d95df7dca2b0fdd9b172c7d0a4175580f0313fe4/src/util.ts#L113
 */
export function generateUUIDv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
