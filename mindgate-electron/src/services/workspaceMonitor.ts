import type { ActiveWindowInfo, Configuration } from '../types.js';
import type { DecisionEngine } from './decisionEngine.js';
import type { SystemMonitor } from './platformWrapper.js';

const DISTRACTING_DOMAINS: string[] = [
  'youtube.com', 'youtu.be', 'youtube-nocookie.com',
  'reddit.com',
  'twitter.com', 'x.com',
  'tiktok.com',
  'instagram.com',
  'twitch.tv',
  'discord.com',
  'netflix.com',
  'facebook.com',
  'fb.com',
  'spotify.com',
  'linkedin.com',
  'pinterest.com',
  'pinterest.ca',
  'snapchat.com',
  'whatsapp.com',
  'telegram.org',
  't.me',
  'medium.com',
  'buzzfeed.com',
  'hackernews.com', 'news.ycombinator.com',
  'producthunt.com',
  'dribbble.com',
  'behance.net',
  'imgur.com',
  'giphy.com',
  '9gag.com',
  'espn.com',
  'bleacherreport.com',
  'cnn.com',
  'foxnews.com',
  'msnbc.com',
  'bbc.com', 'bbc.co.uk',
  'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr',
  'ebay.com', 'ebay.co.uk',
  'etsy.com',
  'walmart.com',
  'target.com',
  'weather.com',
  'crypto.com', 'coinbase.com', 'binance.com',
  'reddit.com',
  'fandom.com',
  'pornhub.com', 'xvideos.com', 'xhamster.com',
];

const TITLE_DISTRACTION_PATTERNS: RegExp[] = [
  /youtube|youtu\.be|watch\?v=/i,
  /reddit|r\//i,
  /twitter|x\.com|tweet/i,
  /tiktok/i,
  /instagram/i,
  /twitch/i,
  /netflix/i,
  /facebook|fb\b/i,
  /discord/i,
  /spotify/i,
  /linkedin/i,
  /pinterest/i,
  /snapchat/i,
  /whatsapp/i,
  /telegram/i,
  /medium\.com/i,
  /buzzfeed/i,
  /amazon|shop|buy|cart/i,
  /ebay/i,
  /etsy/i,
  /walmart|target/i,
  /news|breaking/i,
  /crypto|bitcoin|trading/i,
  /streaming|watch|video/i,
  /gaming|game|play/i,
  /memes|funny|viral|trending/i,
  /sports|espn|nfl|nba|mlb/i,
  /entertainment|celebrity|gossip/i,
  /fashion|beauty/i,
  /weather|stocks|finance/i,
];

export class WorkspaceMonitor {
  private monitor: SystemMonitor;
  private configuration: Configuration;
  private decisionEngine: DecisionEngine | null = null;
  private lastCheckTime: number = 0;
  private debounceInterval: number = 0.75;
  private promptRepeatInterval: number = 20;
  private lastPromptTime: number = 0;
  private activePromptIdentifier: string | null = null;
  private hasInitialCheckRun: boolean = false;

  constructor(configuration: Configuration, monitor: SystemMonitor) {
    this.configuration = configuration;
    this.monitor = monitor;
  }

  setDecisionEngine(engine: DecisionEngine): void {
    this.decisionEngine = engine;
  }

  getCurrentConfiguration(): Configuration {
    return this.configuration;
  }

  updateConfiguration(config: Configuration) {
    this.configuration = config;
  }

  async checkWorkspace(): Promise<boolean> {
    const now = Date.now() / 1000;

    if (now - this.lastCheckTime < this.debounceInterval) {
      return false;
    }
    this.lastCheckTime = now;

    const activeWindow = await this.monitor.getActiveWindow();
    if (!activeWindow) {
      console.log('No active window detected');
      return false;
    }

    console.log('Active window:', activeWindow.processName, '| Title:', activeWindow.windowTitle, '| BundleID:', activeWindow.bundleID, '| URL:', activeWindow.browserURL);

    if (!this.hasInitialCheckRun) {
      this.hasInitialCheckRun = true;
    }

    const identifier = this.getAppIdentifier(activeWindow);

    const isDistracting = this.isDistracting(activeWindow);
    console.log('Is distracting?', isDistracting);

    if (isDistracting) {
      if (this.decisionEngine?.hasActiveAccess(activeWindow)) {
        console.log('Access already granted for', activeWindow.processName);
        return false;
      }

      const timeSinceLastPrompt = now - this.lastPromptTime;
      if (timeSinceLastPrompt > this.promptRepeatInterval || this.lastPromptTime === 0) {
        console.log('Distraction detected — firing prompt for', activeWindow.processName);
        this.lastPromptTime = now;
        this.activePromptIdentifier = identifier;
        this.onDistractionDetected?.(activeWindow);
        return true;
      }
    } else if (this.activePromptIdentifier === identifier) {
      this.clearActivePrompt();
    }

    return false;
  }

  getAppIdentifier(window: ActiveWindowInfo): string {
    return window.bundleID || window.exeName || window.processName;
  }

  private clearActivePrompt(): void {
    this.activePromptIdentifier = null;
    this.onClearPrompt?.();
  }

  private isDistracting(window: ActiveWindowInfo): boolean {
    const processName = window.processName.toLowerCase();
    const bundleID = window.bundleID?.toLowerCase() || '';
    const exeName = window.exeName?.toLowerCase() || '';

    // 1. Check against distracting apps list (process/bundle/exe name match)
    if (this.configuration.settings.distractingApps.some(app => {
      const needle = app.toLowerCase();
      return processName.includes(needle) || bundleID.includes(needle) || exeName.includes(needle);
    })) {
      console.log(`[Distraction] App matched: "${processName}" in distracting apps`);
      return true;
    }

    // 2. If it's a browser, check for distracting websites
    if (this.isBrowser(window)) {
      // 2a. Domain-based blacklist (most reliable)
      if (this.isDistractionDomain(window.browserURL || '')) {
        console.log(`[Distraction] Domain matched: "${window.browserURL}"`);
        return true;
      }

      // 2b. Regex-based title analysis
      if (this.isTitleDistracting(window.windowTitle)) {
        console.log(`[Distraction] Title matched pattern: "${window.windowTitle}"`);
        return true;
      }

      // 2c. Keyword matching from config (fallback)
      if (this.hasRestrictedKeyword(window)) {
        console.log(`[Distraction] Keyword matched`);
        return true;
      }
    }

    return false;
  }

  private isBrowser(window: ActiveWindowInfo): boolean {
    const processName = window.processName.toLowerCase();
    const exeName = window.exeName?.toLowerCase() || '';
    const bundleID = window.bundleID?.toLowerCase() || '';

    return this.configuration.settings.monitoredBrowsers.some(browser => {
      const needle = browser.toLowerCase();
      return processName.includes(needle) || exeName.includes(needle) || bundleID.includes(needle);
    });
  }

  private isDistractionDomain(browserURL: string): boolean {
    if (!browserURL) return false;

    try {
      const url = new URL(browserURL);
      let hostname = url.hostname.toLowerCase();

      hostname = hostname.replace(/^(www|m|mobile)\./, '');

      const match = DISTRACTING_DOMAINS.some(domain => {
        return hostname === domain || hostname.endsWith('.' + domain);
      });

      if (match) {
        console.log(`[Distraction] Blacklisted domain: "${hostname}" from URL: "${browserURL}"`);
      }

      return match;
    } catch {
      return false;
    }
  }

  private isTitleDistracting(windowTitle: string): boolean {
    if (!windowTitle) return false;

    const match = TITLE_DISTRACTION_PATTERNS.some(pattern => pattern.test(windowTitle));

    if (match) {
      console.log(`[Distraction] Title pattern matched: "${windowTitle}"`);
    }

    return match;
  }

  private hasRestrictedKeyword(window: ActiveWindowInfo): boolean {
    const windowTitle = window.windowTitle.toLowerCase();
    const browserURL = window.browserURL?.toLowerCase() || '';

    return this.configuration.settings.restrictedKeywords.some(kw => {
      const keyword = kw.toLowerCase();
      if (windowTitle.includes(keyword)) return true;
      if (browserURL.includes(keyword)) return true;
      try {
        const hostname = new URL(browserURL).hostname;
        if (hostname.includes(keyword)) return true;
      } catch {}
      return false;
    });
  }

  onDistractionDetected?: (window: ActiveWindowInfo) => void;
  onClearPrompt?: () => void;

  startMonitoring(intervalMs: number = 1000): void {
    console.log('Workspace monitoring started');
    this.checkWorkspace().catch(err => {
      console.error('Initial workspace check failed:', err);
    });
    setInterval(async () => {
      try {
        const result = await this.checkWorkspace();
        if (result) {
          console.log('Workspace check completed, distraction detected');
        }
      } catch (err) {
        console.error('Workspace check failed:', err);
      }
    }, intervalMs);
  }
}
