(() => {
  const panel = document.getElementById('homeBooking');
  const modes = panel.querySelector('.home-booking-modes');
  const status = document.getElementById('homeBookingStatus');
  const times = document.getElementById('homeBookingTimes');
  const allTimes = document.getElementById('homeBookingAll');
  const timeZone = 'America/New_York';
  const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'short' });
  const dateLabel = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const visitModes = {
    'in-person': { request: 'In Person', response: 'IN_PERSON' },
    video: { request: 'Virtual', response: 'VIRTUAL' },
  };
  let mode = 'in-person';
  let request;

  function bookingLink(start) {
    const params = new URLSearchParams({ visit: 'new', mode });
    if (start) params.set('slot', new Date(start).toISOString());
    return '/booking?' + params;
  }

  async function readJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error('Availability lookup failed');
    return response.json();
  }

  async function showTimes(nextMode) {
    mode = nextMode;
    request?.abort();
    const current = new AbortController();
    request = current;
    const timeout = setTimeout(() => current.abort(), 15000);
    const visit = visitModes[mode];
    for (const button of modes.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    }
    allTimes.href = bookingLink();
    status.textContent = 'Checking available times…';
    times.replaceChildren();
    times.hidden = true;

    try {
      const { signal } = current;
      const spec = await readJson('/booking-api.json', { signal });
      const operation = spec.paths['/exec'];
      const url = new URL(operation.servers[0].url + '/exec');
      url.search = new URLSearchParams({ action: 'slots', patientType: 'new', visitMode: visit.request });
      const result = await readJson(url, { signal, cache: 'no-store', credentials: 'omit' });
      if (request !== current) return;
      if (!result.success || !Array.isArray(result.slots)) throw new Error('Availability lookup failed');

      const now = Date.now();
      const starts = [...new Set(result.slots
        .filter(slot => slot?.visitMode === visit.response)
        .map(slot => Date.parse(slot.iso))
        .filter(start => start > now))].sort((a, b) => a - b);
      if (!starts.length) {
        status.textContent = 'No online times are available right now.';
        return;
      }

      const first = starts[0];
      const firstDay = dayFormat.format(first);
      const today = firstDay === dayFormat.format(now);
      status.textContent = today ? 'Available today · Eastern time' : 'No times today. Next available ' + dateLabel.format(first) + ' · Eastern time';
      for (const start of starts.filter(value => dayFormat.format(value) === firstDay).slice(0, 4)) {
        const link = document.createElement('a');
        link.href = bookingLink(start);
        link.textContent = timeLabel.format(start);
        link.setAttribute('aria-label', dateLabel.format(start) + ' at ' + link.textContent + ' Eastern time');
        times.append(link);
      }
      times.hidden = false;
    } catch {
      if (request === current) status.textContent = 'Live times are temporarily unavailable.';
    } finally {
      clearTimeout(timeout);
    }
  }

  for (const button of modes.querySelectorAll('button')) {
    button.addEventListener('click', () => showTimes(button.dataset.mode));
  }
  window.addEventListener('pageshow', event => {
    if (event.persisted) showTimes(mode);
  });
  modes.hidden = false;
  status.hidden = false;
  showTimes(mode);
})();
