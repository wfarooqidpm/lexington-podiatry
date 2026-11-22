(() => {
  // Google owns the public in-office schedule. Explicit visit links and private
  // email continuations retain their existing inventory and booking behavior.
  const params = new URLSearchParams(location.search);
  const hasVisitPreference = ['new', 'returning'].includes(params.get('visit')) ||
    ['in-person', 'video'].includes(params.get('mode'));
  if (hasVisitPreference || window.lexBookingVerificationFragment || location.hash.startsWith('#verify=')) return;

  const template = document.getElementById('googleBookingTemplate');
  const booker = document.querySelector('.booking-main');
  if (!template || !booker) return;
  booker.before(template.content.cloneNode(true));
  booker.hidden = true;
  window.lexGoogleBookingActive = true;
})();
