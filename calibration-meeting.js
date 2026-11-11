// Configuration
const config = {
  supabaseUrl: null,
  restUrl: null,
  apiKey: null,
  serviceKey: null
};

function isRetentionQueue(queue) {
  return queue === 'Retention' || queue === 'Order Support';
}

function buildAliasOrFilter(column, values) {
  const validValues = (values || []).filter(Boolean);
  if (!validValues.length) return '';
  const clauses = validValues.map((value) => `${column}.eq.${encodeURIComponent(value)}`);
  return `or=(${clauses.join(',')})`;
}

function showAlert(msg, opts = {}) {
  try {
    const options = typeof opts === 'object' && opts ? opts : {};
    let type = options.type || 'warning';
    const lowerMsg = (msg || '').toLowerCase();
    if (!options.type) {
      if (lowerMsg.includes('success')) type = 'success';
      else if (lowerMsg.includes('fail') || lowerMsg.includes('error') || lowerMsg.includes('not authenticated')) type = 'error';
      else if (lowerMsg.includes('duplicate') || lowerMsg.includes('please') || lowerMsg.includes('empty')) type = 'warning';
      else type = 'info';
 }
    const title = options.title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'warning' ? 'Heads up' : 'Notice');

    let overlay = document.getElementById('appAlertOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'appAlertOverlay';
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '9999';
      document.body.appendChild(overlay);
 }
    overlay.style.background = ((type === 'warning' || type === 'success') ? 'transparent' : 'rgba(0, 0, 0, 0.45)');
    overlay.innerHTML = '';

    const card = document.createElement('div');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.getAttribute('data-theme') === 'light';
    const fallbackBg = isLight ? '#ffffff' : '#1e293b';
    card.style.background = `var(--bg-popup, ${fallbackBg})`;
    card.style.backdropFilter = 'none';
    card.style.webkitBackdropFilter = 'none';
    card.style.color = 'var(--text-primary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = '16px';
    card.style.boxShadow = 'var(--shadow)';
    card.style.maxWidth = '520px';
    card.style.width = '92%';
    card.style.padding = '20px';
    card.style.position = 'relative';

    const accent = document.createElement('div');
    accent.style.position = 'absolute';
    accent.style.top = '0';
    accent.style.left = '0';
    accent.style.height = '4px';
    accent.style.width = '100%';
    const colorMap = {
      success: 'var(--success-color)',
      warning: 'var(--warning-color)',
      error: 'var(--danger-color)',
      info: 'var(--primary-color)'
 };
    accent.style.background = colorMap[type] || 'var(--primary-color)';
    card.appendChild(accent);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '10px';
    closeBtn.style.right = '12px';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'var(--text-primary)';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '16px';
    closeBtn.addEventListener('click', () => { overlay.remove(); });
    card.appendChild(closeBtn);

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.fontSize = '16px';
    titleEl.style.fontWeight = '700';
    titleEl.style.marginBottom = '8px';
    card.appendChild(titleEl);

    const msgContainer = document.createElement('div');
    msgContainer.style.color = 'var(--text-secondary)';
    msgContainer.style.fontSize = '14px';
    const lines = (msg || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      const intro = document.createElement('div');
      intro.textContent = 'Please review and complete the following:';
      intro.style.marginBottom = '6px';
      msgContainer.appendChild(intro);
      const ul = document.createElement('ul');
      ul.style.paddingLeft = '18px';
      ul.style.margin = '8px 0 0';
      lines.forEach((line) => {
        const li = document.createElement('li');
        li.textContent = line.replace(/^\-?\s*/, '');
        ul.appendChild(li);
 });
      msgContainer.appendChild(ul);
 } else {
      const p = document.createElement('p');
      p.textContent = msg || '';
      msgContainer.appendChild(p);
 }
    card.appendChild(msgContainer);

    const footer = document.createElement('div');
    footer.style.marginTop = '16px';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Okay';
    okBtn.className = 'global-btn';
    okBtn.addEventListener('click', () => { overlay.remove(); });
    footer.appendChild(okBtn);
    card.appendChild(footer);

    overlay.appendChild(card);
 } catch (e) {
    alert(msg);
 }
}

// Attributes definition (aligned with DB columns)
const DB_ATTRIBUTES_T2 = [
  { label: 'Interaction Protocols', key: 'interaction_protocols', commentKey: 'comment_interaction_protocols' },
  { label: 'Understanding', key: 'understanding', commentKey: 'comment_Understanding' },
  { label: 'Effectiveness & FCR', key: 'effectiveness_&_FCR', commentKey: 'comment_Effectiveness_&_FCR' },
  { label: 'Engagement & Language', key: 'engagement_&_Langauge', commentKey: 'comment_Engagement_&_Langauge' },
  { label: 'Retention / Sales Skills', key: 'retention_Skills', commentKey: 'comment_Retention_Skills' },
  { label: 'Offering Alternatives', key: 'offering_Alternatives', commentKey: 'comment_Offering_Alternatives' },
  { label: 'Product Awareness', key: 'product_Awareness', commentKey: 'comment_Product_Awareness' },
  { label: 'Process Awareness', key: 'process_Awareness', commentKey: 'comment_Process_Awareness' },
  { label: 'Tempo Values', key: 'tempo_Values', commentKey: 'comment_Tempo_Values' },
  { label: 'Verification', key: 'verfication', commentKey: 'comment_Verfication' },
  { label: 'CRM Updates', key: 'crm_updates', commentKey: 'comment_CRM_Updates' },
  { label: 'Documentation', key: 'documentation', commentKey: 'comment_Documentation' },
  { label: 'Workflow', key: 'workflow', commentKey: 'comment_Workflow' },
  { label: 'Ownership', key: 'ownership', commentKey: 'comment_ownership' }
];

const DB_ATTRIBUTES_SALES_RET_CALIBRATION = [
  { label: 'Interaction Protocols', key: 'interaction_protocols', commentKey: 'comment_interaction_protocols' },
  { label: 'Understanding', key: 'understanding', commentKey: 'comment_Understanding' },
  { label: 'Effectiveness & FCR', key: 'effectiveness_&_FCR', commentKey: 'comment_Effectiveness_&_FCR' },
  { label: 'Engagement & Language', key: 'engagement_&_Langauge', commentKey: 'comment_Engagement_&_Langauge' },
  { label: 'Retention / Sales Skills', key: 'retention_skills', commentKey: 'comment_Retention_Skills' },
  { label: 'Offering Alternatives', key: 'offering_alternatives', commentKey: 'comment_Offering_Alternatives' },
  { label: 'Product Awareness', key: 'product_awareness', commentKey: 'comment_Product_Awareness' },
  { label: 'Process Awareness', key: 'process_awareness', commentKey: 'comment_Process_Awareness' },
  { label: 'Tempo Values', key: 'tempo_values', commentKey: 'comment_Tempo_Values' },
  { label: 'Verification', key: 'verfication', commentKey: 'comment_Verification' },
  { label: 'Documentation & CRM Updates', key: 'documentation_crm', commentKey: 'comment_Documentation_crm' },
  { label: 'Workflow', key: 'workflow', commentKey: 'comment_Workflow' },
  { label: 'Ownership', key: 'ownership', commentKey: 'comment_ownership' }
];

const DB_ATTRIBUTES_T1 = [
  { label: 'Interaction Protocols', key: 'Interaction_Protocols', commentKey: 'Comments_Interaction_Protocols' },
  { label: 'Understanding / Diagnose', key: 'Correctly_Diagnose', commentKey: 'Comments_Correctly_Diagnose' },
  { label: 'Effectiveness', key: 'Effectiveness', commentKey: 'Comments_Effectiveness' },
  { label: 'FCR', key: 'FCR', commentKey: 'Comments_FCR' },
  { label: 'Soft Skills', key: 'Soft_Skills', commentKey: 'Comments_Soft_Skills' },
  { label: 'Language', key: 'Language', commentKey: 'Comments_Language' },
  { label: 'Sales', key: 'Sales', commentKey: 'Sales_Comments' },
  { label: 'Product Awareness', key: 'Product_Awareness', commentKey: 'Comments_Product_Awareness' },
  { label: 'Process Awareness', key: 'Process_Awareness', commentKey: 'Comments_Process_Awareness' },
  { label: 'Brand Representation Ownership', key: 'Brand_Representation_Ownership', commentKey: 'comm_Brand_Representation_Ownership' },
  { label: 'Verification', key: 'Verification', commentKey: 'Comments_Verification' },
  { label: 'CRM Updates', key: 'CRM_Updates', commentKey: 'Comments_CRM_Updates' },
  { label: 'Documentation', key: 'Documentation', commentKey: 'Comments_Documentation' },
  { label: 'Workflow', key: 'Workflow', commentKey: 'Comments_Workflow' },
  { label: 'Responsiveness', key: 'Responsiveness', commentKey: 'Comments_Responsiveness' }
];

const DB_ATTRIBUTES_SMS = [
  { label: 'Workflow Compliance', key: 'Workflow_Compliance', commentKey: 'com_Workflow_Compliance' },
  { label: 'CRM & Documentation', key: 'CRM_Utilization_and_Accurate_Documentation', commentKey: 'com_CRM_Utilization_and_Accurate_Documentation' },
  { label: 'Product & Tempo', key: 'Product_Expertise_and_Tempo_Representation', commentKey: 'com_Product_Expertise_and_Tempo_Representation' },
  { label: 'Professionalism', key: 'Professionalism_and_Interpersonal_Skills', commentKey: 'com_Professionalism_and_Interpersonal_Skills' },
  { label: 'Clear Communication', key: 'Clear_and_Concise_Communication', commentKey: 'com_Clear_and_Concise_Communication' },
  { label: 'Language', key: 'Language_Precision_and_Accuracy', commentKey: 'com_Language_Precision_and_Accuracy' },
  { label: 'Sales & Persuasion', key: 'Effective_Sales_Promotion_and_Customer_Persuasion', commentKey: 'com_Effective_Sales_Promotion_and_Customer_Persuasion' },
  { label: 'Engagement', key: 'Personalized_Customer_Engagement', commentKey: 'com_Personalized_Customer_Engagement' }
];

const DB_ATTRIBUTES_WINS = [
  { label: 'Brand Energy & Protocol', key: 'brand_energy_protocol', commentKey: 'brand_energy_protocol_comment' },
  { label: 'Discovery & History Review', key: 'discovery_history_review', commentKey: 'discovery_history_review_comment' },
  { label: 'Clarity and Concise Explaination', key: 'clarity_and_concise_explaination', commentKey: 'clarity_and_concise_explaination_comment' },
  { label: 'Human Engagement & Soft Skills', key: 'human_engagement_soft_skills', commentKey: 'human_engagement_soft_skills_comment' },
  { label: 'Value Positioning & Objection Handling', key: 'value_positioning_objection_handling', commentKey: 'value_positioning_objection_handling_comment' },
  { label: 'Tailored Concessions & Alternatives', key: 'tailored_concessions_alternatives', commentKey: 'tailored_concessions_alternatives_comment' },
  { label: 'Closing & FCR', key: 'closing_fcr', commentKey: 'closing_fcr_comment' },
  { label: 'Product Awareness', key: 'product_awareness', commentKey: 'product_awareness_comment' },
  { label: 'Brand Representation and Ownership', key: 'brand_representation_ownership', commentKey: 'brand_representation_ownership_comment' },
  { label: 'Process Awareness', key: 'process_awareness', commentKey: 'process_awareness_comment' },
  { label: 'Verfication', key: 'verfication', commentKey: 'verfication_comment' },
  { label: 'Documentation & CRM Updates', key: 'documentation_crm_updates', commentKey: 'documentation_crm_updates_comment' }
];

// Default to T2 OS attributes
let currentAttributes = DB_ATTRIBUTES_T2;
let lastResults = [];
let calibSummaryState = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Load configuration first
  await loadConfig();

  const loadBtn = document.getElementById('loadBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', loadResults);
 }
  
  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearResults);
 }
  
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportResultsCSV);
 }

  const completeBtn = document.getElementById('completeBtn');
  if (completeBtn) {
    completeBtn.addEventListener('click', completeCalibration);
 }
  
  const queueSelect = document.getElementById('queueSelect');
  if (queueSelect) {
    queueSelect.addEventListener('change', handleQueueChange);
 }

  const convIdSelect = document.getElementById('convIdSelect');
  if (convIdSelect) {
    convIdSelect.addEventListener('change', () => {
      // Sync to hidden input if needed, or just use the select value directly
      const input = document.getElementById('convIdInput');
      if (input) input.value = convIdSelect.value;
 });
 }

  // Auto-load if param exists
  const params = new URLSearchParams(window.location.search);
  const convId = params.get('conversation_id');
  if (convId) {
    document.getElementById('convIdInput').value = convId;
    // We might need to handle pre-populating the dropdown if we want to show it correctly
    // But for now, let's assume manual selection for the new flow
    // loadResults(); // Defer loading until queue is selected or logic updated
 }

  initCalibrationSummaryModal();
  initEmailPreviewModal();
});

function initEmailPreviewModal() {
  const modal = document.getElementById('emailPreviewModal');
  const closeBtn = document.getElementById('emailPreviewCloseBtn');
  if (!modal) return;

  const close = () => { modal.style.display = 'none'; };
  if (closeBtn) closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display !== 'none') close(); });
}

function openEmailPreviewModal(html) {
  const modal = document.getElementById('emailPreviewModal');
  const frame = document.getElementById('emailPreviewFrame');
  if (!modal || !frame) return;
  frame.srcdoc = html || '';
  modal.style.display = 'flex';
}

function initCalibrationSummaryModal() {
  const modal = document.getElementById('calibSummaryModal');
  const closeBtn = document.getElementById('calibSummaryCloseBtn');
  const sendBtn = document.getElementById('calibSummarySendBtn');
  const previewBtn = document.getElementById('calibSummaryPreviewBtn');
  if (!modal) return;

  const close = () => {
    modal.style.display = 'none';
    calibSummaryState = null;
 };

  if (closeBtn) closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.style.display !== 'none') close(); });

  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      if (!calibSummaryState) {
        showAlert('Nothing to send. Please load results and try again.', { type: 'warning', title: 'Heads up' });
        return;
 }
      const commentInput = document.getElementById('calibCommentInput');
      const comment = (commentInput && commentInput.value ? commentInput.value : '').toString();

      commitToDraftIntoState();
      commitCcDraftIntoState();
      const { toRecipients, ccEmails, queue, convId, hebaName, alignmentScore, yesItems, noItems, takerNames } = calibSummaryState;
      const to = (toRecipients || []).map(r => r.email).filter(Boolean);
      if (to.length === 0) {
        showAlert('No emails found for takers', { type: 'warning', title: 'Heads up' });
        return;
 }

      const html = buildCalibrationMeetingSummaryEmailHTML({
        queue,
        convId,
        hebaName,
        alignmentScore,
        yesItems,
        noItems,
        takerNames,
        comment
 });
      const subjectQueue = queue || 'Calibration';
      const subject = `Calibration Summary - ${subjectQueue}`;

      try {
        sendBtn.disabled = true;
        const ok = await sendEmailSMTP({ html, to: to.join(','), cc: Array.isArray(ccEmails) ? ccEmails : [], subject });
        if (!ok) {
          showAlert('Email could not be sent.', { type: 'error', title: 'Email issue' });
          return;
 }
        await markCalibrationCompleted(convId, queue);
        updateCompleteButtonState(true);
        await syncCalibrationCompletedState(convId, queue, false);
        showAlert('Email sent successfully.', { type: 'success', title: 'Success' });
        close();
 } catch (e) {
        showAlert('Failed to send email.', { type: 'error', title: 'Email issue' });
 } finally {
        sendBtn.disabled = false;
 }
 });
 }

  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      if (!calibSummaryState) {
        showAlert('Nothing to preview. Please load results and try again.', { type: 'warning', title: 'Heads up' });
        return;
 }
      const commentInput = document.getElementById('calibCommentInput');
      const comment = (commentInput && commentInput.value ? commentInput.value : '').toString();
      const { queue, convId, hebaName, alignmentScore, yesItems, noItems, takerNames } = calibSummaryState;
      const html = buildCalibrationMeetingSummaryEmailHTML({
        queue, convId, hebaName, alignmentScore, yesItems, noItems, takerNames, comment
 });
      openEmailPreviewModal(html);
 });
 }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').toString().trim());
}

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

function parseEmailList(raw) {
  return (raw || '')
    .toString()
    .split(/[,\n]/g)
    .map(x => x.trim())
    .filter(Boolean);
}

function renderEmailChips(container, chips, onRemove) {
  if (!container) return;
  container.innerHTML = '';
  (chips || []).forEach((chip, idx) => {
    const wrapper = document.createElement('span');
    wrapper.className = 'calib-chip';
    const text = document.createElement('span');
    text.className = 'calib-chip-text';
    text.textContent = chip.label || chip.email || '';
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'calib-chip-x';
    x.textContent = '×';
    x.addEventListener('click', () => onRemove(idx));
    wrapper.appendChild(text);
    wrapper.appendChild(x);
    container.appendChild(wrapper);
 });
}

function refreshToChips() {
  if (!calibSummaryState) return;
  const toBox = document.getElementById('calibToChips');
  if (!toBox) return;
  const removeAt = (idx) => {
    const updated = (calibSummaryState.toRecipients || []).filter((_, i) => i !== idx);
    calibSummaryState.toRecipients = updated;
    refreshToChips();
 };
  renderEmailChips(toBox, calibSummaryState.toRecipients || [], removeAt);
  ensureToAddInput(toBox);
}

function refreshCcChips() {
  if (!calibSummaryState) return;
  const ccBox = document.getElementById('calibCcChips');
  if (!ccBox) return;
  const removeAt = (idx) => {
    const updated = (calibSummaryState.ccEmails || []).filter((_, i) => i !== idx);
    calibSummaryState.ccEmails = updated;
    refreshCcChips();
 };
  renderEmailChips(ccBox, (calibSummaryState.ccEmails || []).map(e => ({ email: e, label: e })), removeAt);
  ensureCcAddInput(ccBox);
}

function wireRecipientInput(input, commitFn) {
  if (!input) return;
  input.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitFn();
 }
 };
  input.onblur = () => { commitFn(); };
  input.onpaste = () => { setTimeout(() => commitFn(), 0); };
}

function ensureCcAddInput(container) {
  if (!container) return null;
  let input = document.getElementById('calibCcAddInput');
  if (!input) {
    input = document.createElement('input');
    input.id = 'calibCcAddInput';
    input.className = 'calib-chip-input';
    input.type = 'text';
    input.placeholder = 'Add CC emails...';
    container.appendChild(input);
 }
  wireRecipientInput(input, commitCcDraftIntoState);
  return input;
}

function ensureToAddInput(container) {
  if (!container) return null;
  let input = document.getElementById('calibToAddInput');
  if (!input) {
    input = document.createElement('input');
    input.id = 'calibToAddInput';
    input.className = 'calib-chip-input';
    input.type = 'text';
    input.placeholder = 'Add To emails...';
    container.appendChild(input);
 }
  wireRecipientInput(input, commitToDraftIntoState);
  return input;
}

function commitToDraftIntoState() {
  if (!calibSummaryState) return;
  const input = document.getElementById('calibToAddInput');
  if (!input) return;
  const raw = input.value || '';
  const tokens = parseEmailList(raw);
  if (tokens.length === 0) return;
  const next = Array.isArray(calibSummaryState.toRecipients) ? [...calibSummaryState.toRecipients] : [];
  const existing = new Set(next.map(r => normalizeEmail(r.email)));
  tokens.forEach(t => {
    if (!isValidEmail(t)) return;
    const n = normalizeEmail(t);
    if (existing.has(n)) return;
    next.push({ email: t.trim(), label: t.trim() });
    existing.add(n);
 });
  calibSummaryState.toRecipients = next;
  input.value = '';
  refreshToChips();
}

function commitCcDraftIntoState() {
  if (!calibSummaryState) return;
  const input = document.getElementById('calibCcAddInput');
  if (!input) return;
  const raw = input.value || '';
  const tokens = parseEmailList(raw);
  if (tokens.length === 0) return;
  const next = Array.isArray(calibSummaryState.ccEmails) ? [...calibSummaryState.ccEmails] : [];
  const existing = new Set(next.map(normalizeEmail));
  tokens.forEach(t => {
    if (!isValidEmail(t)) return;
    const n = normalizeEmail(t);
    if (existing.has(n)) return;
    next.push(t.trim());
    existing.add(n);
 });
  calibSummaryState.ccEmails = next;
  input.value = '';
  refreshCcChips();
}

function escapeHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildCalibrationMeetingSummaryEmailHTML({ queue, convId, hebaName, alignmentScore, yesItems, noItems, takerNames, comment }) {
  const safeQueue = escapeHtml(queue || '');
  const safeConv = escapeHtml(convId || '');
  const safeHeba = escapeHtml(hebaName || 'Heba El Sobky');
  const safeComment = escapeHtml((comment || '').trim());
  const scoreText = (alignmentScore == null) ? 'Pending' : `${alignmentScore}%`;

  const pill = (label, value) => `
    <span style="display:inline-flex;align-items:center;gap:8px;border:1px solid #e5e7eb;background:#f3f4f6;color:#111827;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;">
      <span style="color:#6b7280;font-weight:700;">${escapeHtml(label)}:</span>
      <span style="font-weight:900;">${escapeHtml(value)}</span>
    </span>
  `;

  const itemRow = (it) => {
    const label = escapeHtml(it.label || '');
    const val = escapeHtml(it.value || '');
    const pct = (it.scorePercent == null) ? '—' : `${it.scorePercent}%`;
    const alignedText = (it.matchCount != null && it.totalCount != null) ? `${it.matchCount}/${it.totalCount} aligned` : '';
    const badgeBg = val === 'Yes' ? '#dcfce7' : (val === 'No' ? '#fee2e2' : '#f3f4f6');
    const badgeColor = val === 'Yes' ? '#166534' : (val === 'No' ? '#991b1b' : '#475569');
    const badgeBorder = val === 'Yes' ? '#bbf7d0' : (val === 'No' ? '#fecaca' : '#e5e7eb');
    return `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">${label}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #eef2f7;">
          <span style="display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;border:1px solid ${badgeBorder};background:${badgeBg};color:${badgeColor};font-weight:900;font-size:12px;">${val}</span>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid #eef2f7;">
          <div style="color:#1d4ed8;font-weight:900;">${escapeHtml(pct)}</div>
          ${alignedText ? `<div style="margin-top:2px;color:#6b7280;font-size:12px;font-weight:700;">${escapeHtml(alignedText)}</div>` : ``}
        </td>
      </tr>
    `;
 };

  const yesRows = (yesItems || []).map(itemRow).join('') || `
    <tr><td colspan="3" style="padding:14px;color:#6b7280;">No Yes attributes found.</td></tr>`;
  const noRows = (noItems || []).map(itemRow).join('') || `
    <tr><td colspan="3" style="padding:14px;color:#6b7280;">No No attributes found.</td></tr>`;

  const recipientsCount = Array.isArray(takerNames) ? takerNames.filter(Boolean).length : 0;
  const safeRecipients = recipientsCount ? `${recipientsCount} attendees` : 'Attendees';

  const commentBlock = safeComment
    ? `<div style="margin-top:14px;border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;background:#ffffff;">
         <div style="font-weight:900;color:#111827;margin-bottom:6px;">Facilitator note</div>
         <div style="white-space:pre-wrap;color:#374151;line-height:1.5;">${safeComment}</div>
       </div>`
    : '';

  const introBlock = `
    <div style="margin:16px 0 10px;color:#111827;line-height:1.6;">
      <div>Hello All,</div>
      <div style="margin-top:8px;">Thank you for your submissions and insights. We agreed on:</div>
    </div>
  `;

  const twoCol = `
    <table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 12px;">
      <tr>
        <td style="width:50%;padding-right:6px;vertical-align:top;">
          <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff;">
            <div style="padding:12px 14px;background:rgba(34,197,94,0.10);border-bottom:1px solid #e5e7eb;">
              <div style="font-weight:900;color:#166534;">Attributes that should be Yes</div>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Attribute</th>
                  <th style="text-align:left;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Value</th>
                  <th style="text-align:left;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Match</th>
                </tr>
              </thead>
              <tbody>${yesRows}</tbody>
            </table>
          </div>
        </td>
        <td style="width:50%;padding-left:6px;vertical-align:top;">
          <div style="border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff;">
            <div style="padding:12px 14px;background:rgba(239,68,68,0.10);border-bottom:1px solid #e5e7eb;">
              <div style="font-weight:900;color:#991b1b;">Attributes that should be No</div>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Attribute</th>
                  <th style="text-align:left;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Value</th>
                  <th style="text-align:left;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Match</th>
                </tr>
              </thead>
              <tbody>${noRows}</tbody>
            </table>
          </div>
        </td>
      </tr>
    </table>
  `;

  const wrapper = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',Arial,'Noto Sans',sans-serif;background:#ffffff;padding:0;margin:0;">
      <div style="max-width:980px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="padding:22px 18px;background-image:linear-gradient(135deg,#4f46e5,#8b5cf6);color:#ffffff;">
          <div style="font-size:18px;font-weight:900;">Calibration Meeting Summary</div>
          <div style="margin-top:6px;opacity:0.95;font-size:13px;">${safeRecipients} • Queue ${safeQueue || '—'} • Conversation ${safeConv || '—'}</div>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;">
            ${pill('Facilitator', safeHeba)}
            ${pill('Alignment', scoreText)}
          </div>
        </div>
        <div style="padding:10px 18px 18px;background:#ffffff;">
          ${introBlock}
          ${twoCol}
          ${commentBlock}
          <div style="margin-top:16px;color:#111827;line-height:1.6;">Thank you and see you next calibration.</div>
          <div style="margin-top:14px;color:#6b7280;font-size:12px;text-align:center;">
            Generated by Happio Calibration Meeting
          </div>
        </div>
      </div>
    </div>
  `;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background:#ffffff;">${wrapper}</body></html>`;
}

function openCalibrationSummaryModal({ queue, convId, hebaName, alignmentScore, yesItems, noItems, takerNames, toRecipients, ccDefaults = [] }) {
  const modal = document.getElementById('calibSummaryModal');
  const titleEl = document.getElementById('calibSummaryTitle');
  const subEl = document.getElementById('calibSummarySub');
  const bodyEl = document.getElementById('calibSummaryBody');
  const commentEl = document.getElementById('calibCommentInput');
  if (!modal || !bodyEl) return;

  const safe = (s) => escapeHtml(s || '');
  const countYes = Array.isArray(yesItems) ? yesItems.length : 0;
  const countNo = Array.isArray(noItems) ? noItems.length : 0;
  const attendeeCount = Array.isArray(takerNames) ? takerNames.filter(Boolean).length : 0;
  const scoreText = alignmentScore == null ? 'Pending' : `${alignmentScore}%`;

  if (titleEl) titleEl.textContent = 'Calibration Summary';
  if (subEl) subEl.textContent = `Queue: ${queue || '—'} • Conversation: ${convId || '—'} • Recipients: ${attendeeCount || 0}`;
  if (commentEl) commentEl.value = '';

  const renderItem = (it) => {
    const label = safe(it.label);
    const value = safe(it.value);
    const scorePercent = it.scorePercent == null ? null : it.scorePercent;
    const matchText = scorePercent == null ? 'Pending' : `${scorePercent}%`;
    const meta = (it.matchCount != null && it.totalCount != null) ? `${it.matchCount}/${it.totalCount} aligned` : '';
    const badgeClass = value === 'Yes' ? 'calib-badge yes' : (value === 'No' ? 'calib-badge no' : 'calib-badge pending');
    return `
      <div class="calib-item">
        <div>
          <div class="calib-item-name">${label}</div>
          <div class="calib-item-meta">${meta}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
          <span class="${badgeClass}">${value || '—'}</span>
          <span class="calib-pill">${matchText}</span>
        </div>
      </div>
    `;
 };

  const yesList = (yesItems || []).map(renderItem).join('') || `<div style="color:var(--text-secondary);">No attributes marked Yes.</div>`;
  const noList = (noItems || []).map(renderItem).join('') || `<div style="color:var(--text-secondary);">No attributes marked No.</div>`;

  bodyEl.innerHTML = `
    <div class="calib-panel" style="grid-column: 1 / -1; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <span class="calib-pill">Facilitator: ${safe(hebaName || 'Heba El Sobky')}</span>
        <span class="calib-pill">Alignment: ${safe(scoreText)}</span>
        <span class="calib-pill">Yes: ${countYes}</span>
        <span class="calib-pill">No: ${countNo}</span>
      </div>
      <div style="color:var(--text-secondary); font-size:12px;">Match = % of attendees aligned with Heba</div>
    </div>

    <div class="calib-panel">
      <div class="calib-panel-title">
        <span>1- The attributes that should be Yes</span>
        <span class="calib-badge yes">${countYes}</span>
      </div>
      <div class="calib-list">${yesList}</div>
    </div>

    <div class="calib-panel">
      <div class="calib-panel-title">
        <span>2- The attributes that should be No</span>
        <span class="calib-badge no">${countNo}</span>
      </div>
      <div class="calib-list">${noList}</div>
    </div>
  `;

  const normalizedTo = [];
  const toSeen = new Set();
  (Array.isArray(toRecipients) ? toRecipients : []).forEach(r => {
    const email = r && r.email ? r.email : '';
    if (!isValidEmail(email)) return;
    const n = normalizeEmail(email);
    if (toSeen.has(n)) return;
    toSeen.add(n);
    normalizedTo.push({ email: email.trim(), label: (r.label || '').toString() || email.trim() });
 });

  const normalizedCc = [];
  const ccSeen = new Set();
  (Array.isArray(ccDefaults) ? ccDefaults : []).forEach(e => {
    if (!isValidEmail(e)) return;
    const n = normalizeEmail(e);
    if (ccSeen.has(n)) return;
    ccSeen.add(n);
    normalizedCc.push(e.trim());
 });
  calibSummaryState = {
    toRecipients: normalizedTo,
    ccEmails: normalizedCc,
    queue,
    convId,
    hebaName,
    alignmentScore,
    yesItems,
    noItems,
    takerNames
 };

  refreshToChips();
  refreshCcChips();

  const toBox = document.getElementById('calibToChips');
  const toInput = ensureToAddInput(toBox);
  if (toInput) {
    toInput.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commitToDraftIntoState();
 }
 };
    toInput.onblur = () => { commitToDraftIntoState(); };
 }

  const ccBox = document.getElementById('calibCcChips');
  const ccInput = ensureCcAddInput(ccBox);
  if (ccInput) {
    ccInput.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commitCcDraftIntoState();
 }
 };
    ccInput.onblur = () => { commitCcDraftIntoState(); };
 }

  modal.style.display = 'flex';
}

async function handleQueueChange() {
  const queue = document.getElementById('queueSelect').value;
  const convSelect = document.getElementById('convIdSelect');
  
  if (!queue) return;
  
  convSelect.innerHTML = '<option>Loading...</option>';
  convSelect.disabled = true;

  try {
    let url = '';
    
    if (queue === 'Sales') {
      url = `${config.restUrl}/Assigning_Calibration?type=eq.${encodeURIComponent(queue)}&select=Conversation_Id,day,Score_card,type&order=day.desc`;
 } else if (isRetentionQueue(queue)) {
      url = `${config.restUrl}/Assigning_Calibration?${buildAliasOrFilter('type', ['Retention', 'Order Support'])}&select=Conversation_Id,day,Score_card,type&order=day.desc`;
 } else if (queue === 'SMS') {
      url = `${config.restUrl}/Assigning_Calibration?Score_card=eq.SMS_Scorecard&select=Conversation_Id,day,Score_card,type&order=day.desc`;
 } else if (queue === 'MX-T1') {
      url = `${config.restUrl}/Assigning_Calibration?Score_card=eq.MX-T1_Scorecard&select=Conversation_Id,day,Score_card,type&order=day.desc`;
 } else if (queue === 'Wins') {
      url = `${config.restUrl}/Assigning_Calibration?Score_card=eq.Wins_Scorecard&select=Conversation_Id,day,Score_card,type&order=day.desc`;
 }

    if (url) {
      const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      
      convSelect.innerHTML = '<option value="" disabled selected>Select Conversation ID</option>';
      data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.Conversation_Id;
        option.textContent = `${item.Conversation_Id} (${item.day || 'No Date'})`;
        convSelect.appendChild(option);
 });
      convSelect.disabled = false;
 }
 } catch (e) {
    console.error('Error fetching conversations:', e);
    convSelect.innerHTML = '<option value="">Error loading</option>';
 }
}

async function loadConfig() {
  try {
    const response = await fetch('/database_config.json');
    if (!response.ok) throw new Error('Failed to load config');
    const json = await response.json();
    config.supabaseUrl = json.supabase.url;
    config.restUrl = json.supabase.rest_url;
    config.apiKey = json.supabase.client_api_key;
    config.serviceKey = json.supabase.service_key || null;
 } catch (err) {
    console.error('Error loading config:', err);
    showAlert('Failed to load application configuration.', { type: 'error', title: 'Configuration error' });
 }
}

function authHeaders(opts = {}) {
  const { useServiceKey = false } = opts;
  const token = localStorage.getItem('login_token') || '';
  
  // Logic from other files: Use token if > 20 chars, otherwise fallback to apiKey (anon)
  // This allows the request to proceed with anon key if token is missing/invalid-length,
  // potentially solving issues where a bad token prevents even public reads (if allowed).
  const useBearer = (useServiceKey && config.serviceKey)
    ? config.serviceKey
    : ((token && token.length > 20) ? token : (config.apiKey || ''));
    
  const apiHeader = (useServiceKey && config.serviceKey) ? config.serviceKey : (config.apiKey || '');
  
  return {
    'apikey': apiHeader,
    'Authorization': `Bearer ${useBearer}`,
    'Content-Type': 'application/json',
    'Prefer': 'count=exact'
 };
}

async function loadResults() {
  const convId = document.getElementById('convIdInput').value.trim();
  const queue = document.getElementById('queueSelect').value;
  const container = document.getElementById('resultsContainer');
  
  if (!convId) {
    showAlert('Please enter a Conversation ID', { type: 'warning', title: 'Heads up' });
    return;
 }

  if (!queue) {
    showAlert('Please select a Queue', { type: 'warning', title: 'Heads up' });
    return;
 }
  
  // Set current attributes based on queue
  if (queue === 'SMS') {
    currentAttributes = DB_ATTRIBUTES_SMS;
 } else if (queue === 'MX-T1') {
    currentAttributes = DB_ATTRIBUTES_T1;
 } else if (queue === 'Wins') {
    currentAttributes = DB_ATTRIBUTES_WINS;
 } else if (isRetentionQueue(queue)) {
    currentAttributes = DB_ATTRIBUTES_SALES_RET_CALIBRATION;
 } else {
    currentAttributes = DB_ATTRIBUTES_T2;
 }

  container.innerHTML = 'Loading...';
  
  try {
    const data = await fetchCalibrationData(convId, queue);
    if (!data || data.length === 0) {
      container.innerHTML = 'No results found for this Conversation ID and Queue.';
      updateCompleteButtonState(null);
      return;
 }
    const takerNames = Array.from(new Set((data || []).map(r => (r.Taker_Name || '').toString().trim()).filter(Boolean)));
    const emailMap = new Map();
    if (takerNames.length > 0) {
      try {
        const users = await fetchUserEmailsByNames(takerNames);
        (users || []).forEach(u => {
          const name = (u.Name || '').toString().trim().toLowerCase();
          const email = (u.email || '').toString().trim();
          if (name && email) emailMap.set(name, email);
 });
 } catch (e) {
 }
 }
    renderTable(data, container, emailMap);
    await syncCalibrationCompletedState(convId, queue, true);
 } catch (err) {
    console.error(err);
    if (err.message.includes('JWT expired') || err.message.includes('401')) {
       const doLogin = confirm('Your session has expired. Please log in again.');
       if (doLogin) {
         window.location.href = 'login.html';
 }
 }
    container.innerHTML = `Error loading results: ${err.message}`;
 }
}

function clearResults() {
  document.getElementById('convIdInput').value = '';
  document.getElementById('queueSelect').value = '';
  document.getElementById('resultsContainer').innerHTML = '<div style="color: var(--text-secondary);">Enter a Conversation ID to load calibration results.</div>';
  document.getElementById('alignmentScoreWidget').style.display = 'none';
  updateCompleteButtonState(null);
}

async function fetchCalibrationData(convId, queue) {
  if (!config.restUrl) {
    throw new Error('Configuration not loaded');
 }

  // Determine the table and URL based on the queue
  let tableName = 'calibration_T2_OS_NEW';
  let url = '';

  if (queue === 'SMS') {
    tableName = 'calibration_sms';
 } else if (queue === 'MX-T1') {
    tableName = 'Calibration_T1_QA_New_Scorecards';
 } else if (isRetentionQueue(queue)) {
    tableName = 'sales_ret_calibration';
 } else if (queue === 'Wins') {
    tableName = 'winsAuditSubmissions';
 } else {
    // Default for Sales (T2 OS)
    tableName = 'calibration_T2_OS_NEW';
 }

  // Construct URL
  // Note: Parameter naming might differ across tables, but assuming Conversation_ID standard
  // If T1 uses 'conversation_id' (lowercase), we might need to adjust.
  // Based on typical Supabase/PostgREST, column names are case sensitive if quoted, but typically we match DB schema.
  // Let's assume 'Conversation_ID' works for T2, check others if needed.
  // Actually, standardizing on what works for T2 first, then special case if error.
  
  if (queue === 'Wins') {
    url = `${config.restUrl}/${tableName}?conversation_id=eq.${encodeURIComponent(convId)}&calibration=eq.Yes&order=created_at.asc`;
  } else {
    url = `${config.restUrl}/${tableName}?Conversation_ID=eq.${encodeURIComponent(convId)}`;
  }
  
  if (queue === 'Sales') {
    url += `&queue=eq.${encodeURIComponent(queue)}`;
 } else if (isRetentionQueue(queue)) {
    url += `&${buildAliasOrFilter('queue', ['Retention', 'Order Support'])}`;
 }
  
  // Use Service Key to bypass RLS policies for calibration view
  const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
  
  if (!res.ok) {
    const text = await res.text();
    // Check for specific JWT expiration or auth errors
    if (res.status === 401 || text.includes('JWT expired')) {
      throw new Error(`JWT expired: ${text}`);
 }
    // Fallback: if column not found (e.g. Conversation_ID vs conversation_id), try lowercase?
    if (text.includes('Conversation_ID') && text.includes('column')) {
       // Retry with lowercase
       const retryUrl = `${config.restUrl}/${tableName}?conversation_id=eq.${encodeURIComponent(convId)}`;
       const res2 = await fetch(retryUrl, { headers: authHeaders({ useServiceKey: true }) });
       if (res2.ok) return await res2.json();
 }

    throw new Error(text);
 }
  const rows = await res.json();
  if (queue === 'Wins') {
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      Taker_Name: row.Taker_Name || row.taker_name || '',
      Agent_Name: row.Agent_Name || row.agent_name || '',
      Conversation_ID: row.Conversation_ID || row.conversation_id || ''
    }));
  }
  return rows;
}

function renderTable(data, container, emailMap) {
  // Pivot data: Columns = Takers
  lastResults = Array.isArray(data) ? data.slice() : [];

  // Sort data by Taker Name
  data.sort((a, b) => (a.Taker_Name || '').localeCompare(b.Taker_Name || ''));

  const targetName = 'Heba El Sobky';
  const normalizedTarget = targetName.toLowerCase();
  const hebaRow = (data || []).find(row => {
    const name = (row.Taker_Name || '').toString().trim().toLowerCase();
    return name === normalizedTarget;
 });

  const normalizeYesNo = (val) => {
    const v = (val || '').toString().trim().toLowerCase();
    if (v === 'yes') return 'Yes';
    if (v === 'no') return 'No';
    return '';
 };

  const takerScores = new Map();
  data.forEach(row => {
    let yesCount = 0;
    let answeredCount = 0;
    currentAttributes.forEach(attr => {
      const val = row[attr.key];
      if (val === 'Yes' || val === 'No') {
        answeredCount++;
        if (val === 'Yes') yesCount++;
 }
 });
    let label;
    if (answeredCount === 0) {
      label = 'Pending';
 } else {
      const pct = Math.round((yesCount / answeredCount) * 100);
      label = `${pct}%`;
 }
    takerScores.set(row.Taker_Name || 'Unknown', label);
 });
  
  let html = '<table class="calib-table">';
  
  // Header Row: Taker Names
  html += '<thead><tr>';
  html += '<th>Attributes</th>'; // Top-left cell
  data.forEach(row => {
    const name = row.Taker_Name || 'Unknown';
    const scoreLabel = takerScores.get(name);
    const headerText = scoreLabel ? `${name} : ${scoreLabel}` : name;
    const email = emailMap ? emailMap.get((name || '').toString().trim().toLowerCase()) : '';
    const emailLine = email ? `<div class="taker-email">${email}</div>` : '';
    html += `<th class="taker-header"><div>${headerText}</div>${emailLine}</th>`;
 });
  html += '<th style="min-width: 80px; max-width: 80px;">Score</th>'; // New Score Column at the end
  html += '</tr></thead>';
  
  html += '<tbody>';
  
  let totalScoreSum = 0;
  let scoreCount = 0;

  // Iterate through defined attributes
  currentAttributes.forEach(attr => {
    // Check if comments exist for this attribute
    const hasAnyComment = data.some(row => row[attr.commentKey]);
    
    // 1. Value Row
    html += '<tr>';
    html += `<td>${attr.label}</td>`;

    let scorePercent = null;
    if (hebaRow) {
      const hebaVal = normalizeYesNo(hebaRow[attr.key]);
      if (hebaVal) {
        const totalCount = data.length;
        const matchCount = data.reduce((acc, row) => {
          const v = normalizeYesNo(row[attr.key]);
          return acc + (v === hebaVal ? 1 : 0);
 }, 0);
        scorePercent = totalCount > 0 ? Math.round((matchCount / totalCount) * 100) : 0;
 }
 }

    if (scorePercent != null) {
      totalScoreSum += scorePercent;
      scoreCount++;
 }

    data.forEach(row => {
      const val = row[attr.key] || '-';
      let cls = '';
      if (val === 'Yes') cls = 'cell-yes';
      else if (val === 'No') cls = 'cell-no';
      else if (val === 'N/A') cls = 'cell-na';
      
      html += `<td class="${cls}">${val}</td>`;
 });
    
    // Add Score at the end of the row
    // If comments exist, rowspan=2 so it merges with the empty cell below
    const scoreCellText = scorePercent == null ? 'Pending' : `${scorePercent}%`;
    const scoreCellStyle = scorePercent == null
      ? 'font-weight: bold; background: #f3f4f6; color: #6b7280; vertical-align: middle;'
      : 'font-weight: bold; background: #f0f9ff; color: #0284c7; vertical-align: middle;';
    if (hasAnyComment) {
        html += `<td rowspan="2" style="${scoreCellStyle}">${scoreCellText}</td>`;
 } else {
        html += `<td style="${scoreCellStyle}">${scoreCellText}</td>`;
 }
    html += '</tr>';
    
    if (hasAnyComment) {
        html += '<tr class="comment-row">';
        html += `<td>Comment</td>`;
        data.forEach(row => {
          const rawComment = row[attr.commentKey];
          const comment = (rawComment || '').toString().trim();
          if (comment) {
            html += `<td><div class="comment-cell-wrapper" tabindex="0">${comment}</div></td>`;
 } else {
            html += '<td></td>';
 }
 });
        html += '</tr>';
 }
 });
  
  html += '</tbody></table>';
  container.innerHTML = html;

  // Update Alignment Score Widget
  updateAlignmentScore(data);
}

function updateAlignmentScore(data) {
  const widget = document.getElementById('alignmentScoreWidget');
  const valueSpan = document.getElementById('alignmentScoreValue');
  if (!widget || !valueSpan) return;

  const targetName = 'Heba El Sobky';
  const normalizedTarget = targetName.toLowerCase();

  const hebaRow = (data || []).find(row => {
    const name = (row.Taker_Name || '').toString().trim().toLowerCase();
    return name === normalizedTarget;
 });

  if (!hebaRow) {
    valueSpan.textContent = 'Pending';
    widget.style.display = 'flex';
    widget.style.backgroundColor = '#f3f4f6';
    widget.style.color = '#374151';
    widget.style.border = '1px solid #e5e7eb';
    return;
 }

  const normalizeYesNo = (val) => {
    const v = (val || '').toString().trim().toLowerCase();
    if (v === 'yes') return 'Yes';
    if (v === 'no') return 'No';
    return '';
 };

  let sum = 0;
  let count = 0;
  const takerCount = Array.isArray(data) ? data.length : 0;
  currentAttributes.forEach(attr => {
    const hebaVal = normalizeYesNo(hebaRow[attr.key]);
    if (!hebaVal) return;
    const matchCount = (data || []).reduce((acc, row) => {
      const v = normalizeYesNo(row[attr.key]);
      return acc + (v === hebaVal ? 1 : 0);
 }, 0);
    const pct = takerCount > 0 ? Math.round((matchCount / takerCount) * 100) : 0;
    sum += pct;
    count++;
 });

  if (count === 0) {
    valueSpan.textContent = 'Pending';
    widget.style.display = 'flex';
    widget.style.backgroundColor = '#f3f4f6';
    widget.style.color = '#374151';
    widget.style.border = '1px solid #e5e7eb';
    return;
 }

  const score = Math.round(sum / count);
  valueSpan.textContent = `${score}%`;
  widget.style.display = 'flex';

  if (score < 90) {
    widget.style.backgroundColor = '#fee2e2';
    widget.style.color = '#991b1b';
    widget.style.border = '1px solid #fecaca';
 } else {
    widget.style.backgroundColor = '#dcfce7';
    widget.style.color = '#166534';
    widget.style.border = '1px solid #bbf7d0';
 }
}

function exportResultsCSV() {
  const table = document.querySelector('#resultsContainer table.calib-table');
  if (!table) {
    showAlert('No results to export', { type: 'warning', title: 'Heads up' });
    return;
 }

  const rows = Array.from(table.rows);
  const csvLines = rows.map(tr => {
    const cells = Array.from(tr.cells);
    return cells.map(td => {
      const text = (td.innerText || '').replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
      return `"${text}"`;
 }).join(',');
 });

  const csvContent = csvLines.join('\r\n');
  const queue = document.getElementById('queueSelect') ? (document.getElementById('queueSelect').value || 'All') : 'All';
  const convId = document.getElementById('convIdInput') ? (document.getElementById('convIdInput').value || 'All') : 'All';
  const rawName = `calibration_${queue}_${convId}.csv`;
  const filename = rawName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function completeCalibration() {
  if (!Array.isArray(lastResults) || lastResults.length === 0) {
    showAlert('Please load calibration results first', { type: 'warning', title: 'Heads up' });
    return;
 }

  const queueSelect = document.getElementById('queueSelect');
  const convInput = document.getElementById('convIdInput');
  const queue = queueSelect ? queueSelect.value : '';
  const convId = convInput ? convInput.value : '';

  const targetName = 'Heba El Sobky';
  const normalizedTarget = targetName.toLowerCase();

  const hebaRow = lastResults.find(row => {
    const name = (row.Taker_Name || '').toString().trim().toLowerCase();
    return name === normalizedTarget;
 });

  if (!hebaRow) {
    showAlert("The host haven't submit the calibration yet !", { type: 'warning', title: 'Heads up' });
    return;
 }

  const takerNames = Array.from(new Set(lastResults.map(r => (r.Taker_Name || '').toString().trim()).filter(Boolean)));
  if (takerNames.length === 0) {
    showAlert('No taker names found for this calibration', { type: 'warning', title: 'Heads up' });
    return;
 }

  let users = [];
  try {
    users = await fetchUserEmailsByNames(takerNames);
 } catch (e) {
 }

  const emailMap = new Map();
  (users || []).forEach(u => {
    const name = (u.Name || '').toString().trim().toLowerCase();
    const email = (u.email || '').toString().trim();
    if (name && email) emailMap.set(name, email);
 });

  const toList = [];
  takerNames.forEach(name => {
    const email = emailMap.get(name.toLowerCase());
    if (email) toList.push(email);
 });

  const uniqueTo = Array.from(new Set(toList));
  if (uniqueTo.length === 0) {
    showAlert('No emails found for takers', { type: 'warning', title: 'Heads up' });
    return;
 }

  const toRecipients = [];
  const toSeen = new Set();
  takerNames.forEach(name => {
    const email = emailMap.get(name.toLowerCase());
    if (!email || !isValidEmail(email)) return;
    const n = normalizeEmail(email);
    if (toSeen.has(n)) return;
    toSeen.add(n);
    toRecipients.push({ email, label: email });
 });

  const normalizeYesNo = (val) => {
    const v = (val || '').toString().trim().toLowerCase();
    if (v === 'yes') return 'Yes';
    if (v === 'no') return 'No';
    return '';
 };

  const takerCount = lastResults.length;
  const yesItems = [];
  const noItems = [];
  let sum = 0;
  let count = 0;

  (currentAttributes || []).forEach(attr => {
    const hebaVal = normalizeYesNo(hebaRow[attr.key]);
    if (!hebaVal) return;
    const matchCount = (lastResults || []).reduce((acc, row) => {
      const v = normalizeYesNo(row[attr.key]);
      return acc + (v === hebaVal ? 1 : 0);
 }, 0);
    const scorePercent = takerCount > 0 ? Math.round((matchCount / takerCount) * 100) : 0;
    const item = { label: attr.label, value: hebaVal, scorePercent, matchCount, totalCount: takerCount };
    if (hebaVal === 'Yes') yesItems.push(item);
    else noItems.push(item);
    sum += scorePercent;
    count++;
 });

  const alignmentScore = count ? Math.round(sum / count) : null;
  const hebaName = hebaRow.Taker_Name || 'Heba El Sobky';

  openCalibrationSummaryModal({
    queue,
    convId,
    hebaName,
    alignmentScore,
    yesItems,
    noItems,
    takerNames,
    toRecipients,
    ccDefaults: ['halim@tempo.fit', 'nancy@tempo.fit', 'khaledsabban@tempo.fit']
 });
}

function updateCompleteButtonState(completed) {
  const btn = document.getElementById('completeBtn');
  if (!btn) return;
  let isDone = false;
  if (completed === true || completed === 1) {
    isDone = true;
 } else if (typeof completed === 'string') {
    const v = completed.toLowerCase();
    if (v === 'true' || v === 't' || v === '1') isDone = true;
 }
  btn.disabled = isDone;
}

async function syncCalibrationCompletedState(convId, queue, showNotice = false) {
  try {
    const completed = await fetchCalibrationCompleted(convId, queue);
    updateCompleteButtonState(completed);
    if (completed && showNotice) {
      showAlert('Calibration has been sent already', { type: 'info', title: 'Already sent' });
 }
 } catch (e) {
    updateCompleteButtonState(null);
 }
}

async function fetchCalibrationCompleted(convId, queue) {
  if (!config.restUrl) return false;
  if (!convId || !queue) return false;
  let scorecardValue = '';
  let typeFilter = '';
  if (queue === 'MX-T1') {
    scorecardValue = 'MX-T1_Scorecard';
  } else if (queue === 'SMS') {
    scorecardValue = 'SMS_Scorecard';
 } else if (queue === 'Wins') {
    scorecardValue = 'Wins_Scorecard';
 } else if (queue === 'Sales' || isRetentionQueue(queue)) {
    scorecardValue = 'MX-T2_OS Scorecard';
    typeFilter = queue === 'Sales' ? 'Sales' : '';
 }
  let url = `${config.restUrl}/Assigning_Calibration?Conversation_Id=eq.${encodeURIComponent(convId)}&select=completed&limit=1`;
  if (scorecardValue) {
    url += `&Score_card=eq.${encodeURIComponent(scorecardValue)}`;
 }
   if (typeFilter) {
     url += `&type=eq.${encodeURIComponent(typeFilter)}`;
 } else if (isRetentionQueue(queue)) {
     url += `&${buildAliasOrFilter('type', ['Retention', 'Order Support'])}`;
 }
  const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
  if (!res.ok) return false;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return false;
  const row = rows[0] || {};
  const val = row.completed;
  if (val === true) return true;
  if (typeof val === 'string') {
    const v = val.toLowerCase();
    if (v === 'true' || v === 't' || v === '1') return true;
 }
  if (val === 1) return true;
  return false;
}

async function markCalibrationCompleted(convId, queue) {
  if (!config.restUrl) return;
  if (!convId || !queue) return;
  let scorecardValue = '';
  let typeFilter = '';
  if (queue === 'MX-T1') {
    scorecardValue = 'MX-T1_Scorecard';
  } else if (queue === 'SMS') {
    scorecardValue = 'SMS_Scorecard';
 } else if (queue === 'Wins') {
    scorecardValue = 'Wins_Scorecard';
 } else if (queue === 'Sales' || isRetentionQueue(queue)) {
    scorecardValue = 'MX-T2_OS Scorecard';
    typeFilter = queue === 'Sales' ? 'Sales' : '';
 }
  let url = `${config.restUrl}/Assigning_Calibration?Conversation_Id=eq.${encodeURIComponent(convId)}`;
  if (scorecardValue) {
    url += `&Score_card=eq.${encodeURIComponent(scorecardValue)}`;
 }
  if (typeFilter) {
    url += `&type=eq.${encodeURIComponent(typeFilter)}`;
 } else if (isRetentionQueue(queue)) {
    url += `&${buildAliasOrFilter('type', ['Retention', 'Order Support'])}`;
 }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: authHeaders({ useServiceKey: true }),
    body: JSON.stringify({ completed: true })
 });
  if (!res.ok) {
    const text = await res.text();
 }
}

async function fetchUserEmailsByNames(names) {
  const list = Array.isArray(names) ? Array.from(new Set(names.filter(Boolean))) : [];
  if (list.length === 0) return [];
  const encoded = list.map(n => encodeURIComponent(n));
  const inClause = encoded.join(',');
  const base = `${config.restUrl}/users?select=Name,email`;
  const url = `${base}&Name=in.(${inClause})`;
  let res;
  try {
    res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
 } catch (e) {
    return [];
 }
  if (!res || !res.ok) {
    return [];
 }
  try {
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
 } catch (e) {
    return [];
 }
}

function buildCalibrationEmailHTML(row, queue, convId) {
  const attrs = (currentAttributes || []).map(attr => {
    const val = row[attr.key];
    const comment = row[attr.commentKey];
    return { label: attr.label, val, comment };
 });

  let yesCount = 0;
  let answeredCount = 0;
  (currentAttributes || []).forEach(attr => {
    const v = row[attr.key];
    if (v === 'Yes' || v === 'No') {
      answeredCount++;
      if (v === 'Yes') yesCount++;
 }
 });
  const score = answeredCount > 0 ? Math.round((yesCount / answeredCount) * 100) : null;

  const conv = convId || row.Conversation_Id || row.conversation_id || '';
  const agentName = row.Agent_Name || row.agent_name || '';
  const takerName = row.Taker_Name || 'Heba El Sobky';
  const statusLabel = score !== null && score >= 90 ? 'Pass' : 'Fail';
  const queueLabel = queue || (row.Score_card || row.type || '');

  const pill = (label, value) => `
    <div style="display:inline-flex; align-items:center; gap:6px; background:#f3f4f6; color:#111827; border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px; font-size:12px; margin:4px 6px 0 0;">
      <span style="color:#6b7280;">${label}:</span>
      <span style="font-weight:600;">${(value || '').toString()}</span>
    </div>`;

  const attrRows = attrs.map(a => {
    const safeVal = (a.val || '').toString();
    const safeComment = (a.comment || '').toString();
    const attrScore = safeVal === 'Yes' ? '100' : (safeVal === 'No' ? '0' : '');
    return `
      <tr>
        <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; font-weight:600; color:#111827;">${a.label}</td>
        <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; color:#111827;">${safeVal}</td>
        <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; color:#111827;">${attrScore}</td>
        <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; color:#6b7280; white-space: pre-wrap;">${safeComment ? safeComment : ''}</td>
      </tr>`;
 }).join('');

  const header = `
    <div style="background:#4f46e5; background-image:linear-gradient(135deg,#6366f1,#8b5cf6); padding:22px; border-radius:16px 16px 0 0; color:#fff; text-align:center;">
      <div style="font-size:18px; font-weight:800;">QA Summary</div>
      <div style="margin-top:6px; font-size:14px; opacity:0.95;">Conversation ${conv || ''} • Score ${score !== null ? score + '%' : 'Pending'}</div>
    </div>`;

  const meta = `
    <div style="padding:16px;">
      ${pill('Agent', agentName)}
      ${pill('Coach Name', takerName)}
      ${pill('Queue', queueLabel)}
      ${pill('Final Score', score !== null ? score + '%' : 'Pending')}
      ${pill('Status', score !== null ? statusLabel : 'Pending')}
    </div>`;

  const table = `
    <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
      <thead><tr>
        <th style="text-align:left; padding:12px 14px; background:#f9fafb; color:#374151; border-bottom:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">Attribute</th>
        <th style="text-align:left; padding:12px 14px; background:#f9fafb; color:#374151; border-bottom:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">Value</th>
        <th style="text-align:left; padding:12px 14px; background:#f9fafb; color:#374151; border-bottom:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">Score</th>
        <th style="text-align:left; padding:12px 14px; background:#f9fafb; color:#374151; border-bottom:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">Comment</th>
      </tr></thead>
      <tbody>${attrRows}</tbody>
    </table>`;

  const wrapper = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,'Helvetica Neue',Arial,'Noto Sans',sans-serif; background:#f9fafb; padding:20px;">
      <div style="max-width:800px; margin:0 auto; background:#ffffff; border-radius:16px; box-shadow:0 10px 20px rgba(0,0,0,0.06); overflow:hidden;">
        ${header}
        ${meta}
        <div style="padding:16px;">${table}</div>
      </div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body>${wrapper}</body></html>`;
}

async function sendEmailSMTP({ html, to, cc = [], subject }) {
  const host = (typeof location !== 'undefined') ? (location.hostname || '') : '';
  const normalizedHost = host.replace(/^\[|\]$/g, '');
  const isLocal = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::' || normalizedHost === '::1';
  const endpoint = isLocal ? 'http://127.0.0.1:8025/send-email' : '/api/send-email';
  const payload = {
    to,
    cc,
    subject,
    html
 };
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    try {
      const data = await res.json();
      if (data && data.ok === false) return false;
 } catch (e) {}
    return true;
 } catch (e) {  return false; }
}
