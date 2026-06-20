import type { ActiveWindowInfo, Configuration } from '../types.js';
import type { DecisionEngine } from './decisionEngine.js';
import type { SystemMonitor } from './platformWrapper.js';

const DISTRACTING_DOMAINS: string[] = [
  'facebook.com', 'fb.com', 'fb.watch',
  'twitter.com', 'x.com', 'tweetdeck.com',
  'instagram.com', 'threads.net',
  'tiktok.com',
  'snapchat.com', 'snap.com',
  'pinterest.com', 'pinterest.ca', 'pinterest.co.uk',
  'linkedin.com',
  'tumblr.com',
  'flickr.com',
  'vk.com', 'vkontakte.ru',
  'weibo.com',
  'qq.com',
  'reddit.com', 'redd.it',
  'youtube.com', 'youtu.be', 'youtube-nocookie.com',
  'netflix.com',
  'hulu.com',
  'twitch.tv',
  'disneyplus.com',
  'hbomax.com', 'max.com',
  'peacocktv.com',
  'paramountplus.com',
  'primevideo.com',
  'appletv.com',
  'crunchyroll.com',
  'funimation.com',
  'vimeo.com',
  'dailymotion.com',
  'bilibili.com',
  'nicovideo.jp',
  '4chan.org', '4channel.org',
  '8kun.top',
  'fandom.com', 'wikia.com',
  'imgur.com',
  'giphy.com',
  '9gag.com',
  'cheezburger.com',
  'memegenerator.net',
  'knowyourmeme.com',
  'tenor.com',
  'deviantart.com',
  'pornhub.com', 'xvideos.com', 'xhamster.com',
  'xnxx.com', 'redtube.com', 'youporn.com',
  'tube8.com', 'spankbang.com', 'porntrex.com',
  'motherless.com', 'efukt.com',
  'onlyfans.com', 'fansly.com',
  'stripchat.com', 'chaturbate.com',
  'livesex.com', 'camsoda.com',
  'manyvids.com', 'clips4sale.com',
  'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es',
  'ebay.com', 'ebay.co.uk', 'ebay.ca', 'ebay.de', 'ebay.fr',
  'etsy.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'homedepot.com',
  'lowes.com',
  'aliexpress.com', 'alibaba.com',
  'wish.com',
  'temu.com',
  'shein.com',
  'zara.com',
  'hm.com',
  'nike.com',
  'adidas.com',
  'gap.com',
  'oldnavy.com',
  'macys.com',
  'nordstrom.com',
  'kohls.com',
  'sephora.com',
  'ulta.com',
  'tinder.com',
  'bumble.com',
  'hinge.co',
  'okcupid.com',
  'match.com',
  'eharmony.com',
  'plentyoffish.com',
  'grindr.com',
  'badoo.com',
  'buzzfeed.com',
  'tmz.com',
  'eonline.com',
  'people.com',
  'pagesix.com',
  'dailymail.co.uk',
  'thesun.co.uk',
  'mirror.co.uk',
  'deadline.com',
  'variety.com',
  'hollywoodreporter.com',
  'steampowered.com', 'steamcommunity.com',
  'epicgames.com',
  'roblox.com',
  'kick.com',
  'pokemon.com',
  'nintendo.com',
  'playstation.com',
  'xbox.com',
  'battle.net', 'blizzard.com',
  'origin.com', 'ea.com',
  'ubisoft.com',
  'rockstargames.com',
  'minecraft.net',
  'valorant.com',
  'leagueoflegends.com',
  'dota2.com',
  'fortnite.com',
  'upworthy.com',
  'distractify.com',
  'thechive.com',
  'cracked.com',
  'collegehumor.com',
  'thepiratebay.org',
  '1337x.to',
  'rutracker.org',
  'nyaa.si',
  'kissanime.com', 'kissmanga.com',
  'gogoanime.com',
  'zoro.to',
  'fmovies.to', 'fmovies.co',
  'soap2day.com', 'soap2day.to',
  'putlocker.com', 'putlocker.to',
  'solarmovie.com',
  'projectfreetv.com',
  'watchseries.com',
  'draftkings.com',
  'fanduel.com',
  'bet365.com',
  'pokerstars.com',
  'bovada.lv',
  '888casino.com',
  'partypoker.com',
  'opensea.io',
  'rarible.com',
  'niftygateway.com',
  'pancakeswap.finance',
  'uniswap.org',
];

const TITLE_DISTRACTION_PATTERNS: RegExp[] = [
  /facebook/i,
  /twitter|x\.com|tweet|retweet/i,
  /instagram|threads/i,
  /tiktok/i,
  /snapchat|snap\s/i,
  /pinterest/i,
  /linkedin/i,
  /tumblr/i,
  /reddit|r\//i,
  /youtube|youtu\.be|watch\?v=/i,
  /netflix|hulu|disney\+|hbomax|max|peacock|paramount\+/i,
  /crunchyroll|funimation|bilibili/i,
  /streaming|watch\s(movie|show|episode|anime)/i,
  /twitch|streamlabs|streamelements/i,
  /amazon|ebay|etsy|walmart|target|best\s?buy/i,
  /aliexpress|alibaba|temu|shein|shopify/i,
  /shopping\s(cart|bag)|checkout|buy\snow/i,
  /nike|adidas|zara|hm\b/i,
  /tinder|bumble|hinge|okcupid|match\.com|eharmony/i,
  /grindr|badoo/i,
  /4chan|8kun|fandom|wikia/i,
  /imgur|giphy|9gag|memes|tenor|cheezburger/i,
  /deviantart|artstation/i,
  /steam|epic\sgames|roblox/i,
  /pokemon|nintendo/i,
  /playstation|xbox|battle\.net|blizzard/i,
  /minecraft|fortnite|valorant|league\sof\slegends/i,
  /gaming|game\s(over|play|on)|esports/i,
  /buzzfeed|tmz|e!\s|people\.com|pagesix/i,
  /dailymail|the\ssun|mirror|deadline|variety/i,
  /entertainment|celebrity|gossip|hollywood/i,
  /pornhub|xvideos|xhamster|xnxx|redtube|youporn/i,
  /onlyfans|fansly|chaturbate|stripchat/i,
  /adult|18\+\s/,
  /nsfw/i,
  /thepiratebay|1337x|rutracker/i,
  /kissanime|gogoanime|fmovies|soap2day|putlocker/i,
  /draftkings|fanduel|bet365|pokerstars|bovada/i,
  /casino|poker|betting/i,
  /trending|viral|watch\sthis/i,
  /only\sfans|fan(sly)?/i,
];

interface WorkspaceObserverLike {
  on(event: 'app-activated', listener: (appName: string) => void): void;
  start(): void;
  stop(): void;
}

export class WorkspaceMonitor {
  private monitor: SystemMonitor;
  private configuration: Configuration;
  private decisionEngine: DecisionEngine | null = null;
  private promptRepeatInterval: number = 10;
  private lastPromptTime: number = 0;
  private activePromptIdentifier: string | null = null;
  private observer: WorkspaceObserverLike | null = null;
  private browserPollTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

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

  onDistractionDetected?: (window: ActiveWindowInfo) => void;
  onClearPrompt?: () => void;

  startEventDrivenMonitoring(): void {
    console.log('[Monitor] Starting monitoring on', process.platform);

    if (process.platform === 'darwin') {
      void this.startMacObserver();
    } else {
      this.startPollingMonitoring();
    }

    setTimeout(() => {
      this.fullCheck().catch((err) =>
        console.error('[Monitor] initial check failed:', err)
      );
    }, 500);
  }

  private async startMacObserver(): Promise<void> {
    try {
      const { WorkspaceObserver } = await import('../platform/mac/workspaceObserver.js');
      this.observer = new WorkspaceObserver();

      this.observer.on('app-activated', (appName: string) => {
        this.handleAppActivation(appName).catch((err) =>
          console.error('[Monitor] handleAppActivation error:', err)
        );
      });

      this.observer.start();
    } catch (err) {
      console.error('[Monitor] macOS observer failed, falling back to polling:', err);
      this.startPollingMonitoring();
    }
  }

  private startPollingMonitoring(): void {
    if (this.pollTimer) return;
    console.log('[Monitor] Starting 1.5s polling fallback');
    this.pollTimer = setInterval(() => {
      this.fullCheck().catch((err) => console.error('[Monitor] poll error:', err));
    }, 1500);
  }

  stopMonitoring(): void {
    console.log('[Monitor] Stopping monitoring');
    this.stopBrowserPoll();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.observer?.stop();
    this.observer = null;
    this.activePromptIdentifier = null;
    this.lastPromptTime = 0;
  }

  forceRetryPrompt(): void {
    this.activePromptIdentifier = null;
    this.lastPromptTime = 0;
  }

  async triggerCheckForCurrentWindow(): Promise<void> {
    const window = await this.monitor.getActiveWindow();
    if (window) {
      await this.performDetection(window);
    }
  }

  private async handleAppActivation(appName: string): Promise<void> {
    console.log('[Monitor] App activated:', appName);

    const window = await this.monitor.getActiveWindow();
    if (!window) return;

    if (this.isBrowser(window)) {
      this.startBrowserPoll();
    } else {
      this.stopBrowserPoll();
    }

    await this.performDetection(window);
  }

  private async performDetection(window: ActiveWindowInfo): Promise<boolean> {
    this.decisionEngine?.expireAccessIfNeeded();

    if (this.decisionEngine?.hasActiveAccess(window)) {
      return false;
    }

    const identifier = this.getAppIdentifier(window);
    const now = Date.now() / 1000;
    const isDistracting = this.isDistracting(window);
    console.log('[Monitor] Window check:', identifier, window.processName, 'distracting:', isDistracting);

    if (isDistracting) {
      if (
        this.activePromptIdentifier !== identifier ||
        now - this.lastPromptTime > this.promptRepeatInterval ||
        this.lastPromptTime === 0
      ) {
        this.lastPromptTime = now;
        this.activePromptIdentifier = identifier;
        console.log('[Monitor] Distraction prompt triggered:', identifier);
        this.onDistractionDetected?.(window);
        return true;
      }
      console.log('[Monitor] Distraction prompt suppressed by repeat throttle:', identifier);
    } else if (this.activePromptIdentifier === identifier) {
      this.clearActivePrompt();
    }

    return false;
  }

  private async fullCheck(): Promise<boolean> {
    const window = await this.monitor.getActiveWindow();
    if (!window) return false;

    if (this.isBrowser(window)) {
      this.startBrowserPoll();
    } else {
      this.stopBrowserPoll();
    }

    return this.performDetection(window);
  }

  private startBrowserPoll(): void {
    if (this.browserPollTimer) return;
    this.browserPollTimer = setInterval(async () => {
      try {
        const window = await this.monitor.getActiveWindow();
        if (!window) return;

        if (!this.isBrowser(window)) {
          this.stopBrowserPoll();
          return;
        }

        await this.performDetection(window);
      } catch (err) {
        console.error('[Monitor] Browser poll error:', err);
      }
    }, 5000);
  }

  private stopBrowserPoll(): void {
    if (this.browserPollTimer) {
      clearInterval(this.browserPollTimer);
      this.browserPollTimer = null;
    }
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

    if (this.configuration.settings.distractingApps.some((app) => {
      const needle = app.toLowerCase();
      return processName.includes(needle) || bundleID.includes(needle) || exeName.includes(needle);
    })) {
      return true;
    }

    if (this.isBrowser(window)) {
      if (this.isDistractionDomain(window.browserURL || '')) return true;
      if (this.isTitleDistracting(window.windowTitle)) return true;
      if (this.hasRestrictedKeyword(window)) return true;
    }

    return false;
  }

  private isBrowser(window: ActiveWindowInfo): boolean {
    const processName = window.processName.toLowerCase();
    const exeName = window.exeName?.toLowerCase() || '';
    const bundleID = window.bundleID?.toLowerCase() || '';

    return this.configuration.settings.monitoredBrowsers.some((browser) => {
      const needle = browser.toLowerCase();
      return processName.includes(needle) || exeName.includes(needle) || bundleID.includes(needle);
    });
  }

  private isDistractionDomain(browserURL: string): boolean {
    if (!browserURL) return false;
    try {
      const url = new URL(browserURL.startsWith('http') ? browserURL : `https://${browserURL}`);
      let hostname = url.hostname.toLowerCase();
      hostname = hostname.replace(/^(www|m|mobile)\./, '');
      return DISTRACTING_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith('.' + domain)
      );
    } catch {
      return false;
    }
  }

  private isTitleDistracting(windowTitle: string): boolean {
    if (!windowTitle) return false;
    return TITLE_DISTRACTION_PATTERNS.some((pattern) => pattern.test(windowTitle));
  }

  private hasRestrictedKeyword(window: ActiveWindowInfo): boolean {
    const windowTitle = window.windowTitle.toLowerCase();
    const browserURL = window.browserURL?.toLowerCase() || '';
    return this.configuration.settings.restrictedKeywords.some((kw) => {
      const keyword = kw.toLowerCase();
      if (windowTitle.includes(keyword)) return true;
      if (browserURL.includes(keyword)) return true;
      try {
        const hostname = new URL(browserURL.startsWith('http') ? browserURL : `https://${browserURL}`).hostname;
        if (hostname.includes(keyword)) return true;
      } catch {
        // ignore invalid URLs
      }
      return false;
    });
  }
}
