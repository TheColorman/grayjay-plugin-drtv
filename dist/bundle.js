"use strict";
(() => {
  // src/const.ts
  var PLATFORM = "DRTV";
  var MAIN_URL = "https://dr.dk/drtv";
  var API_V1_URL = "https://production-cdn.dr-massive.com/api";
  var API_V2_URL = "https://production-cdn.dr-massive.com/api/v2";

  // src/util.ts
  function throwIfNotOk(response) {
    if (!response.isOk)
      throw new ScriptException(
        `Request failed [${response.code}] for ${response.url}`
      );
    return response;
  }
  function generateUUIDv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === "x" ? r : r & 3 | 8;
      return v.toString(16);
    });
  }

  // src/authentication.ts
  function checkToken(state2) {
    const threeHoursAgo = new Date(
      (/* @__PURE__ */ new Date()).setUTCHours((/* @__PURE__ */ new Date()).getUTCHours() - 3)
    );
    if (!state2.token || threeHoursAgo >= new Date(state2.token.expirationDate)) {
      state2.token = getToken();
      delete state2.userId;
    }
    if (!state2.userId) state2.userId = getUserId(state2.token);
  }
  function getToken() {
    const url = new URL(`${API_V1_URL}/authorization/anonymous-sso`);
    url.searchParams.set("device", "phone_android");
    url.searchParams.set("lang", "da");
    url.searchParams.set("supportFallbackToken", "true");
    const tokenResponse = JSON.parse(
      throwIfNotOk(
        http.POST(
          url.toString(),
          JSON.stringify({
            deviceId: generateUUIDv4(),
            scopes: ["Catalog"],
            optout: true
          }),
          {
            "Content-Type": "application/json"
          },
          false
        )
      ).body
    );
    const accountToken = tokenResponse.find((t) => t.type === "UserAccount");
    if (!accountToken) {
      console.error(
        "Unable to get anonymous token from response:",
        tokenResponse
      );
      throw new ScriptException("Unable to get anonymous token");
    }
    return accountToken;
  }
  function getUserId(token) {
    const account = JSON.parse(
      throwIfNotOk(
        http.GET(
          `${API_V1_URL}/account`,
          { "X-Authorization": `Bearer ${token.value}` },
          false
        )
      ).body
    );
    return account.id;
  }

  // src/channels.ts
  var showToPlatformChannel = (show) => new PlatformChannel({
    id: new PlatformID(PLATFORM, show.id, plugin.config.id),
    url: `${MAIN_URL}${show.path}`,
    name: show.title,
    banner: show.images.wallpaper,
    thumbnail: show.images.tile,
    description: show.shortDescription
  });
  var DRTVChannelPager = class _DRTVChannelPager extends ChannelPager {
    query;
    userId;
    constructor(state2, query) {
      checkToken(state2);
      const channels = _DRTVChannelPager.getSearchPage(query, state2.userId);
      super(channels, false);
      this.query = query;
      this.userId = state2.userId;
    }
    // Not paginated
    nextPage() {
      this.results = [];
      this.hasMore = false;
      return this;
    }
    // Not paginated
    hasMorePagers() {
      return false;
    }
    static getSearchUrl(query, userId) {
      const url = new URL(`${API_V2_URL}/search`);
      url.searchParams.set("group", "false");
      url.searchParams.set("sub", "Registered");
      url.searchParams.set("term", query);
      url.searchParams.set("userId", userId);
      return url;
    }
    static getSearchPage(query, userId) {
      const searchUrl = _DRTVChannelPager.getSearchUrl(query, userId);
      const searchResult = JSON.parse(
        throwIfNotOk(http.GET(searchUrl.toString(), {}, false)).body
      );
      console.log(searchResult);
      return searchResult.series.items.map(showToPlatformChannel);
    }
  };
  function getChannelPage(channelUrl) {
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
  function getChannel(channelUrl) {
    const pageResult = getChannelPage(channelUrl);
    const channel = pageResult.entries[0]?.item;
    if (!channel) throw new ScriptException("Failed to get channel");
    console.log(pageResult);
    return showToPlatformChannel(channel.show);
  }

  // src/video.ts
  var DRTVVideoPager = class extends VideoPager {
    constructor(url) {
      const channel = getChannelPage(url).entries[0]?.item;
      if (!channel) throw new ScriptException("Failed to get channel");
      const platformAuthorLink = new PlatformAuthorLink(
        new PlatformID(
          PLATFORM,
          channel.show.customFields.PathIdSegment,
          plugin.config.id
        ),
        channel.show.title,
        `${MAIN_URL}${channel.show.path}`,
        channel.show.images.tile
      );
      const videos = channel.episodes.items.map(
        (episode) => new PlatformVideo({
          id: new PlatformID(PLATFORM, episode.id, plugin.config.id),
          name: episode.contextualTitle,
          thumbnails: new Thumbnails([new Thumbnail(episode.images.tile, 100)]),
          isLive: false,
          shareUrl: `${MAIN_URL}${episode.path}`,
          datetime: Math.floor(
            new Date(episode.customFields.AvailableFrom).getTime() / 1e3
          ),
          author: platformAuthorLink,
          url: `${MAIN_URL}${episode.watchPath}`,
          duration: episode.duration
        })
      );
      super(videos, false);
    }
    // Endpoint has no pagination
    nextPage() {
      this.results = [];
      this.hasMore = false;
      return this;
    }
    // Endpoint has no pagination
    hasMorePagers() {
      return false;
    }
  };
  function getContentDetails(contentUrl, state2) {
    checkToken(state2);
    const contentId = contentUrl.split("_").at(-1);
    if (!contentId) throw new ScriptException("Failed to get content ID");
    const episodeUrl = new URL(`${API_V1_URL}/items/${contentId}`);
    episodeUrl.searchParams.set("expand", "all");
    episodeUrl.searchParams.set("geoLocation", "dk");
    episodeUrl.searchParams.set("isDeviceAbroad", "false");
    episodeUrl.searchParams.set("sub", "Registered");
    const episode = JSON.parse(
      throwIfNotOk(http.GET(episodeUrl.toString(), {}, false)).body
    );
    const showUrl = new URL(`${API_V1_URL}/items/${episode.showId}`);
    showUrl.searchParams.set("geoLocation", "dk");
    showUrl.searchParams.set("isDeviceAbroad", "false");
    showUrl.searchParams.set("sub", "Registered");
    const show = JSON.parse(
      throwIfNotOk(http.GET(showUrl.toString(), {}, false)).body
    );
    const resolution = episode.offers[0]?.resolution ?? "HD-1080";
    const videosUrl = new URL(`${API_V1_URL}/account/items/${contentId}/videos`);
    videosUrl.searchParams.set("delivery", "stream");
    videosUrl.searchParams.set("device", "web_browser");
    videosUrl.searchParams.set("resolution", resolution);
    videosUrl.searchParams.set("sub", "Registered");
    const videos = JSON.parse(
      throwIfNotOk(
        http.GET(
          videosUrl.toString(),
          { "X-Authorization": `Bearer ${state2.token.value}` },
          false
        )
      ).body
    );
    const sources = getVideoSources(videos);
    return new PlatformVideoDetails({
      id: new PlatformID(PLATFORM, episode.id, plugin.config.id),
      url: `${MAIN_URL}${episode.watchPath}`,
      name: episode.contextualTitle,
      video: new VideoSourceDescriptor(sources),
      isLive: videos.some((v) => v.isStreamLive),
      author: new PlatformAuthorLink(
        new PlatformID(
          PLATFORM,
          show.customFields.PathIdSegment,
          plugin.config.id
        ),
        show.title,
        `${MAIN_URL}${show.path}`,
        show.images.tile
      ),
      description: episode.description,
      rating: new RatingLikes(0),
      thumbnails: new Thumbnails([new Thumbnail(episode.images.tile, 100)]),
      shareUrl: `${MAIN_URL}${episode.path}`,
      datetime: Math.floor(
        new Date(episode.customFields.AvailableFrom).getTime() / 1e3
      )
    });
  }
  function getVideoSources(videos) {
    const videoSources = [];
    for (const video of videos) {
      switch (video.format) {
        case "video/hls": {
          videoSources.push(
            new HLSSource({
              name: video.accessService,
              url: video.url,
              priority: [
                "SpokenSubtitles",
                "SignLanguage",
                "VisuallyInterpreted"
              ].includes(video.accessService) ? false : true
            })
          );
          break;
        }
        default: {
          console.warn(
            "Found an unsupported video source, support should be added:",
            video.format
          );
        }
      }
    }
    return videoSources;
  }

  // src/main.ts
  var state = {};
  source.enable = (_conf, _settings, savedState) => {
    if (savedState) state = JSON.parse(savedState);
    checkToken(state);
  };
  source.disable = () => {
  };
  source.saveState = () => JSON.stringify(state);
  source.searchChannels = (query) => new DRTVChannelPager(state, query);
  source.isChannelUrl = (url) => /https?:\/\/(?:www\.)?dr\.dk\/drtv\/serie\//.test(url);
  source.getChannel = (url) => getChannel(url);
  source.getChannelContents = (url) => new DRTVVideoPager(url);
  source.isContentDetailsUrl = (url) => /https?:\/\/dr\.dk\/drtv\/se\//.test(url);
  source.getContentDetails = (url) => getContentDetails(url, state);
})();
