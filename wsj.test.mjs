import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CLI = './wsj.mjs';
// v1.5: XDG-compliant config directory
const CONFIG_DIR = join(homedir(), '.config/wsj');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');
const TEST_USER_NAME = '_test_user_';
const NEWS_TEST_USER = '_news_test_user_';

// Helper to run CLI safely using spawnSync (no shell injection risk)
// Set withUser=true to run with WSJ_USER set (for news commands)
// Set username to override the default username
function runCLI(argsString, { withUser = false, username = null, withProfile = false, profileName = null } = {}) {
  const args = parseArgs(argsString);
  const env = { ...process.env };
  // Support both old and new parameter names for backwards compatibility in tests
  if (withUser || withProfile) {
    env.WSJ_USER = username || profileName || NEWS_TEST_USER;
  } else if (username || profileName) {
    env.WSJ_USER = username || profileName;
  } else {
    delete env.WSJ_USER;
  }
  const result = spawnSync('node', [CLI, ...args], {
    encoding: 'utf-8',
    timeout: 30000,
    env
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status || 0
  };
}

// Load credentials from file
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

// Save credentials to file
function saveCredentials(creds) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2) + '\n');
}

// Create test user for news commands
function setupNewsTestUser() {
  const creds = loadCredentials();
  creds.users[NEWS_TEST_USER] = {
    registered: new Date().toISOString(),
    preferences: { instructions: 'Test user for automated testing' }
  };
  saveCredentials(creds);
}

// Clean up news test user
function cleanupNewsTestUser() {
  const creds = loadCredentials();
  delete creds.users[NEWS_TEST_USER];
  saveCredentials(creds);
}

// Simple argument parser that handles quoted strings
function parseArgs(str) {
  if (!str) return [];
  const args = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = '';
    } else if (!inQuote && char === ' ') {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}

// Helper to clean up test users
function cleanupTestUsers() {
  const creds = loadCredentials();
  const testUsers = [TEST_USER_NAME, '_test1_', '_test2_', '_test_invalid_'];
  for (const name of testUsers) {
    delete creds.users[name];
  }
  saveCredentials(creds);
}

// ============================================
// Global Setup/Teardown for News Tests
// ============================================

// Setup news test user before all tests
setupNewsTestUser();

// Cleanup on process exit
process.on('exit', () => {
  cleanupNewsTestUser();
});

// ============================================
// Help & Default Output Tests
// ============================================

describe('Help Output', () => {
  it('should show help when no command provided', () => {
    const { stdout } = runCLI('');
    assert.ok(stdout.includes('WSJ CLI'), 'Should show CLI title');
    assert.ok(stdout.includes('Commands:'), 'Should show commands section');
    assert.ok(stdout.includes('wsj setup'), 'Should mention setup command');
    assert.ok(stdout.includes('wsj rss'), 'Should mention rss command');
    assert.ok(stdout.includes('wsj read'), 'Should mention read command');
    assert.ok(stdout.includes('wsj search'), 'Should mention search command');
    assert.ok(stdout.includes('wsj prefs'), 'Should mention prefs command');
  });

  it('should show available sections in help', () => {
    const { stdout } = runCLI('');
    assert.ok(stdout.includes('world'), 'Should list world section');
    assert.ok(stdout.includes('markets'), 'Should list markets section');
    assert.ok(stdout.includes('tech'), 'Should list tech section');
  });

  it('should show WSJ_USER environment variable info', () => {
    const { stdout } = runCLI('');
    assert.ok(stdout.includes('WSJ_USER'), 'Should mention WSJ_USER env var');
  });

  it('should NOT show prefs list in help (removed command)', () => {
    const { stdout } = runCLI('');
    assert.ok(!stdout.includes('prefs list'), 'Should NOT mention prefs list');
  });

  it('should show prefs commands without profile name argument', () => {
    const { stdout } = runCLI('');
    assert.ok(stdout.includes('wsj prefs get'), 'Should mention prefs get');
    assert.ok(stdout.includes("wsj prefs set '<json>'"), 'Should show prefs set without name arg');
  });
});

// ============================================
// Prefs Tool Tests (v1.5 - User-based preferences)
// ============================================

describe('Prefs Tool', () => {
  beforeEach(() => {
    cleanupTestUsers();
  });

  afterEach(() => {
    cleanupTestUsers();
  });

  describe('prefs list (removed)', () => {
    it('should return error - command removed', () => {
      const { stderr, exitCode } = runCLI('prefs list', { username: TEST_USER_NAME });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('removed'), 'Should indicate command removed');
    });
  });

  describe('prefs set', () => {
    it('should save preferences for auto-registered user', () => {
      const json = JSON.stringify({ topics: ['AI', 'markets'], instructions: 'Test instructions' });
      const { stdout, exitCode } = runCLI(`prefs set '${json}'`, { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('saved'), 'Should confirm preferences saved');

      // Verify in credentials.json
      const creds = loadCredentials();
      assert.ok(creds.users[TEST_USER_NAME], 'User should exist in credentials');
      assert.deepStrictEqual(creds.users[TEST_USER_NAME].preferences.topics, ['AI', 'markets'], 'Should have topics');
    });

    it('should reject invalid JSON', () => {
      const { stderr, exitCode } = runCLI("prefs set '{not valid json}'", { username: '_test_invalid_' });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('Invalid JSON') || stderr.includes('JSON'),
        'Should mention JSON error');
    });

    it('should error when $WSJ_USER not set', () => {
      const json = JSON.stringify({ topics: ['test'] });
      const { stderr, exitCode } = runCLI(`prefs set '${json}'`);

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
    });

    it('should show usage when JSON missing', () => {
      const { stderr, exitCode } = runCLI('prefs set', { username: TEST_USER_NAME });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('Usage'), 'Should show usage');
    });

    it('should allow any free-form fields', () => {
      const json = JSON.stringify({
        instructions: 'Test',
        topics: ['AI', 'Fed'],
        custom_field: 'custom value'
      });
      const { exitCode } = runCLI(`prefs set '${json}'`, { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should accept fields');

      const { stdout } = runCLI('prefs get', { username: TEST_USER_NAME });
      const data = JSON.parse(stdout);
      assert.deepStrictEqual(data.topics, ['AI', 'Fed'], 'Should preserve topics array');
      assert.strictEqual(data.custom_field, 'custom value', 'Should preserve custom field');
    });
  });

  describe('prefs get', () => {
    it('should return own preferences as JSON', () => {
      const original = { instructions: 'Get test', topics: ['tech'] };
      runCLI(`prefs set '${JSON.stringify(original)}'`, { username: TEST_USER_NAME });

      const { stdout, exitCode } = runCLI('prefs get', { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      const data = JSON.parse(stdout);
      assert.strictEqual(data.instructions, 'Get test', 'Should return correct instructions');
      assert.deepStrictEqual(data.topics, ['tech'], 'Should return correct topics');
    });

    it('should return default instructions for new user', () => {
      const { stdout, exitCode } = runCLI('prefs get', { username: '_new_user_test_' });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      const data = JSON.parse(stdout);
      assert.ok(data.instructions, 'Should have default instructions');
      assert.ok(data.instructions.includes('HEADLINE'), 'Default instructions should include HEADLINE format');

      // Cleanup
      const creds = loadCredentials();
      delete creds.users['_new_user_test_'];
      saveCredentials(creds);
    });

    it('should error when $WSJ_USER not set', () => {
      const { stderr, exitCode } = runCLI('prefs get');

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
    });
  });

  describe('prefs update', () => {
    it('should update a single key with string value', () => {
      const original = { instructions: 'Original' };
      runCLI(`prefs set '${JSON.stringify(original)}'`, { username: TEST_USER_NAME });

      const { stdout, exitCode } = runCLI('prefs update instructions "Updated instructions"', { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('Updated'), 'Should confirm update');

      const { stdout: getOutput } = runCLI('prefs get', { username: TEST_USER_NAME });
      const data = JSON.parse(getOutput);
      assert.strictEqual(data.instructions, 'Updated instructions', 'Should have updated value');
    });

    it('should update a single key with JSON value', () => {
      const original = { instructions: 'Test' };
      runCLI(`prefs set '${JSON.stringify(original)}'`, { username: TEST_USER_NAME });

      const { exitCode } = runCLI(`prefs update topics '["AI", "Fed", "tariffs"]'`, { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');

      const { stdout: getOutput } = runCLI('prefs get', { username: TEST_USER_NAME });
      const data = JSON.parse(getOutput);
      assert.deepStrictEqual(data.topics, ['AI', 'Fed', 'tariffs'], 'Should have updated array');
    });

    it('should error when $WSJ_USER not set', () => {
      const { stderr, exitCode } = runCLI('prefs update key value');

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
    });

    it('should show usage when arguments missing', () => {
      const { stderr, exitCode } = runCLI('prefs update', { username: TEST_USER_NAME });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('Usage'), 'Should show usage');
    });
  });

  describe('prefs unknown subcommand', () => {
    it('should error on unknown subcommand', () => {
      const { stderr, exitCode } = runCLI('prefs unknown', { username: TEST_USER_NAME });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('Unknown') || stderr.includes('unknown'),
        'Should indicate unknown command');
    });
  });
});

// ============================================
// RSS Tool Tests
// ============================================

describe('RSS Tool', () => {
  describe('rss single section', () => {
    it('should fetch markets headlines in markdown format', () => {
      const { stdout, exitCode } = runCLI('rss markets', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('WSJ Headlines'), 'Should show headlines header');
      assert.ok(stdout.includes('markets'), 'Should mention section name');
    });

    it('should fetch tech headlines in markdown format', () => {
      const { stdout, exitCode } = runCLI('rss tech', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('WSJ Headlines'), 'Should show headlines header');
      assert.ok(stdout.includes('tech'), 'Should mention section name');
    });

    it('should fetch world headlines (default section)', () => {
      const { stdout, exitCode } = runCLI('rss', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('WSJ Headlines'), 'Should show headlines header');
      assert.ok(stdout.includes('world'), 'Should show world section');
    });

    it('should fetch us headlines', () => {
      const { stdout, exitCode } = runCLI('rss us', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('WSJ Headlines'), 'Should show headlines header');
    });

    it('should fetch opinion headlines', () => {
      const { stdout, exitCode } = runCLI('rss opinion', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('WSJ Headlines'), 'Should show headlines header');
    });

    it('should fetch lifestyle headlines', () => {
      const { stdout, exitCode } = runCLI('rss lifestyle', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('WSJ Headlines'), 'Should show headlines header');
    });
  });

  describe('rss single section --json', () => {
    it('should return valid JSON for markets', () => {
      const { stdout, exitCode } = runCLI('rss markets --json', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');

      const data = JSON.parse(stdout);
      assert.strictEqual(data.section, 'markets', 'Should have correct section');
      assert.ok(data.fetched_at, 'Should have fetched_at timestamp');
      assert.ok(Array.isArray(data.articles), 'Should have articles array');
    });

    it('should have correct article structure in JSON', () => {
      const { stdout } = runCLI('rss tech --json', { withProfile: true });
      const data = JSON.parse(stdout);

      if (data.articles.length > 0) {
        const article = data.articles[0];
        assert.ok('title' in article, 'Article should have title');
        assert.ok('url' in article, 'Article should have url');
        assert.ok('description' in article, 'Article should have description');
        assert.ok('pubDate' in article, 'Article should have pubDate');
        assert.ok('age' in article, 'Article should have age');
      }
    });

    it('should return valid JSON for world', () => {
      const { stdout, exitCode } = runCLI('rss world --json', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      const data = JSON.parse(stdout);
      assert.strictEqual(data.section, 'world', 'Should have correct section');
    });
  });

  describe('rss all', () => {
    it('should fetch all sections in markdown format', () => {
      const { stdout, exitCode } = runCLI('rss all', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('world'), 'Should include world section');
      assert.ok(stdout.includes('markets'), 'Should include markets section');
      assert.ok(stdout.includes('tech'), 'Should include tech section');
    });

    it('should return valid JSON for all sections', () => {
      const { stdout, exitCode } = runCLI('rss all --json', { withProfile: true });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');

      const data = JSON.parse(stdout);
      assert.ok(data.fetched_at, 'Should have fetched_at timestamp');
      assert.ok(Array.isArray(data.sections), 'Should have sections array');
      assert.strictEqual(data.sections.length, 6, 'Should have 6 sections');

      const sectionNames = data.sections.map(s => s.section);
      assert.ok(sectionNames.includes('world'), 'Should include world');
      assert.ok(sectionNames.includes('markets'), 'Should include markets');
      assert.ok(sectionNames.includes('tech'), 'Should include tech');
      assert.ok(sectionNames.includes('us'), 'Should include us');
      assert.ok(sectionNames.includes('opinion'), 'Should include opinion');
      assert.ok(sectionNames.includes('lifestyle'), 'Should include lifestyle');
    });
  });

  describe('rss invalid section', () => {
    it('should error on invalid section', () => {
      const { stderr, exitCode } = runCLI('rss invalid_section', { withProfile: true });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('Unknown section') || stderr.includes('invalid'),
        'Should indicate unknown section');
    });
  });
});

// ============================================
// User Enforcement Tests
// ============================================

describe('User Enforcement', () => {
  it('should require WSJ_USER for rss command', () => {
    const { stderr, exitCode } = runCLI('rss markets', { withUser: false });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('WSJ_USER') || stderr.includes('ERROR'),
      'Should show user required error');
  });

  it('should require WSJ_USER for read command', () => {
    const { stderr, exitCode } = runCLI('read https://example.com', { withUser: false });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('WSJ_USER') || stderr.includes('ERROR'),
      'Should show user required error');
  });

  it('should require WSJ_USER for search command', () => {
    const { stderr, exitCode } = runCLI('search test', { withUser: false });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('WSJ_USER') || stderr.includes('ERROR'),
      'Should show user required error');
  });

  it('should require WSJ_USER for prefs get command', () => {
    const { stderr, exitCode } = runCLI('prefs get', { withUser: false });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
  });

  it('should require WSJ_USER for prefs set command', () => {
    const json = JSON.stringify({ topics: ['test'] });
    const { stderr, exitCode } = runCLI(`prefs set '${json}'`, { withUser: false });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
  });

  it('should require WSJ_USER for prefs update command', () => {
    const { stderr, exitCode } = runCLI('prefs update key value', { withUser: false });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
  });

  it('should allow status command without WSJ_USER', () => {
    const { exitCode } = runCLI('status', { withUser: false });

    assert.strictEqual(exitCode, 0, 'Status should work without WSJ_USER');
  });
});

// ============================================
// Read Tool Tests
// ============================================

describe('Read Tool', () => {
  it('should show usage when URL missing', () => {
    const { stderr, exitCode } = runCLI('read', { withProfile: true });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('Usage'), 'Should show usage');
  });

  it('should accept --json flag without error in usage', () => {
    const { stderr } = runCLI('read', { withProfile: true });
    assert.ok(stderr.includes('--json'), 'Usage should mention --json flag');
  });
});

// ============================================
// Search Tool Tests
// ============================================

describe('Search Tool', () => {
  it('should show usage when query missing', () => {
    const { stderr, exitCode } = runCLI('search', { withProfile: true });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('Usage'), 'Should show usage');
  });

  it('should accept --json flag without error in usage', () => {
    const { stderr } = runCLI('search', { withProfile: true });
    assert.ok(stderr.includes('--json'), 'Usage should mention --json flag');
  });
});

// ============================================
// Status Tool Tests
// ============================================

describe('Status Tool', () => {
  it('should show connection status', () => {
    const { stdout, exitCode } = runCLI('status');

    assert.strictEqual(exitCode, 0, 'Should exit with code 0');
    assert.ok(stdout.includes('Connected:'), 'Should show connection status');
  });

  it('should show port when connected', () => {
    const { stdout } = runCLI('status');

    assert.ok(stdout.includes('Port:') || stdout.includes('wsj setup'),
      'Should show port or setup instructions');
  });
});

// ============================================
// Backward Compatibility Tests
// ============================================

describe('Backward Compatibility', () => {
  it('headlines command should work as alias for rss', () => {
    const { stdout, exitCode } = runCLI('headlines markets', { withUser: true });

    assert.strictEqual(exitCode, 0, 'Should exit with code 0');
    assert.ok(stdout.includes('WSJ Headlines'), 'Should show headlines');
  });

  it('headlines --json should work', () => {
    const { stdout, exitCode } = runCLI('headlines tech --json', { withUser: true });

    assert.strictEqual(exitCode, 0, 'Should exit with code 0');
    const data = JSON.parse(stdout);
    assert.ok(data.section, 'Should return valid JSON');
  });

  it('article command should show usage (alias for read)', () => {
    const { stderr, exitCode } = runCLI('article', { withUser: true });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
    assert.ok(stderr.includes('Usage'), 'Should show usage');
  });

  it('profile command should redirect to prefs with notice', () => {
    const { stderr } = runCLI('profile get', { username: NEWS_TEST_USER });

    assert.ok(stderr.includes('prefs'), 'Should redirect to prefs functionality');
  });
});

// ============================================
// Edge Cases & Error Handling
// ============================================

describe('Edge Cases', () => {
  beforeEach(() => {
    cleanupTestUsers();
  });

  afterEach(() => {
    cleanupTestUsers();
  });

  it('should handle preferences with special characters in instructions', () => {
    const json = JSON.stringify({
      instructions: 'Test with special chars: $100 & more'
    });
    const { exitCode } = runCLI(`prefs set '${json}'`, { username: TEST_USER_NAME });

    assert.strictEqual(exitCode, 0, 'Should handle special characters');

    const { stdout } = runCLI('prefs get', { username: TEST_USER_NAME });
    const data = JSON.parse(stdout);
    assert.ok(data.instructions.includes('$100'), 'Should preserve special chars');
  });

  it('should handle preferences update with nested JSON value', () => {
    const original = { instructions: 'Test' };
    runCLI(`prefs set '${JSON.stringify(original)}'`, { username: TEST_USER_NAME });

    const { exitCode } = runCLI(`prefs update config '{"nested": {"key": "value"}}'`, { username: TEST_USER_NAME });

    assert.strictEqual(exitCode, 0, 'Should handle nested JSON');

    const { stdout } = runCLI('prefs get', { username: TEST_USER_NAME });
    const data = JSON.parse(stdout);
    assert.deepStrictEqual(data.config, { nested: { key: 'value' } }, 'Should preserve nested structure');
  });
});

// ============================================
// JSON Output Validation Tests
// ============================================

describe('JSON Output Validation', () => {
  it('rss JSON should have ISO timestamp', () => {
    const { stdout } = runCLI('rss markets --json', { withProfile: true });
    const data = JSON.parse(stdout);

    const timestamp = new Date(data.fetched_at);
    assert.ok(!isNaN(timestamp.getTime()), 'fetched_at should be valid date');
  });

  it('rss all JSON should have consistent structure', () => {
    const { stdout } = runCLI('rss all --json', { withProfile: true });
    const data = JSON.parse(stdout);

    for (const section of data.sections) {
      assert.ok(section.section, 'Each section should have section name');
      assert.ok(section.fetched_at, 'Each section should have fetched_at');
      assert.ok(Array.isArray(section.articles), 'Each section should have articles array');
    }
  });
});

// ============================================
// Additional Prefs Tests (v1.5)
// ============================================

describe('Additional Prefs Tests', () => {
  beforeEach(() => {
    cleanupTestUsers();
  });

  afterEach(() => {
    cleanupTestUsers();
  });

  it('should accept empty JSON object (empty preferences)', () => {
    const { exitCode } = runCLI("prefs set '{}'", { username: '_test_invalid_' });

    assert.strictEqual(exitCode, 0, 'Should accept empty preferences');
  });

  it('should reject non-object JSON', () => {
    const { stderr, exitCode } = runCLI('prefs set \'"just a string"\'', { username: '_test_invalid_' });

    assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
  });

  it('should add new field via update', () => {
    const original = { instructions: 'Test' };
    runCLI(`prefs set '${JSON.stringify(original)}'`, { username: TEST_USER_NAME });

    const { exitCode } = runCLI('prefs update new_field "new value"', { username: TEST_USER_NAME });

    assert.strictEqual(exitCode, 0, 'Should succeed');

    const { stdout } = runCLI('prefs get', { username: TEST_USER_NAME });
    const data = JSON.parse(stdout);
    assert.strictEqual(data.new_field, 'new value', 'Should have new field');
  });

  it('should handle boolean value in update', () => {
    const original = { instructions: 'Test' };
    runCLI(`prefs set '${JSON.stringify(original)}'`, { username: TEST_USER_NAME });

    const { exitCode } = runCLI("prefs update include_opinion 'true'", { username: TEST_USER_NAME });

    assert.strictEqual(exitCode, 0, 'Should succeed');

    const { stdout } = runCLI('prefs get', { username: TEST_USER_NAME });
    const data = JSON.parse(stdout);
    assert.strictEqual(data.include_opinion, true, 'Should have boolean value');
  });

  it('should handle number value in update', () => {
    const original = { instructions: 'Test' };
    runCLI(`prefs set '${JSON.stringify(original)}'`, { username: TEST_USER_NAME });

    const { exitCode } = runCLI("prefs update max_items '10'", { username: TEST_USER_NAME });

    assert.strictEqual(exitCode, 0, 'Should succeed');

    const { stdout } = runCLI('prefs get', { username: TEST_USER_NAME });
    const data = JSON.parse(stdout);
    assert.strictEqual(data.max_items, 10, 'Should have number value');
  });
});

// ============================================
// Morning Feed E2E Tests (24-hour freshness)
// ============================================

describe('Morning Feed - 24hr freshness', () => {
  it('rss all should have some articles within the last 24 hours per section', () => {
    const { stdout, exitCode } = runCLI('rss all --json', { withProfile: true });
    assert.strictEqual(exitCode, 0, 'Should exit with code 0');

    const data = JSON.parse(stdout);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    for (const section of data.sections) {
      const freshCount = section.articles.filter(a => {
        if (!a.pubDate) return false;
        return (now - new Date(a.pubDate).getTime()) <= twentyFourHours;
      }).length;
      assert.ok(
        freshCount >= 3,
        `Section "${section.section}" has only ${freshCount} articles within 24h, expected at least 3`
      );
    }
  });

  it('rss single section should have some articles within the last 24 hours', () => {
    const { stdout, exitCode } = runCLI('rss markets --json', { withProfile: true });
    assert.strictEqual(exitCode, 0, 'Should exit with code 0');

    const data = JSON.parse(stdout);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    const freshCount = data.articles.filter(a => {
      if (!a.pubDate) return false;
      return (now - new Date(a.pubDate).getTime()) <= twentyFourHours;
    }).length;
    assert.ok(
      freshCount >= 3,
      `Markets section has only ${freshCount} articles within 24h, expected at least 3`
    );
  });

  it('all articles should have a non-empty pubDate', () => {
    const { stdout } = runCLI('rss all --json', { withProfile: true });
    const data = JSON.parse(stdout);

    for (const section of data.sections) {
      for (const article of section.articles) {
        assert.ok(article.pubDate, `Article "${article.title}" in ${section.section} is missing pubDate`);
      }
    }
  });
});

// ============================================
// Additional RSS Tests
// ============================================

describe('Additional RSS Tests', () => {
  it('should have category field in article JSON', () => {
    const { stdout } = runCLI('rss markets --json', { withProfile: true });
    const data = JSON.parse(stdout);

    if (data.articles.length > 0) {
      const article = data.articles[0];
      assert.ok('category' in article, 'Article should have category field');
    }
  });

  it('should handle --json flag position after section', () => {
    const { stdout, exitCode } = runCLI('rss tech --json', { withProfile: true });

    assert.strictEqual(exitCode, 0, 'Should exit with code 0');
    const data = JSON.parse(stdout);
    assert.strictEqual(data.section, 'tech', 'Should parse section correctly');
  });

  it('should show available sections in markdown output', () => {
    const { stdout } = runCLI('rss markets', { withProfile: true });
    assert.ok(stdout.includes('Available sections'), 'Should show available sections');
  });

  it('rss all should fetch exactly 6 sections', () => {
    const { stdout } = runCLI('rss all --json', { withProfile: true });
    const data = JSON.parse(stdout);

    assert.strictEqual(data.sections.length, 6, 'Should have exactly 6 sections');
  });
});

// ============================================
// File System Tests
// ============================================

describe('File System', () => {
  beforeEach(() => {
    cleanupTestUsers();
  });

  afterEach(() => {
    cleanupTestUsers();
  });

  it('should create config directory if it does not exist', () => {
    const json = JSON.stringify({ instructions: 'Test' });
    const { exitCode } = runCLI(`prefs set '${json}'`, { username: TEST_USER_NAME });

    assert.strictEqual(exitCode, 0, 'Should succeed');
    assert.ok(existsSync(CONFIG_DIR), 'Config directory should exist');
  });

  it('should overwrite existing preferences on set', () => {
    const json1 = JSON.stringify({ instructions: 'First' });
    const json2 = JSON.stringify({ instructions: 'Second' });

    runCLI(`prefs set '${json1}'`, { username: TEST_USER_NAME });
    runCLI(`prefs set '${json2}'`, { username: TEST_USER_NAME });

    const { stdout } = runCLI('prefs get', { username: TEST_USER_NAME });
    const data = JSON.parse(stdout);

    assert.strictEqual(data.instructions, 'Second', 'Should have overwritten value');
  });

  it('should write valid JSON to credentials file', () => {
    const json = JSON.stringify({ instructions: 'Test' });
    runCLI(`prefs set '${json}'`, { username: TEST_USER_NAME });

    const creds = loadCredentials();
    assert.ok(creds.users[TEST_USER_NAME], 'User should exist in credentials');
    assert.strictEqual(creds.users[TEST_USER_NAME].preferences.instructions, 'Test', 'Should have correct instructions');
  });
});

// ============================================
// User Registration Tests (v1.5)
// ============================================

describe('User Registration', () => {
  beforeEach(() => {
    cleanupTestUsers();
  });

  afterEach(() => {
    cleanupTestUsers();
  });

  it('should auto-register new user on first command', () => {
    const { stdout, stderr, exitCode } = runCLI('rss markets', { username: '_new_auto_user_' });

    assert.strictEqual(exitCode, 0, 'Should succeed');
    assert.ok(stderr.includes('Registered new user') || stdout.includes('WSJ Headlines'),
      'Should register and run command');

    // Verify user exists
    const creds = loadCredentials();
    assert.ok(creds.users['_new_auto_user_'], 'User should exist in credentials');
    assert.ok(creds.users['_new_auto_user_'].registered, 'Should have registered timestamp');

    // Cleanup
    delete creds.users['_new_auto_user_'];
    saveCredentials(creds);
  });

  it('should not re-register existing user', () => {
    // First call registers
    runCLI('rss markets', { username: TEST_USER_NAME });
    const creds1 = loadCredentials();
    const registered1 = creds1.users[TEST_USER_NAME].registered;

    // Second call should not re-register
    const { stderr } = runCLI('rss markets', { username: TEST_USER_NAME });
    const creds2 = loadCredentials();
    const registered2 = creds2.users[TEST_USER_NAME].registered;

    assert.strictEqual(registered1, registered2, 'Registration timestamp should not change');
    assert.ok(!stderr.includes('Registered new user'), 'Should not show registration message');
  });
});

// ============================================
// User Command Tests (v1.5)
// ============================================

describe('User Command', () => {
  beforeEach(() => {
    cleanupTestUsers();
    // Create test user for these tests
    const creds = loadCredentials();
    creds.users[TEST_USER_NAME] = {
      registered: new Date().toISOString(),
      preferences: { topics: ['AI'], instructions: 'Test' },
      context: { last_query: 'test' }
    };
    saveCredentials(creds);
  });

  afterEach(() => {
    cleanupTestUsers();
  });

  describe('user info', () => {
    it('should show user information', () => {
      const { stdout, exitCode } = runCLI('user info', { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('Username:'), 'Should show username');
      assert.ok(stdout.includes('Registered:'), 'Should show registered date');
      assert.ok(stdout.includes('Preferences:'), 'Should show preferences');
    });
  });

  describe('user reset', () => {
    it('should clear user preferences and context', () => {
      const { stdout, exitCode } = runCLI('user reset', { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('Reset context'), 'Should confirm reset');

      // Verify preferences are cleared
      const creds = loadCredentials();
      assert.ok(creds.users[TEST_USER_NAME].preferences.instructions, 'Should have default instructions after reset');
      assert.ok(creds.users[TEST_USER_NAME].preferences.instructions.includes('HEADLINE'), 'Should revert to default instructions');
      assert.strictEqual(Object.keys(creds.users[TEST_USER_NAME].preferences).length, 1, 'Should only have instructions (no other prefs)');
      assert.deepStrictEqual(creds.users[TEST_USER_NAME].context, {}, 'Context should be empty');
    });

    it('should error when user does not exist', () => {
      const { stderr, exitCode } = runCLI('user reset', { username: '_nonexistent_user_' });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('not found'), 'Should indicate user not found');
    });

    it('should error when WSJ_USER not set', () => {
      const { stderr, exitCode } = runCLI('user reset');

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
    });
  });

  describe('user delete', () => {
    it('should remove user entirely', () => {
      const { stdout, exitCode } = runCLI('user delete', { username: TEST_USER_NAME });

      assert.strictEqual(exitCode, 0, 'Should exit with code 0');
      assert.ok(stdout.includes('Deleted user'), 'Should confirm deletion');

      // Verify user is removed
      const creds = loadCredentials();
      assert.ok(!creds.users[TEST_USER_NAME], 'User should not exist');
    });

    it('should error when user does not exist', () => {
      const { stderr, exitCode } = runCLI('user delete', { username: '_nonexistent_user_' });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('not found'), 'Should indicate user not found');
    });

    it('should error when WSJ_USER not set', () => {
      const { stderr, exitCode } = runCLI('user delete');

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('WSJ_USER'), 'Should mention WSJ_USER');
    });
  });

  describe('user unknown subcommand', () => {
    it('should show usage for unknown subcommand', () => {
      const { stderr, exitCode } = runCLI('user unknown', { username: TEST_USER_NAME });

      assert.notStrictEqual(exitCode, 0, 'Should exit with non-zero code');
      assert.ok(stderr.includes('Usage'), 'Should show usage');
    });
  });
});
