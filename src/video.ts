import { checkToken } from "./authentication";
import { getChannelPage } from "./channels";
import { API_V1_URL, MAIN_URL, PLATFORM } from "./const";
import { EpisodeFeed, PluginState, ShowFeed, VideosResult } from "./types";
import { throwIfNotOk } from "./util";

export class DRTVVideoPager extends VideoPager {
  constructor(url: string) {
    const channel = getChannelPage(url).entries[0]?.item;
    if (!channel) throw new ScriptException("Failed to get channel");

    const platformAuthorLink = new PlatformAuthorLink(
      new PlatformID(
        PLATFORM,
        channel.show.customFields.PathIdSegment,
        plugin.config.id,
      ),
      channel.show.title,
      `${MAIN_URL}${channel.show.path}`,
      channel.show.images.tile,
    );

    const videos = channel.episodes.items.map(
      (episode) =>
        new PlatformVideo({
          id: new PlatformID(PLATFORM, episode.id, plugin.config.id),
          name: episode.contextualTitle,
          thumbnails: new Thumbnails([new Thumbnail(episode.images.tile, 100)]),
          isLive: false,
          shareUrl: `${MAIN_URL}${episode.path}`,
          datetime: Math.floor(
            new Date(episode.customFields.AvailableFrom).getTime() / 1000,
          ),
          author: platformAuthorLink,
          url: `${MAIN_URL}${episode.watchPath}`,
          duration: episode.duration,
        }),
    );

    // Endpoint has no pagination
    super(videos, false);
  }

  // Endpoint has no pagination
  override nextPage(): VideoPager {
    this.results = [];
    this.hasMore = false;
    return this;
  }

  // Endpoint has no pagination
  override hasMorePagers(): boolean {
    return false;
  }
}

// https://www.dr.dk/drtv/episode/tva_-stigende-tilfaelde-af-tarmsygdom-kobles-til-kost_567238
export function getContentDetails(contentUrl: string, state: PluginState) {
  checkToken(state);

  const contentId = contentUrl.split("_").at(-1);
  if (!contentId) throw new ScriptException("Failed to get content ID");

  const episodeUrl = new URL(`${API_V1_URL}/items/${contentId}`);
  episodeUrl.searchParams.set("expand", "all");
  episodeUrl.searchParams.set("geoLocation", "dk");
  episodeUrl.searchParams.set("isDeviceAbroad", "false");
  episodeUrl.searchParams.set("sub", "Registered");

  const episode: EpisodeFeed = JSON.parse(
    throwIfNotOk(http.GET(episodeUrl.toString(), {}, false)).body,
  );

  const showUrl = new URL(`${API_V1_URL}/items/${episode.showId}`);
  showUrl.searchParams.set("geoLocation", "dk");
  showUrl.searchParams.set("isDeviceAbroad", "false");
  showUrl.searchParams.set("sub", "Registered");

  const show: ShowFeed = JSON.parse(
    throwIfNotOk(http.GET(showUrl.toString(), {}, false)).body,
  );

  const resolution = episode.offers[0]?.resolution ?? "HD-1080";

  const videosUrl = new URL(`${API_V1_URL}/account/items/${contentId}/videos`);
  videosUrl.searchParams.set("delivery", "stream");
  videosUrl.searchParams.set("device", "web_browser");
  videosUrl.searchParams.set("resolution", resolution);
  videosUrl.searchParams.set("sub", "Registered");

  const videos: VideosResult = JSON.parse(
    throwIfNotOk(
      http.GET(
        videosUrl.toString(),
        { "X-Authorization": `Bearer ${state.token.value}` },
        false,
      ),
    ).body,
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
        plugin.config.id,
      ),
      show.title,
      `${MAIN_URL}${show.path}`,
      show.images.tile,
    ),
    description: episode.description,
    rating: new RatingLikes(0),
    thumbnails: new Thumbnails([new Thumbnail(episode.images.tile, 100)]),
    shareUrl: `${MAIN_URL}${episode.path}`,
    datetime: Math.floor(
      new Date(episode.customFields.AvailableFrom).getTime() / 1000,
    ),
  });
}

function getVideoSources(videos: VideosResult) {
  const videoSources: IVideoSource[] = [];

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
              "VisuallyInterpreted",
            ].includes(video.accessService)
              ? false
              : true,
          }),
        );
        break;
      }
      default: {
        console.warn(
          "Found an unsupported video source, support should be added:",
          video.format,
        );
      }
    }
  }

  return videoSources;
}
