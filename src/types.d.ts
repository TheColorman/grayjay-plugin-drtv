export type PluginState = {
  token?: Token & {
    type: "UserAccount";
  };
  userId?: string;
};

export type CustomFields = { [key: string]: string | CustomFields };

// Common types
export type Token = {
  /** ISO 8601 */
  expirationDate: string;
  refreshable: boolean;
  value: string;
  type: "UserAccount" | "UserProfile";
};

export type Images = {
  wallpaper: string;
  poster: string;
  tile: string;
};

export type Paging = {
  total: number;
  page: number;
  size: number;
  next: string;
  options?: {
    pageSize: number;
  };
};

export type Classification = { code: string; name: string };

export type Offer = {
  deliveryType: "StreamOrDownload";
  /** ISO 8601 */
  endDate: string;
  scopes: string[];
  exclusionRules: [];
  resolution: string;
  name: string;
  availability: "Available";
  ownership: "Free";
  price: number;
  /** ISO 8601 */
  startDate: string;
};

// Feed types
export type FeedItem = {
  id: string;
  keywords: string[];
  images: Images;
  offers: Offer[];
  scopes: string[];
  categories: string[];
  customFields: CustomFields;
  customId: string;
  genres: string[];
  sports: [];
  type: string;
  subtype: string;
  themes: [];
  title: string;
  shortDescription: string;
  path: string;
  contextualTitle: string;
};

export interface ShowFeed extends FeedItem {
  type: "show";
  availableSeasonCount: number;
  tagLine: string;
  customFields: CustomFields & {
    PathIdSegment: string;
  };
}

export interface SeasonFeed extends FeedItem {
  type: "season";
  showId: string;
  releaseYear: number;
  availableEpisodeCount: number;
  seasonNumber: number;
  episodeCount: number;
  channelPath: string;
  vodItemWatchPath: string;
  classification: Classification;
}

export interface EpisodeFeed extends FeedItem {
  type: "episode";
  seasonId: string;
  showId: string;
  customFields: CustomFields & {
    /** ISO 8601 */
    AvailableFrom: string;
  };
  channelPath: string;
  classification: Classification;
  duration: number;
  episodeName: string;
  episodeNumber: number;
  releaseYear: number;
  vodItemWatchPath: string;
  watchPath: string;
  description: string;
}

// Detail types
export type DetailItem = {
  advisoryText: string;
  copyright: string;
  credits: [];
  cusomMetadata: [];
  distributor: string;
  trailers: [];
  channelPath: string;
  description: string;
};

export interface ShowDetail extends ShowFeed, DetailItem {
  seasons: {
    id: string;
    path: string;
    items: SeasonFeed[];
  };
  size: number;
  paging: Paging;
  nextEpisode: {
    available: string;
    /** Unix epoch */
    availableUTC: string;
  };
}

export interface SeasonDetail extends SeasonFeed, DetailItem {
  episodes: {
    id: string;
    items: EpisodeFeed[];
    pagh: string;
    size: number;
  };
  genrePaths: [];
  totalUserRatings: number;
  show: ShowDetail;
}

export interface EpisodeDetail extends EpisodeFeed, DetailItem {
  totalUserRatings: number;
  season: SeasonDetail;
  show: ShowDetail;
}

export type VideoResult = {
  accessService:
    | "StandardVideo"
    | "SpokenSubtitles"
    | "SignLanguage"
    | "VisuallyInterpreted"
    | string;
  channels: number;
  complianceProfile: string;
  containerFormat: string;
  deliveryType: "Stream" | string;
  drm: string;
  format: string;
  resolution: "HD-1080" | string;
  height: number;
  width: number;
  isStreamLive: boolean;
  language: "da" | "foreign" | string;
  name: "Video Resource";
  subtitles: {
    format: string;
    isEmbedded: boolean;
    isHardSubs: boolean;
    language: "DanishLanguageSubtitles" | string;
    link: string;
  }[];
  timeCodes: {
    duration: number;
    endTime: number;
    startTime: number;
    timeCodeType: string;
  }[];
  url: string;
};

// Top level response types
// /api/authorization/anonymous-sso
export type TokenResult = [
  Token & {
    type: "UserAccount";
  },
  Token & {
    type: "UserProfile";
  },
];

// /api/account
export type AccountResult = {
  id: string;
  name: string;
  pinEnabled: boolean;
  purchaseEnabled: boolean;
  color: `#${string}`;
  segments: string[];
  isActive: boolean;
  marketingEnabled: boolean;
  bookmarked: unknown;
  watched: unknown;
  rated: unknown;
};

// /api/v2/search
export type SearchResult = {
  term: string;
  total: number;
  people: [];
  series: {
    id: "series-items";
    title: "Series";
    path: "";
    itemTypes: ["show"];
    items: ShowFeed[];
  };
};

// /api/page
export type PageResult = {
  id: string;
  isStatic: boolean;
  isSystemPage: boolean;
  metadata: {
    description: string;
    keywords: string[];
  };
  key: string;
  path: string;
  template: string;
  themes: [];
  title: string;
  entries: {
    id: string;
    type: string;
    template: string;
    title: string;
    item: SeasonDetail;
  }[];
  canonical: string;
};

// /api/account/items/:itemId/videos
export type VideosResult = VideoResult[];
