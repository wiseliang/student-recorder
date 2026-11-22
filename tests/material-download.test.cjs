const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');

const job = { id: '12345678-1234-4234-8234-123456789abc' };
const production = 'https://hit-recorder.wiseliang.cloud/student-recorder';
const legacyProduction = 'https://wiseliang.cloud/student-recorder';
const direct = 'https://download.wiseliang.cloud/student-recorder';

function setup(first, override = {}) {
  const requests = [], shared = [], progress = [];
  let context = 'test-owner:1';
  let cancellations = 0;
  const exports = {};
  const mocks = {
    'react-native': { Platform: { OS: 'android' } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async uri => shared.push(uri) },
    'expo-document-picker': {},
    'expo-file-system': {
      cacheDirectory: 'file:///cache/',
      makeDirectoryAsync: async () => {},
      deleteAsync: async () => {},
      createDownloadResumable(url, uri, options) {
        requests.push({ url, uri, token: options.headers.Authorization });
        return {
          cancelAsync: async () => { cancellations++; },
          downloadAsync: async () => url.startsWith(direct) ? first(() => { context = 'different-owner:2'; }) : { status: 200 },
        };
      },
    },
    './api': {
      BASE_URL: override.base || production,
      IS_PRODUCTION_API: [production, legacyProduction].includes(override.base || production),
      identityContext: async () => context,
      identity: async () => ({ token: 'fixture-token' }),
      refreshIdentity: async () => {},
    },
  };
  const source = fs.readFileSync(__dirname + '/../src/utils/materialFiles.js', 'utf8');
  const code = babel.transformSync(source, { configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'] }).code;
  vm.runInNewContext(code, {
    exports, require: name => mocks[name],
    setTimeout: callback => setTimeout(callback, override.timeout || 1000),
    clearTimeout,
  });
  return {
    run: () => exports.downloadMaterial(job, event => progress.push(event)),
    requests, shared, progress, cancellations: () => cancellations,
  };
}

test('uses the authenticated direct route and shares the PPT only after transfer', async () => {
  const fixture = setup(() => ({ status: 200 }));
  await fixture.run();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].url, direct + '/api/materials/jobs/' + job.id + '/download');
  assert.equal(fixture.requests[0].token, 'Bearer fixture-token');
  assert.equal(fixture.shared[0], fixture.requests[0].uri);
});

test('falls back to the normal route when direct download returns an error or no first byte', async () => {
  const unavailable = setup(() => ({ status: 503 }));
  await unavailable.run();
  assert.equal(unavailable.requests.length, 2);
  assert(unavailable.requests[1].url.startsWith(production));
  assert.equal(unavailable.shared[0], unavailable.requests[1].uri);
  const stalled = setup(() => new Promise(() => {}), { timeout: 5 });
  await stalled.run();
  assert.equal(stalled.cancellations(), 1);
  assert.equal(stalled.requests.length, 2);
  assert.notEqual(stalled.requests[0].uri, stalled.requests[1].uri);
});

test('does not share a download after the user has switched accounts', async () => {
  const fixture = setup(switchAccount => { switchAccount(); return { status: 200 }; });
  await assert.rejects(fixture.run(), /账号已切换/);
  assert.deepEqual(fixture.shared, []);
});

test('retains the direct route for the old production origin and isolates a custom backend', async () => {
  const old = setup(() => ({ status: 200 }), { base: legacyProduction });
  await old.run();
  assert(old.requests[0].url.startsWith(direct));
  const custom = setup(() => ({ status: 200 }), { base: 'https://fixture.invalid' });
  await custom.run();
  assert(custom.requests[0].url.startsWith('https://fixture.invalid/api/'));
});
