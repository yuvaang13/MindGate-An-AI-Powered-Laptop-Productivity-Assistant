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
        ...defaults.theme,
        ...loaded.theme
      }
    };
  }

  private getDefaultConfiguration(): Configuration {
    return {
      settings: {
        distractingApps: [
          'Discord', 'Slack', 'Twitter', 'Telegram', 'Reddit', 'TikTok',
          'Instagram', 'Facebook', 'Netflix', 'YouTube', 'Twitch'
        ],
        restrictedKeywords: [
          'youtube', 'youtu.be', 'youtube-nocookie',
          'twitter', 'x.com',
          'facebook', 'fb.com', 'fb.watch', 'instagram',
          'tiktok', 'reddit',
          'twitch', 'netflix', 'spotify', 'discord',
          'linkedin', 'pinterest', 'snapchat',
          'whatsapp', 'telegram', 't.me',
          'medium', 'buzzfeed', 'hackernews', 'news.ycombinator.com', 'producthunt',
          'dribbble', 'behance', 'imgur', 'giphy', '9gag',
          'memes', 'gaming', 'espn', 'bleacherreport',
          'cnn', 'foxnews', 'msnbc', 'bbc', 'bbc.co.uk',
          'news', 'weather.com', 'stocks', 'finance.yahoo.com',
          'crypto.com', 'coinbase', 'binance', 'crypto', 'bitcoin', 'trading',
          'shopping', 'amazon.com', 'amazon.co.uk', 'ebay', 'etsy',
          'walmart', 'target.com',
          'fashion', 'celebrity', 'gossip', 'entertainment',
          'movies', 'tv shows', 'streaming', 'video', 'viral', 'trending'
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
        justificationCountdownDuration: 25
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
          overlayWidth: 380,
          overlayHeight: 380,
          chatCornerRadius: 28,
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