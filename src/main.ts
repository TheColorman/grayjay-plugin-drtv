import { checkToken } from "./authentication";
import { DRTVChannelPager, getChannel } from "./channels";
import { PluginState } from "./types";
import { DRTVVideoPager, getContentDetails } from "./video";

let state: PluginState = {};

source.enable = (_conf, _settings, savedState) => {
  if (savedState) state = JSON.parse(savedState);
  checkToken(state);
};
source.disable = () => {};
source.saveState = () => JSON.stringify(state);

source.searchChannels = (query) => new DRTVChannelPager(state, query);

source.isChannelUrl = (url) =>
  /https?:\/\/(?:www\.)?dr\.dk\/drtv\/serie\//.test(url);
source.getChannel = (url) => getChannel(url);
source.getChannelContents = (url) => new DRTVVideoPager(url);

source.isContentDetailsUrl = (url) => /https?:\/\/dr\.dk\/drtv\/se\//.test(url);
source.getContentDetails = (url) => getContentDetails(url, state);
