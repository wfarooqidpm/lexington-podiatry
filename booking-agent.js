(() => {
  const tools = document.modelContext;
  if (typeof tools?.registerTool !== 'function' || document.getElementById('fd331Approval')) return;

  const registration = new AbortController();
  window.addEventListener('pagehide', event => {
    if (!event.persisted) registration.abort();
  }, { signal: registration.signal });

  const catalogUrl = '/booking-options.json';
  const completeOnWebsite = 'The patient enters their details and confirms on the booking page. Times can change before confirmation.';
  const modes = new Map([
    ['in-person', { request: 'In Person', response: 'IN_PERSON' }],
    ['video', { request: 'Virtual', response: 'VIRTUAL' }],
  ]);

  tools.registerTool({
    name: 'get_booking_options',
    description: 'Find Lexington Podiatry’s clinician, location, foot and ankle services, and direct links for first visits and follow-ups.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_input, { signal } = {}) {
      const response = await fetch(catalogUrl, { signal });
      if (!response.ok) throw new Error('Could not load booking options. Visit the Lexington Podiatry appointment page.');
      return JSON.stringify(await response.json());
    },
    annotations: { readOnlyHint: true },
  }, { signal: registration.signal });

  tools.registerTool({
    name: 'list_new_patient_appointment_times',
    description: 'Find the next available first-visit times at Lexington Podiatry. Returns a link for the patient to complete booking.',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['in-person', 'video'], description: 'Where the patient would like to be seen.' } },
      required: ['mode'],
      additionalProperties: false,
    },
    async execute({ mode } = {}) {
      const visitMode = modes.get(mode);
      if (!visitMode) throw new Error('Choose in-person or video.');
      const bookingUrl = new URL('/booking', location.origin);
      bookingUrl.search = new URLSearchParams({ visit: 'new', mode });
      const result = { bookingUrl: bookingUrl.href, timeZone: 'America/New_York', nextStep: completeOnWebsite };

      let reply;
      try {
        reply = await call271({ action: 'slots', patientType: 'new', visitMode: visitMode.request });
      } catch {
        return JSON.stringify({ ...result, status: 'unavailable' });
      }
      if (!reply?.success || !Array.isArray(reply.slots)) return JSON.stringify({ ...result, status: 'unavailable' });

      const now = Date.now();
      const slots = reply.slots
        .filter(slot => slot?.visitMode === visitMode.response && Date.parse(slot.iso) > now && Number.isInteger(slot.durationMinutes) && slot.durationMinutes > 0)
        .sort((first, second) => Date.parse(first.iso) - Date.parse(second.iso))
        .slice(0, 10)
        .map(slot => ({ start: new Date(slot.iso).toISOString(), durationMinutes: slot.durationMinutes }));
      return JSON.stringify({ ...result, status: 'ok', slots });
    },
    annotations: { readOnlyHint: true },
  }, { signal: registration.signal });
})();
