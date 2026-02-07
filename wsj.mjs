#!/usr/bin/env node
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';
import { createInterface } from 'node:readline/promises';

const CDP_PORT = 9222;
const IS_MACOS = platform() === 'darwin';
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

// WSJ RSS feeds (no auth needed)
const RSS_FEEDS = {
  world: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
  us: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',
  markets: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
  opinion: 'https://feeds.a.dj.com/rss/RSSOpinion.xml',
  tech: 'https://feeds.a.dj.com/rss/RSSWSJD.xml',
  lifestyle: 'https://feeds.a.dj.com/rss/RSSLifestyle.xml',
};

// XDG-compliant config directory
const CONFIG_DIR = join(homedir(), '.config/wsj');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');
const CHROME_DIR = join(CONFIG_DIR, 'chrome');
const VALID_SECTIONS = Object.keys(RSS_FEEDS);

// Helper to parse --json flag from args
function hasJsonFlag(args) {
  return args.includes('--json');
}

function removeFlags(args) {
  return args.filter(a => !a.startsWith('--'));
}

// ============================================
// User Management (credentials.json)
// ============================================

function loadCredentials() {
  if (!existsSync(CREDENTIALS_FILE)) {
    return { users: {} };
  }
  try {
    return JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf-8'));
  } catch {
    return { users: {} };
  }
}

function saveCredentials(creds) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2) + '\n');
}

function getUser(username) {
  const creds = loadCredentials();
  return creds.users[username] || null;
}

const DEFAULT_INSTRUCTIONS = 'Exactly 5 items, flat list, no headers. Each item: • [2-4 WORD HEADLINE](article-url) - takeaway under 15 words. Use • as the bullet. Select the 5 most important across all sections.';

function registerUser(username) {
  const creds = loadCredentials();
  if (!creds.users[username]) {
    creds.users[username] = {
      registered: new Date().toISOString(),
      preferences: {
        instructions: DEFAULT_INSTRUCTIONS
      }
    };
    saveCredentials(creds);
    console.error(`Registered new user: ${username}`);
  }
  return creds.users[username];
}

function updateUserPreferences(username, key, value) {
  const creds = loadCredentials();
  if (!creds.users[username]) {
    return false;
  }
  if (!creds.users[username].preferences) {
    creds.users[username].preferences = {};
  }
  creds.users[username].preferences[key] = value;
  saveCredentials(creds);
  return true;
}

function setUserPreferences(username, preferences) {
  const creds = loadCredentials();
  if (!creds.users[username]) {
    return false;
  }
  creds.users[username].preferences = preferences;
  saveCredentials(creds);
  return true;
}

function resetUserContext(username) {
  const creds = loadCredentials();
  if (creds.users[username]) {
    creds.users[username].preferences = { instructions: DEFAULT_INSTRUCTIONS };
    creds.users[username].context = {};
    saveCredentials(creds);
    return true;
  }
  return false;
}

function deleteUser(username) {
  const creds = loadCredentials();
  if (creds.users[username]) {
    delete creds.users[username];
    saveCredentials(creds);
    return true;
  }
  return false;
}

// Prompt for username interactively (only when stdin is a TTY)
async function promptUsername() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const name = await rl.question('Enter a username to get started: ');
    return name.trim();
  } finally {
    rl.close();
  }
}

// Get current username from environment, prompt interactively if TTY
async function requireUserEnv() {
  let username = process.env.WSJ_USER;
  if (!username) {
    if (!process.stdin.isTTY) {
      console.error('Error: $WSJ_USER not set. Run: export WSJ_USER=<your-username>');
      process.exit(1);
    }
    username = await promptUsername();
    if (!username) {
      console.error('Error: No username entered.');
      process.exit(1);
    }
    registerUser(username);
    console.error(`\nTo persist, run: export WSJ_USER=${username}\n`);
    process.env.WSJ_USER = username;
  }
  return username;
}

// Require user for all commands - registers if new
async function requireUser() {
  const username = await requireUserEnv();

  let user = getUser(username);
  if (!user) {
    user = registerUser(username);
  }

  return { username, ...user };
}

// Validate preferences structure
function validatePreferences(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    errors.push('Preferences must be a JSON object');
    return errors;
  }
  // All fields are optional in the new structure
  return errors;
}

// Simple XML parser for RSS
function parseRSS(xml) {
  const items = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const link = itemXml.match(/<link>([^<]*)<\/link>/)?.[1] || '';
    const desc = itemXml.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
              || itemXml.match(/<description>([^<]*)<\/description>/)?.[1] || '';
    const category = itemXml.match(/<wsj:articletype>([^<]*)<\/wsj:articletype>/)?.[1] || '';
    const pubDate = itemXml.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || '';
    if (title && link) items.push({ title, link, description: desc, category, pubDate });
  }
  return items;
}

// Format pubDate into compact relative/absolute string
function formatAge(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d)) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Check if Chrome is running with CDP
async function checkCDP() {
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    const data = await res.json();
    return { connected: true, browser: data.Browser };
  } catch {
    return { connected: false };
  }
}

// Start Chrome with CDP enabled
function startChrome() {
  if (!IS_MACOS) {
    console.error('ERROR: wsj setup only works on macOS.\n');
    console.error('On other platforms, start Chrome manually with:');
    console.error(`  google-chrome --remote-debugging-port=${CDP_PORT} --user-data-dir=~/.config/wsj/chrome https://www.wsj.com`);
    process.exit(1);
  }

  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  console.log('Starting Chrome with CDP enabled...\n');

  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${CHROME_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    'https://www.wsj.com'
  ], {
    detached: true,
    stdio: 'ignore'
  });

  chrome.unref();

  console.log(`Chrome started with CDP on port ${CDP_PORT}`);
  console.log(`Profile: ${CHROME_DIR}\n`);
  console.log('Next steps:');
  console.log('1. Log into WSJ in the Chrome window that just opened');
  console.log('2. Keep Chrome running in the background');
  console.log('3. Use "wsj read <url>" to read articles\n');
}

// Connect to Chrome via CDP
async function connectCDP() {
  const status = await checkCDP();
  if (!status.connected) {
    console.error('ERROR: Chrome not running with CDP enabled.\n');
    console.error('Run "wsj setup" first to start Chrome with CDP.\n');
    process.exit(1);
  }

  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  const context = contexts[0] || await browser.newContext();
  return { browser, context };
}

// ============================================
// RSS Tool
// ============================================

async function fetchRSSSection(section) {
  const feedUrl = RSS_FEEDS[section];
  const response = await fetch(feedUrl);
  const xml = await response.text();
  const items = parseRSS(xml);

  return {
    section,
    fetched_at: new Date().toISOString(),
    articles: items.map(item => ({
      title: item.title,
      url: item.link,
      description: item.description,
      category: item.category || null,
      pubDate: item.pubDate || null,
      age: formatAge(item.pubDate) || null
    }))
  };
}

async function handleRSS(args) {
  await requireUser();  // Enforce user requirement (auto-registers if new)

  const jsonOutput = hasJsonFlag(args);
  const cleanArgs = removeFlags(args);
  const section = cleanArgs[0] || 'world';

  if (section === 'all') {
    // Fetch all sections in parallel
    try {
      const results = await Promise.all(
        VALID_SECTIONS.map(sec => fetchRSSSection(sec))
      );

      if (jsonOutput) {
        console.log(JSON.stringify({
          fetched_at: new Date().toISOString(),
          sections: results
        }, null, 2));
      } else {
        for (const result of results) {
          console.log(`\n# WSJ Headlines (${result.section})\n`);
          result.articles.slice(0, 10).forEach((item, i) => {
            console.log(`${i + 1}. **${item.title}**${item.age ? ` (${item.age})` : ''}`);
            if (item.description) {
              console.log(`   ${item.description.slice(0, 150)}${item.description.length > 150 ? '...' : ''}`);
            }
            console.log(`   ${item.url}`);
            console.log();
          });
        }
      }
    } catch (e) {
      console.error('Error fetching RSS feeds:', e.message);
      process.exit(1);
    }
    return;
  }

  if (!RSS_FEEDS[section]) {
    console.error(`Unknown section: ${section}`);
    console.error(`Available sections: ${VALID_SECTIONS.join(', ')}, all`);
    process.exit(1);
  }

  try {
    const result = await fetchRSSSection(section);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`# WSJ Headlines (${section})\n`);
      result.articles.slice(0, 15).forEach((item, i) => {
        console.log(`${i + 1}. **${item.title}**${item.age ? ` (${item.age})` : ''}`);
        if (item.description) {
          console.log(`   ${item.description.slice(0, 150)}${item.description.length > 150 ? '...' : ''}`);
        }
        console.log(`   ${item.url}`);
        if (item.category) console.log(`   [${item.category}]`);
        console.log();
      });
      console.log(`Available sections: ${VALID_SECTIONS.join(', ')}, all`);
    }
  } catch (e) {
    console.error('Error fetching headlines:', e.message);
    process.exit(1);
  }
}

// ============================================
// Read Tool (formerly article)
// ============================================

async function extractArticle(url, existingContext) {
  let browser, context, shouldClose = false;
  if (existingContext) {
    context = existingContext;
  } else {
    const conn = await connectCDP();
    browser = conn.browser;
    context = conn.context;
    shouldClose = true;
  }

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {});

    const article = await page.evaluate(() => {
      const title = document.querySelector('h1')?.innerText || '';
      const subtitle = document.querySelector('[class*="sub-head"], [class*="summary"], [class*="dek"]')?.innerText || '';
      const author = document.querySelector('[class*="author"], [class*="byline"]')?.innerText || '';
      const date = document.querySelector('time, [class*="timestamp"]')?.innerText || '';

      const selectors = [
        'article p',
        '[class*="article-content"] p',
        '[class*="body"] p',
        '[data-testid*="article"] p',
        'section p'
      ];

      let paragraphs = [];
      for (const sel of selectors) {
        const ps = Array.from(document.querySelectorAll(sel))
          .map(p => p.innerText?.trim())
          .filter(t => t && t.length > 30 && !t.includes('Subscribe') && !t.includes('Sign In'));
        if (ps.length > paragraphs.length) paragraphs = ps;
      }

      const content = paragraphs.join('\n\n');
      const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;

      return { title, subtitle, author, date, content, word_count: wordCount };
    });

    return article;
  } finally {
    await page.close();
    if (shouldClose) await browser.close();
  }
}

async function handleRead(args) {
  await requireUser();  // Enforce user requirement (auto-registers if new)

  const jsonOutput = hasJsonFlag(args);
  const cleanArgs = removeFlags(args);
  const url = cleanArgs[0];

  if (!url) {
    console.error('Usage: wsj read <url> [--json]');
    process.exit(1);
  }

  try {
    const article = await extractArticle(url);

    if (jsonOutput) {
      console.log(JSON.stringify({
        url,
        title: article.title,
        subtitle: article.subtitle || null,
        author: article.author || null,
        date: article.date || null,
        content: article.content,
        word_count: article.word_count
      }, null, 2));
    } else {
      console.log(`# ${article.title}\n`);
      console.log('---\n');
      if (article.subtitle) console.log(`*${article.subtitle}*\n`);
      if (article.author) console.log(`By ${article.author}`);
      if (article.date) console.log(`${article.date}\n`);
      if (article.content) {
        console.log(article.content);
      } else {
        console.log('(Could not extract content. Make sure you are logged into WSJ in Chrome.)');
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

// ============================================
// Search Tool
// ============================================

async function handleSearch(args) {
  await requireUser();  // Enforce user requirement (auto-registers if new)

  const jsonOutput = hasJsonFlag(args);
  const cleanArgs = removeFlags(args);
  const query = cleanArgs.join(' ');

  if (!query) {
    console.error('Usage: wsj search "<query>" [--json]');
    process.exit(1);
  }

  const { browser, context } = await connectCDP();
  const page = await context.newPage();

  try {
    const searchUrl = `https://www.wsj.com/search?query=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('h2, h3', { timeout: 5000 }).catch(() => {});

    const results = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      const headlines = Array.from(document.querySelectorAll('h2, h3'));

      for (const h of headlines) {
        const link = h.closest('a') || h.querySelector('a') || h.parentElement?.querySelector('a');
        if (!link) continue;

        const href = link.href || '';
        if (!href.includes('wsj.com')) continue;
        if (seen.has(href)) continue;
        seen.add(href);

        const title = h.innerText?.trim() || '';
        if (title.length < 10 || title.length > 300) continue;
        if (title.includes('Sign In') || title.includes('Subscribe')) continue;

        let snippet = '';
        const container = h.closest('article, section, div');
        if (container) {
          const p = container.querySelector('p');
          if (p) {
            const text = p.innerText?.trim();
            if (text && text.length > 20 && text.length < 500) snippet = text;
          }
        }

        items.push({ title, snippet, url: href });
        if (items.length >= 10) break;
      }
      return items;
    });

    if (jsonOutput) {
      console.log(JSON.stringify({
        query,
        results: results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet || null
        }))
      }, null, 2));
    } else {
      console.log(`# WSJ Search: "${query}"\n`);
      if (results.length === 0) {
        console.log('No results found.');
      } else {
        results.forEach((r, i) => {
          console.log(`${i + 1}. **${r.title}**`);
          if (r.snippet) console.log(`   ${r.snippet.slice(0, 150)}${r.snippet.length > 150 ? '...' : ''}`);
          console.log(`   ${r.url}\n`);
        });
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await page.close();
    await browser.close();
  }
}

// ============================================
// Prefs Tool
// ============================================

async function handlePrefs(args) {
  const subcommand = args[0] || 'get';

  switch (subcommand) {
    case 'list': {
      // v1.4: list command removed for security
      console.error('Error: "prefs list" has been removed.');
      console.error('Use "wsj prefs get" to view your own preferences.');
      process.exit(1);
    }

    case 'get': {
      // v1.5: Uses $WSJ_USER, returns user preferences
      const { username, preferences } = await requireUser();
      console.log(JSON.stringify(preferences || {}, null, 2));
      break;
    }

    case 'set': {
      // v1.5: Uses $WSJ_USER, sets user preferences
      const { username } = await requireUser();
      const jsonStr = args.slice(1).join(' ');
      if (!jsonStr) {
        console.error('Usage: wsj prefs set \'<json>\'');
        console.error('\nExample:');
        console.error('  wsj prefs set \'{"topics": ["AI", "markets"], "instructions": "Brief bullets"}\'');
        process.exit(1);
      }

      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (e) {
        console.error('Invalid JSON:', e.message);
        process.exit(1);
      }

      const errors = validatePreferences(data);
      if (errors.length > 0) {
        console.error('Validation errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
      }

      setUserPreferences(username, data);
      console.log(`Preferences saved for user "${username}".`);
      break;
    }

    case 'update': {
      // v1.5: Uses $WSJ_USER, updates single preference key
      const { username } = await requireUser();
      const key = args[1];
      const valueStr = args.slice(2).join(' ');

      if (!key || valueStr === undefined || valueStr === '') {
        console.error('Usage: wsj prefs update <key> <value>');
        console.error('\nExample:');
        console.error('  wsj prefs update topics \'["AI", "Fed"]\'');
        process.exit(1);
      }

      // Try to parse value as JSON, otherwise treat as string
      let value;
      try {
        value = JSON.parse(valueStr);
      } catch {
        value = valueStr;
      }

      updateUserPreferences(username, key, value);
      console.log(`Updated "${key}" for user "${username}".`);
      break;
    }

    default:
      console.error(`Unknown prefs command: ${subcommand}`);
      console.error('Commands: get, set, update');
      process.exit(1);
  }
}

// ============================================
// User Tool
// ============================================

async function handleUser(args) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'reset': {
      const username = await requireUserEnv();
      if (resetUserContext(username)) {
        console.log(`Reset context for user: ${username}`);
      } else {
        console.error(`User "${username}" not found.`);
        process.exit(1);
      }
      break;
    }

    case 'delete': {
      const username = await requireUserEnv();
      if (deleteUser(username)) {
        console.log(`Deleted user: ${username}`);
      } else {
        console.error(`User "${username}" not found.`);
        process.exit(1);
      }
      break;
    }

    case 'info': {
      const { username, registered, preferences } = await requireUser();
      console.log(`Username: ${username}`);
      console.log(`Registered: ${registered}`);
      console.log(`Preferences: ${JSON.stringify(preferences || {}, null, 2)}`);
      break;
    }

    default:
      console.error('Usage: wsj user <command>');
      console.error('\nCommands:');
      console.error('  info     Show user information');
      console.error('  reset    Clear user preferences and context');
      console.error('  delete   Remove user entirely');
      process.exit(1);
  }
}

// ============================================
// Status Tool
// ============================================

async function showStatus() {
  const status = await checkCDP();
  if (status.connected) {
    console.log(`Connected: true`);
    console.log(`Port: ${CDP_PORT}`);
    console.log(`Browser: ${status.browser}`);
  } else {
    console.log(`Connected: false`);
    console.log('\nRun "wsj setup" to start Chrome with CDP enabled.');
  }
}

// ============================================
// Main CLI
// ============================================

const [,, command, ...args] = process.argv;

switch (command) {
  case 'setup':
    startChrome();
    break;

  case 'status':
    await showStatus();
    break;

  case 'rss':
    await handleRSS(args);
    break;

  case 'read':
    await handleRead(args);
    break;

  case 'search':
    await handleSearch(args);
    break;

  case 'prefs':
    await handlePrefs(args);
    break;

  case 'user':
    await handleUser(args);
    break;

  // Keep old commands as aliases for backward compatibility (hidden from help)
  case 'headlines':
    await handleRSS(args);
    break;

  case 'article':
    await handleRead(args);
    break;

  case 'profile':
    // Redirect to prefs with a notice
    console.error('Note: "profile" command has been renamed to "prefs".\n');
    await handlePrefs(args);
    break;

  default:
    console.log(`WSJ CLI - Wall Street Journal reader

Commands:
  wsj setup                    Start Chrome with CDP (do this first, then log into WSJ)
  wsj status                   Check if Chrome/CDP is connected

  wsj rss <section> [--json]   Get headlines via RSS (no login needed)
  wsj rss all [--json]         Get headlines from all sections

  wsj read <url> [--json]      Read full article (requires CDP + WSJ login)
  wsj search "<query>" [--json] Search articles (requires CDP)

  wsj prefs get                Get your preferences as JSON
  wsj prefs set '<json>'       Set your preferences
  wsj prefs update <key> '<value>'  Update single preference key

  wsj user info                Show user information
  wsj user reset               Clear your preferences and context
  wsj user delete              Remove your user entirely

Sections: ${VALID_SECTIONS.join(', ')}

Examples:
  wsj rss markets              # Get market headlines
  wsj rss tech --json          # Get tech headlines as JSON
  wsj rss all --json           # Get all sections as JSON
  wsj read "<url>" --json      # Read article as JSON
  wsj search "Federal Reserve" # Search for articles

  export WSJ_USER=alice        # Set your username
  wsj prefs set '{"topics": ["AI", "markets"], "instructions": "Brief bullets"}'
  wsj prefs get                # Get your preferences
  wsj prefs update topics '["AI", "Fed", "tariffs"]'

Environment:
  WSJ_USER                     Your username (required for all commands)

First time setup:
  1. export WSJ_USER=<your-username>
  2. Run any command - you'll be auto-registered
  3. wsj prefs set '{"instructions": "..."}'  # Optional: set preferences
  4. Run "wsj setup" - opens Chrome
  5. Log into WSJ in that Chrome window
  6. Keep Chrome running
  7. Use other commands as needed`);
}
