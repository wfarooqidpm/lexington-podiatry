const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const catalog = JSON.parse(read('booking-options.json'));
const controller = read('booking-single-page.js');
const handoff = controller.slice(controller.indexOf('function applyBookingLinkPreferences'));

test('catalog links use the real booking controls, while email links keep their own flow', () => {
  const resolve = (search, continuation = false) => {
    const effects = [];
    vm.runInNewContext(handoff, {
      URLSearchParams,
      location: { search },
      document: { querySelector: selector => selector },
      fd331El: id => id,
      fd331Approval: () => continuation,
      fd331Initialize: () => effects.push('initialized'),
      fd331SelectType: type => effects.push(type),
      fd331SelectMode: selector => effects.push(selector),
    });
    return effects;
  };
  for (const { bookingUrl, patientType, mode } of catalog.visitOptions) {
    const type = patientType === 'new' ? 'cardNew' : 'cardReturning';
    const value = mode === 'video' ? 'Virtual' : 'In Person';
    assert.deepEqual(resolve(new URL(bookingUrl).search), ['initialized', type, `#newModeGrid [data-mode="${value}"]`]);
    assert.deepEqual(resolve(new URL(bookingUrl).search, true), []);
  }
  const firstVisitDefault = ['initialized', 'cardNew', '#newModeGrid [data-mode="In Person"]'];
  assert.deepEqual(resolve(''), firstVisitDefault);
  assert.deepEqual(resolve('?rwg_token=example'), firstVisitDefault);
  assert.deepEqual(resolve('?visit=orthotics&mode=video'), ['initialized']);
  assert.deepEqual(resolve('?visit=returning&mode=invalid'), ['initialized', 'cardReturning']);
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

test('booking holds the service directory and old appointment links lead there', () => {
  const booking = read('booking.html');
  const directory = booking.match(/<section class="booking-services"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(directory, 'The service links belong on the booking page');
  for (const service of catalog.services) {
    assert.ok(directory.includes(`href="${new URL(service.url).pathname}"`));
  }
  const oldRoute = read('appointments/index.html');
  assert.ok(oldRoute.includes('<meta http-equiv="refresh" content="0;url=/booking">'));
  assert.ok(oldRoute.includes(`<link rel="canonical" href="${catalog.bookingUrl}">`));
  assert.ok(!read('sitemap.xml').includes('/appointments/'));
  assert.equal(catalog.appointmentsUrl, catalog.bookingUrl);
});
