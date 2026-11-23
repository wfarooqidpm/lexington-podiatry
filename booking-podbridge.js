// The practice's booking API owns the session, selected slot and private PodBridge access.
// A dedicated same-site host leaves the public GitHub Pages domain in place.
function startPodBridgeBooking() {
  const el = id => document.getElementById(id);
  const storageKey = 'lexington.podbridge.booking';
  const api = location.origin === 'https://lexingtonpodiatry.nyc'
    ? 'https://booking-api.lexingtonpodiatry.nyc/api/booking/'
    : '/api/booking/';
  const idPattern = /^WEB-[a-f0-9]{32}$/;
  const fields = {firstName:'npFirst', lastName:'npLast', dob:'npDob', phone:'npPhone', email:'npEmail'};
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/New_York', weekday:'long', month:'short', day:'numeric',
  });
  const timeLabel = new Intl.DateTimeFormat('en-US', {
    timeZone:'America/New_York', hour:'numeric', minute:'2-digit',
  });
  const reviewMessage = 'Please call the office at (212) 510-8665 so we can help with your booking.';
  const params = new URLSearchParams(location.search);
  let preferredSlot = Date.parse(params.get('slot'));
  let stage = 'time';
  let busy = false;
  let generation = 0;
  let bookingId;

  async function request(path, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const options = {credentials:'include', redirect:'error', cache:'no-store', signal:controller.signal};
    if (body) Object.assign(options, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
    });
    try {
      const response = await fetch(api + path, options);
      if (!response.ok) throw new Error('Scheduling is unavailable');
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function render() {
    const progressing = ['time', 'details', 'confirm'].includes(stage);
    el('bookingPath').hidden = !progressing;
    el('bookingInputs').disabled = busy;
    el('panel3').hidden = stage !== 'time';
    el('identitySection').hidden = stage !== 'details';
    el('panel2New').hidden = stage !== 'details';
    el('bookingFollowUpReason').hidden = stage !== 'confirm';
    el('bookingFinish').hidden = stage !== 'details' && stage !== 'confirm';
    el('bookingContinue').hidden = stage !== 'details';
    el('bookingContinue').disabled = busy;
    el('btnSubmit').hidden = stage !== 'confirm';
    el('btnSubmit').disabled = busy || stage !== 'confirm';
    el('bookingSelection').textContent = state.selectedSlot?.label || '';
    el('pathFirstText').textContent = state.selectedSlot?.label || 'Choose a time';
    for (const [id, step, target] of [
      ['pathFirst','time','panel3'], ['pathSecond','details','identitySection'],
      ['pathConfirm','confirm','bookingFollowUpReason'],
    ]) {
      const button = el(id);
      button.disabled = busy || (step === 'details' && !state.selectedSlot) ||
        (step === 'confirm' && stage !== 'confirm');
      button.classList.toggle('current', stage === step);
      button.setAttribute('aria-current', stage === step ? 'step' : 'false');
      button.setAttribute('aria-controls', target);
    }
  }

  function show(next, message = '') {
    stage = next;
    el('bookingMessage').textContent = message;
    render();
  }

  // Calendar labels come from timestamps, never HTML supplied by the API.
  async function loadTimes() {
    const requestGeneration = ++generation;
    const container = el('slotContainer');
    calViewYear = null;
    calViewMonth = null;
    container.textContent = 'Finding available appointments…';
    try {
      const data = await request('slots?' + new URLSearchParams({visitMode:state.visitMode}));
      if (requestGeneration !== generation) return;
      if (data.status !== 'ok' || !Array.isArray(data.slots)) throw new Error('Missing schedule');
      const times = [...new Set(data.slots.map(slot => Date.parse(slot.start)))]
        .filter(start => start > Date.now())
        .sort((a, b) => a - b);
      const slots = times.map(start => ({
        iso:new Date(start).toISOString(), dateLabel:dateLabel.format(start), timeLabel:timeLabel.format(start),
      }));
      const preferred = slots.find(slot => Date.parse(slot.iso) === preferredSlot);
      preferredSlot = NaN;
      renderSlots(slots, 'slotContainer');
      if (preferred) chooseTime(preferred.iso, preferred.dateLabel + ' at ' + preferred.timeLabel);
    } catch {
      if (requestGeneration === generation) container.textContent =
        'Unable to load times. Please call the office at (212) 510-8665.';
    }
  }

  function chooseMode(button) {
    const mode = button.getAttribute('data-mode');
    if (busy || stage !== 'time' || !['In Person','Virtual'].includes(mode) || state.visitMode === mode) return;
    state.visitMode = mode;
    state.selectedSlot = null;
    for (const option of el('bookingSlotModes').querySelectorAll('button')) {
      const selected = option.getAttribute('data-mode') === mode;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    }
    show('time');
    loadTimes();
  }

  function chooseTime(start, label) {
    if (busy || stage !== 'time' || !allSlots.some(slot => slot.iso === start)) return;
    for (const button of el('slotContainer').querySelectorAll('.slot-btn')) {
      const selected = button.dataset.iso === start;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }
    state.selectedSlot = {iso:start, label};
    bookingId = null;
    el('bookingReason').value = '';
    show('details');
    el('npFirst').focus();
  }

  function openIntake(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return false;
    location.assign('/frontdoor.html?t=' + encodeURIComponent(token));
    return true;
  }

  async function match() {
    if (busy || stage !== 'details' || !state.selectedSlot) return;
    const details = {};
    for (const [field, id] of Object.entries(fields)) {
      const input = el(id);
      if (!input.value.trim() || !input.reportValidity()) { input.focus(); return; }
      details[field] = input.value.trim();
    }
    details.phone = bookingPhoneNumber_();
    busy = true;
    show('details', 'Checking your details…');
    try {
      bookingId ||= newWebsiteBookingId();
      // A new-patient match can issue an intake token. Retain this ID before the
      // POST so a lost handoff response can be retrieved without a new request.
      sessionStorage.setItem(storageKey, bookingId);
      const result = await request('match', {
        bookingId, start:state.selectedSlot.iso, visitMode:state.visitMode, details,
      });
      if (result.status === 'returning') {
        sessionStorage.removeItem(storageKey);
        el('bookingFollowUpTime').textContent = state.selectedSlot.label + ' Eastern · ' +
          (state.visitMode === 'Virtual' ? 'Video visit' : 'In person');
        show('confirm');
      } else if (result.status === 'new' && openIntake(result.intakeToken)) {
        show('handoff', 'Opening your registration…');
      } else if (result.status === 'invalid_details') {
        sessionStorage.removeItem(storageKey);
        show('details', 'Please check your name, date of birth, phone number and email address.');
      } else if (result.status === 'slot_unavailable') {
        chooseAnotherTime();
      } else {
        show('review', reviewMessage);
      }
    } catch {
      if (bookingId) await recover(bookingId);
      else show('review', reviewMessage);
    } finally {
      busy = false;
      render();
      if (stage === 'confirm') el('bookingReason').focus();
    }
  }

  function chooseAnotherTime() {
    sessionStorage.removeItem(storageKey);
    state.selectedSlot = null;
    bookingId = null;
    show('time', 'That time is no longer available. Please choose another.');
    loadTimes();
  }

  function finish(result) {
    if (result.status === 'new' && openIntake(result.intakeToken)) {
      show('handoff', 'Opening your registration…');
      return true;
    }
    if (result.status === 'slot_unavailable') {
      chooseAnotherTime();
      return true;
    }
    const card = result.appointment;
    const start = Date.parse(card?.start);
    if (result.status !== 'confirmed' || !Number.isFinite(start) ||
        !['In Person','Virtual'].includes(card?.visitMode)) return false;
    for (const id of Object.values(fields)) el(id).value = '';
    el('bookingReason').value = '';
    el('confirmedSlot').textContent = dateLabel.format(start) + ' at ' + timeLabel.format(start) + ' Eastern';
    el('confirmedVisitMode').textContent = card.visitMode === 'Virtual' ? 'Video visit' : 'In person';
    el('confirmedVisitMode').hidden = false;
    const carrier = typeof card.insuranceCarrier === 'string' ? card.insuranceCarrier.trim() : '';
    el('confirmedInsurance').textContent = carrier ? 'Insurance on file · ' + carrier : '';
    el('confirmedInsurance').hidden = !carrier;
    el('panel5').hidden = false;
    show('complete');
    return true;
  }

  async function recover(id) {
    show('pending', 'Checking your original request…');
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      try {
        const result = await request('status', {bookingId:id});
        if (finish(result)) return;
        if (result.status === 'review_required') break;
      } catch {
        // Only status reads are retried after an uncertain outcome.
      }
    }
    show('review', reviewMessage);
  }

  async function submit() {
    if (busy || stage !== 'confirm' || !idPattern.test(bookingId)) return;
    busy = true;
    show('confirm', 'Booking your appointment…');
    try {
      sessionStorage.setItem(storageKey, bookingId);
      const result = await request('submit', {bookingId, reason:el('bookingReason').value.trim()});
      if (!finish(result)) await recover(bookingId);
    } catch {
      await recover(bookingId);
    } finally {
      busy = false;
      render();
    }
  }

  el('bookingFollowUpLink').remove();
  el('pathType').remove();
  el('pathMode').remove();
  el('bookingRegistrationNote').hidden = true;
  el('bookingSlotModes').hidden = false;
  el('bookingContinue').onclick = match;
  el('btnSubmit').onclick = submit;
  el('pathFirst').onclick = () => show('time');
  el('pathSecond').onclick = () => {
    if (stage === 'confirm') {
      bookingId = null;
      el('bookingReason').value = '';
    }
    show('details');
  };
  el('pathConfirm').onclick = () => el('bookingReason').focus();
  for (const button of el('bookingSlotModes').querySelectorAll('button')) button.onclick = () => chooseMode(button);
  for (const id of Object.values(fields)) {
    el(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); match(); }
    });
  }
  selectSlot = button => chooseTime(button.dataset.iso, button.dataset.label);
  renderBookingCards = render;
  initialiseInternationalPhone_();
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return idPattern.test(existing) ? recover(existing) : show('review', reviewMessage);
  } catch {
    return show('review', reviewMessage);
  }
  const mode = params.get('mode') === 'video' ? 'Virtual' : 'In Person';
  chooseMode(el('bookingSlotModes').querySelector('[data-mode="' + mode + '"]'));
}
