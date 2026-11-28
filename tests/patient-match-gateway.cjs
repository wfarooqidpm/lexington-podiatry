// Gateway release 2026-11-28: patient-match bridge, follow-up gap, Sex. Synthetic data only.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dir = path.join(__dirname, '../releases/2026-11-28-patient-match');
const session = 'a'.repeat(64);
const charm = { patientId: '1001', recordId: 'R1001', firstName: 'Chart', lastName: 'Name', dob: '1980-01-01', phone: '2025550142', email: 'chart@example.test' };
const headers = ['Front Door ID', 'Booking Source', 'Source Booking ID', 'Source Calendar ID', 'Source Calendar Event ID',
  'Appointment Start', 'Appointment End', 'Patient Type', 'First Name', 'Last Name', 'DOB', 'Sex', 'Phone', 'Email',
  'Front Door Status', 'Patient Token', 'Charm Patient ID', 'Raw Source JSON'];
const tomorrowAt = (h, m) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d; };
const busy = (start, end) => ({ isAllDayEvent: () => false, getStartTime: () => start, getEndTime: () => end });

function runtime({ dayEvents = [], router } = {}) {
  const rows = [headers], events = [], routerCalls = [];
  const ctx = vm.createContext({
    Date, // share the Date type so dates built here pass the gateway's instanceof checks
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({
      getLastRow: () => rows.length, getLastColumn: () => headers.length,
      getRange: (row, col, count, width) => ({ getValues: () => rows.slice(row - 1, row - 1 + count).map(r => r.slice(col - 1, col - 1 + width)) }),
      appendRow: row => rows.push(row)
    }) }) },
    Utilities: { getUuid: () => 'synthetic-uuid', formatDate: (d) => d.toISOString().slice(0, 10) }
  });
  for (const f of ['FrontDoor_Gateway.gs', 'FrontDoor_BookingBridge.gs']) vm.runInContext(readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  Object.assign(ctx, {
    fdg080Json_: obj => obj,
    fdg160WebsiteVerificationEnabled_: () => true,
    fdg160PrivateRouterCall_: (action, body) => {
      routerCalls.push({ action, body });
      if (action === 'verification-session') return body.session === session ? { success: true, valid: true, ...charm } : { success: true, valid: false };
      return router ? router(action, body) : { success: false };
    },
    fdg111SchedulingPolicy_: () => ({
      leadMinutes: 0, returningDurationMinutes: 15, returningGapMinutes: 15, newDurationMinutes: 30,
      returningDaysAhead: 3, newDaysAhead: 3, progressiveReturning: false,
      hours: Array(7).fill({ enabled: true, open: '09:00', close: '12:00', mode: 'IN_PERSON' }), closures: []
    }),
    fdg111DateBlocked_: () => false,
    fdg083WebsiteCalendar_: () => ({
      getEventsForDay: () => dayEvents, getEvents: () => [],
      createEvent(title, start, end, opts) { events.push({ title, start, end, description: opts.description }); return { getId: () => 'evt' }; }
    }),
    fdg082NewPatientToken_: () => 'd'.repeat(64),
    fdg163RequireWebsiteBookingRateLimit_: () => {}
  });
  const row = i => Object.fromEntries(headers.map((h, j) => [h, rows[i][j]]));
  return { ctx, rows, events, routerCalls, row };
}

test('a follow-up needs its 15-minute gap free; a first visit does not get one', () => {
  // Busy 10:30-11:00 tomorrow.
  const { ctx } = runtime();
  const p = ctx.fdg111SchedulingPolicy_(), events = [busy(tomorrowAt(10, 30), tomorrowAt(11, 0))], now = new Date();
  const offered = (h, m, type) => ctx.fdg111IsOfferedSlot_(tomorrowAt(h, m), type, p, events, now, 'In Person').ok;
  assert.equal(offered(10, 0, 'returning'), true, '10:00 + gap ends at 10:30');
  assert.equal(offered(10, 15, 'returning'), false, 'the gap would overlap 10:30');
  assert.equal(offered(10, 0, 'new'), true, 'a 30-minute first visit fits before 10:30');
  assert.equal(ctx.fdg111IsOfferedSlot_(tomorrowAt(10, 0), 'returning', p, events, now, 'In Person').durationMinutes, 15);
  // Orthotics pickups keep 15 minutes with no gap.
  assert.equal(ctx.fdgPickupPolicy_({ bookingPurpose: 'ORTHOTICS_PICKUP' }, 'IN_PERSON').returningGapMinutes, 0);
  assert.equal(ctx.fdgPickupPolicy_(null, 'IN_PERSON').returningGapMinutes, 15);
});

test('a linked follow-up holds 30 minutes on the calendar but records a 15-minute appointment and Sex', () => {
  const { ctx, events, row } = runtime();
  const start = tomorrowAt(10, 0);
  const r = ctx.fdg273CreateWebsiteBookingInternal_({ websiteBookingId: 'WEB-' + 'c'.repeat(32), booking: {
    patientType: 'returning', visitMode: 'In Person', verificationSession: session, slotIso: start.toISOString(), sex: 'female' } });
  assert.equal(r.success, true);
  assert.equal((events[0].end - events[0].start) / 60000, 30);
  assert.match(events[0].description, /15-minute gap after the 15-minute appointment/);
  const saved = row(1);
  assert.equal((saved['Appointment End'] - saved['Appointment Start']) / 60000, 15);
  assert.equal(saved.Sex, 'Female');
  assert.equal(saved['Charm Patient ID'], charm.patientId);
  assert.equal(saved.Email, charm.email, 'Charm contact details are used, not typed ones');
});

test('a first visit holds exactly 30 minutes and stores Sex', () => {
  const { ctx, events, row } = runtime();
  ctx.fdg273CreateWebsiteBookingInternal_({ websiteBookingId: 'WEB-' + 'e'.repeat(32), booking: {
    patientType: 'new', visitMode: 'In Person', slotIso: tomorrowAt(9, 0).toISOString(),
    firstName: 'New', lastName: 'Person', dob: '1990-02-03', sex: 'male', phone: '+12125550100', email: 'new@example.test' } });
  assert.equal((events[0].end - events[0].start) / 60000, 30);
  assert.ok(!/gap/.test(events[0].description));
  assert.equal(row(1).Sex, 'Male');
  assert.equal(ctx.fdg280Sex_('other'), '');
});

test('the bridge forwards only the match details and returns only the decision', () => {
  let reply = { success: true, matched: true, session: 'f'.repeat(64), expiresAt: '2030-01-01T00:00:00Z', patientId: 'leak', email: 'leak' };
  const { ctx, routerCalls } = runtime({ router: () => reply });
  const request = { action: 'patient-match', firstName: ' Robin ', lastName: 'Sample', dob: '1984-06-02', sex: 'female', phone: '+12125550142', email: 'Robin@Example.test', extra: 'dropped' };
  assert.deepEqual({ ...ctx.bookingBridge271(request) }, { success: true, matched: true, session: 'f'.repeat(64), expiresAt: '2030-01-01T00:00:00Z' });
  assert.deepEqual({ ...routerCalls[0].body }, { firstName: 'Robin', lastName: 'Sample', dob: '1984-06-02', phone: '+12125550142', email: 'robin@example.test' });
  reply = { success: true, matched: false, patientId: 'leak' };
  assert.deepEqual({ ...ctx.bookingBridge271(request) }, { success: true, matched: false });
  reply = { success: true, matched: true, session: 'not-a-session', expiresAt: 'x' };
  assert.equal(ctx.bookingBridge271(request).success, false);
  reply = { success: false, error: 'We couldn’t check your details right now. Please try again later.' };
  assert.match(ctx.bookingBridge271(request).error, /try again later/);
  ctx.fdg160WebsiteVerificationEnabled_ = () => false;
  assert.equal(ctx.bookingBridge271(request).success, false);
});

test('health reports the new version and patient-match support for the booking page', () => {
  const { ctx } = runtime();
  const health = ctx.doGet({ parameter: { action: 'health' } });
  assert.equal(health.version, 'v0.27.0');
  assert.equal(health.websitePatientMatch, true);
});
