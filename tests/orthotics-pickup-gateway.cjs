const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const gateway = path.join(__dirname, '../releases/2026-11-17-orthotics-pickup/FrontDoor_Gateway.gs');
const session = 'a'.repeat(64);
const sourceBookingId = 'WEB-DME-' + 'b'.repeat(32);
const patient = {
  bookingPurpose: 'ORTHOTICS_PICKUP', websiteBookingId: sourceBookingId,
  patientId: '123456789012345678', recordId: 'TEST-01',
  firstName: 'Test', lastName: 'Patient', dob: '1980-01-01', phone: '2025550142', email: 'patient@example.test'
};
const headers = [
  'Front Door ID', 'Booking Source', 'Source Booking ID', 'Source Calendar ID',
  'Source Calendar Event ID', 'Appointment Start', 'Appointment End', 'Patient Type',
  'First Name', 'Last Name', 'Phone', 'Email', 'Front Door Status', 'Patient Token',
  'Charm Patient ID', 'Charm Record ID', 'Visit Reason', 'Raw Source JSON'
];

function gatewayRuntime() {
  const rows = [headers];
  const events = [];
  const ctx = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => '' }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({
      getLastRow: () => rows.length,
      getLastColumn: () => headers.length,
      getRange: (row, col, count, width) => ({
        getValues: () => rows.slice(row - 1, row - 1 + count).map(r => r.slice(col - 1, col - 1 + width))
      }),
      appendRow: row => rows.push(row)
    }) }) },
    Utilities: { getUuid: () => 'synthetic-event-id', formatDate: () => '2030-01-01' }
  });
  vm.runInContext(readFileSync(gateway, 'utf8'), ctx, { filename: gateway });
  Object.assign(ctx, {
    fdg080Json_: obj => obj,
    fdg160WebsiteVerificationEnabled_: () => true,
    fdg160PrivateRouterCall_: (_action, body) => body.session === session
      ? { success: true, valid: true, ...patient }
      : { success: true, valid: false },
    fdg111SchedulingPolicy_: () => ({
      returningDurationMinutes: 30, newDurationMinutes: 45, returningDaysAhead: 2, newDaysAhead: 2,
      hours: Array(7).fill({ enabled: true, open: '09:00', close: '12:00', mode: 'IN_PERSON' }),
      closures: [], banners: [], minNoticeHours: 0
    }),
    fdg083WebsiteCalendar_: () => ({
      getEventsForDay: () => [], getEvents: () => [],
      createEvent(_title, start, end) {
        events.push({ start, end });
        return { getId: () => 'test-event' };
      }
    }),
    fdg082NewPatientToken_: () => 'd'.repeat(64),
    fdg080FindSourceByToken_: () => ({ 'Patient Type': 'RETURNING' }),
    fdg163RequireWebsiteBookingRateLimit_: () => {}
  });
  return { ctx, events, rows };
}

test('the verified link lists 15-minute slots and creates one matching hold on explicit submit', () => {
  const { ctx, events, rows } = gatewayRuntime();
  const result = ctx.doGet({ parameter: { action: 'slots', type: 'returning', mode: 'In Person', session } });
  assert.equal(result.success, true);
  assert.ok(result.slots.length > 0);
  assert.ok(result.slots.every(slot => slot.durationMinutes === 15 && slot.visitMode === 'IN_PERSON'));
  assert.equal(events.length, 0);

  const booking = {
    patientType: 'returning', visitMode: 'In Person', verificationSession: session,
    slotIso: result.slots[0].iso, reason: 'Browser-provided reason', email: 'other@example.test'
  };
  const first = ctx.fdg082CreateWebsiteBooking_({ websiteBookingId: 'WEB-client-supplied', booking });
  assert.equal(first.bookingConfirmed, true);
  assert.equal(first.created, true);
  assert.equal(events.length, 1);
  assert.equal((events[0].end - events[0].start) / 60000, 15);
  const held = Object.fromEntries(headers.map((name, index) => [name, rows[1][index]]));
  assert.equal(held['Source Booking ID'], sourceBookingId);
  assert.equal(held['Visit Reason'], 'Orthotics pickup');
  assert.equal(held['Charm Patient ID'], patient.patientId);
  assert.equal(held.Email, patient.email);

  const repeat = ctx.fdg082CreateWebsiteBooking_({ websiteBookingId: 'WEB-another-browser', booking });
  assert.equal(repeat.idempotent, true);
  assert.equal(events.length, 1);
  assert.equal(rows.length, 2);
});

test('the gateway rejects virtual and forged pickup bookings and keeps ordinary duration', () => {
  const { ctx, events } = gatewayRuntime();
  assert.equal(ctx.fdgPickupPolicy_(null, 'IN_PERSON').returningDurationMinutes, 30);
  const slots = ctx.doGet({ parameter: { action: 'slots', type: 'returning', mode: 'Virtual', session } });
  assert.equal(slots.success, false);
  assert.match(slots.error, /in person/i);
  assert.throws(() => ctx.fdg273CreateWebsiteBookingInternal_({
    websiteBookingId: sourceBookingId,
    booking: { patientType: 'new', visitMode: 'In Person', bookingPurpose: 'ORTHOTICS_PICKUP' }
  }), /original orthotics pickup invitation/i);
  assert.equal(events.length, 0);
});
