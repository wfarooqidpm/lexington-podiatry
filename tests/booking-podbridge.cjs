const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const read = name => readFileSync(join(__dirname, '..', name), 'utf8');
const html = read('booking.html');
const controller = read('booking-podbridge.js');
const legacy = read('booking-single-page.js');
const start = new Date(Date.now() + 86400000).toISOString();
const token = 'b'.repeat(64);
const verified = {status:'confirmed', appointment:{start, visitMode:'In Person', insuranceCarrier:'Example Health'}};
const turn = () => new Promise(setImmediate);

function harness(route, {query = '', storage = new Map()} = {}) {
  const elements = new Map();
  const calls = [];
  const navigations = [];
  function element(mode) {
    return {value:'', hidden:true, textContent:'', classList:{toggle(){}}, dataset:{}, remove(){this.removed=true;},
      reportValidity(){return true;}, addEventListener(){}, focus(){}, setAttribute(k,v){this[k]=v;},
      getAttribute(){return mode;}, querySelectorAll(){return [];}};
  }
  for (const result of html.matchAll(/\bid="([\w-]+)"/g)) elements.set(result[1], element());
  const el = id => {
    assert.ok(elements.has(id), 'Missing booking element ' + id);
    return elements.get(id);
  };
  const modes = [element('In Person'), element('Virtual')];
  el('bookingSlotModes').querySelector = selector => selector.includes('Virtual') ? modes[1] : modes[0];
  el('bookingSlotModes').querySelectorAll = () => modes;
  const c = vm.createContext({
    Date, Intl, URLSearchParams, AbortController,
    location:{hash:'', search:query, assign:url => navigations.push(url)}, window:{},
    document:{getElementById:el},
    crypto:{getRandomValues:crypto.getRandomValues.bind(crypto)},
    clearTimeout(){}, setTimeout(callback, ms){if (ms !== 30_000) queueMicrotask(callback);},
    sessionStorage:{getItem:key => storage.get(key) ?? null, setItem:(key, value) => storage.set(key, value),
      removeItem:key => storage.delete(key)},
    async fetch(path, options) {
      assert.equal(options.credentials, 'same-origin');
      assert.equal(options.redirect, 'error');
      const body = options.body && JSON.parse(options.body);
      calls.push({path, body});
      const result = path.startsWith('/api/booking/slots?') ? {status:'ok', slots:[{start}]} : await route(path, body);
      return {ok:true, json:async () => result};
    },
    state:{}, allSlots:[], calViewYear:null, calViewMonth:null, selectSlot:null, renderBookingCards:null,
    renderSlots(slots){c.allSlots = slots;}, initialiseInternationalPhone_(){},
    bookingPhoneNumber_:() => el('npPhone').value,
    newWebsiteBookingId:() => 'WEB-' + Buffer.from(c.crypto.getRandomValues(new Uint8Array(16))).toString('hex'),
  });
  vm.runInContext(controller, c);
  vm.runInContext(legacy, c);
  async function enterDetails() {
    await turn();
    c.selectSlot({dataset:{iso:start, label:'Tomorrow at 11:00 AM'}});
    assert.equal(el('pathSecond')['aria-current'], 'step');
    for (const [id, value] of Object.entries({npFirst:'Taylor', npLast:'Example', npDob:'1990-01-01',
      npPhone:'2125550100', npEmail:'taylor@example.test'})) el(id).value = value;
    await el('bookingContinue').onclick();
  }
  return {el, c, calls, storage, navigations, enterDetails};
}

test('plain and legacy links start with time and do not classify from the URL', async () => {
  for (const query of ['', '?visit=new', '?visit=returning&mode=video']) {
    const page = harness(async () => ({status:'returning'}), {query});
    assert.equal(page.el('pathFirst')['aria-current'], 'step');
    assert.equal(page.el('bookingFollowUpLink').removed, true);
    assert.equal(page.el('pathType').removed, true);
    await page.enterDetails();
    assert.equal(page.el('pathConfirm')['aria-current'], 'step');
    const [slots, match] = page.calls;
    assert.equal(new URL(slots.path, 'https://example.test').searchParams.get('visitMode'), query.includes('video') ? 'Virtual' : 'In Person');
    assert.equal(match.path, '/api/booking/match');
    assert.deepEqual(Object.keys(match.body).sort(), ['bookingId','details','start','visitMode']);
    assert.deepEqual(Object.keys(match.body.details).sort(), ['dob','email','firstName','lastName','phone']);
  }
});

test('returning patients submit only a reason and see the verified card in the same page', async () => {
  const page = harness(async path => path.endsWith('/match') ? {status:'returning'} : verified);
  await page.enterDetails();
  page.el('bookingReason').value = 'Orthotics adjustment';
  await page.el('btnSubmit').onclick();
  assert.equal(page.el('panel5').hidden, false);
  assert.match(page.el('confirmedInsurance').textContent, /Example Health/);
  const [_, match, submit] = page.calls;
  assert.match(match.body.bookingId, /^WEB-[a-f0-9]{32}$/);
  assert.deepEqual(submit.body, {bookingId:match.body.bookingId, reason:'Orthotics adjustment'});
  assert.deepEqual(page.navigations, []);
});

test('clearly new patients continue to the signed Front Door registration', async () => {
  const page = harness(async () => ({status:'new', intakeToken:token}));
  await page.enterDetails();
  assert.deepEqual(page.navigations, ['/frontdoor.html?t=' + token]);
  assert.equal(page.calls.length, 2);
  assert.equal(page.el('panel5').hidden, true);
});

test('uncertain matches stay in booking and show staff help', async () => {
  const page = harness(async () => ({status:'review_required'}));
  await page.enterDetails();
  assert.match(page.el('bookingMessage').textContent, /call the office/);
  assert.deepEqual(page.navigations, []);
});

test('after a lost booking response a refresh checks status without issuing another write', async () => {
  let release;
  const page = harness(async path => {
    if (path.endsWith('/match')) return {status:'returning'};
    if (path.endsWith('/submit')) return new Promise((_, reject) => { release = reject; });
    return verified;
  });
  await page.enterDetails();
  const submission = page.el('btnSubmit').onclick();
  await turn();
  const originalId = page.calls.at(-1).body.bookingId;
  const refresh = harness(async () => verified, {storage:page.storage});
  await turn();
  assert.deepEqual(refresh.calls, [{path:'/api/booking/status', body:{bookingId:originalId}}]);
  assert.equal(refresh.el('panel5').hidden, false);
  release(new Error('Lost response'));
  await submission;
  assert.equal(page.calls.filter(call => call.path.endsWith('/submit')).length, 1);
});
