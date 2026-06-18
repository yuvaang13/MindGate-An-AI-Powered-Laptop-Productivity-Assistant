import { Configuration, AppSettings } from '../types.js';
import { app } from 'electron';
import { join, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

export class ConfigurationService {
  private configuration: Configuration;
  private filePath: string;

  constructor() {
    this.filePath = this.getConfigurationPath();
    this.configuration = this.loadConfiguration();
  }

  private getConfigurationPath(): string {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, 'mindgate-config.json');
  }

  private loadConfiguration(): Configuration {
    const defaultConfig = this.getDefaultConfiguration();

    if (existsSync(this.filePath)) {
      try {
        const data = readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        return this.mergeWithDefaults(parsed, defaultConfig);
      } catch (error) {
        console.error('Failed to load configuration, using defaults:', error);
      }
    }

    this.saveConfiguration(defaultConfig);
    return defaultConfig;
  }

  private mergeWithDefaults(loaded: Partial<Configuration>, defaults: Configuration): Configuration {
    const merged: Configuration = {
      settings: {
        ...defaults.settings,
        ...loaded.settings
      },
      theme: {
        colors: { ...defaults.theme.colors, ...loaded.theme?.colors },
        animation: { ...defaults.theme.animation, ...loaded.theme?.animation },
        dimensions: { ...defaults.theme.dimensions, ...loaded.theme?.dimensions }
      }
    };
    this.validateConfig(merged, defaults);
    return merged;
  }

  private validateConfig(config: Configuration, defaults: Configuration): void {
    if (!Array.isArray(config.settings.distractingApps)) {
      config.settings.distractingApps = defaults.settings.distractingApps;
    }
    if (!Array.isArray(config.settings.restrictedKeywords)) {
      config.settings.restrictedKeywords = defaults.settings.restrictedKeywords;
    }
    if (!Array.isArray(config.settings.monitoredBrowsers)) {
      config.settings.monitoredBrowsers = defaults.settings.monitoredBrowsers;
    }
    if (typeof config.settings.justificationCountdownDuration !== 'number' || config.settings.justificationCountdownDuration <= 0) {
      config.settings.justificationCountdownDuration = defaults.settings.justificationCountdownDuration;
    }
    const legacyOverlayWidths = new Set([240, 360]);
    const legacyOverlayHeights = new Set([200, 420]);
    if (legacyOverlayWidths.has(config.theme.dimensions.overlayWidth) || typeof config.theme.dimensions.overlayWidth !== 'number' || config.theme.dimensions.overlayWidth < 300 || config.theme.dimensions.overlayWidth > 360) {
      config.theme.dimensions.overlayWidth = defaults.theme.dimensions.overlayWidth;
    }
    if (legacyOverlayHeights.has(config.theme.dimensions.overlayHeight) || typeof config.theme.dimensions.overlayHeight !== 'number' || config.theme.dimensions.overlayHeight < 320 || config.theme.dimensions.overlayHeight > 430) {
      config.theme.dimensions.overlayHeight = defaults.theme.dimensions.overlayHeight;
    }
    const legacyBlack = new Set(['#000', '#000000']);
    if (legacyBlack.has(config.theme.colors.background)) {
      config.theme.colors.background = defaults.theme.colors.background;
    }
    if (legacyBlack.has(config.theme.colors.surface)) {
      config.theme.colors.surface = defaults.theme.colors.surface;
    }
  }

  private getDefaultConfiguration(): Configuration {
    return {
      settings: {
        distractingApps: [
          'Twitter', 'TweetDeck', 'Reddit',
          'TikTok', 'Instagram', 'Threads', 'Facebook',
          'Netflix', 'YouTube', 'Twitch', 'Hulu', 'Disney+', 'HBOMax',
          'Snapchat', 'Pinterest', 'LinkedIn', 'Tumblr',
          'Tinder', 'Bumble', 'Hinge', 'Grindr',
          'Steam', 'Epic Games', 'Battle.net', 'Roblox', 'Minecraft',
          'Amazon', 'eBay', 'Etsy', 'Walmart', 'Target', 'Best Buy',
          'AliExpress', 'Temu', 'Shein', 'Wish',
        ],
        restrictedKeywords: [
          // Social Media
          'facebook', 'fb.com', 'fb.watch',
          'twitter', 'x.com', 'tweetdeck', 'tweet',
          'instagram', 'threads.net',
          'tiktok',
          'snapchat',
          'pinterest',
          'linkedin',
          'tumblr',
          'tinder', 'bumble', 'hinge', 'okcupid', 'grindr', 'badoo',

          // Video & Streaming
          'youtube', 'youtu.be', 'youtube-nocookie',
          'netflix', 'hulu', 'disney+', 'hbomax', 'max', 'peacock', 'paramount+',
          'crunchyroll', 'funimation', 'bilibili',
          'streaming', 'watch movie', 'watch anime',

          // Live Streaming
          'twitch', 'kick.com',

          // Forums
          'reddit',
          '4chan', '8kun',
          'fandom',

          // Memes & Image Sharing
          'imgur', 'giphy', '9gag', 'tenor',
          'memes', 'knowyourmeme',
          'deviantart',

          // Shopping
          'amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy',
          'aliexpress', 'temu', 'shein', 'wish',
          'nike', 'adidas', 'zara', 'hm', 'sephora', 'ulta',

          // Gaming
          'steam', 'epic games', 'roblox',
          'playstation', 'xbox', 'nintendo',
          'minecraft', 'fortnite', 'valorant', 'league of legends',

          // Adult
          'pornhub', 'xvideos', 'xhamster', 'xnxx', 'redtube', 'onlyfans',
          'chaturbate', 'stripchat',
          'nsfw', 'adult',

          // Pirated Content
          'thepiratebay', '1337x', 'rutracker',
          'kissanime', 'gogoanime', 'fmovies', 'soap2day',

          // Gambling
          'draftkings', 'fanduel', 'bet365', 'pokerstars',
          'casino', 'poker',

          // Entertainment / Gossip / General Traps
          'buzzfeed', 'tmz', 'eonline', 'people', 'pagesix',
          'dailymail', 'thesun', 'mirror',
          'gaming', 'entertainment', 'celebrity', 'gossip',
          'viral', 'trending',
        ],
        monitoredBrowsers: ['Safari', 'Google Chrome', 'Microsoft Edge', 'Firefox', 'Brave'],
        ollamaURL: 'http://localhost:11434/api/generate',
        ollamaModel: 'gemma3:1b',
        accessDurations: [300, 600, 900],
        accessDurationLabels: ['5 Mins', '10 Mins', '15 Mins'],
        productiveTasks: [
          'Review today\'s coding tasks',
          'Plan next steps for MindGate',
          'Learn a new concept',
          'Organize project files',
          'Respond to important emails'
        ],
        productiveApps: ['Terminal', 'Notes', 'Obsidian', 'Calendar'],
        justificationCountdownDuration: 20
      },
      theme: {
        colors: {
          primary: '#7ee7c9',
          secondary: '#a8b0bd',
          accent: '#7ee7c9',
          background: '#111318',
          surface: '#1b202b',
          text: '#f4f1ea',
          textSecondary: '#a8b0bd',
          error: '#ff6b5f',
          warning: '#ffd166',
        },
        animation: {
          transitionDuration: 0.25,
          overlayFadeDuration: 0.25,
        },
        dimensions: {
          overlayWidth: 330,
          overlayHeight: 380,
          chatCornerRadius: 24,
        }

      }
    };
  }

  getConfiguration(): Configuration {
    return this.configuration;
  }

  updateSettings(settings: Partial<AppSettings>): void {
    this.configuration.settings = {
      ...this.configuration.settings,
      ...settings
    };
    this.saveConfiguration(this.configuration);
  }

  updateTheme(theme: Partial<Configuration['theme']>): void {
    this.configuration.theme = {
      ...this.configuration.theme,
      ...theme
    };
    this.saveConfiguration(this.configuration);
  }

  private saveConfiguration(config: Configuration): void {
    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }
}