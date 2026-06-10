import { Configuration, AppSettings } from '../types.js';
import { app } from 'electron';
import { join } from 'path';
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
    return {
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
          'Twitch',
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
        justificationCountdownDuration: 60
      },
      theme: {
        colors: {
          primary: '#FFFFFF',
          secondary: '#FFFFFFB3',
          accent: '#FFFFFF99',
          background: '#000000',
          surface: '#000000',
          text: '#FFFFFF',
          textSecondary: '#FFFFFFB3',
          error: '#FF453A',
          warning: '#FF9F0A'
        },
animation: {
          transitionDuration: 0.3,
          overlayFadeDuration: 0.3
        },
        dimensions: {
          overlayWidth: 340,
          overlayHeight: 340,
          chatCornerRadius: 24,
          overlayXOffset: 24,
          overlayYOffset: 24
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
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf('/'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }
}