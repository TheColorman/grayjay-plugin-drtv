import { checkToken } from "./authentication";
import { API_V1_URL, API_V2_URL, MAIN_URL, PLATFORM } from "./const";
import { PageResult, PluginState, SearchResult, ShowFeed } from "./types";
import { throwIfNotOk } from "./util";

const showToPlatformChannel = (show: ShowFeed) =>
  new PlatformChannel({
    id: new PlatformID(PLATFORM, show.id, plugin.config.id),
    url: `${MAIN_URL}${show.path}`,
    name: show.title,
    banner: show.images.wallpaper,
    thumbnail: show.images.tile,
    description: show.shortDescription,
  });

export class DRTVChannelPager extends ChannelPager {
  query: string;
  userId: string;

  constructor(state: PluginState, query: string) {
    checkToken(state);
    const channels = DRTVChannelPager.getSearchPage(query, state.userId);

    // hasMore is false because the search endpoint isn't properly paginated
    super(channels, false);

    this.query = query;
    this.userId = state.userId;
  }

  // Not paginated
  override nextPage(): ChannelPager {
    this.results = [];
    this.hasMore = false;
    return this;
  }

  // Not paginated
  override hasMorePagers(): boolean {
    return false;
  }

  static getSearchUrl(query: string, userId: string) {
    const url = new URL(`${API_V2_URL}/search`);
    url.searchParams.set("group", "false");
    url.searchParams.set("sub", "Registered");
    url.searchParams.set("term", query);
    url.searchParams.set("userId", userId);

    return url;
  }

  static getSearchPage(query: string, userId: string) {
    const searchUrl = DRTVChannelPager.getSearchUrl(query, userId);
    const searchResult: SearchResult = JSON.parse(
      throwIfNotOk(http.GET(searchUrl.toString(), {}, false)).body,
    );

    console.log(searchResult);
    return searchResult.series.items.map(showToPlatformChannel);
  }
}

export function getChannelPage(channelUrl: string): PageResult {
  const seriesPath = /dr\.dk\/drtv\/serie\/(?<id>.*)$/.exec(channelUrl);
  if (!(seriesPath && seriesPath.groups && "id" in seriesPath.groups))
    throw new ScriptException("Failed to parse channel path");

  const seriesId = seriesPath.groups["id"];

  const url = new URL(`${API_V1_URL}/page`);
  url.searchParams.set("geoLocation", "dk");
  url.searchParams.set("isDeviceAbroad", "false");
  url.searchParams.set("sub", "Registered");
  url.searchParams.set("text_entry_format", "html");
  url.searchParams.set("item_detail_expand", "all");
  url.searchParams.set("path", `/serie/${seriesId}`);

  return JSON.parse(throwIfNotOk(http.GET(url.toString(), {}, false)).body);
}

export function getChannel(channelUrl: string): PlatformChannel {
  const pageResult = getChannelPage(channelUrl);
  const channel = pageResult.entries[0]?.item;
  if (!channel) throw new ScriptException("Failed to get channel");

  console.log(pageResult);

  return showToPlatformChannel(channel.show);
}
