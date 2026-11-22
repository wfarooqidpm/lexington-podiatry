const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const read = name => readFileSync(join(__dirname, '..', name), 'utf8');
const controller = read('booking-single-page.js');
const tail = controller.slice(controller.indexOf('if(!window.lexGoogleBookingActive'));

function open(search = '', hash = '', savedFragment = '') {
  const calls = [];
  const fragment = {};
  const booker = { hidden: false, before(content) { assert.equal(content, fragment); calls.push('embedded'); } };
  const template = { content: { cloneNode: () => fragment } };
  const context = {
    URLSearchParams,
    location: { search, hash },
    window: { lexBookingVerificationFragment: savedFragment },
    document: { getElementById: () => template, querySelector: () => booker },
    fd331Approval() { calls.push('verification check'); return Boolean(savedFragment); },
    fd331Initialize() { calls.push('initialize existing scheduler'); },
    applyBookingLinkPreferences(query) { calls.push(query); },
  };
  runInNewContext(read('booking-calendar.js') + '\n' + tail, context);
  return { embedded: booker.hidden, calls };
}

test('normal and Google referral URLs open the calendar without a legacy network call', () => {
  const expected = { embedded: true, calls: ['embedded'] };
  assert.deepEqual(open(), expected);
  assert.deepEqual(open('?rwg_token=example'), expected);
});

test('existing first visit, video, follow-up and email continuation links remain usable', () => {
  for (const query of ['?visit=new&mode=in-person', '?visit=returning&mode=in-person', '?mode=video']) {
    assert.deepEqual(open(query), { embedded: false, calls: ['verification check', 'initialize existing scheduler', query] });
  }
  assert.deepEqual(open('', '', '#verify=opaque'), { embedded: false, calls: ['verification check'] });
  assert.deepEqual(open('', '#verify=opaque'), { embedded: false, calls: ['verification check', 'initialize existing scheduler'] });
});

test('inline source and fallback point to the same public Google appointment schedule', () => {
  const html = read('booking.html');
  const template = html.match(/<template id="googleBookingTemplate">([\s\S]*?)<\/template>/)?.[1];
  assert.ok(template);
  const embed = new URL(template.match(/<iframe[^>]+src="([^"]+)"/)?.[1]);
  assert.equal(embed.origin, 'https://calendar.google.com');
  assert.equal(embed.searchParams.get('gv'), 'true');
  assert.match(embed.pathname, /^\/calendar\/appointments\/schedules\/[a-zA-Z0-9_-]+$/);
  assert.ok(template.includes(`href="${embed.origin}${embed.pathname}"`));
  assert.ok(template.includes('referrerpolicy="no-referrer"'));
  assert.ok(html.indexOf('booking-calendar.js?v=1') < html.indexOf('booking-single-page.js?v=340'));
});
