import type { ActiveWindowInfo, Configuration } from '../types.js';
import type { DecisionEngine } from './decisionEngine.js';
import type { SystemMonitor } from './platformWrapper.js';

const DISTRACTING_DOMAINS: string[] = [
  // ── Social Media & Microblogging ──
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

  // ── Video & Streaming ──
  'youtube.com', 'youtu.be', 'youtube-nocookie.com',
  'netflix.com',
  'hulu.com',
  'twitch.tv',
  'disneyplus.com', 'disneyplus.com',
  'hbomax.com', 'max.com',
  'peacocktv.com',
  'paramountplus.com',
  'primevideo.com', 'amazon.com/video',
  'appletv.com',
  'crunchyroll.com',
  'funimation.com',
  'vimeo.com',
  'dailymotion.com',
  'bilibili.com',
  'nicovideo.jp',

  // ── Forums & Communities ──
  '4chan.org', '4channel.org',
  '8kun.top',
  'fandom.com', 'wikia.com',
  'forum.',  // catches ubuntuforums, etc.

  // ── Imageboards & Memes ──
  'imgur.com',
  'giphy.com',
  '9gag.com',
  'cheezburger.com',
  'memegenerator.net',
  'knowyourmeme.com',
  'tenor.com',
  'deviantart.com',

  // ── Adult Content ──
  'pornhub.com', 'xvideos.com', 'xhamster.com',
  'xnxx.com', 'redtube.com', 'youporn.com',
  'tube8.com', 'spankbang.com', 'porntrex.com',
  'motherless.com', 'efukt.com',
  'onlyfans.com', 'fansly.com',
  'stripchat.com', 'chaturbate.com',
  'livesex.com', 'camsoda.com',
  'manyvids.com', 'clips4sale.com',

  // ── Shopping (Consumer) ──
  'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr', 'amazon.it', 'amazon.es',
  'ebay.com', 'ebay.co.uk', 'ebay.ca', 'ebay.de', 'ebay.fr',
  'etsy.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'homedepot.com',
  'lowes.com',
  'aliexpress.com', 'alibaba.com',
  'shopify.com',  // catches stores hosted on shopify
  'wish.com',
  'temu.com',
  'shein.com', 'shein.com',
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

  // ── Dating & Social Discovery ──
  'tinder.com',
  'bumble.com',
  'hinge.co',
  'okcupid.com',
  'match.com',
  'eharmony.com',
  'plentyoffish.com',
  'grindr.com',
  'badoo.com',

  // ── Entertainment & Gossip ──
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
  'buzzfeednews.com',

  // ── Gaming ──
  'steampowered.com', 'steamcommunity.com',
  'epicgames.com',
  'roblox.com',
  'twitch.tv',
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
  'amongus.com',

  // ── News & Aggregators (Entertainment-focused) ──
  'buzzfeed.com',
  'upworthy.com',
  'distractify.com',
  'thechive.com',
  'cracked.com',
  'collegehumor.com',

  // ── Pirated / Streaming Sites ──
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

  // ── Gambling & Betting ──
  'draftkings.com',
  'fanduel.com',
  'bet365.com',
  'pokerstars.com',
  'bovada.lv',
  '888casino.com',
  'partypoker.com',

  // ── Crypto / NFT / Meme Stocks ──
  'opensea.io',
  'rarible.com',
  'niftygateway.com',
  'loot.exchange',
  'pancakeswap.finance',
  'uniswap.org',
];

const TITLE_DISTRACTION_PATTERNS: RegExp[] = [
  // Social Media
  /facebook/i,
  /twitter|x\.com|tweet|retweet/i,
  /instagram|threads/i,
  /tiktok/i,
  /snapchat|snap\s/i,
  /pinterest/i,
  /linkedin/i,
  /tumblr/i,
  /reddit|r\//i,

  // Video & Streaming
  /youtube|youtu\.be|watch\?v=/i,
  /netflix|hulu|disney\+|hbomax|max|peacock|paramount\+/i,
  /crunchyroll|funimation|bilibili/i,
  /streaming|watch\s(movie|show|episode|anime)/i,

  // Twitch / Live Streaming
  /twitch|streamlabs|streamelements/i,

  // Shopping
  /amazon|ebay|etsy|walmart|target|best\s?buy/i,
  /aliexpress|alibaba|temu|shein|shopify/i,
  /shopping\s(cart|bag)|checkout|buy\snow/i,
  /nike|adidas|zara|hm\b/i,

  // Dating
  /tinder|bumble|hinge|okcupid|match\.com|eharmony/i,
  /grindr|badoo/i,

  // Forums / Imageboards
  /4chan|8kun|fandom|wikia/i,

  // Memes & Image Sharing
  /imgur|giphy|9gag|memes|tenor|cheezburger/i,
  /deviantart|artstation/i,

  // Gaming
  /steam|epic\sgames|roblox/i,
  /pokemon|nintendo/i,
  /playstation|xbox|battle\.net|blizzard/i,
  /minecraft|fortnite|valorant|league\sof\slegends/i,
  /gaming|game\s(over|play|on)|esports/i,

  // Entertainment / Gossip
  /buzzfeed|tmz|e!\s|people\.com|pagesix/i,
  /dailymail|the\ssun|mirror|deadline|variety/i,
  /entertainment|celebrity|gossip|hollywood/i,

  // Adult
  /pornhub|xvideos|xhamster|xnxx|redtube|youporn/i,
  /onlyfans|fansly|chaturbate|stripchat/i,
  /adult|18\+\s/,
  /nsfw/i,

  // Pirated Content
  /thepiratebay|1337x|rutracker/i,
  /kissanime|gogoanime|fmovies|soap2day|putlocker/i,

  // Gambling
  /draftkings|fanduel|bet365|pokerstars|bovada/i,
  /casino|poker|betting/i,

  // General Traps
  /trending|viral|watch\sthis/i,
  /only\sfans|fan(sly)?/i,
];

export class WorkspaceMonitor {
  private monitor: SystemMonitor;
  private configuration: Configuration;
  private decisionEngine: DecisionEngine | null = null;
  private lastCheckTime: number = 0;
  private debounceInterval: number = 0.3;
  private promptRepeatInterval: number = 5;
  private lastPromptTime: number = 0;
  private activePromptIdentifier: string | null = null;
  private hasInitialCheckRun: boolean = false;
  private lastActiveWindowIdentifier: string | null = null;

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

    const activeWindow = await this.monitor.getActiveWindow();
    if (!activeWindow) {
      console.log('No active window detected');
      return false;
    }

    const identifier = this.getAppIdentifier(activeWindow);

    // If active window changed, skip debounce and check immediately
    if (identifier !== this.lastActiveWindowIdentifier) {
      console.log('Active window changed:', this.lastActiveWindowIdentifier, '->', identifier);
      this.lastActiveWindowIdentifier = identifier;
      this.lastCheckTime = 0;
    }

    if (now - this.lastCheckTime < this.debounceInterval) {
      return false;
    }
    this.lastCheckTime = now;

    console.log('Active window:', activeWindow.processName, '| Title:', activeWindow.windowTitle, '| BundleID:', activeWindow.bundleID, '| URL:', activeWindow.browserURL);

    if (!this.hasInitialCheckRun) {
      this.hasInitialCheckRun = true;
    }

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

  startMonitoring(intervalMs: number = 500): void {
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
