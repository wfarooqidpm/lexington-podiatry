/**
 * 
 * FrontDoorGateway.gs — Lexington Podiatry Front Door Gateway
 * v0.16.3
 *
 * DEPLOY THIS IN A SEPARATE, STANDALONE APPS SCRIPT PROJECT.
 *
 * Public, tightly-scoped bridge between frontdoor.html and the private
 * Lexington Practice OS v2 spreadsheet.
 *
 * SECURITY / ARCHITECTURE
 * - NO Charm credentials.
 * - NO Stedi credentials.
 * - NO Helcim credentials.
 * - Reads exactly one Front Door record by its opaque 64-char patient token.
 * - Returns only whitelisted patient-facing fields.
 * - Patient-entered data is stored separately in "Front Door Intake".
 * - Source booking evidence is not overwritten by patient corrections.
 * - Optional card/ID uploads are stored in a private Drive folder.
 * - NEVER creates a Charm appointment directly.
 * - NEVER archives a calendar event.
 */

var FDG080 = Object.freeze({
  VERSION: 'v0.26.9',
  TIMEZONE: 'America/New_York',

  SHEET_ID: '1q5BgkZVnHCCzotpLMnPeEabAe2BDZ13FlJfDx1DlgxM',

  SOURCE_TAB: 'Front Door',
  INTAKE_TAB: 'Front Door Intake',
  ELIGIBILITY_TAB: 'Front Door Eligibility',

  ELIGIBILITY_HEADERS: [
    'Request Key',
    'Patient Token',
    'Front Door ID',
    'Created At',
    'Updated At',
    'Request Hash',
    'Payer Input',
    'Member ID Last4',
    'Status',
    'Coverage Status',
    'Plan Name',
    'Group Number',
    'Plan Number',
    'Payer Display',
    'Needs Subscriber Details',
    'Message',
    'Checked At',
    'Stedi Trace ID'
  ],

  DISCOVERY_TAB: 'Front Door Discovery',

  DISCOVERY_HEADERS: [
    'Request Key',
    'Patient Token',
    'Front Door ID',
    'Created At',
    'Updated At',
    'Request Hash',
    'Status',
    'Discovery ID',
    'Coverages Found',
    'Payer Name',
    'Payer ID',
    'Member ID',
    'Member ID Last4',
    'Plan Name',
    'Group Number',
    'Plan Number',
    'Confidence',
    'Message',
    'Checked At',
    'Stedi Trace ID',
    'Match Summary JSON'
  ],

  ESTIMATE_TAB: 'Front Door Estimate',

  ESTIMATE_HEADERS: [
    'Patient Token',
    'Front Door ID',
    'Created At',
    'Updated At',
    'Status',
    'Amount',
    'Currency',
    'Confidence',
    'Basis',
    'Service Type Code',
    'Copay',
    'Coinsurance Percent',
    'Deductible Explicit',
    'Message',
    'Checked At',
    'Stedi Trace ID'
  ],

  UPLOAD_FOLDER_NAME: 'Lexington Front Door Uploads',
  UPLOAD_FOLDER_PROPERTY: 'FD_UPLOAD_FOLDER_ID_V080',

  MAX_JSON_CHARS: 120000,
  MAX_FILE_BYTES: 4 * 1024 * 1024,
  MAX_UPLOADS_PER_SUBMISSION: 3,
  PAST_APPOINTMENT_GRACE_DAYS: 7,
  MIN_WEBSITE_FORM_AGE_MS: 1500,
  MAX_WEBSITE_FORM_AGE_MS: 4 * 60 * 60 * 1000,
  MAX_WEBSITE_BOOKINGS_PER_HOUR: 8,
  MAX_WEBSITE_BOOKINGS_PER_IDENTITY_HOUR: 2,
  WEBSITE_FORM_AGE_REQUIRED_FLAG: 'WEBSITE_BOOKING_FORM_AGE_REQUIRED',

  // Public booking policy is now owned by the OS2 Scheduling tabs.
  // This gateway is only the public adapter; it contains no Charm/Stedi/Helcim credentials.
  SCHED_SETTINGS_TAB: 'Scheduling Settings',
  SCHED_HOURS_TAB: 'Scheduling Hours',
  SCHED_CLOSURES_TAB: 'Scheduling Closures',
  CASH_PRICES_TAB: 'Cash Prices',
  WEBSITE_CALENDAR_ID: 'primary',

  // v0.16.0 returning-patient verification. Both remain disabled until the
  // private OS2 preview is approved and the shared bridge secret is installed.
  WEBSITE_VERIFY_FLAG: 'WEBSITE_FOLLOWUP_VERIFICATION_ENABLED',
  PRIVATE_ROUTER_URL_PROPERTY: 'FRONT_DOOR_PRIVATE_ROUTER_URL',
  PRIVATE_ROUTER_SECRET_PROPERTY: 'FRONT_DOOR_ROUTER_BRIDGE_SECRET',

  AGREEMENT_FOLDER_NAME: 'Lexington Front Door Signed Agreements',
  AGREEMENT_FOLDER_PROPERTY: 'FD_AGREEMENT_FOLDER_ID_V083',

  INTAKE_HEADERS: [
    'Patient Token',
    'Front Door ID',
    'Created At',
    'Updated At',
    'Completed At',
    'Current Step',
    'Confirmation Status',
    'Insurance Card Status',
    'Photo ID Status',
    'Secondary Insurance Status',
    'Signature Name',
    'Policies Accepted',
    'Data JSON',
    'Upload IDs JSON',
    'Client Version',
    'Last Error',
    'Agreement Version',
    'Agreement Accepted At',
    'Agreement PDF File ID',
    'Agreement SHA-256'
  ]
});



/* ============================================================
 * CANONICAL PATIENT AGREEMENT — v0.8.3
 * ============================================================ */

var FDG083_AGREEMENT = Object.freeze({
  VERSION: '2026-08-22.v4',
  TITLE: 'Patient Registration, Treatment Consent & Financial Agreement',
  SECTIONS: [
    {
      title: '1. Appointment confirmation and no-show policy',
      paragraphs: [
        'Completing Front Door prepares my registration and permits Lexington Podiatry to place the appointment in its clinical schedule, but Front Door completion does not itself constitute my final attendance confirmation. Lexington Podiatry generally requests confirmation on the evening before the visit. An appointment that remains unconfirmed may be released so the time can be offered to another patient.',
        'After I separately confirm the appointment, a missed appointment without notice carries a $50 no-show fee. I understand that I may reschedule when I receive the evening-before reminder if needed.'
      ]
    },
    {
      title: '2. Consent to podiatric evaluation and treatment',
      paragraphs: [
        'I consent to podiatric evaluation and treatment by Dr. Wiqar Farooqi and by authorized clinical staff acting under his direction at WAF Podiatry P.C. (Lexington Podiatry). This may include history taking, examination, routine diagnostic services, treatment planning, prescriptions, office-based care, and other clinically appropriate services.',
        'I understand that I may ask questions and may decline a specific treatment. Procedures or services that require a separate consent will be discussed with me and documented separately when appropriate.'
      ]
    },
    {
      title: '3. Telemedicine consent',
      paragraphs: [
        'If I select telemedicine authorization, I voluntarily consent to evaluation, treatment, follow-up, care coordination, and communication through secure video, audio, messaging, and other electronic technology when clinically appropriate. I understand that telemedicine has limitations compared with an in-person examination; technical, privacy, or communication problems may occur despite reasonable safeguards; and Dr. Wiqar Farooqi may stop a virtual visit or recommend in-person or emergency evaluation when clinically appropriate.',
        'I understand that I may decline or withdraw telemedicine authorization for future services without losing access to in-person care. If I decline telemedicine authorization, Lexington Podiatry cannot schedule or provide a virtual/video appointment unless I later provide the required consent.'
      ]
    },
    {
      title: '4. Medication history and prescription information',
      paragraphs: [
        'I authorize Dr. Wiqar Farooqi, WAF Podiatry P.C., and authorized staff to obtain my medication history and prescription benefit information from pharmacies, pharmacy benefit managers, electronic prescribing networks, health information exchanges, and other permitted sources for medication reconciliation, treatment, prescribing, and patient safety.',
        'This authorization is optional and may be declined by unchecking the medication-history authorization before I sign. I may provide or correct my medication list at any time.'
      ]
    },
    {
      title: '5. Billing authorization and assignment of benefits',
      paragraphs: [
        'If I choose to use health insurance for this visit, I authorize WAF Podiatry P.C. to bill my health plan or other responsible payer for services rendered and to submit claims, supporting records, authorizations, appeals, and other information reasonably necessary for payment and benefits administration.',
        'If I choose to use insurance, then to the extent permitted by my health plan and applicable law, I assign to WAF Podiatry P.C. the insurance benefits payable for services rendered to me and authorize direct payment of those benefits to WAF Podiatry P.C. If I choose self-pay, this insurance-billing authorization does not apply to that visit.'
      ]
    },
    {
      title: '6. Financial responsibility',
      paragraphs: [
        'If I use insurance, verification, benefit information, and cost estimates are not guarantees of payment. I am responsible for applicable copays, deductibles, coinsurance, non-covered services, and other patient amounts assigned under my plan. If I choose self-pay, I am responsible for the cash price shown for the scheduled visit and for any additional services I agree to receive.',
        'When Lexington Podiatry provides an estimate, it applies to the scheduled evaluation unless stated otherwise. The final amount may change if additional services, procedures, imaging, supplies, or treatments are provided.'
      ]
    },
    {
      title: '7. Privacy acknowledgment',
      paragraphs: [
        'I acknowledge the privacy information presented through Front Door and understand that WAF Podiatry P.C. may use and disclose health information for treatment, payment, healthcare operations, and other uses permitted or required by law. The practice\'s formal Notice of Privacy Practices is a separate document.'
      ]
    },
    {
      title: '8. Electronic signature and electronic records',
      paragraphs: [
        'By typing my name and submitting Front Door, I intend to sign this agreement electronically. I agree that my electronic signature, the date and time of acceptance, the agreement version, and the selections recorded in Front Door may be maintained as part of my medical and business record and have the same effect as my handwritten signature to the extent permitted by law.',
        'I understand that I may request a copy of the signed agreement from WAF Podiatry P.C.'
      ]
    }
  ]
});


/**
 * Run ONCE after replacing v0.8.2 with v0.8.3.
 * Safe migration: appends only the four v0.8.3 agreement columns, creates the
 * private agreement folder, and performs a disposable Google-Docs-to-PDF
 * conversion to authorize the new document scope before a real patient signs.
 */
function upgradeFrontDoorGateway_v083_() {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var sh = ss.getSheetByName(FDG080.INTAKE_TAB);
  if (!sh) throw new Error('Front Door Intake tab is missing.');

  var oldHeaders = [
    'Patient Token','Front Door ID','Created At','Updated At','Completed At',
    'Current Step','Confirmation Status','Insurance Card Status','Photo ID Status',
    'Secondary Insurance Status','Signature Name','Policies Accepted','Data JSON',
    'Upload IDs JSON','Client Version','Last Error'
  ];

  var current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function(x) { return String(x || '').trim(); });

  for (var i = 0; i < oldHeaders.length; i++) {
    if (current[i] !== oldHeaders[i]) {
      throw new Error('Front Door Intake schema differs before v0.8.3. Nothing was changed.');
    }
  }

  var additions = [
    'Agreement Version',
    'Agreement Accepted At',
    'Agreement PDF File ID',
    'Agreement SHA-256'
  ];

  additions.forEach(function(h) {
    if (current.indexOf(h) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      current.push(h);
    }
  });

  fdg080VerifyIntakeSchema_(sh);
  var folder = fdg083AgreementFolder_();

  // Force one harmless document conversion now so the deployment owner grants
  // the Google Docs/Drive scope before a patient completes the form.
  var doc = DocumentApp.create('Front Door authorization test');
  doc.getBody().appendParagraph('Authorization test - no patient data.');
  doc.saveAndClose();
  var f = DriveApp.getFileById(doc.getId());
  var pdf = f.getAs(MimeType.PDF);
  if (!pdf || pdf.getBytes().length < 1) {
    throw new Error('Agreement PDF conversion authorization test failed.');
  }
  f.setTrashed(true);

  Logger.log('Front Door Gateway v0.8.3 upgrade complete. Agreement folder: %s', folder.getId());
  return {
    ok: true,
    version: FDG080.VERSION,
    agreementVersion: FDG083_AGREEMENT.VERSION,
    agreementFolderId: folder.getId()
  };
}



/**
 * ONE-TIME SETUP IN THE NEW GATEWAY PROJECT.
 *
 * Creates:
 * - Front Door Intake tab
 * - private Drive folder for Front Door uploads
 *
 * Does NOT alter the existing Front Door schema.
 */
function setupFrontDoorGateway_v080_() {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);

  var source = ss.getSheetByName(FDG080.SOURCE_TAB);
  if (!source) {
    throw new Error('Source tab not found: ' + FDG080.SOURCE_TAB);
  }

  var intake = ss.getSheetByName(FDG080.INTAKE_TAB);

  if (!intake) {
    intake = ss.insertSheet(FDG080.INTAKE_TAB);
    intake
      .getRange(1, 1, 1, FDG080.INTAKE_HEADERS.length)
      .setValues([FDG080.INTAKE_HEADERS]);

    intake.setFrozenRows(1);

    intake
      .getRange(1, 1, 1, FDG080.INTAKE_HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#111111')
      .setFontColor('#ffffff');

    intake.setColumnWidth(
      FDG080.INTAKE_HEADERS.indexOf('Data JSON') + 1,
      420
    );

    intake.setColumnWidth(
      FDG080.INTAKE_HEADERS.indexOf('Upload IDs JSON') + 1,
      300
    );

    intake.setColumnWidth(
      FDG080.INTAKE_HEADERS.indexOf('Last Error') + 1,
      260
    );
  } else {
    fdg080VerifyIntakeSchema_(intake);
  }

  var folder = fdg080UploadFolder_();

  Logger.log(
    'FRONT DOOR GATEWAY READY ' + FDG080.VERSION + '\n' +
    'Source tab: ' + FDG080.SOURCE_TAB + '\n' +
    'Intake tab: ' + FDG080.INTAKE_TAB + '\n' +
    'Upload folder ID: ' + folder.getId() + '\n\n' +
    'No Charm/Stedi/Helcim credentials are used by this project.'
  );

  return {
    ok: true,
    version: FDG080.VERSION,
    intakeTab: FDG080.INTAKE_TAB,
    uploadFolderId: folder.getId()
  };
}



/**
 * v0.9.0 SAFE UPGRADE.
 * Adds the public-safe Front Door Eligibility queue/result tab.
 * NO Stedi credential is stored here.
 */

/**
 * v0.9.6 SAFE UPGRADE.
 * Adds the public-safe Front Door Discovery queue/result tab.
 * NO Stedi credential is stored in this Gateway.
 */

/**
 * v0.10.0 SAFE UPGRADE.
 * Adds a PUBLIC-SAFE initial-visit estimate result tab.
 * Does not alter existing Front Door / eligibility / discovery rows.
 */
function upgradeFrontDoorGateway_v100_() {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var sh = ss.getSheetByName(FDG080.ESTIMATE_TAB);

  if (!sh) {
    sh = ss.insertSheet(FDG080.ESTIMATE_TAB);

    sh.getRange(
      1,
      1,
      1,
      FDG080.ESTIMATE_HEADERS.length
    )
    .setValues([FDG080.ESTIMATE_HEADERS])
    .setFontWeight('bold');

    sh.setFrozenRows(1);
  } else {
    fdg100VerifyEstimateSchema_(sh);
  }

  Logger.log(
    'Front Door Gateway v0.10.0 initial-visit estimate tab ready.'
  );

  return {
    ok: true,
    version: FDG080.VERSION,
    estimateTab: FDG080.ESTIMATE_TAB
  };
}


function upgradeFrontDoorGateway_v096_() {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var sh = ss.getSheetByName(FDG080.DISCOVERY_TAB);

  if (!sh) {
    sh = ss.insertSheet(FDG080.DISCOVERY_TAB);

    sh.getRange(
      1,
      1,
      1,
      FDG080.DISCOVERY_HEADERS.length
    )
    .setValues([FDG080.DISCOVERY_HEADERS])
    .setFontWeight('bold');

    sh.setFrozenRows(1);
  } else {
    fdg096VerifyDiscoverySchema_(sh);
  }

  Logger.log('Front Door Gateway v0.10.0 discovery queue ready.');

  return {
    ok: true,
    version: FDG080.VERSION,
    discoveryTab: FDG080.DISCOVERY_TAB
  };
}


function upgradeFrontDoorGateway_v090_() {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var sh = ss.getSheetByName(FDG080.ELIGIBILITY_TAB);

  if (!sh) {
    sh = ss.insertSheet(FDG080.ELIGIBILITY_TAB);

    sh.getRange(
      1,
      1,
      1,
      FDG080.ELIGIBILITY_HEADERS.length
    )
    .setValues([FDG080.ELIGIBILITY_HEADERS])
    .setFontWeight('bold');

    sh.setFrozenRows(1);
  } else {
    fdg090VerifyEligibilitySchema_(sh);
  }

  Logger.log('Front Door Gateway v0.9.0 eligibility queue ready.');

  return {
    ok: true,
    version: FDG080.VERSION,
    eligibilityTab: FDG080.ELIGIBILITY_TAB
  };
}


/**
 * Public GET endpoint.
 *
 * Health:
 *   ?action=health
 *
 * Patient load:
 *   ?action=load&t=<opaque-token>
 */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var action = fdg080Clean_(p.action || 'load').toLowerCase();

    if(action==='booking-bridge')return fd271BookingBridgePage_(p);
    if (action === 'health') {
      return fdg080Json_({
        success: true,
        version: FDG080.VERSION,
        service: 'Lexington Front Door Gateway',
        schedulingSource: 'OS2',
        selfPayCashPrice: true,
        websiteFollowUpVerification: fdg160WebsiteVerificationEnabled_()
      });
    }

    // Public booking reads. These are intentionally narrow and contain no
    // private OS2/Charm credentials or patient chart data.
    if (action === 'booking-config') {
      return fdg080Json_(fdg111PublicBookingConfig_());
    }

    if (action === 'slots') {
      if (
        fdg111PatientType_(p.patientType || p.type || '') === 'returning' &&
        fdg160WebsiteVerificationEnabled_()
      ) {
        fdg160RequireFollowUpSession_(p.session || '');
      }
      return fdg080Json_(
        fdg111PublicSlots_(p.patientType || p.type || '', p.visitMode || p.mode || '')
      );
    }

    // Temporary compatibility verifier while returning-patient identification
    // is redesigned against Charm. This reproduces the old Calendar-based
    // behavior so the legacy Booking Backend can be retired safely.
    if (action === 'verify') {
      if (fdg160WebsiteVerificationEnabled_()) {
        return fdg080Json_({
          success: false,
          found: false,
          error: 'Email-code verification is required.'
        });
      }
      return fdg080Json_(
        fdg111VerifyReturningPatient_(
          p.first || '',
          p.last || '',
          p.last4 || ''
        )
      );
    }

    if (action !== 'load' && action !== 'insurance-options' && action !== 'pharmacy-search' && action !== 'eligibility-status' && action !== 'discovery-status') {
      throw new Error('Unsupported action.');
    }

    // v236: snapshots live only for this read-only registration request.
    var readContext = action === 'load'
      ? { startedAt: Date.now(), timings: {}, sheets: {}, ok: false }
      : null;
    var token = fdg080ValidateToken_(p.t || p.token || '');
    var source = fdg080FindSourceByToken_(token, readContext);

    if (action === 'insurance-options') {
      // The existing authenticated bridge returns only configured payer names and IDs.
      // Do not couple durable intake saving to catalogue availability.
      return fdg080Json_(fdg160PrivateRouterCall_('intake-insurance-options', {}));
    }

    if (action === 'pharmacy-search') {
      return fdg080Json_(fdg083SearchPharmacies_(p));
    }

    if (action === 'eligibility-status') {
      return fdg080Json_(
        fdg090PublicEligibilityStatus_(token)
      );
    }

    if (action === 'discovery-status') {
      return fdg080Json_(
        fdg096PublicDiscoveryStatus_(token)
      );
    }

    var intake = fdg080ReadIntake_(token, readContext);
    var eligibility = fdg090PublicEligibilityStatus_(token, readContext);
    var office=fdg240Prefill_(source,intake,readContext);intake=office.intake;
    // Staff may update Charm after a link is sent or its contract is signed.
    // Refresh only on load, through the existing authenticated Google bridge;
    // saves remain local and patient corrections/signatures stay authoritative.
    if (String(source['Charm Patient ID']||'').trim()) {
      try {
        var fresh = fdg160PrivateRouterCall_('intake-charm-prefill', {
          frontDoorId:String(source['Front Door ID']), token:token
        });
        if (fresh && fresh.success && intake && !intake.parseError) {
          var previousPolicy = fdg357PolicyKey_(intake.data || {});
          intake.data = fdg357MergeCharm_(source, intake.data || {}, fresh.snapshot);
          intake.data.officeSections = intake.data.officeSections || {};
          intake.data.officeSections.personal = !intake.data.addressReview && fdg274Complete_('personal',intake.data);
          if (previousPolicy !== fdg357PolicyKey_(intake.data)) {
            office.eligibility = null;
            eligibility = {success:true,status:'NOT REQUESTED',coverageStatus:'',checkedAt:'',
              message:'Insurance details are on file in Charm. Coverage has not been rechecked.'};
            intake.data.officeSections = intake.data.officeSections || {};
            intake.data.officeSections.insurance = false;
          }
        }
      } catch (prefillError) { console.log('Charm prefill unavailable; retained saved intake.'); }
    }
    if(office.eligibility&&(!eligibility.checkedAt||new Date(office.eligibility.checkedAt)>=new Date(eligibility.checkedAt)))eligibility=office.eligibility;

    var response = fdg080Json_({
      success: true,
      version: FDG080.VERSION,
      capabilities: {
        approvedIntake: true,
        selfPayCashPrice: true,
        cashPricesSource: 'OS2',
        followUpReview: true,
        followUpReviewVersion: 'v0.12.0'
      },
      booking: fdg080PublicBooking_(source),
      intake: intake ? fdg080PublicIntake_(intake) : null,
      // Explicit section refresh may replace a preserved partial draft, but only
      // with this request's exact-token current Charm snapshot. No chart writes.
      charmSnapshot: fresh && fresh.success ? fresh.snapshot : null,
      eligibility: eligibility,
      discovery: fdg096PublicDiscoveryStatus_(token, readContext),
      estimate: eligibility.estimate,
      cashPrice: fdg112PublicCashPrice_(source, readContext),
      agreement: fdg083PublicAgreement_()
    });
    readContext.ok = true;
    return response;

  } catch (err) {
    return fdg080Json_({
      success: false,
      error: fdg080PublicError_(err)
    });
  } finally {
    fdg236LogLoad_(readContext);
  }
}


/**
 * Public POST endpoint.
 *
 * JSON body:
 * {
 *   action: "save" | "complete",
 *   token: "...",
 *   step: "3",
 *   clientVersion: "v0.8.0",
 *   data: {...},
 *   uploads: [...]
 * }
 */
function doPost(e) {
  try {
    var raw = String(
      e && e.postData && e.postData.contents
        ? e.postData.contents
        : ''
    );

    if (!raw) {
      throw new Error('Empty request.');
    }

    // Generous outer ceiling because base64 uploads are larger than files.
    if (raw.length > FDG080.MAX_JSON_CHARS * 60) {
      throw new Error('Request is too large.');
    }

    var body = JSON.parse(raw);
    var action = fdg080Clean_(body.action || 'save').toLowerCase();

    if(action==='reschedule-slots'||action==='reschedule-confirm')return fdg080Json_(fdg269Reschedule_(body));
    if(action==='save-status')return fdg080Json_(fdg330SaveStatus_(body));
    if(action==='contract-status')return fdg080Json_(fdg230ContractStatus_(body));
    if(action==='section-save'||action==='sign-contract')return fdg080Json_(fdg230Section_(body));
    if(action==='section-upload')return fdg080Json_(fdg230Upload_(body));
    if(action==='section-sync')return fdg080Json_(fdg230Sync_(body));

    if (action === 'followup-verification-start') {
      if (!fdg160WebsiteVerificationEnabled_()) {
        throw new Error('Follow-up verification is not enabled.');
      }
      return fdg080Json_(fdg160PrivateRouterCall_('verification-start', {
        firstName: fdg080Clean_(body.firstName),
        lastName: fdg080Clean_(body.lastName),
        dob: fdg080DateOnly_(body.dob),
        email: fdg080Clean_(body.email).toLowerCase()
      }));
    }

    if (action === 'followup-verification-confirm') {
      if (!fdg160WebsiteVerificationEnabled_()) {
        throw new Error('Follow-up verification is not enabled.');
      }
      return fdg080Json_(fdg160PrivateRouterCall_('verification-confirm', {
        requestId: fdg080Clean_(body.requestId),
        code: fdg080Clean_(body.code)
      }));
    }

    // Website bookings arrive here only AFTER the existing booking
    // endpoint has successfully reserved the slot / created its calendar event.
    // This action creates the source-neutral Front Door queue record and token.
    if (action === 'website-book') {
      return fdg080Json_(fdg082CreateWebsiteBooking_(body));
    }

    if (action === 'insurance-analyze') {
      return fdg080Json_(fdg170AnalyzeInsuranceCard_(body));
    }

    if (action === 'eligibility-request') {
      return fdg080Json_(
        fdg090QueueEligibilityRequest_(body)
      );
    }

    if (action === 'discovery-request') {
      return fdg080Json_(
        fdg096QueueDiscoveryRequest_(body)
      );
    }

    if (action !== 'save' && action !== 'complete') {
      throw new Error('Unsupported action.');
    }

    var token = fdg080ValidateToken_(body.token || '');
    var source = fdg080FindSourceByToken_(token);
    var existing = fdg080ReadIntake_(token);
    if(existing&&existing.data&&existing.data.flowVersion==='FOUR_SECTIONS'&&(action==='save'||action==='complete'))throw new Error('This form has been updated. Refresh to continue with your saved sections.');

    var data = fdg080SanitizeData_(body.data || {});
    if(action==='complete')fdg360ValidateVisit_(data);

    if (fdg120IsFollowUpSource_(source)) {
      // The review baseline is private, server-prepared state. Never trust a
      // copy posted by the browser; restore the canonical saved snapshot
      // before comparing or locking demographics.
      data.reviewBaseline = existing && existing.data
        ? existing.data.reviewBaseline
        : null;
      data = fdg120NormalizeFollowUpData_(data);
    }

    var paymentChoice = fdg112PaymentChoice_(data, source);
    data.paymentChoice = paymentChoice;
    if (paymentChoice === 'SELF_PAY') {
      data.insuranceCarrier = 'Self-pay';
      data.payerId = '';
      data.memberId = '';
      data.insurancePlan = '';
      data.groupId = '';
      data.insuranceCardStatus = 'not_applicable';
      data.hasSecondaryInsurance = false;
      data.secondaryCarrier = '';
      data.secondaryMemberId = '';
      data.secondaryGroupId = '';
      fdg112WriteSelfPayEstimate_(token, source);
    } else {
      fdg112ClearStaleSelfPayEstimate_(token, source);
    }

    var step = fdg080Clean_(body.step || '');
    var clientVersion = fdg080Clean_(body.clientVersion || '');

    // A completed signed intake is immutable from the public link. A repeated
    // final submit is idempotent; any later save attempt is rejected.
    if (existing && existing.completedAt) {
      if (action === 'complete') {
        return fdg080Json_({
          success: true,
          completed: true,
          idempotent: true,
          status: 'PATIENT COMPLETED — READY FOR CHARM'
        });
      }
      throw new Error('This Front Door registration has already been completed.');
    }

    var uploadRefs = existing && existing.uploadRefs
      ? existing.uploadRefs
      : {};

    if (action === 'complete') {
      fdg080ValidateCompletion_(source, data, token);

      var uploads = Array.isArray(body.uploads)
        ? body.uploads
        : [];

      if (uploads.length > FDG080.MAX_UPLOADS_PER_SUBMISSION) {
        throw new Error('Too many files in one submission.');
      }

      if (uploads.length) {
        uploadRefs = fdg080SaveUploads_(
          source,
          uploads,
          uploadRefs
        );
      }

      fdg080ValidateRequiredUploadChoices_(data, uploadRefs);
    }

    var now = new Date();
    var agreementArtifact = null;

    if (action === 'complete' && !fdg120IsFollowUpSource_(source)) {
      agreementArtifact = fdg083CreateAgreementPdf_(source, data, now);
      data.agreementVersion = agreementArtifact.version;
      data.agreementSha256 = agreementArtifact.sha256;
      data.agreementAcceptedAt = agreementArtifact.acceptedAtIso;
    } else if (action === 'complete') {
      data.followUpReview.completedAt = now.toISOString();
    }

    var dataJson = JSON.stringify(data);
    if (dataJson.length > FDG080.MAX_JSON_CHARS) {
      if (agreementArtifact && agreementArtifact.fileId) {
        try { DriveApp.getFileById(agreementArtifact.fileId).setTrashed(true); } catch (ignore) {}
      }
      throw new Error('Intake data is too large.');
    }

    try {
      fdg080UpsertIntake_({
        token: token,
        frontDoorId: fdg080Clean_(source['Front Door ID']),
        now: now,
        completedAt: action === 'complete' ? now : '',
        step: step,
        confirmationStatus:
          action === 'complete'
            ? 'FRONT DOOR COMPLETE'
            : 'IN PROGRESS',
        insuranceCardStatus:
          fdg080Clean_(data.insuranceCardStatus),
        photoIdStatus:
          fdg080Clean_(data.photoIdStatus),
        secondaryStatus:
          data.hasSecondaryInsurance ? 'YES' : 'NO',
        signatureName:
          fdg080Clean_(data.signatureName),
        policiesAccepted:
          action === 'complete' ? 'YES' : '',
        dataJson: dataJson,
        uploadRefs: uploadRefs,
        clientVersion: clientVersion,
        lastError: '',
        agreementVersion: agreementArtifact ? agreementArtifact.version : '',
        agreementAcceptedAt: agreementArtifact ? now : '',
        agreementPdfFileId: agreementArtifact ? agreementArtifact.fileId : '',
        agreementSha256: agreementArtifact ? agreementArtifact.sha256 : ''
      });
    } catch (writeErr) {
      if (agreementArtifact && agreementArtifact.fileId) {
        try { DriveApp.getFileById(agreementArtifact.fileId).setTrashed(true); } catch (ignore2) {}
      }
      throw writeErr;
    }

    if (action === 'complete') {
      fdg080UpdateSourceStatus_(source, {
        'Front Door Status':
          'PATIENT COMPLETED — READY FOR CHARM',
        'Missing Information Status': 'PATIENT SUBMITTED',
        'Paperwork Status': 'PATIENT COMPLETED',
        'Updated At': now,
        'Last Error': ''
      });
    } else {
      fdg080UpdateSourceStatus_(source, {
        'Front Door Status': 'PATIENT IN PROGRESS',
        'Updated At': now
      });
    }

    return fdg080Json_({
      success: true,
      completed: action === 'complete',
      status:
        action === 'complete'
          ? 'PATIENT COMPLETED — AWAITING INTERNAL PROCESSING'
          : 'PATIENT IN PROGRESS'
    });

  } catch (err) {
    return fdg080Json_({
      success: false,
      error: fdg080PublicError_(err)
    });
  }
}


/* ============================================================
 * SOURCE LOOKUP
 * ============================================================ */

function fdg080FindSourceByToken_(token, readContext) {
  var sh = fdg236ReadSheet_(readContext, FDG080.SOURCE_TAB);

  if (!sh || sh.getLastRow() < 2) {
    throw new Error('Front Door source is unavailable.');
  }

  var values = readContext ? sh.getDataRange().getValues() : sh.getRange(1,1,1,sh.getLastColumn()).getValues();
  var headers = values.shift().map(function(x) {
    return String(x || '').trim();
  });

  var tokenCol = headers.indexOf('Patient Token');

  if (tokenCol < 0) {
    throw new Error('Front Door token column is missing.');
  }

  var sourceRow = readContext ? 0 : fdg330TokenRow_(sh, tokenCol+1, token);
  if(!readContext)values=sourceRow?sh.getRange(sourceRow,1,1,headers.length).getValues():[];

  for (var i = 0; i < values.length; i++) {
    var got = fdg080Clean_(values[i][tokenCol]);

    if (got !== token) {
      continue;
    }

    var obj = {
      _row: sourceRow || i + 2,
      _sheet: sh._liveSheet || sh,
      _headers: headers
    };

    headers.forEach(function(h, idx) {
      if (h) {
        obj[h] = values[i][idx];
      }
    });

    fdg080ValidateSourceWindow_(obj);
    return obj;
  }

  throw new Error('This Front Door link is invalid or has expired.');
}


function fdg080ValidateSourceWindow_(source) {
  var start = source['Appointment Start'];
  if (!start) return;

  var d = start instanceof Date ? start : new Date(start);
  if (isNaN(d.getTime())) return;

  var cutoff = new Date(
    Date.now() -
    FDG080.PAST_APPOINTMENT_GRACE_DAYS *
      24 * 60 * 60 * 1000
  );

  if (d < cutoff) {
    throw new Error('This Front Door link has expired.');
  }
}


function fdg080PublicBooking_(s) {
  // A booking can identify an insurer before it has a member ID. Keep that
  // selection independently of whether Charm has a complete insurance entry.
  var partial={};try{var raw=JSON.parse(String(s['Raw Source JSON']||'{}'));partial=raw.bookingInsurance||{};}catch(ignore){}
  return {
    frontDoorId:
      fdg080Clean_(s['Front Door ID']),

    source:
      fdg080Clean_(s['Booking Source']),

    patientType:
      fdg080Clean_(s['Patient Type']),

    appointmentStart:
      fdg269AbsoluteDate_(s['Appointment Start']),

    appointmentEnd:
      fdg269AbsoluteDate_(s['Appointment End']),

    appointmentDisplay:
      fdg080DisplayDate_(s['Appointment Start']),

    visitReason:
      fdg080Clean_(s['Visit Reason']),

    visitMode:
      fdg102VisitModeForSource_(s),

    firstName:
      fdg080Clean_(s['First Name']),

    lastName:
      fdg080Clean_(s['Last Name']),

    dob:
      fdg080DateOnly_(s['DOB']),

    sex:
      fdg080Clean_(s['Sex']),

    phone:
      fdg080Clean_(s['Phone']),

    email:
      fdg080Clean_(s['Email']),

    insuranceCarrier:
      fdg080Clean_(s['Insurance Carrier']||partial.insuranceCarrier||partial.insuranceName||partial.carrier),

    payerId:
      fdg095SourcePayerId_(s),

    insurancePlan:
      fdg080Clean_(s['Insurance Plan']),

    memberId:
      fdg080Clean_(s['Member ID']),

    groupId:
      fdg080Clean_(s['Group ID']),

    eligibilityStatus:
      fdg080Clean_(s['Eligibility Status']),

    networkStatus:
      fdg080Clean_(s['Network Status']),

    estimateStatus:
      fdg080Clean_(s['Estimate Status']),

    estimateAmount:
      fdg080MoneyOrBlank_(s['Estimate Amount']),

    estimateConfidence:
      fdg080Clean_(s['Estimate Confidence']),

    frontDoorStatus:
      fdg080Clean_(s['Front Door Status'])
  };
}


/* ============================================================
 * INTAKE STORAGE
 * ============================================================ */

function fdg080VerifyIntakeSchema_(sh) {
  var current = sh
    .getRange(
      1,
      1,
      1,
      Math.max(
        sh.getLastColumn(),
        FDG080.INTAKE_HEADERS.length
      )
    )
    .getValues()[0];

  var mismatch =
    FDG080.INTAKE_HEADERS.some(function(h, i) {
      return String(current[i] || '') !== h;
    });

  if (mismatch) {
    throw new Error(
      'Front Door Intake schema differs from ' +
      FDG080.VERSION +
      '. Nothing was overwritten.'
    );
  }
}


function fdg080ReadIntake_(token, readContext) {
  var sh = fdg236ReadSheet_(readContext, FDG080.INTAKE_TAB);

  if (!sh || sh.getLastRow() < 2) {
    return null;
  }

  fdg080VerifyIntakeSchema_(sh);
  var H = fdg080HeaderMap_(sh);

  // A save needs one patient's row, not every patient's JSON. Load-time
  // snapshots retain their existing behavior; ordinary writes use a narrow lookup.
  var matchedRow = readContext ? 0 : fdg330TokenRow_(sh, H['Patient Token'], token);
  if (!readContext && !matchedRow) return null;
  var vals = sh.getRange(matchedRow || 2, 1, matchedRow ? 1 : sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (var i = 0; i < vals.length; i++) {
    if (
      fdg080Clean_(
        vals[i][H['Patient Token'] - 1]
      ) !== token
    ) {
      continue;
    }

    var data = {};
    var uploads = {},parseError=false;

    try {
      data = JSON.parse(
        String(vals[i][H['Data JSON'] - 1] || '{}')
      );
    } catch (ignore1) {parseError=true;}

    try {
      uploads = JSON.parse(
        String(
          vals[i][H['Upload IDs JSON'] - 1] || '{}'
        )
      );
    } catch (ignore2) {}

    return {
      row: matchedRow || i + 2,
      _writeContext: readContext ? null : {sheet:sh, headers:H, row:matchedRow, createdAt:vals[i][H['Created At'] - 1]},
      parseError:parseError,
      currentStep:
        fdg080Clean_(
          vals[i][H['Current Step'] - 1]
        ),
      completedAt:
        vals[i][H['Completed At'] - 1] || '',
      confirmationStatus:
        fdg080Clean_(
          vals[i][H['Confirmation Status'] - 1]
        ),
      data: data,
      uploadRefs: uploads,
      agreementVersion: fdg080Clean_(vals[i][H['Agreement Version'] - 1]),
      agreementAcceptedAt: vals[i][H['Agreement Accepted At'] - 1] || '',
      agreementPdfFileId: fdg080Clean_(vals[i][H['Agreement PDF File ID'] - 1]),
      agreementSha256: fdg080Clean_(vals[i][H['Agreement SHA-256'] - 1])
    };
  }

  return null;
}


function fdg080PublicIntake_(x) {
  return {
    currentStep: x.currentStep || '',
    completed: !!x.completedAt,
    confirmationStatus:
      x.confirmationStatus || '',
    data: x.data || {},
    contractSigned: !!x.agreementPdfFileId,
    sectionProgress: (x.data||{}).sectionProgress||{},
    uploadsOnFile:
      Object.keys(x.uploadRefs || {})
  };
}


function fdg080UpsertIntake_(x) {
  var lock = LockService.getScriptLock();
  var ownLock=!lock.hasLock();
  if(ownLock&&!lock.tryLock(1500))throw new Error('Saving is busy; please retry.');

  try {
    var context = x.rowContext;
    var sh = context ? context.sheet : SpreadsheetApp.openById(FDG080.SHEET_ID).getSheetByName(FDG080.INTAKE_TAB);

    if (!sh) {
      throw new Error(
        'Front Door Intake tab is missing. Run setup first.'
      );
    }

    if (!context) fdg080VerifyIntakeSchema_(sh);
    var H = context ? context.headers : fdg080HeaderMap_(sh);

    var row = context ? context.row : 0;
    if (context && fdg080Clean_(sh.getRange(row, H['Patient Token']).getValue()) !== x.token) {
      throw new Error('The intake row changed. Please try saving again.');
    }

    if (!context && sh.getLastRow() >= 2) {
      var tokens = sh
        .getRange(
          2,
          H['Patient Token'],
          sh.getLastRow() - 1,
          1
        )
        .getValues();

      for (var i = 0; i < tokens.length; i++) {
        if (
          fdg080Clean_(tokens[i][0]) === x.token
        ) {
          row = i + 2;
          break;
        }
      }
    }

    var createdAt = x.now;

    if (row) {
      createdAt = context ? context.createdAt || x.now :
        sh.getRange(row, H['Created At']).getValue() ||
        x.now;
    } else {
      row = sh.getLastRow() + 1;
    }

    var obj = {
      'Patient Token': x.token,
      'Front Door ID': x.frontDoorId,
      'Created At': createdAt,
      'Updated At': x.now,
      'Completed At': x.completedAt || '',
      'Current Step': x.step || '',
      'Confirmation Status':
        x.confirmationStatus || '',
      'Insurance Card Status':
        x.insuranceCardStatus || '',
      'Photo ID Status':
        x.photoIdStatus || '',
      'Secondary Insurance Status':
        x.secondaryStatus || '',
      'Signature Name':
        x.signatureName || '',
      'Policies Accepted':
        x.policiesAccepted || '',
      'Data JSON':
        x.dataJson || '{}',
      'Upload IDs JSON':
        JSON.stringify(x.uploadRefs || {}),
      'Client Version':
        x.clientVersion || '',
      'Last Error':
        x.lastError || '',
      'Agreement Version':
        x.agreementVersion || '',
      'Agreement Accepted At':
        x.agreementAcceptedAt || '',
      'Agreement PDF File ID':
        x.agreementPdfFileId || '',
      'Agreement SHA-256':
        x.agreementSha256 || ''
    };

    var rowValues =
      FDG080.INTAKE_HEADERS.map(function(h) {
        return obj[h];
      });

    sh
      .getRange(row, 1, 1, rowValues.length)
      .setValues([rowValues]);
    // Commit Sheets' buffered write before acknowledging or releasing the lock.
    SpreadsheetApp.flush();

  } finally {
    if(ownLock)lock.releaseLock();
  }
}


function fdg080UpdateSourceStatus_(source, fields) {
  var sh = source._sheet;
  var headers = source._headers;

  Object.keys(fields).forEach(function(header) {
    var idx = headers.indexOf(header);

    if (idx < 0) {
      throw new Error(
        'Front Door source column missing: ' + header
      );
    }

    sh
      .getRange(source._row, idx + 1)
      .setValue(fields[header]);
  });
}



function fdg102VisitModeForSource_(source) {
  source = source || {};

  var raw = {};
  try {
    raw = JSON.parse(
      String(source['Raw Source JSON'] || '{}')
    );
  } catch (ignore) {}

  var x = fdg080Clean_(
    raw.visitType ||
    raw.appointmentType ||
    raw.visitMode ||
    raw.appointmentMode ||
    raw.mode ||
    ''
  ).toUpperCase();

  if (
    x === 'VIDEO CONSULT' ||
    x === 'VIDEO' ||
    x === 'VIRTUAL' ||
    x === 'VIRTUAL VISIT' ||
    x === 'TELEMEDICINE' ||
    x === 'TELEHEALTH'
  ) {
    return 'Video Consult';
  }

  return 'In Person';
}
function fdg102IsVirtualSource_(source){return fdg102VisitModeForSource_(source)==='Video Consult';}


/* ============================================================
 * FOLLOW-UP REVIEW NORMALIZATION + VALIDATION — v0.12.0
 * ============================================================ */

function fdg120IsFollowUpSource_(source) {
  var x = fdg080Clean_(source && source['Patient Type']).toUpperCase();
  return x === 'RETURNING' || x === 'FOLLOW UP' || x === 'FOLLOW-UP' || x === 'FOLLOWUP';
}


function fdg120NormalizeFollowUpData_(d) {
  d = d && typeof d === 'object' ? d : {};
  var baseline = d.reviewBaseline && typeof d.reviewBaseline === 'object'
    ? d.reviewBaseline
    : null;
  if (!baseline || !baseline.demographics || !baseline.insurance || !baseline.health) {
    throw new Error('This follow-up review is still being prepared. Please wait a moment and try again.');
  }

  var review = d.followUpReview && typeof d.followUpReview === 'object'
    ? d.followUpReview
    : {};
  review.appointmentConfirmed = !!review.appointmentConfirmed;
  review.demographicsConfirmed = !!review.demographicsConfirmed;
  review.insuranceChanged = !!review.insuranceChanged;
  review.healthChanged = !!review.healthChanged;
  review.insuranceStatus = fdg080Clean_(review.insuranceStatus).toUpperCase();
  review.healthStatus = fdg080Clean_(review.healthStatus).toUpperCase();
  d.followUpReview = review;
  d.flowType = 'FOLLOW_UP_REVIEW';

  // Demographics are always locked to the private Charm snapshot. Public
  // clients cannot use hidden-field edits to modify identity/contact data.
  var dem = baseline.demographics;
  d.firstName = fdg080Clean_(dem.firstName);
  d.lastName = fdg080Clean_(dem.lastName);
  d.dob = fdg080DateOnly_(dem.dob);
  d.phone = fdg080Clean_(dem.phone);
  d.email = fdg080Clean_(dem.email);
  d.address1 = fdg080Clean_(dem.address1);
  d.address2 = fdg080Clean_(dem.address2);
  d.city = fdg080Clean_(dem.city);
  d.state = fdg080Clean_(dem.state);
  d.zip = fdg080Clean_(dem.zip);

  if (!review.insuranceChanged) {
    var ins = baseline.insurance;
    d.paymentChoice = ins.available ? 'INSURANCE' : 'SELF_PAY';
    d.insuranceCarrier = fdg080Clean_(ins.carrier);
    d.payerId = fdg095PayerId_(ins.payerId);
    d.insurancePlan = fdg080Clean_(ins.planName);
    d.memberId = fdg080Clean_(ins.memberId);
    d.groupId = fdg080Clean_(ins.groupNumber);
    d.insuranceCardStatus = ins.available ? 'verified' : 'not_applicable';
    d.hasSecondaryInsurance = false;
  }

  if (!review.healthChanged) {
    var health = baseline.health;
    d.healthChange = 'none';
    d.noKnownAllergies = !!health.noKnownAllergies;
    d.allergies = fdg080Clean_(health.allergies);
    d.medications = fdg080Clean_(health.medications);
    d.pharmacy = fdg080Clean_(health.pharmacy);
    d.pharmacyAddress = fdg080Clean_(health.pharmacyAddress);
    d.pharmacyPhone = fdg080Clean_(health.pharmacyPhone);
    d.pharmacyNpi = fdg080Clean_(health.pharmacyNpi);
  } else {
    d.healthChange = 'changes';
  }

  d.hpi = fdg080Clean_(d.followUpVisitNote || d.hpi).slice(0, 4000);
  d.followUpVisitNote = d.hpi;
  d.reviewChanges = fdg120ReviewChanges_(baseline, d);
  return d;
}


function fdg120ReviewChanges_(baseline, d) {
  var out = {
    appointment: 'CONFIRMED',
    demographics: 'CONFIRMED — LOCKED',
    insuranceChanged: !!d.followUpReview.insuranceChanged,
    healthChanged: !!d.followUpReview.healthChanged,
    insuranceFields: [],
    healthFields: [],
    visitNoteProvided: !!fdg080Clean_(d.followUpVisitNote)
  };

  if (out.insuranceChanged) {
    var ib = baseline.insurance || {};
    [
      ['Insurance company','carrier','insuranceCarrier'],
      ['Payer ID','payerId','payerId'],
      ['Member ID','memberId','memberId'],
      ['Plan','planName','insurancePlan'],
      ['Group','groupNumber','groupId']
    ].forEach(function(x) {
      if (fdg120Key_(ib[x[1]]) !== fdg120Key_(d[x[2]])) out.insuranceFields.push(x[0]);
    });
  }

  if (out.healthChanged) {
    var hb = baseline.health || {};
    [
      ['Allergies','allergies','allergies'],
      ['Medications','medications','medications'],
      ['Pharmacy','pharmacy','pharmacy'],
      ['Pharmacy address','pharmacyAddress','pharmacyAddress'],
      ['Pharmacy phone','pharmacyPhone','pharmacyPhone']
    ].forEach(function(x) {
      if (fdg120Key_(hb[x[1]]) !== fdg120Key_(d[x[2]])) out.healthFields.push(x[0]);
    });
    if (!!hb.noKnownAllergies !== !!d.noKnownAllergies) out.healthFields.push('Allergy status');
  }
  return out;
}


function fdg120ValidateFollowUpCompletion_(token, source, d) {
  var review = d.followUpReview || {};
  if (!review.appointmentConfirmed) {
    throw new Error('Please confirm the appointment details.');
  }
  if (!review.demographicsConfirmed) {
    throw new Error('Please confirm that you reviewed the locked demographics.');
  }

  var allowedInsurance = {
    'CONFIRMED': true,
    'NO INSURANCE ON FILE': true,
    'CHANGED — ACTIVE': true,
    'CHANGED — SAVED': true
  };
  var allowedHealth = { 'CONFIRMED': true, 'CHANGED': true };
  if (!allowedInsurance[review.insuranceStatus]) {
    throw new Error('Please confirm the insurance information or save your changes.');
  }
  if (!allowedHealth[review.healthStatus]) {
    throw new Error('Please confirm the health information or report a health change.');
  }

  if (review.insuranceChanged) {
    if (!fdg080Clean_(d.insuranceCarrier) || !fdg080Clean_(d.memberId)) {
      throw new Error('Updated insurance company and member ID are required.');
    }
    // Updating insurance is storage, not a coverage determination.
    // Preserve the existing change/identity checks without requiring eligibility.
    if (!(d.reviewChanges && d.reviewChanges.insuranceFields || []).length) {
      throw new Error('The updated insurance matches the insurance already on file.');
    }
  }

  if (review.healthChanged && !(d.reviewChanges && d.reviewChanges.healthFields || []).length) {
    throw new Error('Choose “information is correct” or enter at least one health change.');
  }
}


function fdg120RequireCurrentActiveEligibility_(token, d) {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var sh = ss.getSheetByName(FDG080.ELIGIBILITY_TAB);
  if (!sh || sh.getLastRow() < 2) {
    throw new Error('Updated insurance must be verified before submission.');
  }
  fdg090VerifyEligibilitySchema_(sh);
  var H = fdg080HeaderMap_(sh);
  var row = fdg090EligibilityRowByToken_(sh, H, token);
  if (!row) throw new Error('Updated insurance must be verified before submission.');

  var expectedHash = fdg090Sha256_([
    fdg080Clean_(d.insuranceCarrier).toLowerCase(),
    fdg095PayerId_(d.payerId),
    fdg080Clean_(d.memberId).replace(/\s+/g, '').toUpperCase(),
    fdg080Clean_(d.firstName).toLowerCase(),
    fdg080Clean_(d.lastName).toLowerCase(),
    fdg080DateOnly_(d.dob),
    fdg080Clean_(d.subscriberFirstName).toLowerCase(),
    fdg080Clean_(d.subscriberLastName).toLowerCase(),
    fdg080DateOnly_(d.subscriberDob)
  ].join('|'));

  var actualHash = fdg080Clean_(row.values[H['Request Hash'] - 1]);
  var status = fdg080Clean_(row.values[H['Status'] - 1]).toUpperCase();
  var coverage = fdg080Clean_(row.values[H['Coverage Status'] - 1]).toUpperCase();
  if (actualHash !== expectedHash || status !== 'ACTIVE' || (coverage && coverage !== 'ACTIVE')) {
    throw new Error('The latest insurance change has not returned active coverage for these exact details.');
  }
}


function fdg120Key_(v) {
  return fdg080Clean_(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/* ============================================================
 * COMPLETION VALIDATION
 * ============================================================ */

function fdg080ValidateCompletion_(source, d, token) {
  if (fdg120IsFollowUpSource_(source)) {
    fdg120ValidateFollowUpCompletion_(token, source, d);
    return;
  }
  var required = [
    ['firstName', 'First name'],
    ['lastName', 'Last name'],
    ['dob', 'Date of birth'],
    ['phone', 'Phone'],
    ['email', 'Email'],
    ['address1', 'Address'],
    ['city', 'City'],
    ['state', 'State'],
    ['zip', 'ZIP code'],
    ['photoIdStatus', 'Photo ID choice'],
    ['signatureName', 'Electronic signature']
  ];

  required.forEach(function(pair) {
    if (!fdg080Clean_(d[pair[0]])) {
      throw new Error(pair[1] + ' is required.');
    }
  });

  var paymentChoice = fdg112PaymentChoice_(d, source);
  var staffHelp = !!d.insuranceAssistanceRequested;
  if (paymentChoice !== 'SELF_PAY' && !staffHelp) {
    if (!fdg080Clean_(d.insuranceCarrier)) throw new Error('Insurance company is required.');
    if (!fdg080Clean_(d.memberId)) throw new Error('Member ID is required.');
    if (!fdg080Clean_(d.insuranceCardStatus)) throw new Error('Insurance card choice is required.');
  }

  if (!fdg080EmailOk_(d.email)) {
    throw new Error(
      'Please enter a valid email address.'
    );
  }

  if (fdg080Digits_(d.phone).length < 10) {
    throw new Error(
      'Please enter a valid phone number.'
    );
  }

  if (!d.confirmationPolicyAccepted) {
    throw new Error(
      'Please acknowledge the appointment confirmation policy.'
    );
  }

  if (!d.noShowPolicyAccepted) {
    throw new Error(
      'Please acknowledge the $50 no-show policy.'
    );
  }

  if (!d.privacyAcknowledged) {
    throw new Error(
      'Please acknowledge the privacy notice.'
    );
  }

  if (!d.treatmentConsent) {
    throw new Error(
      'Consent to treatment is required.'
    );
  }

  if (fdg102IsVirtualSource_(source) && !d.telemedicineConsent) {
    throw new Error('Telemedicine consent is required for a virtual/video appointment.');
  }

  if (paymentChoice !== 'SELF_PAY' && !d.billingAuthorizationAccepted) {
    throw new Error(
      'Please authorize insurance billing and assignment of benefits.'
    );
  }

  if (!d.financialPolicyAcknowledged) {
    throw new Error(
      'Please acknowledge the financial policy.'
    );
  }

  if (!d.agreementAccepted) {
    throw new Error(
      'Please review and accept the Patient Registration, Treatment Consent & Financial Agreement.'
    );
  }

  if (paymentChoice !== 'SELF_PAY' && !staffHelp && d.hasSecondaryInsurance) {
    if (!fdg080Clean_(d.secondaryCarrier)) {
      throw new Error(
        'Secondary insurance company is required.'
      );
    }

    if (!fdg080Clean_(d.secondaryMemberId)) {
      throw new Error(
        'Secondary member ID is required.'
      );
    }
  }

  var sourceType =
    fdg080Clean_(source['Booking Source'])
      .toUpperCase();

  if (
    fdg080Clean_(d.insuranceCardStatus) ===
      'zocdoc' &&
    sourceType !== 'ZOCDOC'
  ) {
    throw new Error(
      'The Zocdoc card option is only valid for Zocdoc bookings.'
    );
  }

  if (
    fdg080Clean_(d.photoIdStatus) ===
      'zocdoc' &&
    sourceType !== 'ZOCDOC'
  ) {
    throw new Error(
      'The Zocdoc photo ID option is only valid for Zocdoc bookings.'
    );
  }
}


function fdg080ValidateRequiredUploadChoices_(
  d,
  refs
) {
  if (
    fdg080Clean_(d.insuranceCardStatus) ===
      'upload' &&
    !(
      refs.insurance_front ||
      refs.insurance_back
    )
  ) {
    throw new Error(
      'Please upload at least one insurance card image, or choose another card option.'
    );
  }

  if (
    fdg080Clean_(d.photoIdStatus) ===
      'upload' &&
    !refs.photo_id
  ) {
    throw new Error(
      'Please upload your photo ID, or choose another ID option.'
    );
  }
}


/* ============================================================
 * PRIVATE DRIVE UPLOADS
 * ============================================================ */

function fdg080UploadFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(
    FDG080.UPLOAD_FOLDER_PROPERTY
  );

  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (ignore) {}
  }

  var folder =
    DriveApp.createFolder(
      FDG080.UPLOAD_FOLDER_NAME
    );

  props.setProperty(
    FDG080.UPLOAD_FOLDER_PROPERTY,
    folder.getId()
  );

  return folder;
}


/* Read an insurance card transiently so the patient can review extracted
 * fields before saving insurance information. The temporary OCR document is
 * deleted immediately; the actual card is stored only on final completion. */
function fdg170AnalyzeInsuranceCard_(body) {
  var token = fdg080ValidateToken_(body.token || '');
  fdg080FindSourceByToken_(token);
  var uploads = Array.isArray(body.uploads) ? body.uploads : [];
  if (!uploads.length || uploads.length > 2) throw new Error('Choose an insurance card image or PDF first.');
  var text = '';
  uploads.forEach(function(u) {
    var kind = fdg080Clean_(u.kind).toLowerCase();
    if (kind !== 'insurance_front' && kind !== 'insurance_back') throw new Error('Only insurance-card files can be read here.');
    var mime = fdg080Clean_(u.mime).toLowerCase();
    if (!({'image/jpeg':1,'image/png':1,'application/pdf':1})[mime]) throw new Error('Files must be JPG, PNG, or PDF.');
    var b64 = String(u.base64 || '').replace(/^data:[^;]+;base64,/,'').replace(/\s/g,'');
    var bytes = Utilities.base64Decode(b64);
    if (bytes.length > FDG080.MAX_FILE_BYTES) throw new Error('Each uploaded file must be 4 MB or smaller.');
    text += '\n' + fdg170OcrBlob_(Utilities.newBlob(bytes, mime, 'insurance-card'));
  });
  var extracted = fdg170InsuranceFields_(text);
  return {success:true, extracted:extracted, message:extracted.memberId ? 'Card details found.' : 'Please review the card details manually.'};
}

function fdg170OcrBlob_(blob) {
  var temporaryId = '';
  try {
    var boundary = '-------FDOCR' + Utilities.getUuid().replace(/-/g,'');
    var metadata = JSON.stringify({name:'Front Door temporary OCR',mimeType:'application/vnd.google-apps.document'});
    var head = '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+metadata+'\r\n--'+boundary+'\r\nContent-Type: '+blob.getContentType()+'\r\n\r\n';
    var tail = '\r\n--'+boundary+'--';
    var payload = Utilities.newBlob(head).getBytes().concat(blob.getBytes()).concat(Utilities.newBlob(tail).getBytes());
    var created = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{
      method:'post',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},contentType:'multipart/related; boundary='+boundary,payload:payload,muteHttpExceptions:true
    });
    if (created.getResponseCode() < 200 || created.getResponseCode() >= 300) return '';
    temporaryId = fdg080Clean_(JSON.parse(created.getContentText()||'{}').id);
    if (!temporaryId) return '';
    var url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(temporaryId)+'/export?mimeType='+encodeURIComponent('text/plain');
    for(var i=0;i<4;i++){
      if(i)Utilities.sleep(500*i);
      var out=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
      if(out.getResponseCode()>=200&&out.getResponseCode()<300)return String(out.getContentText()||'').slice(0,30000);
    }
    return '';
  } catch(ignore) { return ''; }
  finally { if(temporaryId){try{DriveApp.getFileById(temporaryId).setTrashed(true);}catch(ignoreTrash){}} }
}

function fdg170InsuranceFields_(text) {
  var t=String(text||''),u=t.toUpperCase(),carrier='',payerId='';
  var payers=[
    ['UNITEDHEALTHCARE','UnitedHealthcare','87726'],['UNITED HEALTHCARE','UnitedHealthcare','87726'],
    ['OXFORD','Oxford','06111'],['AETNA','Aetna','60054'],['CIGNA','Cigna','62308'],
    ['ANTHEM','Anthem BCBS','803'],['BLUE CROSS','Anthem BCBS','803'],
    ['TRICARE','TRICARE','99727'],['MEDICARE','Medicare','CMS'],
    ['AARP','AARP Medicare Supplement','36273']
  ];
  for(var i=0;i<payers.length;i++){if(u.indexOf(payers[i][0])!==-1){carrier=payers[i][1];payerId=payers[i][2];break;}}
  var member='';
  var m=t.match(/(?:MEDICARE\s+(?:NUMBER|NO)|MEMBER\s*(?:ID|NUMBER|NO|#)?|SUBSCRIBER\s*(?:ID|NUMBER|NO|#)?|IDENTIFICATION\s*(?:ID|NUMBER|NO|#)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 -]{4,29})/i);
  if(m)member=fdg080Clean_(m[1]).toUpperCase().replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'').slice(0,30);
  if(!member){var mbi=u.replace(/[^A-Z0-9\n]/g,'').match(/(?:^|\n)([1-9][A-Z][A-Z0-9][0-9][A-Z][A-Z0-9][0-9][A-Z]{2}[0-9]{2})(?:$|\n)/);if(mbi)member=mbi[1];}
  var g=t.match(/(?:GROUP|GRP)\s*(?:ID|NUMBER|NO|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9 -]{2,24})/i);
  var groupId=g?fdg080Clean_(g[1]).toUpperCase().replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'').slice(0,25):'';
  // OCR suggests text only. The patient chooses the native Charm payer list entry.
  return {insuranceCarrier:carrier,payerId:'',memberId:member,groupId:groupId};
}



function fdg080SaveUploads_(
  source,
  uploads,
  existingRefs
) {
  var folder = fdg080UploadFolder_();
  var refs = existingRefs || {};

  uploads.forEach(function(u) {
    var kind =
      fdg080Clean_(u.kind).toLowerCase();

    if (
      kind !== 'insurance_front' &&
      kind !== 'insurance_back' &&
      kind !== 'secondary_insurance_front' &&
      kind !== 'photo_id'
    ) {
      throw new Error(
        'Unsupported upload type.'
      );
    }

    var mime =
      fdg080Clean_(u.mime).toLowerCase();

    var allowed = {
      'image/jpeg': true,
      'image/png': true,
      'application/pdf': true
    };

    if (!allowed[mime]) {
      throw new Error(
        'Files must be JPG, PNG, or PDF.'
      );
    }

    var b64 = String(u.base64 || '')
      .replace(/^data:[^;]+;base64,/, '')
      .replace(/\s/g, '');

    if (!b64) {
      throw new Error(
        'An uploaded file was empty.'
      );
    }

    var bytes = Utilities.base64Decode(b64);

    if (bytes.length > FDG080.MAX_FILE_BYTES) {
      throw new Error(
        'Each uploaded file must be 4 MB or smaller.'
      );
    }

    var ext =
      mime === 'image/jpeg'
        ? '.jpg'
        : mime === 'image/png'
          ? '.png'
          : '.pdf';

    // Keep PHI out of Drive filenames.
    var frontDoorId =
      fdg080Clean_(source['Front Door ID'])
        .replace(/[^A-Za-z0-9:_-]/g, '');

    var name =
      frontDoorId +
      '_' +
      kind +
      '_' +
      Utilities.formatDate(
        new Date(),
        FDG080.TIMEZONE,
        'yyyyMMdd_HHmmss'
      ) +
      ext;

    var blob =
      Utilities.newBlob(bytes, mime, name);

    var file =
      folder.createFile(blob);

    refs[kind] = {
      fileId: file.getId(),
      mime: mime,
      savedAt: new Date().toISOString()
    };
  });

  return refs;
}



/* ============================================================
 * WEBSITE BOOKING ADAPTER — v0.8.2
 * ============================================================ */

/**
 * Creates one WEBSITE source record and a private source-calendar hold.
 *
 * IMPORTANT:
 * - The public gateway creates only a private source-calendar hold.
 * - Private OS2 independently creates and verifies the Charm appointment.
 * - Source Booking ID makes retries idempotent.
 * - Form-age, honeypot, global, and identity throttles limit automated abuse.
 */
function fdg273CreateWebsiteBookingInternal_(body) {
  body = body || {};

  var formStartedAt = Number(body.formStartedAt || 0);
  var formAge = Date.now() - formStartedAt;
  if (fdg080Clean_(body.website || '')) {
    throw new Error('The appointment could not be submitted.');
  }
  var requireFormAge = String(
    PropertiesService.getScriptProperties()
      .getProperty(FDG080.WEBSITE_FORM_AGE_REQUIRED_FLAG) || ''
  ).toUpperCase() === 'TRUE';
  if (
    (formStartedAt && (
      formAge < FDG080.MIN_WEBSITE_FORM_AGE_MS ||
      formAge > FDG080.MAX_WEBSITE_FORM_AGE_MS
    )) ||
    (!formStartedAt && requireFormAge)
  ) {
    throw new Error('Please refresh the booking page and try again.');
  }

  var sourceBookingId = fdg080Clean_(body.websiteBookingId);
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(sourceBookingId)) {
    throw new Error('Website booking identity is invalid.');
  }

  var b = fdg080SanitizeData_(body.booking || {});
  var patientTypeRaw = fdg080Clean_(b.patientType).toLowerCase();
  var requestedVisitMode = fdg161RequestedVisitMode_(b.visitMode);

  if (patientTypeRaw !== 'new' && patientTypeRaw !== 'returning') {
    throw new Error('Website patient type is invalid.');
  }
  if (!requestedVisitMode) {
    throw new Error('Please choose an in-person or virtual visit.');
  }

  var verifiedFollowUp = null;
  if (patientTypeRaw === 'returning' && fdg160WebsiteVerificationEnabled_()) {
    verifiedFollowUp = fdg160RequireFollowUpSession_(b.verificationSession || '');
    // One email link represents one booking, even across reopened/concurrent tabs.
    // Use the private router's identity, never a replacement supplied by the browser.
    if (verifiedFollowUp.websiteBookingId) sourceBookingId = verifiedFollowUp.websiteBookingId;
    // Use only the established Charm demographics returned server-to-server.
    b.firstName = verifiedFollowUp.firstName;
    b.lastName = verifiedFollowUp.lastName;
    b.dob = verifiedFollowUp.dob;
    b.phone = verifiedFollowUp.phone;
    b.email = verifiedFollowUp.email;
  }

  var firstName = fdg080Clean_(b.firstName);
  var lastName = fdg080Clean_(b.lastName);
  var phone = fdg080Clean_(b.phone);
  var email = fdg080Clean_(b.email);
  var slotIso = fdg080Clean_(b.slotIso);

  if (!firstName || !lastName) {
    throw new Error('Website booking is missing the patient name.');
  }
  if (fdg080Digits_(phone).length < 10) {
    throw new Error('Website booking phone number is invalid.');
  }
  if (!fdg080EmailOk_(email)) {
    throw new Error('Website booking email address is invalid.');
  }

  var start = new Date(slotIso);
  if (isNaN(start.getTime())) {
    throw new Error('Website appointment time is invalid.');
  }

  var policy = fdg111SchedulingPolicy_();
  var durationMinutes = patientTypeRaw === 'new'
    ? policy.newDurationMinutes
    : policy.returningDurationMinutes;
  var end = new Date(start.getTime() + durationMinutes * 60000);

  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var sh = ss.getSheetByName(FDG080.SOURCE_TAB);
  if (!sh || sh.getLastRow() < 1) {
    throw new Error('Front Door source is unavailable.');
  }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn())
    .getValues()[0]
    .map(function(x) { return String(x || '').trim(); });

  [
    'Front Door ID','Booking Source','Source Booking ID','Source Calendar ID',
    'Source Calendar Event ID','Appointment Start','Appointment End','Patient Type',
    'First Name','Last Name','Phone','Email','Front Door Status','Patient Token'
  ].forEach(function(required) {
    if (headers.indexOf(required) < 0) {
      throw new Error('Front Door source column missing: ' + required);
    }
  });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var existing = fdg082FindWebsiteSource_(sh, headers, sourceBookingId);
    if (existing) {
      return {
        success: true,
        created: false,
        idempotent: true,
        token: existing.token,
        frontDoorId: existing.frontDoorId,
        sourceBookingId: sourceBookingId,
        frontDoorPath: '/frontdoor.html?t=' + existing.token
      };
    }

    fdg163RequireWebsiteBookingRateLimit_(
      sh,
      headers,
      firstName,
      lastName,
      email
    );

    // Validate against the exact same OS2-controlled rules that generated the
    // public slot list. No legacy Booking Backend call remains.
    var slotCheck = fdg111RequireWebsiteSlotAvailable_(
      start,
      patientTypeRaw,
      policy,
      requestedVisitMode
    );

    var calendar = fdg083WebsiteCalendar_();

    // Independent last-second conflict check protects against another booking
    // landing after the availability calculation but before the hold is made.
    var conflicts = calendar.getEvents(start, end).filter(function(ev) {
      if (ev.isAllDayEvent()) return false;
      return ev.getStartTime() < end && ev.getEndTime() > start;
    });
    if (conflicts.length) {
      throw new Error('That appointment time was just taken. Please choose another available time.');
    }

    var now = new Date();
    var token = fdg082NewPatientToken_();
    var frontDoorId = 'FD:' + Utilities.getUuid();
    var event = null;
    var visitMode = slotCheck.visitMode === 'VIRTUAL' ? 'VIRTUAL' : 'IN PERSON';

    try {
      // No guests are added and no email is sent. This event is only a source
      // hold until the private OS2 flow creates/verifies the Charm appointment.
      var title = 'Website - ' +
        (patientTypeRaw === 'new' ? 'New: ' : 'Follow up: ') +
        firstName + ' ' + lastName;

      var description = [
        'Lexington Podiatry Website Booking',
        'Front Door ID: ' + frontDoorId,
        'Source Booking ID: ' + sourceBookingId,
        'Patient Type: ' + (patientTypeRaw === 'new' ? 'New' : 'Returning'),
        'Visit Mode: ' + (visitMode === 'VIRTUAL' ? 'Virtual' : 'In Person'),
        'Patient: ' + firstName + ' ' + lastName,
        'Phone: ' + phone,
        'Email: ' + email,
        'Reason: ' + fdg080Clean_(b.reason),
        'Front Door status: Registration required; Charm appointment processing begins immediately.'
      ].join('\n');

      event = calendar.createEvent(title, start, end, {
        description: description
      });

      var rowObj = {
        'Front Door ID': frontDoorId,
        'Created At': now,
        'Updated At': now,
        'Booking Source': 'WEBSITE',
        'Source Booking ID': sourceBookingId,
        'Source Calendar ID': FDG080.WEBSITE_CALENDAR_ID,
        'Source Calendar Event ID': event.getId(),
        'Zocdoc ID': '',
        'Appointment Start': start,
        'Appointment End': end,
        'Patient Type': patientTypeRaw === 'new' ? 'NEW' : 'RETURNING',
        'Visit Reason': fdg080Clean_(b.reason),
        'First Name': firstName,
        'Last Name': lastName,
        'DOB': fdg080DateOnly_(b.dob),
        'Sex': '',
        'Phone': phone,
        'Email': email,
        'Insurance Carrier': fdg080Clean_(b.insurer),
        'Insurance Plan': '',
        'Member ID': fdg080Clean_(b.insId),
        'Group ID': '',
        'Charm Match Status': verifiedFollowUp ? 'MATCHED — WEBSITE DETAILS' : 'NOT CHECKED',
        'Charm Patient ID': verifiedFollowUp ? fdg080Clean_(verifiedFollowUp.patientId) : '',
        'Charm Record ID': verifiedFollowUp ? fdg080Clean_(verifiedFollowUp.recordId) : '',
        'Charm Appointment ID': '',
        'Calendar Archive Status': 'SOURCE EVENT ACTIVE',
        'Eligibility Status': 'NOT CHECKED',
        'Eligibility Checked At': '',
        'Network Status': 'NOT CHECKED',
        'Missing Information Status': 'NOT ASSESSED',
        'Paperwork Status': 'NOT STARTED',
        'Estimate Status': 'NOT STARTED',
        'Estimate Amount': '',
        'Estimate Confidence': '',
        'Front Door Status': 'RECEIVED',
        'Patient Token': token,
        'Token Created At': now,
        'Last Error': '',
        'Raw Source JSON': JSON.stringify({
          source: 'WEBSITE',
          sourceBookingId: sourceBookingId,
          calendarEventCreatedByGateway: true,
          legacyBookingEmailSuppressed: true,
          schedulingSource: 'OS2',
          schedulingVersion: FDG080.VERSION,
          slotIso: slotIso,
          slotLabel: fdg080Clean_(b.slotLabel),
          visitType: visitMode,
          visitMode: visitMode,
          patientType: patientTypeRaw,
          durationMinutes: durationMinutes,
          firstName: firstName,
          lastName: lastName,
          dob: fdg080DateOnly_(b.dob),
          phone: phone,
          email: email,
          insurer: fdg080Clean_(b.insurer),
          payerId: fdg095PayerId_(b.payerId),
          memberId: fdg080Clean_(b.insId),
          reason: fdg080Clean_(b.reason),
          notes: fdg080Clean_(b.notes)
          ,patientRouting: verifiedFollowUp ? {
            VERSION: 'v0.26.9',
            patientDecision: 'MATCHED',
            resolutionMethod: 'WEBSITE_DETAILS',
            verificationPassed: true
          } : null
        })
      };

      var row = headers.map(function(h) {
        return Object.prototype.hasOwnProperty.call(rowObj, h) ? rowObj[h] : '';
      });
      sh.appendRow(row);

      return {
        success: true,
        created: true,
        idempotent: false,
        token: token,
        frontDoorId: frontDoorId,
        sourceBookingId: sourceBookingId,
        sourceCalendarEventId: event.getId(),
        visitMode: visitMode,
        durationMinutes: durationMinutes,
        frontDoorPath: '/frontdoor.html?t=' + token
      };

    } catch (innerErr) {
      if (event) {
        try { event.deleteEvent(); } catch (ignore) {}
      }
      throw innerErr;
    }

  } finally {
    lock.releaseLock();
  }
}


function fdg082FindWebsiteSource_(sh, headers, sourceBookingId) {
  if (sh.getLastRow() < 2) return null;

  var sourceCol = headers.indexOf('Booking Source');
  var idCol = headers.indexOf('Source Booking ID');
  var tokenCol = headers.indexOf('Patient Token');
  var frontDoorCol = headers.indexOf('Front Door ID');

  if (
    sourceCol < 0 ||
    idCol < 0 ||
    tokenCol < 0 ||
    frontDoorCol < 0
  ) {
    return null;
  }

  var rows = sh.getRange(
    2,
    1,
    sh.getLastRow() - 1,
    sh.getLastColumn()
  ).getValues();

  for (var i = 0; i < rows.length; i++) {
    if (
      fdg080Clean_(rows[i][sourceCol]).toUpperCase() === 'WEBSITE' &&
      fdg080Clean_(rows[i][idCol]) === sourceBookingId
    ) {
      var token = fdg080Clean_(rows[i][tokenCol]);

      if (!/^[a-f0-9]{64}$/i.test(token)) {
        throw new Error(
          'Existing website Front Door record has an invalid token.'
        );
      }

      return {
        token: token,
        frontDoorId: fdg080Clean_(rows[i][frontDoorCol])
      };
    }
  }

  return null;
}


/**
 * Limits rapid public bookings without storing any new patient data. The
 * Front Door source already contains the fields used for these counts.
 * This runs under the same script lock as idempotency and slot creation.
 */
function fdg163RequireWebsiteBookingRateLimit_(sh, headers, firstName, lastName, email) {
  if (sh.getLastRow() < 2) return;

  var sourceCol = headers.indexOf('Booking Source');
  var createdCol = headers.indexOf('Created At');
  var firstCol = headers.indexOf('First Name');
  var lastCol = headers.indexOf('Last Name');
  var emailCol = headers.indexOf('Email');
  if ([sourceCol, createdCol, firstCol, lastCol, emailCol].some(function(i) { return i < 0; })) {
    throw new Error('Website booking security columns are unavailable.');
  }

  var cutoff = Date.now() - 60 * 60 * 1000;
  var identity = fdg163BookingIdentity_(firstName, lastName, email);
  var globalCount = 0;
  var identityCount = 0;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  rows.forEach(function(row) {
    if (fdg080Clean_(row[sourceCol]).toUpperCase() !== 'WEBSITE') return;
    var created = row[createdCol] instanceof Date
      ? row[createdCol]
      : new Date(row[createdCol]);
    if (!created || isNaN(created.getTime()) || created.getTime() < cutoff) return;
    globalCount++;
    if (fdg163BookingIdentity_(row[firstCol], row[lastCol], row[emailCol]) === identity) {
      identityCount++;
    }
  });

  if (globalCount >= FDG080.MAX_WEBSITE_BOOKINGS_PER_HOUR) {
    throw new Error('Online booking is temporarily busy. Please call the office for help.');
  }
  if (identityCount >= FDG080.MAX_WEBSITE_BOOKINGS_PER_IDENTITY_HOUR) {
    throw new Error('Please call the office if you need to schedule another appointment.');
  }
}


function fdg163BookingIdentity_(firstName, lastName, email) {
  return [firstName, lastName]
    .map(function(v) {
      return fdg080Clean_(v).toUpperCase().replace(/[^A-Z]/g, '');
    })
    .join('|') + '|' + fdg080Clean_(email).toLowerCase();
}


/** READ ONLY. Verifies the public booking security configuration. */
function testWebsiteBookingSecurity_v0163_() {
  var a = fdg163BookingIdentity_(' Test ', 'Patient', 'TEST@example.com');
  var b = fdg163BookingIdentity_('test', 'patient', 'test@example.com');
  if (a !== b || !a) throw new Error('Website booking identity normalization failed.');
  if (FDG080.MIN_WEBSITE_FORM_AGE_MS < 1000) throw new Error('Minimum form age is too low.');
  if (FDG080.MAX_WEBSITE_BOOKINGS_PER_HOUR < 1) throw new Error('Global booking limit is invalid.');
  if (FDG080.MAX_WEBSITE_BOOKINGS_PER_IDENTITY_HOUR < 1) throw new Error('Identity booking limit is invalid.');
  return {
    ok: true,
    readOnly: true,
    version: FDG080.VERSION,
    minFormAgeMs: FDG080.MIN_WEBSITE_FORM_AGE_MS,
    maxFormAgeMs: FDG080.MAX_WEBSITE_FORM_AGE_MS,
    formAgeRequired: String(
      PropertiesService.getScriptProperties()
        .getProperty(FDG080.WEBSITE_FORM_AGE_REQUIRED_FLAG) || ''
    ).toUpperCase() === 'TRUE',
    maxBookingsPerHour: FDG080.MAX_WEBSITE_BOOKINGS_PER_HOUR,
    maxBookingsPerIdentityHour: FDG080.MAX_WEBSITE_BOOKINGS_PER_IDENTITY_HOUR
  };
}


function fdg082NewPatientToken_() {
  return (
    Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '')
  ).toLowerCase();
}



/* ============================================================
 * v0.8.3 WEBSITE SLOT / CALENDAR + PHARMACY + AGREEMENT HELPERS
 * ============================================================ */

function fdg083WebsiteCalendar_() {
  if (FDG080.WEBSITE_CALENDAR_ID === 'primary') {
    return CalendarApp.getDefaultCalendar();
  }
  return CalendarApp.getCalendarById(FDG080.WEBSITE_CALENDAR_ID);
}

function fdg083RequireWebsiteSlotAvailable_(wantedStart, durationMinutes) {
  // Retained only so older internal references fail safely during the cutover.
  // Public website bookings now validate by patient type through
  // fdg111RequireWebsiteSlotAvailable_().
  var policy = fdg111SchedulingPolicy_();
  var patientType = Number(durationMinutes) === Number(policy.returningDurationMinutes)
    ? 'returning'
    : 'new';
  return fdg111RequireWebsiteSlotAvailable_(wantedStart, patientType, policy);
}


function fdg083PublicAgreement_() {
  return {
    version: FDG083_AGREEMENT.VERSION,
    title: FDG083_AGREEMENT.TITLE,
    sections: FDG083_AGREEMENT.SECTIONS.map(function(s) {
      return { title: s.title, paragraphs: s.paragraphs.slice() };
    })
  };
}

function fdg083AgreementText_() {
  var parts = [FDG083_AGREEMENT.TITLE, 'Version: ' + FDG083_AGREEMENT.VERSION];
  FDG083_AGREEMENT.SECTIONS.forEach(function(s) {
    parts.push(s.title);
    s.paragraphs.forEach(function(p) { parts.push(p); });
  });
  return parts.join('\n\n');
}

function fdg083Sha256_(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function fdg083AgreementFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(FDG080.AGREEMENT_FOLDER_PROPERTY);
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (ignore) {}
  }
  var folder = DriveApp.createFolder(FDG080.AGREEMENT_FOLDER_NAME);
  props.setProperty(FDG080.AGREEMENT_FOLDER_PROPERTY, folder.getId());
  return folder;
}

function fdg083CreateAgreementPdf_(source, d, acceptedAt) {
  var sha = fdg083Sha256_(fdg083AgreementText_());
  var frontDoorId = fdg080Clean_(source['Front Door ID']).replace(/[^A-Za-z0-9:_-]/g, '');
  var doc = DocumentApp.create('Front Door Agreement ' + frontDoorId);
  var body = doc.getBody();

  body.appendParagraph(FDG083_AGREEMENT.TITLE)
    .setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Agreement version: ' + FDG083_AGREEMENT.VERSION);
  body.appendParagraph('Agreement SHA-256: ' + sha);

  body.appendParagraph('Patient and appointment')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Patient: ' + fdg080Clean_(d.firstName) + ' ' + fdg080Clean_(d.lastName));
  body.appendParagraph('Date of birth: ' + fdg080Clean_(d.dob));
  body.appendParagraph('Appointment: ' + fdg080DisplayDate_(source['Appointment Start']));
  body.appendParagraph('Practice: WAF Podiatry P.C. (Lexington Podiatry)');
  body.appendParagraph('Treating podiatrist: Dr. Wiqar Farooqi');

  FDG083_AGREEMENT.SECTIONS.forEach(function(s) {
    body.appendParagraph(s.title)
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
    s.paragraphs.forEach(function(p) { body.appendParagraph(p); });
  });

  body.appendParagraph('Recorded selections')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Consent to treatment: ACCEPTED');
  body.appendParagraph('Telemedicine authorization: ' + (d.telemedicineConsent ? 'AUTHORIZED' : 'DECLINED'));
  body.appendParagraph(
    'Electronic medication-history retrieval: ' +
    (d.medicationHistoryConsent ? 'AUTHORIZED' : 'DECLINED')
  );
  body.appendParagraph('Payment choice: ' + (fdg112PaymentChoice_(d, source) === 'SELF_PAY' ? 'SELF-PAY' : 'USE INSURANCE'));
  body.appendParagraph('Insurance billing / assignment of benefits: ' + (fdg112PaymentChoice_(d, source) === 'SELF_PAY' ? 'NOT APPLICABLE — SELF-PAY' : d.billingAuthorizationAccepted===true?'ACCEPTED':'NOT ACCEPTED'));
  body.appendParagraph('Financial responsibility: ACCEPTED');

  body.appendParagraph('$50 no-show policy after confirmation: ACCEPTED');
  body.appendParagraph('Privacy acknowledgment: ACCEPTED');
  
  body.appendParagraph('Electronic signature')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph('Electronic signature: ' + fdg080Clean_(d.signatureName));
  body.appendParagraph('Signature method: '+(d.signatureType==='drawn'?'Drawn signature':'Adopted typed name'));
  if(d.signatureImage){var image=body.appendImage(Utilities.newBlob(Utilities.base64Decode(d.signatureImage),'image/png','signature.png'));image.setWidth(300).setHeight(100);}
  body.appendParagraph(
    'Date signed: ' + Utilities.formatDate(acceptedAt, FDG080.TIMEZONE, 'MMMM d, yyyy')
  );
  body.appendParagraph(
    'Signature timestamp: ' + Utilities.formatDate(acceptedAt, FDG080.TIMEZONE, 'yyyy-MM-dd HH:mm:ss z')
  );
  body.appendParagraph(
    'The signer submitted this agreement with the recorded selections and adopted the electronic signature above.'
  );

  doc.saveAndClose();

  var docFile = DriveApp.getFileById(doc.getId());
  var pdfName = frontDoorId + '_agreement_' + FDG083_AGREEMENT.VERSION.replace(/[^A-Za-z0-9._-]/g, '_') + '.pdf';
  var pdfBlob = docFile.getAs(MimeType.PDF).setName(pdfName);
  var pdfFile = fdg083AgreementFolder_().createFile(pdfBlob);
  docFile.setTrashed(true);

  return {
    fileId: pdfFile.getId(),
    version: FDG083_AGREEMENT.VERSION,
    sha256: sha,
    acceptedAtIso: acceptedAt.toISOString()
  };
}


/**
 * Free pharmacy finder using the CMS NPPES public NPI Registry API v2.1.
 * NPPES is useful for structured pharmacy name/address/phone selection, but it
 * is not a licensing/credentialing validation service. Manual entry remains
 * available when a pharmacy is not listed cleanly.
 */
function fdg083SearchPharmacies_(p) {
  // v0.8.4 UX: explicit Pharmacy Name + Town/ZIP.
  // NPPES organization_name searches legal names AND DBA/other organization
  // names. We deliberately do NOT constrain taxonomy_description in the query,
  // because chain pharmacies are frequently enumerated under a broader
  // Pharmacy taxonomy even when they also carry Community/Retail Pharmacy.
  var name = fdg080Clean_(p.name || p.q).slice(0, 80);
  var location = fdg080Clean_(p.location).slice(0, 80);
  var patientZip = fdg080Clean_(p.zip).replace(/[^0-9-]/g, '').slice(0, 10);
  var patientCity = fdg080Clean_(p.city).slice(0, 60);
  var patientState = fdg080Clean_(p.state).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);

  if (name && name.length < 2) throw new Error('Enter at least two letters of the pharmacy name.');

  var zip = '';
  var city = '';
  var state = patientState || 'NY';

  var zipHit = location.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipHit) {
    zip = zipHit[1];
  } else if (location) {
    // Accept "Brooklyn", "Brooklyn NY", "New York, NY", etc.
    var loc = location.replace(/\s+/g, ' ').trim();
    var stateHit = loc.match(/(?:,|\s)\s*([A-Za-z]{2})$/);
    if (stateHit) {
      state = stateHit[1].toUpperCase();
      loc = loc.slice(0, stateHit.index).replace(/,\s*$/, '').trim();
    }
    city = loc;
  } else if (patientZip) {
    zip = patientZip.slice(0, 5);
  } else {
    city = patientCity;
  }

  if (!zip && !city) {
    throw new Error('Enter a town or ZIP code.');
  }

  var key = 'fdpharm084|' + [name.toLowerCase(), zip, city.toLowerCase(), state].join('|');
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached) {
    try { return JSON.parse(cached); } catch (ignore) {}
  }

  var params = {
    version: '2.1',
    enumeration_type: 'NPI-2',
    taxonomy_description: 'Pharmacy',
    address_purpose: 'PRIMARY',
    limit: '50'
  };

  if(name)params.organization_name=name.replace(/\*+$/g,'')+'*';
  if (zip) {
    params.postal_code = zip;
  } else {
    params.city = city + '*';
    if (state) params.state = state;
  }

  var query = Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');

  var response = UrlFetchApp.fetch(
    'https://npiregistry.cms.hhs.gov/api/?' + query,
    { method: 'get', muteHttpExceptions: true, followRedirects: true }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error('Pharmacy search is temporarily unavailable. Please try again shortly or ask the office for help.');
  }

  var body;
  try { body = JSON.parse(response.getContentText()); }
  catch (e) {
    throw new Error('Pharmacy search is temporarily unavailable. Please try again shortly or ask the office for help.');
  }

  var out = [];

  (body.results || []).forEach(function(r) {
    var tax = r.taxonomies || [];
    var isPharmacy = tax.some(function(t) {
      var code = fdg080Clean_(t.code).toUpperCase();
      var desc = fdg080Clean_(t.desc).toLowerCase();
      return code.indexOf('3336') === 0 || desc.indexOf('pharmacy') > -1;
    });
    if (!isPharmacy) return;

    var basic = r.basic || {};
    var legal = fdg080Clean_(basic.organization_name);
    var display = legal;

    // Prefer DBA / other organization name when it better resembles what the
    // patient typed ("Duane Reade", "CVS", etc.).
    var wanted = name.toLowerCase();
    var otherNames = r.other_names || [];
    otherNames.some(function(on) {
      var candidate = fdg080Clean_(on.organization_name);
      if (!candidate) return false;
      if (candidate.toLowerCase().indexOf(wanted.replace(/\*+$/g, '')) > -1) {
        display = candidate;
        return true;
      }
      return false;
    });

    if (!display) return;

    var addresses = r.addresses || [];
    var a = null;
    for (var i = 0; i < addresses.length; i++) {
      if (fdg080Clean_(addresses[i].address_purpose).toUpperCase() === 'LOCATION') {
        a = addresses[i];
        break;
      }
    }
    if (!a && addresses.length) a = addresses[0];
    a = a || {};

    var addr = [
      fdg080Clean_(a.address_1),
      fdg080Clean_(a.address_2),
      [
        fdg080Clean_(a.city),
        fdg080Clean_(a.state),
        fdg080Clean_(a.postal_code).slice(0, 5)
      ].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ');

    out.push({
      npi: fdg080Clean_(r.number),
      name: display,
      legalName: legal,
      address: addr,
      city: fdg080Clean_(a.city),
      state: fdg080Clean_(a.state),
      zip: fdg080Clean_(a.postal_code).slice(0, 5),
      phone: fdg080Clean_(a.telephone_number)
    });
  });

  // De-dupe and cap patient-facing choices.
  var seen = {};
  out = out.filter(function(x) {
    var k = [x.npi, x.address].join('|');
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  }).slice(0, 12);

  var result = { success: true, results: out };
  try { cache.put(key, JSON.stringify(result), 900); } catch (ignore2) {}
  return result;
}



/* ============================================================
 * FRONT DOOR ELIGIBILITY QUEUE — v0.9.0
 * ============================================================ */

function fdg090QueueEligibilityRequest_(body) {
  // Owner decision 2026-10-22: Front Door collects insurance for Charm, not STEDI.
  // Stale pages must not recreate paid work after the simplified UI is released.
  body = body || {};
  var token = fdg080ValidateToken_(body.token || '');
  fdg080FindSourceByToken_(token);
  return {success:true, status:'NOT REQUESTED', disabled:true,
    message:'Insurance information is saved separately. Coverage checks are not part of registration.'};
}


function fdg090PublicEligibilityStatus_(token, readContext) {
  var sh = fdg236ReadSheet_(readContext, FDG080.ELIGIBILITY_TAB);

  var out;

  if (!sh || sh.getLastRow() < 2) {
    out = {
      success: true,
      status: 'NOT REQUESTED',
      coverageStatus: '',
      planName: '',
      groupNumber: '',
      planNumber: '',
      payerDisplay: '',
      needsSubscriberDetails: false,
      message: '',
      checkedAt: ''
    };
  } else {
    fdg090VerifyEligibilitySchema_(sh);
    var H = fdg080HeaderMap_(sh);
    var row = fdg090EligibilityRowByToken_(sh, H, token);

    out = row
      ? fdg090EligibilityResponseFromRow_(row.values, H)
      : {
          success: true,
          status: 'NOT REQUESTED',
          coverageStatus: '',
          planName: '',
          groupNumber: '',
          planNumber: '',
          payerDisplay: '',
          needsSubscriberDetails: false,
          message: '',
          checkedAt: ''
        };
  }

  out.estimate = fdg100PublicEstimateStatus_(token, readContext);
  return out;
}


function fdg090EligibilityResponseFromRow_(values, H) {
  return {
    success: true,
    status:
      fdg080Clean_(values[H['Status'] - 1]) ||
      'NOT REQUESTED',
    coverageStatus:
      fdg080Clean_(values[H['Coverage Status'] - 1]),
    planName:
      fdg080Clean_(values[H['Plan Name'] - 1]),
    groupNumber:
      fdg080Clean_(values[H['Group Number'] - 1]),
    planNumber:
      fdg080Clean_(values[H['Plan Number'] - 1]),
    payerDisplay:
      fdg080Clean_(values[H['Payer Display'] - 1]),
    needsSubscriberDetails:
      fdg080Clean_(
        values[H['Needs Subscriber Details'] - 1]
      ).toUpperCase() === 'YES',
    message:
      fdg080Clean_(values[H['Message'] - 1]),
    checkedAt:
      fdg080DateIso_(values[H['Checked At'] - 1])
  };
}


function fdg090EligibilityRowByToken_(sh, H, token) {
  if (sh.getLastRow() < 2) return null;

  var rows = sh
    .getRange(
      2,
      1,
      sh.getLastRow() - 1,
      sh.getLastColumn()
    )
    .getValues();

  for (var i = 0; i < rows.length; i++) {
    if (
      fdg080Clean_(
        rows[i][H['Patient Token'] - 1]
      ) === token
    ) {
      return {
        row: i + 2,
        values: rows[i]
      };
    }
  }

  return null;
}


function fdg090VerifyEligibilitySchema_(sh) {
  var current = sh
    .getRange(
      1,
      1,
      1,
      FDG080.ELIGIBILITY_HEADERS.length
    )
    .getValues()[0]
    .map(function(x) {
      return String(x || '').trim();
    });

  for (
    var i = 0;
    i < FDG080.ELIGIBILITY_HEADERS.length;
    i++
  ) {
    if (
      current[i] !== FDG080.ELIGIBILITY_HEADERS[i]
    ) {
      throw new Error(
        'Front Door Eligibility schema differs from v0.9.0. Nothing was overwritten.'
      );
    }
  }
}


function fdg090Sha256_(text) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}





/* ============================================================
 * SELF-PAY / CASH PRICE — v0.11.2
 * Public-safe read + deterministic estimate writer.
 * ============================================================ */

function fdg112PaymentChoice_(d, source) {
  var explicit = fdg080Clean_(d && d.paymentChoice).toUpperCase();
  if (explicit === 'SELF_PAY' || explicit === 'INSURANCE') return explicit;
  var carrier = fdg080Clean_(
    (d && d.insuranceCarrier) || (source && source['Insurance Carrier']) || ''
  ).toUpperCase();
  return /SELF.?PAY|NO INSURANCE/.test(carrier) ? 'SELF_PAY' : 'INSURANCE';
}

function fdg112CashCodeForSource_(source) {
  var t = fdg080Clean_(source && source['Patient Type']).toUpperCase();
  return (t === 'RETURNING' || t === 'FOLLOW UP' || t === 'FOLLOW-UP' || t === 'FOLLOWUP')
    ? 'FOLLOW_UP'
    : 'NEW_PATIENT';
}

function fdg112PublicCashPrice_(source, readContext) {
  var code = fdg112CashCodeForSource_(source);
  var sh = fdg236ReadSheet_(readContext, FDG080.CASH_PRICES_TAB);
  if (!sh || sh.getLastRow() < 2) {
    return { success:true, status:'NOT CONFIGURED', code:code, amount:'', currency:'USD', label:'', note:'' };
  }

  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(fdg080Clean_);
  var H = {};
  headers.forEach(function(h,i){ if(h) H[h]=i; });
  ['Code','Patient-facing label','Amount','Active','Patient-facing note'].forEach(function(h){
    if (H[h] == null) throw new Error('Cash Prices tab schema is incomplete.');
  });

  var rows = sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
  for (var i=0;i<rows.length;i++) {
    if (fdg080Clean_(rows[i][H['Code']]).toUpperCase() !== code) continue;
    var active = rows[i][H['Active']] === true || ['TRUE','YES','1','ON'].indexOf(fdg080Clean_(rows[i][H['Active']]).toUpperCase()) > -1;
    var raw = rows[i][H['Amount']];
    var amount = raw === '' || raw == null ? '' : Number(raw);
    if (!active || amount === '' || !isFinite(amount)) {
      return { success:true, status:'NOT CONFIGURED', code:code, amount:'', currency:'USD', label:fdg080Clean_(rows[i][H['Patient-facing label']]), note:fdg080Clean_(rows[i][H['Patient-facing note']]) };
    }
    return {
      success:true,
      status:'READY',
      code:code,
      amount:Math.round(amount*100)/100,
      currency:'USD',
      label:fdg080Clean_(rows[i][H['Patient-facing label']]) || (code==='NEW_PATIENT'?'New patient visit':'Follow-up visit'),
      note:fdg080Clean_(rows[i][H['Patient-facing note']])
    };
  }
  return { success:true, status:'NOT CONFIGURED', code:code, amount:'', currency:'USD', label:'', note:'' };
}

function fdg112WriteSelfPayEstimate_(token, source) {
  var price = fdg112PublicCashPrice_(source);
  var now = new Date();
  var estimate = {
    status: price.status === 'READY' ? 'READY' : 'CASH PRICE NOT CONFIGURED',
    amount: price.status === 'READY' ? price.amount : '',
    currency: 'USD',
    confidence: price.status === 'READY' ? 'HIGH' : '',
    basis: 'SELF PAY CASH PRICE',
    serviceTypeCode: 'SELF_PAY',
    copay: '',
    coinsurancePercent: '',
    deductibleExplicit: false,
    message: price.status === 'READY'
      ? (price.note || 'This is the cash price for the scheduled visit. Additional services are separate.')
      : 'A firm cash price has not been configured for this visit type yet.',
    checkedAt: now,
    traceId: ''
  };
  fdg112UpsertEstimate_(token, fdg080Clean_(source['Front Door ID']), estimate, now);
  return estimate;
}

function fdg112ClearStaleSelfPayEstimate_(token, source) {
  var current = fdg100PublicEstimateStatus_(token);
  if (fdg080Clean_(current.basis).toUpperCase() !== 'SELF PAY CASH PRICE') return;
  var now = new Date();
  fdg112UpsertEstimate_(token, fdg080Clean_(source['Front Door ID']), {
    status:'NOT AVAILABLE', amount:'', currency:'USD', confidence:'', basis:'', serviceTypeCode:'', copay:'', coinsurancePercent:'', deductibleExplicit:false,
    message:'Insurance benefit verification is pending.', checkedAt:'', traceId:''
  }, now);
}

function fdg112UpsertEstimate_(token, frontDoorId, estimate, now) {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var sh = ss.getSheetByName(FDG080.ESTIMATE_TAB);
  if (!sh) {
    sh = ss.insertSheet(FDG080.ESTIMATE_TAB);
    sh.getRange(1,1,1,FDG080.ESTIMATE_HEADERS.length).setValues([FDG080.ESTIMATE_HEADERS]);
  }
  fdg100VerifyEstimateSchema_(sh);
  var H = fdg080HeaderMap_(sh);
  var row = 0;
  if (sh.getLastRow() >= 2) {
    var vals = sh.getRange(2,H['Patient Token'],sh.getLastRow()-1,1).getValues();
    for (var i=vals.length-1;i>=0;i--) {
      if (fdg080Clean_(vals[i][0]) === token) { row=i+2; break; }
    }
  }
  var createdAt = now;
  if (row) createdAt = sh.getRange(row,H['Created At']).getValue() || now;
  else row = sh.getLastRow()+1;
  var obj = {
    'Patient Token':token,'Front Door ID':frontDoorId,'Created At':createdAt,'Updated At':now,
    'Status':estimate.status,'Amount':estimate.amount,'Currency':estimate.currency||'USD','Confidence':estimate.confidence||'',
    'Basis':estimate.basis||'','Service Type Code':estimate.serviceTypeCode||'','Copay':estimate.copay,
    'Coinsurance Percent':estimate.coinsurancePercent,'Deductible Explicit':estimate.deductibleExplicit?'YES':'NO',
    'Message':estimate.message||'','Checked At':estimate.checkedAt||'','Stedi Trace ID':estimate.traceId||''
  };
  var values = FDG080.ESTIMATE_HEADERS.map(function(h){ return obj[h]; });
  sh.getRange(row,1,1,values.length).setValues([values]);
}

/* ============================================================
 * INITIAL VISIT ESTIMATE — v0.10.0
 * Public-safe read layer only. Private OS2 computes/writes results.
 * ============================================================ */

function fdg100PublicEstimateStatus_(token, readContext) {
  var sh = fdg236ReadSheet_(readContext, FDG080.ESTIMATE_TAB);

  if (!sh || sh.getLastRow() < 2) {
    return fdg100EmptyEstimate_();
  }

  fdg100VerifyEstimateSchema_(sh);
  var H = fdg080HeaderMap_(sh);

  var rows = sh
    .getRange(
      2,
      1,
      sh.getLastRow() - 1,
      sh.getLastColumn()
    )
    .getValues();

  for (var i = rows.length - 1; i >= 0; i--) {
    if (
      fdg080Clean_(
        rows[i][H['Patient Token'] - 1]
      ) !== token
    ) {
      continue;
    }

    return {
      success: true,
      status:
        fdg080Clean_(
          rows[i][H['Status'] - 1]
        ) || 'NOT AVAILABLE',

      amount:
        fdg100NumberOrBlank_(
          rows[i][H['Amount'] - 1]
        ),

      currency:
        fdg080Clean_(
          rows[i][H['Currency'] - 1]
        ) || 'USD',

      confidence:
        fdg080Clean_(
          rows[i][H['Confidence'] - 1]
        ),

      basis:
        fdg080Clean_(
          rows[i][H['Basis'] - 1]
        ),

      serviceTypeCode:
        fdg080Clean_(
          rows[i][H['Service Type Code'] - 1]
        ),

      copay:
        fdg100NumberOrBlank_(
          rows[i][H['Copay'] - 1]
        ),

      coinsurancePercent:
        fdg100NumberOrBlank_(
          rows[i][H['Coinsurance Percent'] - 1]
        ),

      deductibleExplicit:
        fdg080Clean_(
          rows[i][H['Deductible Explicit'] - 1]
        ).toUpperCase() === 'YES',

      message:
        fdg080Clean_(
          rows[i][H['Message'] - 1]
        ),

      checkedAt:
        fdg080DateIso_(
          rows[i][H['Checked At'] - 1]
        )
    };
  }

  return fdg100EmptyEstimate_();
}


function fdg100EmptyEstimate_() {
  return {
    success: true,
    status: 'NOT AVAILABLE',
    amount: '',
    currency: 'USD',
    confidence: '',
    basis: '',
    serviceTypeCode: '',
    copay: '',
    coinsurancePercent: '',
    deductibleExplicit: false,
    message: '',
    checkedAt: ''
  };
}


function fdg100NumberOrBlank_(v) {
  if (v === '' || v == null) return '';

  var n = Number(v);
  return isFinite(n) ? n : '';
}


function fdg100VerifyEstimateSchema_(sh) {
  var current = sh
    .getRange(
      1,
      1,
      1,
      FDG080.ESTIMATE_HEADERS.length
    )
    .getValues()[0]
    .map(function(x) {
      return String(x || '').trim();
    });

  for (
    var i = 0;
    i < FDG080.ESTIMATE_HEADERS.length;
    i++
  ) {
    if (
      current[i] !==
      FDG080.ESTIMATE_HEADERS[i]
    ) {
      throw new Error(
        'Front Door Estimate schema differs from v0.10.0. Nothing was overwritten.'
      );
    }
  }
}


/* ============================================================
 * INSURANCE DISCOVERY QUEUE — v0.9.6
 * ============================================================ */

function fdg096QueueDiscoveryRequest_(body) {
  // Owner decision 2026-10-22: Front Door collects insurance for Charm, not STEDI.
  // Stale pages must not recreate paid work after the simplified UI is released.
  body = body || {};
  var token = fdg080ValidateToken_(body.token || '');
  fdg080FindSourceByToken_(token);
  return {success:true, status:'NOT REQUESTED', disabled:true,
    message:'Insurance information is saved separately. Coverage checks are not part of registration.'};
}


function fdg096PublicDiscoveryStatus_(token, readContext) {
  var sh = fdg236ReadSheet_(readContext, FDG080.DISCOVERY_TAB);

  if (!sh || sh.getLastRow() < 2) {
    return fdg096EmptyDiscovery_();
  }

  fdg096VerifyDiscoverySchema_(sh);
  var H = fdg080HeaderMap_(sh);
  var row = fdg096DiscoveryRowByToken_(sh, H, token);

  if (!row) {
    return fdg096EmptyDiscovery_();
  }

  return fdg096DiscoveryResponseFromRow_(
    row.values,
    H
  );
}


function fdg096EmptyDiscovery_() {
  return {
    success: true,
    status: 'NOT REQUESTED',
    coveragesFound: 0,
    payerName: '',
    payerId: '',
    memberId: '',
    planName: '',
    groupNumber: '',
    planNumber: '',
    confidence: '',
    message: '',
    checkedAt: ''
  };
}


function fdg096DiscoveryResponseFromRow_(values, H) {
  return {
    success: true,
    status:
      fdg080Clean_(
        values[H['Status'] - 1]
      ) || 'NOT REQUESTED',

    coveragesFound:
      Number(
        values[H['Coverages Found'] - 1] || 0
      ),

    payerName:
      fdg080Clean_(
        values[H['Payer Name'] - 1]
      ),

    payerId:
      fdg080Clean_(
        values[H['Payer ID'] - 1]
      ),

    memberId:
      fdg080Clean_(
        values[H['Member ID'] - 1]
      ),

    planName:
      fdg080Clean_(
        values[H['Plan Name'] - 1]
      ),

    groupNumber:
      fdg080Clean_(
        values[H['Group Number'] - 1]
      ),

    planNumber:
      fdg080Clean_(
        values[H['Plan Number'] - 1]
      ),

    confidence:
      fdg080Clean_(
        values[H['Confidence'] - 1]
      ),

    message:
      fdg080Clean_(
        values[H['Message'] - 1]
      ),

    checkedAt:
      fdg080DateIso_(
        values[H['Checked At'] - 1]
      )
  };
}


function fdg096DiscoveryRowByToken_(sh, H, token) {
  if (sh.getLastRow() < 2) return null;

  var rows = sh
    .getRange(
      2,
      1,
      sh.getLastRow() - 1,
      sh.getLastColumn()
    )
    .getValues();

  for (var i = 0; i < rows.length; i++) {
    if (
      fdg080Clean_(
        rows[i][H['Patient Token'] - 1]
      ) === token
    ) {
      return {
        row: i + 2,
        values: rows[i]
      };
    }
  }

  return null;
}


function fdg096VerifyDiscoverySchema_(sh) {
  var current = sh
    .getRange(
      1,
      1,
      1,
      FDG080.DISCOVERY_HEADERS.length
    )
    .getValues()[0]
    .map(function(x) {
      return String(x || '').trim();
    });

  for (
    var i = 0;
    i < FDG080.DISCOVERY_HEADERS.length;
    i++
  ) {
    if (
      current[i] !==
      FDG080.DISCOVERY_HEADERS[i]
    ) {
      throw new Error(
        'Front Door Discovery schema differs from v0.9.6. Nothing was overwritten.'
      );
    }
  }
}


function fdg095PayerId_(v) {
  var s = String(v == null ? '' : v)
    .replace(/\s+/g, '')
    .trim()
    .toUpperCase()
    .slice(0, 80);

  if (!s) return '';

  if (!/^[A-Z0-9-]+$/.test(s)) {
    throw new Error('Payer ID contains invalid characters.');
  }

  return s;
}


function fdg095SourcePayerId_(source) {
  var raw = source && source['Raw Source JSON'];

  if (!raw) return '';

  try {
    var obj = JSON.parse(String(raw));
    return fdg095PayerId_(obj && obj.payerId);
  } catch (e) {
    return '';
  }
}


/* ============================================================
 * SANITIZATION / HELPERS
 * ============================================================ */

function fdg080SanitizeData_(input) {
  var maxDepth = 4;

  function walk(v, depth) {
    if (depth > maxDepth) return '';

    if (v == null) return '';

    if (typeof v === 'string') {
      return v
        .replace(/\u0000/g, '')
        .trim()
        .slice(0, 4000);
    }

    if (typeof v === 'number') {
      return isFinite(v) ? v : '';
    }

    if (typeof v === 'boolean') {
      return v;
    }

    if (Array.isArray(v)) {
      return v
        .slice(0, 60)
        .map(function(x) {
          return walk(x, depth + 1);
        });
    }

    if (typeof v === 'object') {
      var out = {};

      Object.keys(v)
        .slice(0, 100)
        .forEach(function(k) {
          var key =
            String(k || '')
              .replace(/[^\w.-]/g, '')
              .slice(0, 80);

          if (!key) return;

          if (
            key === '__proto__' ||
            key === 'prototype' ||
            key === 'constructor'
          ) {
            return;
          }

          out[key] =
            walk(v[k], depth + 1);
        });

      return out;
    }

    return '';
  }

  return walk(input, 0);
}


function fdg080ValidateToken_(value) {
  var token = fdg080Clean_(value);

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new Error(
      'This Front Door link is invalid or has expired.'
    );
  }

  return token;
}


function fdg080HeaderMap_(sh) {
  var headers =
    sh
      .getRange(
        1,
        1,
        1,
        sh.getLastColumn()
      )
      .getValues()[0];

  var H = {};

  headers.forEach(function(h, i) {
    var k = String(h || '').trim();
    if (k) H[k] = i + 1;
  });

  return H;
}


function fdg080Json_(obj) {
  return ContentService
    .createTextOutput(
      JSON.stringify(obj)
    )
    .setMimeType(
      ContentService.MimeType.JSON
    );
}


function fdg080PublicError_(err) {
  var msg = String(
    err && err.message
      ? err.message
      : err || 'Request failed.'
  );

  // Never expose a stack trace to the public page.
  return msg.slice(0, 300);
}


function fdg080Clean_(v) {
  return String(v == null ? '' : v)
    .replace(/\s+/g, ' ')
    .trim();
}


function fdg080Digits_(v) {
  return String(v || '')
    .replace(/\D/g, '');
}


function fdg080EmailOk_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(fdg080Clean_(v));
}


function fdg080DateIso_(v) {
  if (!v) return '';

  var d =
    v instanceof Date
      ? v
      : new Date(v);

  if (isNaN(d.getTime())) return '';

  return Utilities.formatDate(
    d,
    FDG080.TIMEZONE,
    "yyyy-MM-dd'T'HH:mm:ss"
  );
}


function fdg080DateOnly_(v) {
  if (!v) return '';

  if (v instanceof Date) {
    return Utilities.formatDate(
      v,
      FDG080.TIMEZONE,
      'yyyy-MM-dd'
    );
  }

  var s = fdg080Clean_(v);
  var iso =
    s.match(/^(\d{4}-\d{2}-\d{2})/);

  if (iso) return iso[1];

  var d = new Date(v);
  if (isNaN(d.getTime())) return s;

  return Utilities.formatDate(
    d,
    FDG080.TIMEZONE,
    'yyyy-MM-dd'
  );
}


function fdg080DisplayDate_(v) {
  if (!v) return '';

  var d =
    v instanceof Date
      ? v
      : new Date(v);

  if (isNaN(d.getTime())) return '';

  return Utilities.formatDate(
    d,
    FDG080.TIMEZONE,
    'EEEE, MMMM d, yyyy · h:mm a'
  );
}


function fdg080MoneyOrBlank_(v) {
  if (v === '' || v == null) return '';

  var n = Number(v);

  return isFinite(n)
    ? Math.round(n * 100) / 100
    : '';
}


/* ============================================================
 * OS2 SCHEDULING PUBLIC ADAPTER — v0.10.1
 * ============================================================
 * Source of truth: Scheduling Settings / Hours / Closures tabs in OS2.
 * No fake calendar events are created to shape availability.
 * ============================================================ */

function fdg111PublicBookingConfig_() {
  var p = fdg111SchedulingPolicy_();
  return {
    success: true,
    version: FDG080.VERSION,
    source: 'OS2',
    leadMinutes: p.leadMinutes,
    newDurationMinutes: p.newDurationMinutes,
    returningDurationMinutes: p.returningDurationMinutes,
    newDaysAhead: p.newDaysAhead,
    returningDaysAhead: p.returningDaysAhead,
    progressiveReturning: p.progressiveReturning,
    followUpVerification: fdg160WebsiteVerificationEnabled_() ? 'email_code' : 'legacy',
    activeBanners: fdg111ActiveBanners_(p)
  };
}


function fdg111PublicSlots_(patientTypeValue, visitModeValue) {
  var patientType = fdg111PatientType_(patientTypeValue);
  var requestedVisitMode = fdg161RequestedVisitMode_(visitModeValue);
  var p = fdg111SchedulingPolicy_();
  var cal = fdg083WebsiteCalendar_();
  var now = new Date();
  var daysAhead = patientType === 'new' ? p.newDaysAhead : p.returningDaysAhead;
  var slots = [];

  for (var d = 0; d < daysAhead; d++) {
    var date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + d,
      0, 0, 0, 0
    );

    var dayPolicy = p.hours[date.getDay()];
    if (!dayPolicy || !dayPolicy.enabled) continue;

    var dateIso = fdg111IsoDate_(date);
    if (fdg111DateBlocked_(dateIso, p)) continue;

    var openMin = fdg111ClockMinutes_(dayPolicy.open);
    var closeMin = fdg111ClockMinutes_(dayPolicy.close);
    if (openMin == null || closeMin == null || closeMin <= openMin) continue;

    var dayEvents = cal.getEventsForDay(date).filter(function(ev) {
      return !ev.isAllDayEvent();
    });

    for (var minuteOfDay = openMin; minuteOfDay < closeMin; minuteOfDay += 15) {
      var candidate = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        Math.floor(minuteOfDay / 60),
        minuteOfDay % 60,
        0, 0
      );

      var offered = fdg111IsOfferedSlot_(
        candidate,
        patientType,
        p,
        dayEvents,
        now,
        requestedVisitMode
      );
      if (!offered.ok) continue;

      var timeLabel = fdg111TimeLabel_(candidate);
      if (offered.visitMode === 'VIRTUAL') {
        timeLabel += ' (Virtual)';
      }

      slots.push({
        iso: candidate.toISOString(),
        dateLabel: fdg111DateLabel_(candidate),
        timeLabel: timeLabel,
        visitMode: offered.visitMode,
        durationMinutes: offered.durationMinutes
      });
    }
  }

  return {
    success: true,
    version: FDG080.VERSION,
    source: 'OS2',
    patientType: patientType,
    visitMode: requestedVisitMode,
    slots: slots,
    activeBanners: fdg111ActiveBanners_(p)
  };
}


function fdg111RequireWebsiteSlotAvailable_(wantedStart, patientTypeValue, policyOpt, visitModeValue) {
  var patientType = fdg111PatientType_(patientTypeValue);
  var requestedVisitMode = fdg161RequestedVisitMode_(visitModeValue);
  var p = policyOpt || fdg111SchedulingPolicy_();
  var cal = fdg083WebsiteCalendar_();
  var day = new Date(
    wantedStart.getFullYear(),
    wantedStart.getMonth(),
    wantedStart.getDate(),
    0, 0, 0, 0
  );
  var dayEvents = cal.getEventsForDay(day).filter(function(ev) {
    return !ev.isAllDayEvent();
  });

  var offered = fdg111IsOfferedSlot_(
    wantedStart,
    patientType,
    p,
    dayEvents,
    new Date(),
    requestedVisitMode
  );

  if (!offered.ok) {
    throw new Error('That appointment time is no longer available. Please choose another time.');
  }

  return offered;
}


function fdg111IsOfferedSlot_(start, patientType, p, dayEvents, now, visitModeValue) {
  var duration = patientType === 'new'
    ? p.newDurationMinutes
    : p.returningDurationMinutes;
  var daysAhead = patientType === 'new'
    ? p.newDaysAhead
    : p.returningDaysAhead;

  if (!(start instanceof Date) || isNaN(start.getTime())) return { ok: false };

  // Scheduling grid is fixed at 15 minutes.
  if (start.getSeconds() !== 0 || start.getMilliseconds() !== 0 || start.getMinutes() % 15 !== 0) {
    return { ok: false };
  }

  var leadCutoff = now.getTime() + p.leadMinutes * 60000;
  if (start.getTime() < leadCutoff) return { ok: false };

  var today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  var start0 = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
  var dayDiff = Math.round((start0.getTime() - today0.getTime()) / 86400000);
  if (dayDiff < 0 || dayDiff >= daysAhead) return { ok: false };

  var dayPolicy = p.hours[start.getDay()];
  if (!dayPolicy || !dayPolicy.enabled) return { ok: false };
  var requestedVisitMode = fdg161RequestedVisitMode_(visitModeValue);
  if (requestedVisitMode === 'IN_PERSON' && dayPolicy.mode === 'VIRTUAL') return { ok: false };

  var dateIso = fdg111IsoDate_(start);
  if (fdg111DateBlocked_(dateIso, p)) return { ok: false };

  var openMin = fdg111ClockMinutes_(dayPolicy.open);
  var closeMin = fdg111ClockMinutes_(dayPolicy.close);
  var startMin = start.getHours() * 60 + start.getMinutes();
  if (openMin == null || closeMin == null) return { ok: false };
  if (startMin < openMin || startMin + duration > closeMin) return { ok: false };

  // New-patient starts stay aligned to :00 / :30 to avoid creating orphan
  // 15-minute gaps in the public schedule.
  if (patientType === 'new' && start.getMinutes() % 30 !== 0) {
    return { ok: false };
  }

  var end = new Date(start.getTime() + duration * 60000);
  if (fdg111WindowBusy_(dayEvents, start, end)) return { ok: false };

  // Progressive follow-up release:
  // :00 and :30 are anchor slots. :15 and :45 remain hidden until both
  // anchors in that clock hour are occupied by real Calendar events/holds.
  if (patientType === 'returning' && p.progressiveReturning && start.getMinutes() % 30 !== 0) {
    var hourStart = new Date(
      start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), 0, 0, 0
    );
    var anchor0End = new Date(hourStart.getTime() + 15 * 60000);
    var anchor30 = new Date(hourStart.getTime() + 30 * 60000);
    var anchor30End = new Date(hourStart.getTime() + 45 * 60000);

    var bothAnchorsOccupied =
      fdg111WindowBusy_(dayEvents, hourStart, anchor0End) &&
      fdg111WindowBusy_(dayEvents, anchor30, anchor30End);

    if (!bothAnchorsOccupied) return { ok: false };
  }

  return {
    ok: true,
    visitMode: requestedVisitMode || (dayPolicy.mode === 'VIRTUAL' ? 'VIRTUAL' : 'IN_PERSON'),
    durationMinutes: duration
  };
}


function fdg161RequestedVisitMode_(value) {
  var mode = fdg080Clean_(value).toUpperCase().replace(/[ -]+/g, '_');
  if (mode === 'IN_PERSON' || mode === 'INPERSON') return 'IN_PERSON';
  if (mode === 'VIRTUAL' || mode === 'VIDEO' || mode === 'TELEMEDICINE' || mode === 'TELEHEALTH') return 'VIRTUAL';
  return '';
}


function fdg111VerifyReturningPatient_(firstValue, lastValue, last4Value) {
  var first = fdg080Clean_(firstValue).toLowerCase();
  var last = fdg080Clean_(lastValue).toLowerCase();
  var last4 = fdg080Digits_(last4Value).slice(-4);

  if (!first || !last || last4.length !== 4) {
    return { success: true, found: false };
  }

  var cal = fdg083WebsiteCalendar_();
  var searchStart = new Date();
  searchStart.setFullYear(searchStart.getFullYear() - 2);
  var searchEnd = new Date();
  var events = cal.getEvents(searchStart, searchEnd);

  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var title = String(ev.getTitle() || '').toLowerCase();
    var desc = String(ev.getDescription() || '').toLowerCase();

    var nameMatch =
      (title.indexOf(first) !== -1 && title.indexOf(last) !== -1) ||
      (desc.indexOf(first) !== -1 && desc.indexOf(last) !== -1);

    if (!nameMatch) continue;

    var phoneMatch = desc.match(/phone[:\s]*([\d\s\-\(\)\+]{7,})/i);
    if (!phoneMatch) continue;

    var digits = fdg080Digits_(phoneMatch[1]);
    if (digits.slice(-4) === last4) {
      return { success: true, found: true, phone: digits };
    }
  }

  return { success: true, found: false };
}


/* ============================================================
 * v0.16.0 PRIVATE PATIENT-VERIFICATION BRIDGE
 * ============================================================
 *
 * The browser talks only to this public Gateway. The Gateway signs a narrow
 * server-to-server request to private OS2, where Charm matching, visit-history
 * classification, and the security-code email occur. No Charm credential or
 * patient chart response is ever returned to the browser.
 */

function fdg160WebsiteVerificationEnabled_() {
  return String(
    PropertiesService.getScriptProperties()
      .getProperty(FDG080.WEBSITE_VERIFY_FLAG) || ''
  ).toLowerCase() === 'true';
}


/** READ ONLY. Does not call OS2 or create a verification request. */
function previewWebsiteFollowUpVerification_v160_() {
  var props = PropertiesService.getScriptProperties();
  var url = fdg080Clean_(props.getProperty(FDG080.PRIVATE_ROUTER_URL_PROPERTY));
  var secret = fdg080Clean_(props.getProperty(FDG080.PRIVATE_ROUTER_SECRET_PROPERTY));
  var out = {
    version:FDG080.VERSION,
    readOnly:true,
    enabled:fdg160WebsiteVerificationEnabled_(),
    privateRouterUrlConfigured:/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url),
    bridgeSecretConfigured:secret.length >= 32,
    guarantees:{privateCalls:0,sheetWrites:0,emails:0,calendarChanges:0}
  };
  Logger.log('WEBSITE FOLLOW-UP VERIFICATION %s — READ ONLY',FDG080.VERSION);
  Logger.log(JSON.stringify(out,null,2));
  return out;
}


/**
 * AUTHORIZATION / CONNECTIVITY TEST ONLY.
 * Calls private OS2 with a deliberately nonexistent opaque session. A healthy
 * bridge returns success=true, valid=false. No patient lookup, email, sheet,
 * calendar, or booking action occurs.
 */
function testPrivatePatientRouterBridge_v160_() {
  var result = fdg160PrivateRouterCall_('verification-session', {
    session:'0000000000000000000000000000000000000000000000000000000000000000'
  });
  if (!result || result.success !== true || result.valid !== false) {
    throw new Error('Private router handshake returned an unexpected response.');
  }
  var out = {
    version:FDG080.VERSION,
    connected:true,
    patientDataUsed:false,
    emailSent:false,
    sheetWrites:0,
    calendarChanges:0
  };
  Logger.log('PRIVATE PATIENT ROUTER HANDSHAKE %s — SAFE TEST',FDG080.VERSION);
  Logger.log(JSON.stringify(out,null,2));
  return out;
}


function fdg160RequireFollowUpSession_(session) {
  session = fdg080Clean_(session);
  if (!/^[a-f0-9]{64}$/i.test(session)) {
    throw new Error('Please verify your patient record again before choosing a follow-up time.');
  }
  var result = fdg160PrivateRouterCall_('verification-session', {
    session: session
  });
  if (!result || !result.success || !result.valid) {
    throw new Error('Your verification has expired. Please verify your patient record again.');
  }
  return result;
}


function fdg160PrivateRouterCall_(action, payload) {
  var props = PropertiesService.getScriptProperties();
  var url = fdg080Clean_(props.getProperty(FDG080.PRIVATE_ROUTER_URL_PROPERTY));
  var secret = fdg080Clean_(props.getProperty(FDG080.PRIVATE_ROUTER_SECRET_PROPERTY));
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
    throw new Error('Private verification service is not configured.');
  }
  if (secret.length < 32) throw new Error('Private verification service is not configured.');
  var ts = Date.now();
  var nonce = Utilities.getUuid().replace(/-/g,'').toLowerCase();
  var cleanAction = fdg080Clean_(action).toLowerCase();
  var cleanPayload = fdg080SanitizeData_(payload || {});
  var canonical = [String(ts),nonce,cleanAction,JSON.stringify(cleanPayload)].join('\n');
  var signature = fdg160Hmac_(secret, canonical);
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      ts: ts,
      nonce: nonce,
      action: cleanAction,
      payload: cleanPayload,
      signature: signature
    }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  var parsed = null;
  try { parsed = JSON.parse(response.getContentText()); } catch (ignore) {}
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300 || !parsed) {
    throw new Error('Private verification service is temporarily unavailable.');
  }
  return parsed;
}


function fdg160Hmac_(secret, text) {
  return Utilities.computeHmacSha256Signature(
    String(text || ''),
    String(secret || ''),
    Utilities.Charset.UTF_8
  ).map(function(b) {
    var n = b < 0 ? b + 256 : b;
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}


function fdg111SchedulingPolicy_() {
  var ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
  var settingsSh = ss.getSheetByName(FDG080.SCHED_SETTINGS_TAB);
  var hoursSh = ss.getSheetByName(FDG080.SCHED_HOURS_TAB);
  var closuresSh = ss.getSheetByName(FDG080.SCHED_CLOSURES_TAB);

  if (!settingsSh || !hoursSh || !closuresSh) {
    throw new Error('OS2 scheduling is not configured yet.');
  }

  var settings = {};
  if (settingsSh.getLastRow() >= 2) {
    settingsSh.getRange(2, 1, settingsSh.getLastRow() - 1, 2)
      .getValues()
      .forEach(function(r) {
        var k = String(r[0] || '').trim().toUpperCase();
        if (k) settings[k] = String(r[1] == null ? '' : r[1]).trim();
      });
  }

  var hours = {};
  if (hoursSh.getLastRow() >= 2) {
    hoursSh.getRange(2, 1, hoursSh.getLastRow() - 1, 6)
      .getValues()
      .forEach(function(r) {
        var idx = Number(r[0]);
        if (!isFinite(idx) || idx < 0 || idx > 6) return;
        hours[idx] = {
          index: idx,
          name: String(r[1] || ''),
          enabled: fdg111Bool_(r[2]),
          open: fdg111Time_(r[3]),
          close: fdg111Time_(r[4]),
          mode: String(r[5] || '').trim().toUpperCase() === 'VIRTUAL'
            ? 'VIRTUAL'
            : 'IN_PERSON'
        };
      });
  }

  var closures = [];
  if (closuresSh.getLastRow() >= 2) {
    closuresSh.getRange(2, 1, closuresSh.getLastRow() - 1, 7)
      .getValues()
      .forEach(function(r) {
        var c = {
          id: String(r[0] || '').trim(),
          active: fdg111Bool_(r[1]),
          startDate: fdg111IsoDate_(r[2]),
          endDate: fdg111IsoDate_(r[3]),
          blocksBooking: fdg111Bool_(r[4]),
          showBanner: fdg111Bool_(r[5]),
          message: String(r[6] || '').trim()
        };
        if (c.id || c.startDate || c.endDate || c.message) closures.push(c);
      });
  }

  var p = {
    leadMinutes: fdg111PositiveInt_(settings.LEAD_MINUTES, 120),
    newDurationMinutes: fdg111PositiveInt_(settings.NEW_DURATION_MINUTES, 30),
    returningDurationMinutes: fdg111PositiveInt_(settings.RETURNING_DURATION_MINUTES, 15),
    newDaysAhead: fdg111PositiveInt_(settings.NEW_DAYS_AHEAD, 30),
    returningDaysAhead: fdg111PositiveInt_(settings.RETURNING_DAYS_AHEAD, 30),
    progressiveReturning: fdg111Bool_(settings.PROGRESSIVE_RETURNING),
    bannerLeadDays: fdg111NonnegativeInt_(settings.BANNER_LEAD_DAYS, 14),
    hours: hours,
    closures: closures
  };

  [0,1,2,3,4,5,6].forEach(function(i) {
    if (!Object.prototype.hasOwnProperty.call(p.hours, i)) {
      p.hours[i] = { index:i, name:'', enabled:false, open:'', close:'', mode:'IN_PERSON' };
    }
  });

  return p;
}


function fdg111ActiveBanners_(p) {
  var today = new Date();
  var today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);

  return p.closures.filter(function(c) {
    if (!c.active || !c.showBanner || !c.message || !c.startDate || !c.endDate) return false;
    var start = fdg111DateFromIso_(c.startDate);
    var end = fdg111DateFromIso_(c.endDate);
    if (!start || !end) return false;
    var showFrom = new Date(start.getTime() - p.bannerLeadDays * 86400000);
    return today0.getTime() >= showFrom.getTime() && today0.getTime() <= end.getTime();
  }).map(function(c) {
    return {
      id: c.id,
      startDate: c.startDate,
      endDate: c.endDate,
      message: c.message
    };
  });
}


function fdg111DateBlocked_(dateIso, p) {
  return p.closures.some(function(c) {
    if (!c.active || !c.blocksBooking || !c.startDate || !c.endDate) return false;
    return dateIso >= c.startDate && dateIso <= c.endDate;
  });
}


function fdg111WindowBusy_(events, start, end) {
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (ev.getStartTime() < end && ev.getEndTime() > start) return true;
  }
  return false;
}


function fdg111PatientType_(v) {
  var s = String(v || '').trim().toLowerCase();
  if (s === 'new') return 'new';
  if (s === 'returning' || s === 'followup' || s === 'follow-up') return 'returning';
  throw new Error('Patient type is required.');
}


function fdg111Bool_(v) {
  if (v === true) return true;
  var s = String(v == null ? '' : v).trim().toUpperCase();
  return s === 'TRUE' || s === 'YES' || s === '1' || s === 'Y';
}


function fdg111PositiveInt_(v, fallback) {
  var n = Number(v);
  return isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}


function fdg111NonnegativeInt_(v, fallback) {
  var n = Number(v);
  return isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}


function fdg111Time_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, FDG080.TIMEZONE, 'HH:mm');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return '';
  var h = Number(m[1]), min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return '';
  return ('0' + h).slice(-2) + ':' + ('0' + min).slice(-2);
}


function fdg111ClockMinutes_(hhmm) {
  var m = String(hhmm || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}


function fdg111IsoDate_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, FDG080.TIMEZONE, 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  var d = new Date(v);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, FDG080.TIMEZONE, 'yyyy-MM-dd');
}


function fdg111DateFromIso_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}


function fdg111DateLabel_(d) {
  return Utilities.formatDate(d, FDG080.TIMEZONE, 'EEEE, MMM d');
}


function fdg111TimeLabel_(d) {
  return Utilities.formatDate(d, FDG080.TIMEZONE, 'h:mm a');
}


/**
 * Safe manual smoke test after deploying v0.10.1.
 * Read-only: no events, Front Door rows, triggers, or Charm writes.
 */
function testSchedulingGateway_v0101_() {
  var config = fdg111PublicBookingConfig_();
  var newSlots = fdg111PublicSlots_('new');
  var returningSlots = fdg111PublicSlots_('returning');

  Logger.log(JSON.stringify({
    version: FDG080.VERSION,
    config: config,
    newSlotCount: newSlots.slots.length,
    firstNewSlots: newSlots.slots.slice(0, 8),
    returningSlotCount: returningSlots.slots.length,
    firstReturningSlots: returningSlots.slots.slice(0, 12)
  }, null, 2));

  return {
    ok: true,
    version: FDG080.VERSION,
    newSlotCount: newSlots.slots.length,
    returningSlotCount: returningSlots.slots.length
  };
}


/** READ ONLY. Confirms the Gateway can see the OS2 cash-price table. */
function testCashPriceGateway_v0112_() {
  var newPrice = fdg112PublicCashPrice_({'Patient Type':'NEW'});
  var followPrice = fdg112PublicCashPrice_({'Patient Type':'RETURNING'});
  var out = {version:FDG080.VERSION,newPatient:newPrice,followUp:followPrice};
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}

/** Four independent sections. Submission timestamps are server-owned. */
var FD230_FIELDS = {
 personal:['firstName','lastName','dob','phone','email','address1','address2','city','state','zip','emergencyName','emergencyPhone','addressConfirmed'],
 insurance:['paymentChoice','insuranceAssistanceRequested','insuranceCarrier','charmPracticePayerId','payerId','insurancePlan','memberId','groupId','insuranceCardStatus','photoIdStatus','hasSecondaryInsurance','secondaryCarrier','secondaryMemberId','secondaryGroupId','subscriberIsPatient','subscriberFirstName','subscriberLastName','subscriberDob'],
 visit:['visitHistory','visitHistoryVersion','visitAdditional','visitReasons','hpi'],
 contract:['confirmationPolicyAccepted','noShowPolicyAccepted','privacyAcknowledged','treatmentConsent','medicationHistoryConsent','telemedicineConsent','billingAuthorizationAccepted','financialPolicyAcknowledged','agreementAccepted','signatureName','signatureType'],
 additional:['familyHistory','noCurrentMedications','noMedicalHistory','noSurgicalHistory','pharmacy','pharmacyNpi','pharmacyPhone','pharmacyAddress','noKnownAllergies','allergies','medications','medicalHistory','medicalOther','surgicalHistory','healthChange']
};
function fdg230Write_(source,existing,d,refs,now,artifact){
 artifact=artifact||{};existing=existing||{};
 var signed=artifact.fileId||existing.agreementPdfFileId;
 var visitReady=!!((d.sectionProgress||{}).visit||{}).submittedAt&&fdg360MissingVisit_(d.visitHistory).length===0;
 var completeAt=signed&&visitReady?(existing.completedAt||now):'';
 var full=d.sectionProgress&&d.sectionProgress.additional&&d.sectionProgress.additional.submittedAt;
 fdg080UpsertIntake_({token:String(source['Patient Token']),frontDoorId:String(source['Front Door ID']),now:now,rowContext:existing._writeContext,
 completedAt:completeAt||'',step:full?'4':signed?'3':'1',confirmationStatus:signed&&visitReady?'FRONT DOOR COMPLETE':'IN PROGRESS',
 insuranceCardStatus:d.insuranceCardStatus||'',photoIdStatus:d.photoIdStatus||'',secondaryStatus:d.hasSecondaryInsurance?'YES':'NO',
 signatureName:d.signatureName||'',policiesAccepted:signed?'YES':'',dataJson:JSON.stringify(d),uploadRefs:refs||{},clientVersion:'v0.23.0',lastError:'',
 agreementVersion:artifact.version||existing.agreementVersion||'',agreementAcceptedAt:artifact.fileId?now:existing.agreementAcceptedAt||'',
 agreementPdfFileId:artifact.fileId||existing.agreementPdfFileId||'',agreementSha256:artifact.sha256||existing.agreementSha256||''});
}
function fdg230ValidateSignature_(source,d){
 fdg360ValidateVisit_(d);
 if(!((d.sectionProgress||{}).visit||{}).submittedAt)throw new Error('Please save Today’s visit before signing.');
 if(!String(d.signatureName||'').trim())throw new Error('Please type your name to sign the contract.');
 if(d.agreementAccepted!==true)throw new Error('Please accept the agreement you are signing.');
 ['noShowPolicyAccepted','privacyAcknowledged','treatmentConsent','financialPolicyAcknowledged'].forEach(function(k){if(d[k]!==true)throw new Error('Please review the contract acknowledgements before signing.');});
 if(fdg102IsVirtualSource_(source)&&d.telemedicineConsent!==true)throw new Error('Please accept the telemedicine consent for your video visit.');
 // Insurance, uploads, address, and clinical questions never gate signing.
}
function fdg230Section_(body){
 var token=fdg080ValidateToken_(body.token||''),source=fdg080FindSourceByToken_(token),section=String(body.step||'');
 if(!FD230_FIELDS[section])throw new Error('Unknown section.');
 var signing=body.action==='sign-contract';if(signing&&section!=='contract')throw new Error('Invalid contract section.');
 var incoming=fdg080SanitizeData_(body.data||{}),lock=LockService.getScriptLock();
 var signatureImage=signing?fdg269SignatureImage_(body):null;
 // Office/prior-visit prefill is read-only. Fetch it before the shared save lock
 // so one patient's background draft does not reject another patient's Submit.
 // The current intake is still re-read under the lock to preserve concurrent edits.
 var prefillContext={startedAt:Date.now(),timings:{},sheets:{},ok:false};
 if(signing&&String(source['Charm Patient ID']||'').trim()){
  ['Patient Intake Prefill','Back Door Document Audit'].forEach(function(tab){fdg236ReadSheet_(prefillContext,tab);});
  if(fdg120IsFollowUpSource_(source)&&/^\d+$/.test(String(source['Charm Patient ID']||''))){
   ['Front Door','Front Door Intake'].forEach(function(tab){fdg236ReadSheet_(prefillContext,tab);});
  }
 }
 if(!lock.tryLock(1500))throw new Error('Saving is busy. Your entries remain on this page; please try again.');
 var d,existing,refs,now=new Date(),signKey='',snapshot;
 try{
  fdg230RecoverLocked_(source,token);
  // The form already loaded office prefill. Ordinary saves merge only this
  // section into the fresh locked row; do not reread unrelated sheets per edit.
  existing=fdg080ReadIntake_(token)||{};
  if(signing)existing=fdg240Prefill_(source,existing,prefillContext).intake||{};
  d=existing.data||{};refs=existing.uploadRefs||{};
  if(existing.parseError||!d||typeof d!=='object'||Array.isArray(d))throw new Error('The saved intake needs staff review.');
  // Receipts and section revisions live in the same row write as the data.
  // Lost responses can be checked/replayed without overwriting a later save.
  var receiptRequest = !signing && body.requestId ? fdg330Request_(body, incoming) : null;
  if(receiptRequest){
   var last=(d.saveReceipts||{})[section];
   if(last&&last.id===receiptRequest.id){
    if(last.hash!==receiptRequest.hash)throw new Error('This save request does not match its receipt.');
    if(last.revision!==String(((d.sectionProgress||{})[section]||{}).savedAt||''))throw new Error('This save was superseded by newer changes. Reload to review the saved details.');
    return {success:true,saved:true,idempotent:true,requestId:last.id,contractSigned:!!existing.agreementPdfFileId,sectionProgress:d.sectionProgress||{}};
   }
   if(String(body.expectedRevision||'')!==String(((d.sectionProgress||{})[section]||{}).savedAt||''))throw new Error('This section changed in another save. Reload to review the saved details; your entries remain on this page.');
  }
  if(signing&&existing.agreementPdfFileId)return {success:true,contractSigned:true,idempotent:true,sectionProgress:d.sectionProgress||{}};
  if(existing.agreementPdfFileId&&section==='contract')return {success:true,contractSigned:true,sectionProgress:d.sectionProgress||{}};
  var sectionChanged=false;
  FD230_FIELDS[section].forEach(function(k){if(Object.prototype.hasOwnProperty.call(incoming,k)){if(JSON.stringify(d[k])!==JSON.stringify(incoming[k]))sectionChanged=true;d[k]=incoming[k];}});
  if(!d.firstName)d.firstName=String(source['First Name']||'');if(!d.lastName)d.lastName=String(source['Last Name']||'');
  d.flowVersion='FOUR_SECTIONS';d.flowType='FOUR_SECTIONS';d.sectionProgress=d.sectionProgress||{};
  var old=d.sectionProgress[section]||{};
  if(section==='visit'){if(body.submit===true)fdg360ValidateVisit_(d);d.visitHistoryVersion=1;d.visitReasons=d.visitHistory&&d.visitHistory.problem?[d.visitHistory.problem==='Other'?'Other: '+d.visitHistory.description:d.visitHistory.problem]:[];d.hpi=fdg360VisitSummary_(d.visitHistory)+(d.visitAdditional?'\nAdditional details: '+d.visitAdditional:'');}
  if(section==='personal'&&body.submit===true){d.addressConfirmed=true;if(!fdg274Complete_('personal',d))throw new Error('Please complete your name, date of birth, phone, email and address before submitting My information.');}
  // Ensure sequential commits have distinct revisions, even in the same millisecond.
  (signing?['personal','insurance','contract']:[section]).forEach(function(k){var lastTime=new Date((d.sectionProgress[k]||{}).savedAt||0).getTime();if(now.getTime()<=lastTime)now=new Date(lastTime+1);});
  d.sectionProgress[section]={savedAt:now.toISOString(),submittedAt:body.submit===true&&section!=='contract'?now.toISOString():(!sectionChanged?old.submittedAt||'':'')};
  if(receiptRequest){d.saveReceipts=d.saveReceipts||{};d.saveReceipts[section]={id:receiptRequest.id,hash:receiptRequest.hash,revision:now.toISOString()};}
  if(signing){
   // Signing submits the completed form currently visible to the patient too.
   // Preserve prior submissions, and never invent completion for missing fields.
   ['personal','insurance'].forEach(function(k){
    var candidate=Object.assign({},d);FD230_FIELDS[k].forEach(function(f){if(Object.prototype.hasOwnProperty.call(incoming,f))candidate[f]=incoming[f];});
    // Keep partial entries as a draft too; a signed contract must not discard them.
    var changed=false;
    FD230_FIELDS[k].forEach(function(f){if(Object.prototype.hasOwnProperty.call(incoming,f)){if(JSON.stringify(d[f])!==JSON.stringify(incoming[f]))changed=true;d[f]=incoming[f];}});
    if(k==='personal'){candidate.addressConfirmed=true;d.addressConfirmed=!!fdg274Complete_(k,candidate);}
    if(fdg274Complete_(k,d))d.sectionProgress[k]={savedAt:now.toISOString(),submittedAt:now.toISOString()};
    else d.sectionProgress[k]={savedAt:now.toISOString(),submittedAt:changed?'':((d.sectionProgress[k]||{}).submittedAt||'')};
   });
   fdg230ValidateSignature_(source,d);
   var failed=PropertiesService.getScriptProperties().getProperty('FD230_FAILED_'+token);
   if(d.contractSigning&&d.contractSigning.key!==failed&&now-new Date(d.contractSigning.at)<600000)return {success:true,contractSigned:false,pending:true,sectionProgress:d.sectionProgress};
   signKey=Utilities.getUuid();d.contractSigning={key:signKey,at:now.toISOString()};snapshot=JSON.parse(JSON.stringify(d));snapshot.signatureImage=signatureImage;
  }
  if(JSON.stringify(d).length>FDG080.MAX_JSON_CHARS)throw new Error('This section contains too much text.');
  fdg230Write_(source,existing,d,refs,now);
 }finally{lock.releaseLock();}
 // PDF conversion and uploads are deliberately outside the shared sheet lock.
 if(signing){
  var artifact,props=PropertiesService.getScriptProperties();
  try{
   artifact=fdg083CreateAgreementPdf_(source,snapshot,now);
   var consent={};FD230_FIELDS.contract.forEach(function(k){consent[k]=snapshot[k];});
   // Keep a durable receipt until the row commit succeeds, so contention cannot lose a signed PDF.
   props.setProperty('FD230_RECEIPT_'+token,JSON.stringify({key:signKey,artifact:artifact,consent:consent,at:now.toISOString()}));
  }catch(e){props.setProperty('FD230_FAILED_'+token,signKey);throw new Error('Your entries are saved, but the signed document could not be saved yet. Please retry signing.');}
  if(!lock.tryLock(1500))return {success:true,contractSigned:false,pending:true,sectionProgress:d.sectionProgress||{}};
  try{fdg230RecoverLocked_(source,token);existing=fdg080ReadIntake_(token)||{};d=existing.data||{};}finally{lock.releaseLock();}
  try{fdg080UpdateSourceStatus_(source,{'Paperwork Status':'PATIENT COMPLETED','Front Door Status':'PATIENT COMPLETED — READY FOR CHARM','Missing Information Status':'CHECK SECTION DETAILS','Updated At':now});}catch(ignore){}

 }
 return {success:true,contractSigned:!!existing.agreementPdfFileId,sectionProgress:d.sectionProgress||{},saved:true,requestId:receiptRequest?receiptRequest.id:''};
}
/** Only token-scoped intake writes participate; no new external service or cache. */
function fdg330TokenRow_(sh, column, token){
 if(!column)throw new Error('Patient Token column is missing.');
 var last=sh.getLastRow();if(last<2)return 0;
 var values=sh.getRange(2,column,last-1,1).getValues(),row=0;
 values.forEach(function(v,i){if(fdg080Clean_(v[0])===token){if(row)throw new Error('Multiple intake rows match this link; staff review is needed.');row=i+2;}});
 return row;
}
function fdg330Request_(body,incoming){
 var id=String(body.requestId||'');
 if(!/^[A-Za-z0-9_-]{16,80}$/.test(id)||typeof body.expectedRevision!=='string')throw new Error('Invalid save request.');
 var text=JSON.stringify([String(body.step),body.submit===true,body.expectedRevision,incoming]);
 var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
 return {id:id,hash:hash};
}
function fdg330SaveStatus_(body){
 var token=fdg080ValidateToken_(body.token||'');fdg080FindSourceByToken_(token);
 var section=String(body.step||''),id=String(body.requestId||'');
 if(!FD230_FIELDS[section]||!/^[A-Za-z0-9_-]{16,80}$/.test(id))throw new Error('Invalid save status request.');
 var lock=LockService.getScriptLock();if(!lock.tryLock(1500))return {success:true,saved:false,pending:true};
 try{
  var x=fdg080ReadIntake_(token)||{},d=x.data||{};
  if(x.parseError)throw new Error('The saved intake needs staff review.');
  var receipt=(d.saveReceipts||{})[section],matches=!!(receipt&&receipt.id===id);
  var superseded=matches&&receipt.revision!==String(((d.sectionProgress||{})[section]||{}).savedAt||'');
  var saved=matches&&!superseded;
  return {success:true,saved:saved,superseded:superseded,requestId:saved?id:'',contractSigned:!!x.agreementPdfFileId,sectionProgress:d.sectionProgress||{}};
 }finally{lock.releaseLock();}
}
function fdg230Upload_(body){
 var token=fdg080ValidateToken_(body.token||''),source=fdg080FindSourceByToken_(token),uploads=body.uploads||[];
 if(!Array.isArray(uploads)||uploads.length>FDG080.MAX_UPLOADS_PER_SUBMISSION)throw new Error('Too many uploads.');
 var refs=fdg080SaveUploads_(source,uploads,{}),lock=LockService.getScriptLock();
 if(!lock.tryLock(1500))throw new Error('Upload received; please retry attaching it shortly.');
 try{
  var existing=fdg080ReadIntake_(token)||{},d=existing.data||{},merged=Object.assign({},existing.uploadRefs||{},refs),now=new Date();
  // Historic terminal rows lack per-file upload receipts. Do not silently replay
  // replacement cards into Charm or claim their new contents are already synced.
  var changedCard=['insurance_front','insurance_back','secondary_insurance_front','secondary_insurance_back'].some(function(kind){return Object.prototype.hasOwnProperty.call(refs,kind)&&JSON.stringify(refs[kind])!==JSON.stringify((existing.uploadRefs||{})[kind]);});
  if(existing.completedAt&&changedCard)d.insuranceCardReviewRequired=true;
  fdg230Write_(source,existing,d,merged,now);
 }finally{lock.releaseLock();}
 return {success:true,uploadsOnFile:Object.keys(merged),insuranceCardReviewRequired:!!d.insuranceCardReviewRequired,message:d.insuranceCardReviewRequired?'Updated insurance card saved for staff review before any Charm update.':'Upload saved.'};
}
function fdg230Sync_(body){
 var token=fdg080ValidateToken_(body.token||''),source=fdg080FindSourceByToken_(token);
 var section=String(body.step||'');if(!FD230_FIELDS[section])throw new Error('Unknown section.');
 return fdg160PrivateRouterCall_('intake-section-sync',{frontDoorId:String(source['Front Door ID']),section:section});
}

function fdg230RecoverLocked_(source,token){
 var props=PropertiesService.getScriptProperties(),raw=props.getProperty('FD230_RECEIPT_'+token);if(!raw)return;
 var receipt=JSON.parse(raw),existing=fdg080ReadIntake_(token)||{},d=existing.data||{};
 if(existing.parseError)throw new Error('Saved intake needs staff review.');
 if(!existing.agreementPdfFileId){
  if(!d.contractSigning||d.contractSigning.key!==receipt.key)throw new Error('The saved signature needs staff review.');
  FD230_FIELDS.contract.forEach(function(k){d[k]=receipt.consent[k];});
  d.agreementVersion=receipt.artifact.version;d.agreementSha256=receipt.artifact.sha256;d.agreementAcceptedAt=receipt.at;
  d.sectionProgress=d.sectionProgress||{};d.sectionProgress.contract={savedAt:receipt.at,submittedAt:receipt.at};delete d.contractSigning;
  fdg230Write_(source,existing,d,existing.uploadRefs||{},new Date(receipt.at),receipt.artifact);
 }
 props.deleteProperty('FD230_RECEIPT_'+token);props.deleteProperty('FD230_FAILED_'+token);
}
function fdg230ContractStatus_(body){
 var token=fdg080ValidateToken_(body.token||''),source=fdg080FindSourceByToken_(token),lock=LockService.getScriptLock();
 if(!lock.tryLock(1500))return {success:true,pending:true,contractSigned:false};
 try{fdg230RecoverLocked_(source,token);var x=fdg080ReadIntake_(token)||{},d=x.data||{};
 var failed=d.contractSigning&&PropertiesService.getScriptProperties().getProperty('FD230_FAILED_'+token)===d.contractSigning.key;
 return {success:true,contractSigned:!!x.agreementPdfFileId,pending:!failed&&!!d.contractSigning,sectionProgress:d.sectionProgress||{}};
 }finally{lock.releaseLock();}
}


/* v236 — One workbook connection and one values read per registration tab.
 * doGet(load) and read-only section prefill supply a context. No cross-request patient cache, locks,
 * writes, or external insurance/Charm calls are introduced. Existing schema
 * checks and first/latest token-match behavior run against the same snapshot.
 */
function fdg236ReadSheet_(context, tabName) {
  if (!context) {
    return SpreadsheetApp.openById(FDG080.SHEET_ID).getSheetByName(tabName);
  }
  if (Object.prototype.hasOwnProperty.call(context.sheets, tabName)) {
    return context.sheets[tabName];
  }
  if (!context.ss) {
    var openedAt = Date.now();
    context.ss = SpreadsheetApp.openById(FDG080.SHEET_ID);
    context.timings.workbookOpen = Date.now() - openedAt;
  }
  var startedAt = Date.now();
  try {
    var liveSheet = context.ss.getSheetByName(tabName);
    if (!liveSheet) {
      context.sheets[tabName] = null;
      return null;
    }
    var values = liveSheet.getDataRange().getValues();
    var width = values.length ? values[0].length : 0;
    // Read-only sheet view. getValues returns copies because source lookup
    // shifts its header row; schema reads beyond populated columns get blanks.
    function range(row, col, rows, cols) {
      if (row < 1 || col < 1 || rows < 1 || cols < 1) {
        throw new Error('Invalid registration read range.');
      }
      return { getValues: function() {
        var out = [];
        for (var r = 0; r < rows; r++) {
          var line = [], stored = values[row - 1 + r] || [];
          for (var c = 0; c < cols; c++) {
            var value = stored[col - 1 + c];
            line.push(value == null ? '' : value);
          }
          out.push(line);
        }
        return out;
      }};
    }
    var snapshot = {
      _liveSheet: liveSheet,
      getLastRow: function() { return values.length; },
      getLastColumn: function() { return width; },
      getDataRange: function() { return range(1, 1, Math.max(1, values.length), Math.max(1, width)); },
      getRange: range
    };
    context.sheets[tabName] = snapshot;
    return snapshot;
  } finally {
    context.timings[tabName] = Date.now() - startedAt;
  }
}

function fdg236LogLoad_(context) {
  if (!context) return;
  try {
    // Deliberately excludes tokens, patient data, URLs, and error messages.
    console.log(JSON.stringify({
      event: 'frontdoor_load', revision: 'v236', ok: context.ok,
      elapsedMs: Date.now() - context.startedAt,
      timingsMs: context.timings
    }));
  } catch (ignore) {}
}

/** v240: bounded, token-scoped office prefill; patient edits take precedence. */
function fdg240Rows_(name,context){
 var sh=fdg236ReadSheet_(context,name);if(!sh||sh.getLastRow()<2)return [];
 var rows=sh.getDataRange().getValues(),h=rows.shift();return rows.map(function(r){var o={};h.forEach(function(k,i){o[k]=r[i];});return o;});
}
function fdg240Key_(v){return String(v==null?'':v).toUpperCase().replace(/[^A-Z0-9]/g,'');}
function fdg240SamePolicy_(d,s){
 return (!d.memberId||fdg240Key_(d.memberId)===fdg240Key_(s.memberId))&&(!d.payerId||fdg240Key_(d.payerId)===fdg240Key_(s.payerId))&&(!d.insuranceCarrier||d.payerId||fdg240Key_(d.insuranceCarrier)===fdg240Key_(s.insuranceCarrier)||/aetna/i.test(d.insuranceCarrier)&&String(s.payerId)==='60054')&&['firstName','lastName','dob','subscriberFirstName','subscriberLastName','subscriberDob'].every(function(k){return !d[k]||fdg240Key_(d[k])===fdg240Key_(s[k]);});
}
function fdg240Prefill_(source,intake,context){
 intake=intake||{data:{},uploadRefs:{}};if(intake.parseError)return {intake:intake};
 var patientId=String(source['Charm Patient ID']||'').trim();if(!patientId)return {intake:intake};
 var patientRows=fdg240Rows_('Patient Intake Prefill',context).filter(function(r){return String(r['Patient ID'])===patientId;});
 var rows=patientRows.filter(function(r){return r.Category==='PRIMARY';});
 var d=intake.data||{},snapshot=rows.length?rows[rows.length-1]:null,eligibility=null;
 // Private Charm refresh publishes a separate snapshot. Reading it here avoids
 // a cross-project writer overwriting newer patient input or signed evidence.
 var charmRows=patientRows.filter(function(r){return r.Category==='CHARM_DEMOGRAPHICS';});
 if(charmRows.length&&!((d.sectionProgress||{}).personal||{}).submittedAt&&
    ['address1','address2','city','zip'].every(function(k){return !String(d[k]||'').trim();})){
  var charmAddress=JSON.parse(String(charmRows[charmRows.length-1]['Data JSON']||'{}'));
  if(['address1','city','state','zip'].every(function(k){return !!String(charmAddress[k]||'').trim();})){
   ['address1','address2','city','state','zip'].forEach(function(k){d[k]=charmAddress[k]||'';});
   d.addressPreloadedFrom='CHARM';
  }
 }
 if(snapshot){
  var s=JSON.parse(String(snapshot['Data JSON']||'{}')),e=JSON.parse(String(snapshot['Eligibility JSON']||'{}'));
  var same=fdg240SamePolicy_(d,s);
  if(s.addressReview)d.addressPreloadedFrom='INSURANCE';
  if(s.addressReview){var submitted=((d.sectionProgress||{}).personal||{}).submittedAt;d.addressReview=(d.addressConfirmed&&submitted&&new Date(submitted)>=new Date(s.addressReview.createdAt))?null:s.addressReview;}else d.addressReview=null;
  ['firstName','lastName','dob','phone','email','address1','address2','city','state','zip'].forEach(function(k){if(!d[k]&&s[k])d[k]=s[k];});
  if(same&&d.paymentChoice!=='SELF_PAY'){
   ['insuranceCarrier','payerId','insurancePlan','memberId','groupId','paymentChoice','subscriberFirstName','subscriberLastName','subscriberDob'].forEach(function(k){if(!d[k]&&s[k])d[k]=s[k];});
   if(Date.now()-new Date(e.checkedAt).getTime()<86400000){eligibility=e;eligibility.policy={payerId:s.payerId,memberId:s.memberId,firstName:s.firstName,lastName:s.lastName,dob:s.dob,subscriberFirstName:s.subscriberFirstName,subscriberLastName:s.subscriberLastName,subscriberDob:s.subscriberDob};}
  }
 }
 d.officeSections={personal:!d.addressReview&&fdg274Complete_('personal',d),insurance:!!(eligibility&&eligibility.status==='ACTIVE'&&fdg274Complete_('insurance',d))};
 intake.data=d;intake.uploadRefs=intake.uploadRefs||{};
 fdg240Rows_('Back Door Document Audit',context).forEach(function(r){
  if(String(r['Patient ID'])!==patientId||!r['File ID']||! /^(COMPLETE|CHARM UPLOADED)/.test(String(r.Status)))return;
  var kind={IDENTITY:'photo_id',PRIMARY_INSURANCE:'insurance_front',SECONDARY_INSURANCE:'secondary_insurance_front'}[r.Role];
  if(kind&&!intake.uploadRefs[kind])intake.uploadRefs[kind]={officeOnFile:true};
 });
 return {intake:intake,eligibility:eligibility};
}

/* v269 approved intake: retain clinical fields, real pharmacy search, signature image in signed PDF. */
function fdg269AbsoluteDate_(value){var d=value instanceof Date?value:new Date(value);return isNaN(d.getTime())?'':d.toISOString();}
function fdg269SignatureImage_(body){
 var type=body.data&&body.data.signatureType;if(!type)return null; // compatible with older signed forms
 if(type==='typed')return null;
 if(type!=='drawn')throw new Error('Select a signature method.');
 var value=String(body.signatureImage||'');
 if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)||value.length>180000)throw new Error('Please draw your signature again.');
 var b64=value.split(',')[1],bytes=Utilities.base64Decode(b64);
 if(bytes.length<100||bytes.length>130000||bytes.slice(0,8).map(function(n){return (n+256)%256;}).join(',')!=='137,80,78,71,13,10,26,10')throw new Error('Invalid signature image.');
 return b64;
}
function fdg269Reschedule_(body){
 var token=fdg080ValidateToken_(body.token||''),source=fdg080FindSourceByToken_(token),start=new Date(source['Appointment Start']);
 if(isNaN(start.getTime())||start.getTime()-Date.now()<=14400000)throw new Error('Online rescheduling closes four hours before your appointment. Please call (212) 510-8665.');
 if(String(source['Booking Source']).toUpperCase()!=='WEBSITE')throw new Error('Please call (212) 510-8665 to reschedule this appointment.');
 if(body.action==='reschedule-slots')return fdg111PublicSlots_(source['Patient Type'],fdg102VisitModeForSource_(source));
 var target=new Date(body.data&&body.data.start);if(isNaN(target.getTime()))throw new Error('Select an available appointment.');
 var offered=fdg111RequireWebsiteSlotAvailable_(target,source['Patient Type'],null,fdg102VisitModeForSource_(source));
 return fdg160PrivateRouterCall_('intake-reschedule',{frontDoorId:String(source['Front Door ID']),expectedStart:start.toISOString(),start:target.toISOString(),duration:offered.durationMinutes});
}

// Reuse an established patient's prior submitted intake, without treating insurance as freshly verified.
var fd269PrefillBase=fdg240Prefill_;
fdg240Prefill_=function(source,intake,context){
 var result=fd269PrefillBase(source,intake,context),current=result.intake||{data:{},uploadRefs:{}};
 if(!fdg120IsFollowUpSource_(source)||current.parseError)return result;
 var pid=String(source['Charm Patient ID']||'');if(!/^\d+$/.test(pid))return result;
 var tokens={};fdg240Rows_('Front Door',context).forEach(function(row){if(String(row['Charm Patient ID'])===pid&&String(row['Patient Token'])!==String(source['Patient Token']))tokens[String(row['Patient Token'])]=true;});
 var prior=fdg240Rows_('Front Door Intake',context).filter(function(row){return tokens[String(row['Patient Token'])]&&row['Agreement PDF File ID'];}).sort(function(a,b){return new Date(b['Updated At'])-new Date(a['Updated At']);})[0];
 if(!prior)return result;
 var d;try{d=JSON.parse(String(prior['Data JSON']||'{}'));}catch(ignore){return result;}
 var dest=current.data||{};
 ['personal','insurance','additional'].forEach(function(section){FD230_FIELDS[section].forEach(function(k){if(!Object.prototype.hasOwnProperty.call(dest,k)&&Object.prototype.hasOwnProperty.call(d,k))dest[k]=d[k];});});
 dest.visitReasons=dest.visitReasons||[];dest.sectionProgress=dest.sectionProgress||{};
 ['personal','insurance','additional'].forEach(function(k){if(!dest.sectionProgress[k]&&d.sectionProgress&&d.sectionProgress[k]&&d.sectionProgress[k].submittedAt)dest.sectionProgress[k]=d.sectionProgress[k];});
 if(!current.agreementPdfFileId){current.agreementPdfFileId=String(prior['Agreement PDF File ID']);current.agreementVersion=String(prior['Agreement Version']||'');current.agreementAcceptedAt=prior['Agreement Accepted At'];current.completedAt=prior['Completed At'];}
 if(prior['Completed At'])['personal','insurance','additional'].forEach(function(k){if(!dest.sectionProgress[k])dest.sectionProgress[k]={submittedAt:new Date(prior['Completed At']).toISOString()};});
 try{var refs=JSON.parse(String(prior['Upload IDs JSON']||'{}'));current.uploadRefs=current.uploadRefs||{};Object.keys(refs).forEach(function(k){if(!current.uploadRefs[k])current.uploadRefs[k]=refs[k];});}catch(ignore){}
 current.data=dest;result.intake=current;return result;
};
// Same agreement terms, compact ordering; attendance confirmation is a separate workflow.
var fd269OldAgreement=FDG083_AGREEMENT;
FDG083_AGREEMENT=Object.freeze({VERSION:'2026-09-13.v5',TITLE:fd269OldAgreement.TITLE,SECTIONS:[
 fd269OldAgreement.SECTIONS[6],
 {title:'Consent to treatment, medication history and telemedicine',paragraphs:fd269OldAgreement.SECTIONS[1].paragraphs.concat(fd269OldAgreement.SECTIONS[3].paragraphs,fd269OldAgreement.SECTIONS[2].paragraphs)},
 {title:'Insurance billing and financial responsibility',paragraphs:fd269OldAgreement.SECTIONS[4].paragraphs.concat(fd269OldAgreement.SECTIONS[5].paragraphs)},
 {title:'No-show policy',paragraphs:[fd269OldAgreement.SECTIONS[0].paragraphs[1]]},
 {title:'Electronic signature and records',paragraphs:fd269OldAgreement.SECTIONS[7].paragraphs.map(function(p){return p.replace('By typing my name and submitting Front Door','By adopting my typed name or drawing my signature and submitting Front Door');})}
]});

// Strip sensitive links at the shared handler, including direct POST and idempotent retries.
function fdg082CreateWebsiteBooking_(body){
 var result=fdg273CreateWebsiteBookingInternal_(body);
 if(!result||!result.success||!result.token)return result;
 var source=fdg080FindSourceByToken_(result.token,{startedAt:Date.now(),timings:{},sheets:{},ok:false});
 if(fdg120IsFollowUpSource_(source))return {success:true,created:!!result.created,idempotent:!!result.idempotent,bookingConfirmed:true,cardDelivery:'EMAIL_ON_FILE'};
 return result;
}


function fdg274Complete_(section,d){
 function has(k){return String(d[k]==null?'':d[k]).trim()!=='';}
 if(section==='personal')return (!d.addressReview||d.addressConfirmed===true)&&['firstName','lastName','dob','phone','email','address1','city','state','zip'].every(has)&&/^\d{4}-\d{2}-\d{2}$/.test(d.dob)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)&&String(d.phone).replace(/\D/g,'').length>=10;
 return d.paymentChoice==='SELF_PAY'||(d.paymentChoice==='INSURANCE'&&has('insuranceCarrier')&&has('memberId'));
}

function fdg357MergeCharm_(source,d,snapshot) {
 snapshot=snapshot||{};
 var dem=snapshot.demographics||{},progress=d.sectionProgress||{};
 if(!((progress.personal||{}).submittedAt)&&!d.addressConfirmed) {
  ['firstName','lastName','dob','phone','email'].forEach(function(k){if(!d[k]&&dem[k])d[k]=dem[k];});
  if((!d.state||/^(NY|New York)$/i.test(String(d.state).trim()))&&
     ['address1','address2','city','zip'].every(function(k){return !String(d[k]||'').trim();})&&
     ['address1','city','state','zip'].every(function(k){return !!String(dem[k]||'').trim();})) {
   ['address1','address2','city','state','zip'].forEach(function(k){d[k]=dem[k]||'';});
   d.addressPreloadedFrom='CHARM';
  }
 }
 var ins=snapshot.insurance||{},submitted=(progress.insurance||{}).submittedAt;
 var contract=(progress.contract||{}).submittedAt;
 var explicit=!!((d.saveReceipts||{}).insurance)||!!(submitted&&submitted!==contract);
 var old=(d.reviewBaseline||{}).insurance||{};
 var member=String(d.memberId||'').trim(),bookingMember=String(source['Member ID']||'').trim();
 var booking={insuranceCarrier:source['Insurance Carrier'],insurancePlan:source['Insurance Plan'],groupId:source['Group ID']};
 var baseline={insuranceCarrier:old.carrier,insurancePlan:old.planName,groupId:old.groupNumber,payerId:old.payerId,charmPracticePayerId:old.practicePayerId};
 var draftEdit=d.subscriberIsPatient===false||['subscriberFirstName','subscriberLastName','subscriberDob'].some(function(k){return !!String(d[k]||'').trim();})||
  Object.keys(baseline).some(function(k){var value=String(d[k]||'').trim();return value&&value!==String(booking[k]||'').trim()&&value!==String(baseline[k]||'').trim();});
 // Contract signing automatically submits preloaded insurance. That receipt is
 // not an explicit insurance edit. Refresh only unchanged booking/baseline data.
 if(ins.available&&ins.memberId&&!explicit&&!draftEdit&&d.paymentChoice!=='SELF_PAY'&&
    !d.insuranceCardReviewRequired&&!d.insuranceAssistanceRequested&&!d.insuranceChanged&&
    !(d.followUpReview||{}).insuranceChanged&&
    (!member||member===bookingMember||member===String(old.memberId||'').trim())) {
  d.paymentChoice='INSURANCE';d.insuranceCarrier=ins.carrier||'';d.memberId=ins.memberId;
  d.payerId=ins.payerId||'';d.charmPracticePayerId=ins.practicePayerId||'';
  d.insurancePlan=ins.planName||'';d.groupId=ins.groupNumber||'';
  if(typeof ins.subscriberIsPatient==='boolean')d.subscriberIsPatient=ins.subscriberIsPatient;
  ['subscriberFirstName','subscriberLastName','subscriberDob'].forEach(function(k){d[k]=ins[k]||'';});
  // On file is not a new eligibility check, uploaded-card receipt or consent.
 }
 return d;
}

function fdg357PolicyKey_(d) {
 return JSON.stringify(['memberId','payerId','charmPracticePayerId','groupId','subscriberIsPatient',
  'subscriberFirstName','subscriberLastName','subscriberDob'].map(function(k){return d[k]==null?'':String(d[k]).trim();}));
}




// Required visit history, approved 2026-11-12. Optional medical saves cannot overwrite it.
var FDGVisit360=(function(){
 var problems=['Fungal toenail','Ingrown toenail','Loose toenail','Heel pain','Painful callus','Skin lesion','Foot pain','Foot fracture / suspected fracture','Painful bunion','Painful hammertoe','Underlapping / overlapping toe','Ankle sprain','Leg cramping','Blister','Other'];
 var labels={problem:'What brings you in?',description:'Please describe your concern',side:'Which side?',location:'Where exactly?',toe:'Which toe?',border:'Which nail edge?',symptoms:'What does it feel or look like?',onset:'How did it start?',duration:'How long has this been going on?',course:'Since it started, is it…',worse:'What makes it worse?',better:'What makes it better?',treatment:'What have you tried, and did it help?'};
 function nail(h){return /toenail|hammertoe|lapping/.test(h.problem||'');}
 function keys(h){return ['problem','side','location','symptoms','onset','duration','course','worse','better','treatment'].concat(h.problem==='Other'?['description']:[],nail(h)?['toe']:[],h.problem==='Ingrown toenail'?['border']:[]);}
 function missing(h){h=h||{};return ['problem'].concat(h.problem==='Other'?['description']:[]).filter(function(k){return !String(h[k]||'').trim()||(k==='problem'&&problems.indexOf(h.problem)<0);});}
 function summary(h){h=h||{};var order=['problem','description','side','location','toe','border','symptoms','onset','duration','course','worse','better','treatment'];var titles={problem:'Concern',description:'Description',side:'Side',location:'Location',toe:'Toe',border:'Nail edge',symptoms:'Symptoms',onset:'Onset',duration:'Duration',course:'Course',worse:'Worse with',better:'Better with',treatment:'Treatment tried'};return order.filter(function(k){return keys(h).indexOf(k)>=0&&String(h[k]||'').trim();}).map(function(k){return titles[k]+': '+String(h[k]).trim();}).join('\n');}

return {missing:missing,summary:summary};})();
function fdg360MissingVisit_(h){return FDGVisit360.missing(h);}
function fdg360ValidateVisit_(d){if(fdg360MissingVisit_(d.visitHistory).length)throw new Error("Please tell us your reason for visiting.");}
function fdg360VisitSummary_(h){return FDGVisit360.summary(h);}
