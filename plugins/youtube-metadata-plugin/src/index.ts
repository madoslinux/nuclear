import type {
  DiscoveryOptions,
  DiscoveryProvider,
  MetadataProvider,
  NuclearPlugin,
  NuclearPluginAPI,
  SearchParams,
  StreamCandidate,
  StreamingProvider,
  Track,
} from '@nuclearplayer/plugin-sdk';

const YOUTUBE_METADATA_ID = 'youtube-metadata';
const YOUTUBE_STREAMING_ID = 'youtube';
const YOUTUBE_DISCOVERY_ID = 'youtube-discovery';

const createMetadataProvider = (api: NuclearPluginAPI): MetadataProvider => ({
  id: YOUTUBE_METADATA_ID,
  kind: 'metadata',
  name: 'YouTube Metadata',
  streamingProviderId: YOUTUBE_STREAMING_ID,
  searchCapabilities: ['tracks'],
  async searchTracks(params: Omit<SearchParams, 'types'>): Promise<Track[]> {
    api.Logger.info(`YouTube Metadata: searching for "${params.query}"`);
    try {
      if (!api.Ytdlp.available) {
        api.Logger.error('YouTube Metadata: Ytdlp API not available');
        return [];
      }

      const results = await api.Ytdlp.search(params.query, params.limit ?? 20);
      api.Logger.info(`YouTube Metadata: got ${results.length} results`);

      return results.map((result) => ({
        title: result.title,
        artists: [{ name: result.channel ?? 'YouTube', roles: [] }],
        durationMs:
          result.duration != null ? result.duration * 1000 : undefined,
        artwork:
          result.thumbnail != null
            ? {
                items: [{ url: result.thumbnail }],
              }
            : undefined,
        source: {
          provider: YOUTUBE_METADATA_ID,
          id: result.id,
          url: `https://youtube.com/watch?v=${result.id}`,
        },
      }));
    } catch (error) {
      api.Logger.error(
        `YouTube Metadata: search failed - ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  },
});

const createStreamingProvider = (api: NuclearPluginAPI): StreamingProvider => ({
  id: YOUTUBE_STREAMING_ID,
  kind: 'streaming',
  name: 'YouTube',
  async searchForTrack(
    artist: string,
    title: string,
  ): Promise<StreamCandidate[]> {
    api.Logger.info(
      `YouTube Streaming: searching for track ${artist} - ${title}`,
    );
    try {
      if (!api.Ytdlp.available) {
        api.Logger.error('YouTube Streaming: Ytdlp API not available');
        return [];
      }
      const results = await api.Ytdlp.search(`${artist} ${title}`, 5);
      return results.map(
        (result): StreamCandidate => ({
          id: result.id,
          title: result.title,
          durationMs:
            result.duration != null ? result.duration * 1000 : undefined,
          thumbnail: result.thumbnail ?? undefined,
          failed: false,
          source: {
            provider: YOUTUBE_STREAMING_ID,
            id: result.id,
            url: `https://youtube.com/watch?v=${result.id}`,
          },
        }),
      );
    } catch (error) {
      api.Logger.error(
        `YouTube Streaming: search failed - ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  },
  async getStreamUrl(candidateId: string) {
    api.Logger.info(`YouTube Streaming: getting stream for ${candidateId}`);
    if (!api.Ytdlp.available) {
      throw new Error('Ytdlp API not available');
    }
    const streamInfo = await api.Ytdlp.getStream(candidateId);
    return {
      url: streamInfo.stream_url,
      protocol: 'https' as const,
      durationMs:
        streamInfo.duration != null ? streamInfo.duration * 1000 : undefined,
      container: streamInfo.container ?? undefined,
      codec: streamInfo.codec ?? undefined,
      source: {
        provider: YOUTUBE_STREAMING_ID,
        id: candidateId,
        url: `https://youtube.com/watch?v=${candidateId}`,
      },
    };
  },
});

const createDiscoveryProvider = (api: NuclearPluginAPI): DiscoveryProvider => ({
  id: YOUTUBE_DISCOVERY_ID,
  kind: 'discovery',
  name: 'YouTube Discovery',
  async getRecommendations(
    context: Track[],
    options: DiscoveryOptions,
  ): Promise<Track[]> {
    api.Logger.info(
      `YouTube Discovery: getting recommendations for ${context.length} tracks`,
    );
    try {
      if (!api.Ytdlp.available) {
        api.Logger.error('YouTube Discovery: Ytdlp API not available');
        return [];
      }

      const contextQuery = context
        .slice(0, 3)
        .map((t) => `${t.title} ${t.artists[0]?.name ?? ''}`)
        .join(' ');
      const results = await api.Ytdlp.search(
        `music ${contextQuery} related songs`,
        options.limit ?? 20,
      );
      api.Logger.info(
        `YouTube Discovery: got ${results.length} recommendations`,
      );

      return results.map((result) => ({
        title: result.title,
        artists: [{ name: result.channel ?? 'YouTube', roles: [] }],
        durationMs:
          result.duration != null ? result.duration * 1000 : undefined,
        artwork:
          result.thumbnail != null
            ? {
                items: [{ url: result.thumbnail }],
              }
            : undefined,
        source: {
          provider: YOUTUBE_METADATA_ID,
          id: result.id,
          url: `https://youtube.com/watch?v=${result.id}`,
        },
      }));
    } catch (error) {
      api.Logger.error(
        `YouTube Discovery: failed - ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  },
});

const plugin: NuclearPlugin = {
  onLoad(api: NuclearPluginAPI) {
    api.Logger.info('YouTube plugin loaded');
  },

  onEnable(api: NuclearPluginAPI) {
    const metadataProvider = createMetadataProvider(api);
    const streamingProvider = createStreamingProvider(api);
    const discoveryProvider = createDiscoveryProvider(api);
    api.Providers.register(metadataProvider);
    api.Providers.register(streamingProvider);
    api.Providers.register(discoveryProvider);
    api.Logger.info(
      'YouTube providers registered (metadata + streaming + discovery)',
    );
  },

  onDisable() {
    // Providers are automatically unregistered on disable
  },

  onUnload() {
    // Cleanup if needed
  },
};

export default plugin;
