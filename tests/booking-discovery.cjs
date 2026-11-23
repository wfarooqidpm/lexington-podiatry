const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const catalog = JSON.parse(read('booking-options.json'));
test('catalog links open the unified page and pass only visit mode', () => {
  for (const { bookingUrl, mode } of catalog.visitOptions) {
    const url = new URL(bookingUrl);
    assert.equal(url.pathname, '/booking');
    assert.deepEqual([...url.searchParams], [['mode', mode]]);
  }
  assert.doesNotMatch(catalog.bookingCompletion, /verify|email/i);
});

test('browser agent tools request only public first-visit slots and return approved fields', async () => {
  const registered = new Map();
  const calls = [];
  const start = '2030-05-06T16:00:00.000Z';
  let response = { success: true, slots: [
    { iso: start, visitMode: 'VIRTUAL', durationMinutes: 30, internal: 'discarded' },
    { iso: start, visitMode: 'IN_PERSON', durationMinutes: 30 },
    { iso: 'bad-date', visitMode: 'VIRTUAL', durationMinutes: 30 },
    { iso: start, visitMode: 'VIRTUAL', durationMinutes: 0 },
  ] };
  class TestDate extends Date { static now() { return Date.parse('2030-05-01'); } }
  const context = {
    AbortController, URL, URLSearchParams, Date: TestDate,
    window: { addEventListener() {} },
    location: { origin: new URL(catalog.bookingUrl).origin },
    document: {
      getElementById: () => null,
      modelContext: { registerTool: definition => registered.set(definition.name, definition) },
    },
    fetch: async () => ({ ok: true, json: async () => catalog }),
    call271: async input => { calls.push(JSON.parse(JSON.stringify(input))); return response; },
  };
  vm.runInNewContext(read('booking-agent.js'), context);
  const findTime = registered.get('list_new_patient_appointment_times');
  await assert.rejects(findTime.execute({ mode: 'returning' }), /in-person or video/);
  const result = JSON.parse(await findTime.execute({ mode: 'video', patientType: 'returning', session: 'ignore' }));
  assert.deepEqual(calls, [{ action: 'slots', patientType: 'new', visitMode: 'Virtual' }]);
  assert.deepEqual(result.slots, [{ start, durationMinutes: 30 }]);
  assert.equal(result.bookingUrl, catalog.visitOptions.find(option => option.patientType === 'new' && option.mode === 'video').bookingUrl);
  assert.equal(registered.get('get_booking_options').annotations.readOnlyHint, true);
  assert.deepEqual(JSON.parse(await registered.get('get_booking_options').execute()), catalog);

  response = { success: false };
  assert.equal(JSON.parse(await findTime.execute({ mode: 'video' })).status, 'unavailable');
  registered.clear();
  context.document.getElementById = () => ({});
  vm.runInNewContext(read('booking-agent.js'), context);
  assert.equal(registered.size, 0);
});

test('booking shows the calendar illustration and old appointment links lead there', () => {
  const booking = read('booking.html');
  assert.match(booking, /<img class="booking-calendar-art" src="\/calendar-sparkles\.webp" alt=""/);
  const calendar = readFileSync(path.join(__dirname, '..', 'calendar-sparkles.webp'));
  assert.equal(calendar.toString('ascii', 8, 12), 'WEBP');
  assert.doesNotMatch(booking, /booking-services|>Foot and ankle services<|booking-flourish/);
  for (const service of catalog.services) {
    assert.ok(read(new URL(service.url).pathname.slice(1)));
  }
  const oldRoute = read('appointments/index.html');
  assert.ok(oldRoute.includes('<meta http-equiv="refresh" content="0;url=/booking">'));
  assert.ok(oldRoute.includes(`<link rel="canonical" href="${catalog.bookingUrl}">`));
  assert.ok(!read('sitemap.xml').includes('/appointments/'));
  assert.equal(catalog.appointmentsUrl, catalog.bookingUrl);
});

test('every homepage booking call to action goes directly to the booking page', () => {
  const home = read('index.html');
  const bookingLinks = [...home.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>\s*(?:Book online|Book an appointment)\s*<\/a>/g)];
  assert.equal(bookingLinks.length, 5);
  assert.ok(bookingLinks.every(([, href]) => href === '/booking'));
  assert.doesNotMatch(home, /href="#homeBooking"|src="[^"]*home-booking\.js|class="home-booking\b/);

  const legacyRedirect = home.match(/if \(location\.hash === '#homeBooking'\)[^\n]+/)?.[0];
  const destinations = [];
  vm.runInNewContext(legacyRedirect, {location:{hash:'#homeBooking',search:'?utm_source=referral',
    replace: path => destinations.push(path)}});
  assert.deepEqual(destinations, ['/booking?utm_source=referral']);
});
