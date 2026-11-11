// Wins Scorecard Page Logic
const WinsScorecard = (function() {
  const config = {
    supabaseUrl: null,
    restUrl: null,
    apiKey: null,
    serviceKey: null,
 };

  // Track single datepicker selection steps
  let dateRangePickStep = 0; // 0 = next pick sets From, 1 = next pick sets To
  // Overlay picker state
  let rpAnchorYear = null; // left month year
  let rpAnchorMonth = null; // left month 0-11
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Track Freshworks rows skipped with "Next" to avoid re-fetching in session
  let excludedFreshworksIds = new Set();
  let calibrationMode = false;
  let currentSbsDisabled = true;
  const WINS_ATTRIBUTES_TABLE = 'winsAttributes';
  const WINS_SUBMISSIONS_TABLE = 'winsAuditSubmissions';
  const PASS_THRESHOLD = 70;
  const WINS_ATTRIBUTE_ORDER = [
    'Brand Energy & Protocol',
    'Discovery & History Review',
    'Clarity and Concise Explaination',
    'Human Engagement & Soft Skills',
    'Value Positioning & Objection Handling',
    'Tailored Concessions & Alternatives',
    'Closing & FCR',
    'Product Awareness',
    'Brand Representation and Ownership',
    'Process Awareness',
    'Verfication',
    'Documentation & CRM Updates'
  ];
  const WINS_ATTRIBUTE_COLUMNS = [
    {
      id: 1,
      label: 'Brand Energy & Protocol',
      score: 10,
      answerKey: 'brand_energy_protocol',
      commentKey: 'brand_energy_protocol_comment'
 },
    {
      id: 2,
      label: 'Discovery & History Review',
      score: 15,
      answerKey: 'discovery_history_review',
      commentKey: 'discovery_history_review_comment'
 },
    {
      id: 3,
      label: 'Clarity and Concise Explaination',
      score: 10,
      answerKey: 'clarity_and_concise_explaination',
      commentKey: 'clarity_and_concise_explaination_comment'
 },
    {
      id: 4,
      label: 'Human Engagement & Soft Skills',
      score: 15,
      answerKey: 'human_engagement_soft_skills',
      commentKey: 'human_engagement_soft_skills_comment'
 },
    {
      id: 5,
      label: 'Value Positioning & Objection Handling',
      score: 20,
      answerKey: 'value_positioning_objection_handling',
      commentKey: 'value_positioning_objection_handling_comment'
    },
    {
      id: 6,
      label: 'Tailored Concessions & Alternatives',
      score: 10,
      answerKey: 'tailored_concessions_alternatives',
      commentKey: 'tailored_concessions_alternatives_comment'
    },
    {
      id: 7,
      label: 'Closing & FCR',
      score: 10,
      answerKey: 'closing_fcr',
      commentKey: 'closing_fcr_comment'
    },
    {
      id: 8,
      label: 'Product Awareness',
      score: 0,
      answerKey: 'product_awareness',
      commentKey: 'product_awareness_comment'
    },
    {
      id: 9,
      label: 'Brand Representation and Ownership',
      score: 0,
      answerKey: 'brand_representation_ownership',
      commentKey: 'brand_representation_ownership_comment'
    },
    {
      id: 10,
      label: 'Process Awareness',
      score: 0,
      answerKey: 'process_awareness',
      commentKey: 'process_awareness_comment'
    },
    {
      id: 11,
      label: 'Verfication',
      score: 0,
      answerKey: 'verfication',
      commentKey: 'verfication_comment'
    },
    {
      id: 12,
      label: 'Documentation & CRM Updates',
      score: 10,
      answerKey: 'documentation_crm_updates',
      commentKey: 'documentation_crm_updates_comment'
    }
  ];

  // Skip-next window and usage counter helpers
  const SKIP_NEXT_LIMIT = 5;
  function computeSkipWindow() {
    const now = new Date();
    const h = now.getHours();
    // Allowed daily window: 17:00 through 05:59
    const allowed = (h >= 17) || (h < 6);
    const startAnchor = new Date(now);
    // For hours 00:00–05:59, treat window as starting previous calendar day at 17:00
    if (h < 6) startAnchor.setDate(startAnchor.getDate() - 1);
    const id = `${startAnchor.getFullYear()}-${String(startAnchor.getMonth()+1).padStart(2,'0')}-${String(startAnchor.getDate()).padStart(2,'0')}`;
    return { allowed, id };
 }
  function getSkipNextKey(userKey) {
    const { id } = computeSkipWindow();
    return `skipNextUses:${userKey || 'anon'}:${id}`;
 }
  function getSkipNextUsed(userKey) {
    const key = getSkipNextKey(userKey);
    const used = parseInt(localStorage.getItem(key) || '0', 10) || 0;
    return { key, used };
 }
  function incSkipNextUsed(userKey) {
    const { key, used } = getSkipNextUsed(userKey);
    localStorage.setItem(key, String(used + 1));
    return used + 1;
 }
  function remainingSkipNext(userKey) {
    return Math.max(0, SKIP_NEXT_LIMIT - getSkipNextUsed(userKey).used);
 }

  function loadConfig() {
    try {
      // database_config.json is in the same directory
      return fetch('/database_config.json')
        .then(r => r.json())
        .then(json => {
          config.supabaseUrl = json.supabase.url;
          config.restUrl = json.supabase.rest_url;
          config.apiKey = json.supabase.client_api_key;
          // Optional: service key for diagnostics only (do NOT use in production UI)
          config.serviceKey = json.supabase.service_key || null;
 });
 } catch (e) {
      console.error('Failed to load config', e);
 }
 }

  function normalizeWinsAttributes(rows) {
    return (rows || []).map((row, index) => ({
      ID: row.id ?? (index + 1),
      Subcategory: row.category || '',
      Criteria: row.criteria || '',
      Score: Number(String(row.score ?? 0).replace(/%/g, '').trim()) || 0
    }));
 }

  function authHeaders(opts = {}) {
    const { useServiceKey = false } = opts;
    const token = localStorage.getItem('login_token') || '';
    // Prefer service key when explicitly requested; otherwise fall back to apiKey when token is absent/invalid
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

  async function loadSmeList() {
    const sel = document.getElementById('smeName');
    if (!sel || !config.restUrl) return;

    const currentValue = sel.value;
    const url = `${config.restUrl}/sme_list?select=id,name,sort_order,is_active&is_active=eq.true&order=sort_order.asc,id.asc`;

    try {
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
      if (!res.ok) throw new Error(`Failed to fetch SME list: ${res.status}`);

      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return;

      sel.innerHTML = '<option value="">Select SME</option>';
      rows.forEach((item) => {
        const name = String(item.name || '').trim();
        if (!name) return;
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sel.appendChild(opt);
 });

      const matching = rows.find((item) => item.name === currentValue);
      if (matching) {
        sel.value = String(matching.name || '');
 } else if (Array.from(sel.options).some((option) => option.value === currentValue)) {
        sel.value = currentValue;
 }
 } catch (error) {
 }
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

      // Build overlay
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
      // Make Heads up/Warning and Success overlays transparent so page remains visible
      overlay.style.background = ((type === 'warning' || type === 'success') ? 'transparent' : 'rgba(0, 0, 0, 0.45)');
      overlay.innerHTML = '';

      // Card
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
      // Solid/darker background removed to respect theme

      // Accent bar
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

      // Close button
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
      // As a fallback, use default alert
      alert(msg);
 }
 }

  // SMTP email sender, mirrors appeal implementation
  async function sendEmailSMTP({ html, to, cc = [], bcc = [], subject }) {
    const host = (typeof location !== 'undefined') ? (location.hostname || '') : '';
    const normalizedHost = host.replace(/^\[|\]$/g, '');
    const isLocal = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::' || normalizedHost === '::1';
    const endpoint = isLocal ? 'http://127.0.0.1:8025/send-email' : '/api/send-email';
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, cc, bcc, subject, html }) });
      const raw = await res.text();
      if (!res.ok) throw new Error(raw || `HTTP ${res.status}`);
      return true;
 } catch (e) {  return false; }
 }

  // --- Attributes Scoring (Yes/No-based) ---
  const ATTR_ORDER = {
    Customer: WINS_ATTRIBUTE_ORDER,
    Process: []
 };

  let attributes = [];
  function mapSubcategoryToGroup(subcat) {
    if (ATTR_ORDER.Customer.includes(subcat)) return 'Customer';
    if (ATTR_ORDER.Process.includes(subcat)) return 'Process';
    return 'Customer';
 }
  function orderAttributes(list) {
    const groups = { Customer: [], Process: [] };
    list.forEach(item => {
      const g = mapSubcategoryToGroup(item.Subcategory);
      groups[g].push(item);
 });
    const sortByOrder = (arr, order) => arr.sort((a,b) => {
      const ia = order.indexOf(a.Subcategory);
      const ib = order.indexOf(b.Subcategory);
      const sa = ia === -1 ? 999 : ia;
      const sb = ib === -1 ? 999 : ib;
      return sa - sb;
 });
    return {
      Customer: sortByOrder(groups.Customer, ATTR_ORDER.Customer),
      Process: sortByOrder(groups.Process, ATTR_ORDER.Process)
 };
 }

  async function fetchAttributes() {
    try {
      const url = `${config.restUrl}/${WINS_ATTRIBUTES_TABLE}?select=*`;
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      attributes = normalizeWinsAttributes(await res.json());
      if (!attributes.length) throw new Error('No attribute rows returned to client');
 } catch (e) {
      try {
        const url = `${config.restUrl}/${WINS_ATTRIBUTES_TABLE}?select=*`;
        const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
        if (!res.ok) throw new Error(await res.text());
        attributes = normalizeWinsAttributes(await res.json());
 } catch (err) {
        console.error(`Failed to fetch ${WINS_ATTRIBUTES_TABLE}`, err);
        attributes = [];
 }
 }
 }

  function createRTEComponent(placeholder) {
    const container = document.createElement('div');
    container.className = 'rte-container';

    const toolbar = document.createElement('div');
    toolbar.className = 'rte-toolbar';

    const createBtn = (label, cmd) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rte-btn';
      btn.innerHTML = label;
      btn.onmousedown = (e) => {
        e.preventDefault();
        document.execCommand(cmd, false, null);
 };
      return btn;
 };

    toolbar.appendChild(createBtn('• Bullet', 'insertUnorderedList'));
    toolbar.appendChild(createBtn('1. Number', 'insertOrderedList'));

    const editor = document.createElement('div');
    editor.className = 'rte-editor';
    editor.contentEditable = 'true';
    editor.setAttribute('placeholder', placeholder || 'Add context...');

    container.appendChild(toolbar);
    container.appendChild(editor);

    return { container, editor };
 }

  function extractTextFromRTE(editor) {
    if (!editor) return '';
    
    function getText(node) {
      if (node.nodeType === 3) return node.nodeValue;
      if (node.nodeType !== 1) return '';
      
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') return '\n';
      
      let content = '';
      if (tag === 'ul') {
        node.childNodes.forEach(child => {
          if (child.nodeType === 1 && child.tagName.toLowerCase() === 'li') {
            content += '\n• ' + getText(child).trim();
 } else {
            content += getText(child);
 }
 });
 } else if (tag === 'ol') {
        let idx = 0;
        node.childNodes.forEach(child => {
          if (child.nodeType === 1 && child.tagName.toLowerCase() === 'li') {
            idx++;
            content += `\n${idx}. ` + getText(child).trim();
 } else {
            content += getText(child);
 }
 });
 } else {
        node.childNodes.forEach(c => content += getText(c));
 }
      
      if (tag === 'div' || tag === 'p') return '\n' + content;
      return content;
 }
    
    return getText(editor).replace(/\n\s*\n/g, '\n').trim();
 }

  function initStaticRTEs() {
    const ids = [
      { id: 'smeGeneralComments', placeholder: 'Add SME-related comments...' },
      { id: 'salesComments', placeholder: 'Add sales-related comments...' }
    ];
    ids.forEach(conf => {
      const ta = document.getElementById(conf.id);
      if (!ta) return;
      const prev = ta.previousElementSibling;
      if (prev && prev.classList.contains('rte-container')) return;

      const { container, editor } = createRTEComponent(conf.placeholder);
      if (ta.value) editor.innerHTML = ta.value; // Initialize with existing value (assuming text, not HTML)

      editor.addEventListener('input', () => {
        ta.value = extractTextFromRTE(editor);
 });

      ta.parentNode.insertBefore(container, ta);
      ta.style.display = 'none';
      ta.dataset.hasRte = 'true';
 });
 }

  function buildAttrRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'attr-row';
    row.dataset.subcategory = item.Subcategory;
    const title = document.createElement('div');
    title.className = 'attr-title';
    const name = document.createElement('div');
    name.className = 'attr-name';
    name.textContent = item.Subcategory;
    const desc = document.createElement('div');
    desc.className = 'attr-desc';
    desc.textContent = item.Criteria || '';
    title.appendChild(name);
    title.appendChild(desc);

    const controls = document.createElement('div');
    controls.className = 'attr-controls';
    const yesId = `attr_yes_${item.ID || idx}`;
    const noId = `attr_no_${item.ID || idx}`;
    const yesLabel = document.createElement('label');
    yesLabel.className = 'radio-pill';
    const yesInput = document.createElement('input');
    yesInput.type = 'radio';
    yesInput.name = `attr_${item.ID || idx}`;
    yesInput.value = 'Yes';
    yesInput.id = yesId;
    yesLabel.appendChild(yesInput);
    yesLabel.appendChild(document.createTextNode(' Yes'));

    const noLabel = document.createElement('label');
    noLabel.className = 'radio-pill';
    const noInput = document.createElement('input');
    noInput.type = 'radio';
    noInput.name = `attr_${item.ID || idx}`;
    noInput.value = 'No';
    noInput.id = noId;
    noLabel.appendChild(noInput);
    noLabel.appendChild(document.createTextNode(' No'));
    controls.appendChild(yesLabel);
    controls.appendChild(noLabel);

    const score = document.createElement('div');
    score.className = 'attr-score';
    const sVal = (item.Score != null ? item.Score : 0);
    score.textContent = sVal;
    if (sVal === 0) score.classList.add('zero');

    row.appendChild(title);
    row.appendChild(controls);
    row.appendChild(score);

    // Per-attribute comment textarea (hidden until Yes/No selected)
    const commentWrap = document.createElement('div');
    commentWrap.className = 'attr-comment';
    commentWrap.style.display = 'none';
    const commentLabel = document.createElement('label');
    commentLabel.textContent = 'Comment';

    const { container: rteContainer, editor } = createRTEComponent('Add context...');

    const hiddenArea = document.createElement('textarea');
    hiddenArea.id = `attr_comment_${item.ID || idx}`;
    hiddenArea.style.display = 'none';

    editor.addEventListener('input', () => {
      hiddenArea.value = extractTextFromRTE(editor);
 });

    rteContainer.appendChild(hiddenArea);
    
    commentWrap.appendChild(commentLabel);
    commentWrap.appendChild(rteContainer);
    
    row.appendChild(commentWrap);

    const onChange = () => { commentWrap.style.display = 'block'; updateAttrSubtotal(); };
    yesInput.addEventListener('change', onChange);
    noInput.addEventListener('change', onChange);

    return row;
 }

  function renderAttributes() {
    const grouped = orderAttributes(attributes);
    const customerEl = document.getElementById('attrGroupCustomer');
    const processEl = document.getElementById('attrGroupProcess');
    if (customerEl) customerEl.innerHTML = '';
    if (processEl) processEl.innerHTML = '';
    grouped.Customer.forEach((item, idx) => { if (customerEl) customerEl.appendChild(buildAttrRow(item, idx)); });
    grouped.Process.forEach((item, idx) => { if (processEl) processEl.appendChild(buildAttrRow(item, idx)); });
    updateAttrSubtotal();
 }

  function updateAttrSubtotal() {
    const subtotalEl = document.getElementById('attrSubtotal');
    if (!subtotalEl) return;
    let total = 0;
    let anyZeroNo = false;
    let countYes = 0;
    attributes.forEach((item, idx) => {
      const name = `attr_${item.ID || idx}`;
      const yes = document.querySelector(`input[name="${name}"][value="Yes"]:checked`);
      const no = document.querySelector(`input[name="${name}"][value="No"]:checked`);
      if (yes) {
        countYes += 1;
        total += (item.Score != null ? item.Score : 0);
 }
      if (no && ((item.Score != null ? item.Score : 0) === 0 || item.ID == 16)) {
        anyZeroNo = true;
 }
 });
    const finalScore = anyZeroNo ? 0 : total;
    subtotalEl.textContent = `Final Score: ${finalScore}%`;
 }

  function countSelectedAttributes() {
    let count = 0;
    attributes.forEach((item, idx) => {
      const name = `attr_${item.ID || idx}`;
      const sel = document.querySelector(`input[name="${name}"]:checked`);
      if (sel) count += 1;
 });
    return count;
 }

  function selectAllAttributesYes() {
    attributes.forEach((item, idx) => {
      const name = `attr_${item.ID || idx}`;
      const yes = document.querySelector(`input[name="${name}"][value="Yes"]`);
      if (yes) {
        yes.checked = true;
        // Show comment area when selected
        const comment = document.getElementById(`attr_comment_${item.ID || idx}`);
        if (comment) {
          const wrapper = comment.closest('.attr-comment');
          if (wrapper) wrapper.style.display = 'block';
 }
 }
 });
    updateAttrSubtotal();
 }

  function resetAttributesUI() {
    // Clear attribute radios and comments
    document.querySelectorAll('.attr-row').forEach(row => {
      row.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = false; });
      const ta = row.querySelector('.attr-comment textarea');
      if (ta) ta.value = '';
      const editor = row.querySelector('.rte-editor');
      if (editor) editor.innerHTML = '';
      const cw = row.querySelector('.attr-comment');
      if (cw) cw.style.display = 'none';
 });
    updateAttrSubtotal();
 }

  function updateConversationIdState() {
    const input = document.getElementById('conversationIdInput');
    if (!input) return;
    const monitoringType = document.getElementById('monitoringType');
    const isSelectedMode = !!(monitoringType && monitoringType.value === 'Selected');

    // Manual conversation entry is only allowed when Monitoring Type is "Selected".
    input.disabled = !isSelectedMode;
 }

  async function syncT1Config() {
    try {
      const url = `${config.restUrl}/T1SBS?id=eq.1&select=sbs_disabled,allowed_users`;
      const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
      if (!res.ok) {
 }
      const rows = await res.json().catch(() => []);
      
      let sbsDisabled = true; 
      let allowedUsers = [];
      
      if (rows && rows.length > 0) {
        const record = rows[0];
        const v = record.sbs_disabled;
        if (typeof v === 'boolean') sbsDisabled = v;
        else if (typeof v === 'string') sbsDisabled = (v.toLowerCase() === 'true' || v === '1');
        else if (typeof v === 'number') sbsDisabled = (v !== 0);

        if (record.allowed_users !== undefined && record.allowed_users !== null) {
          if (Array.isArray(record.allowed_users)) {
            allowedUsers = record.allowed_users.map(x => String(x));
 } else {
            allowedUsers = String(record.allowed_users)
              .split(',')
              .map(s => s.trim())
              .filter(s => s.length > 0);
 }
 }
 }

      const emailKey = localStorage.getItem('loggedInUserEmail') || localStorage.getItem('userEmail') || localStorage.getItem('user_email') || '';
      const currentEmail = emailKey ? String(emailKey).toLowerCase() : '';
      let allowedForUser = false;
      if (allowedUsers.length > 0) {
        if (currentEmail) {
          allowedForUser = allowedUsers.some(e => String(e).toLowerCase() === currentEmail);
 }
 }

      const effectiveDisabled = sbsDisabled || !allowedForUser;
      currentSbsDisabled = effectiveDisabled;

      updateConversationIdState();
      
      const input = document.getElementById('conversationIdInput');
      // if (input) input.disabled = !!effectiveDisabled;

      const icon = document.getElementById('ticketIconBtn');
      if (icon) {
        const hasValue = (input && input.value && input.value.trim().length > 0);
        icon.style.display = hasValue ? 'inline-flex' : 'none';
 }

      const monSelect = document.getElementById('monitoringType');
      if (monSelect) {
        if (monSelect.getAttribute('data-sbs-locked') === 'true') {
            monSelect.disabled = true;
            return; 
 }
        const isPasteLocked = monSelect.dataset.pasteLocked === 'true';
        
        if (!effectiveDisabled) {
           if (!monSelect.value) monSelect.value = 'SBS';
           // monSelect.disabled = true;
 } else {
           if (isPasteLocked) {
             if (!monSelect.value) monSelect.value = 'SBS';
             // monSelect.disabled = true;
 } else {
             monSelect.disabled = false;
 }
 }
 }

 } catch (e) {
      console.error('Error syncing T1 config', e);
 }
 }

  function focusDateRange() {
    const single = document.getElementById('dateRangeSingle');
    if (single) single.focus();
    // Encourage two sequential picks: reset step so next pick sets From
    dateRangePickStep = 0;
    // Clear previous selections if user is restarting range pick
    const from = document.getElementById('dateFrom');
    const to = document.getElementById('dateTo');
    if (from) from.value = '';
    if (to) to.value = '';
    updateDateStatus();
    toggleGetCaseEnabled();
    // Open overlay range picker
    openRangePicker();
 }

  function selectAllRadios() {
    const groups = ['communication','professionalism','knowledge','resolution'];
    groups.forEach((name) => {
      const radios = document.querySelectorAll(`input[name="${name}"]`);
      // choose highest value option by default
      let maxRadio = null; let maxVal = -Infinity;
      radios.forEach(r => {
        const v = parseInt(r.value, 10);
        if (!isNaN(v) && v > maxVal) { maxVal = v; maxRadio = r; }
 });
      if (maxRadio) maxRadio.checked = true;
 });
 }

  function ymdParts(dateStr) {
    // expects yyyy-mm-dd
    const d = new Date(dateStr);
    return {
      yyyy: d.getFullYear(),
      mm: String(d.getMonth()+1).padStart(2,'0'),
      dd: String(d.getDate()).padStart(2,'0')
 };
 }

  async function getCase() {
    // mirror f_order validation
    const currentConv = document.getElementById('conversationIdInput').value.trim();
    if (currentConv && currentConv.length > 0) {
      showAlert('Please submit the current Case before asking for a new one !');
      return;
 }
    const emptyWidgets = [];
    const team = document.getElementById('teamSelect').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    // Prefer selected agentName -> resolve email from users list if available
    const agentNameSelect = document.getElementById('agentNameSelect');
    const selectedAgentId = agentNameSelect ? agentNameSelect.value : '';
    let agentEmail = '';
    // If an option carries data-email attribute, use it; otherwise fallback to the email input
    if (agentNameSelect && selectedAgentId) {
      const opt = agentNameSelect.selectedOptions[0];
      agentEmail = (opt && opt.getAttribute('data-email')) || '';
      const agentLabel = (opt && opt.textContent) || '';
      const emailInput = document.getElementById('agentEmailInput');
      if (emailInput && agentEmail) emailInput.value = agentEmail;
 } else {
      agentEmail = (document.getElementById('agentEmailInput')||{value:''}).value.trim();
 }

    if (!team) emptyWidgets.push('Select Team');
    if (!dateFrom || !dateTo) emptyWidgets.push('Date Range');
    if (!agentEmail) emptyWidgets.push('Choose Agent');

    if (emptyWidgets.length > 0) {
      const emptyWidgetNames = emptyWidgets.join(', ');
      showAlert(`Please choose the missing: ${emptyWidgetNames}.`);
      return;
 }

    try {
      const f = ymdParts(dateFrom);
      const t = ymdParts(dateTo);
      // Use numeric values for Month/Day to match SQL intent
      const fy = f.yyyy;
      const ty = t.yyyy;
      const fm = parseInt(f.mm, 10);
      const tm = parseInt(t.mm, 10);
      const fd = parseInt(f.dd, 10);
      const td = parseInt(t.dd, 10);
      // REST query aligned exactly with provided SQL WHERE conditions
      // SELECT LEFT(interaction_id, POSITION('-' IN interaction_id) - 1) as Conversation_ID, id
      // FROM "Freshworks"
      // WHERE first_responded_by = agent_email AND Channel = team
      //   AND (assigned_qa = '' OR assigned_qa IS NULL)
      //   AND (HAPPIO_Status = '' OR HAPPIO_Status IS NULL)
      //   AND Year BETWEEN fy AND ty
      //   AND Month BETWEEN fm AND tm
      //   AND Day BETWEEN fd AND td
      let url = `${config.restUrl}/Freshworks?select=interaction_id,id,con_Id` +
        `&first_responded_by=eq.${encodeURIComponent(agentEmail)}` +
        `&Channel=eq.${encodeURIComponent(team)}` +
        // Keep two OR groups to enforce AND semantics like SQL
        `&or=(assigned_qa.is.null,assigned_qa.eq.)` +
        `&or=(HAPPIO_Status.is.null,HAPPIO_Status.eq.)` +
        `&date_created=gte.${encodeURIComponent(dateFrom)}` +
        `&date_created=lte.${encodeURIComponent(dateTo)}` +
        `&limit=10`;
      if (excludedFreshworksIds && excludedFreshworksIds.size > 0) {
        const idsList = Array.from(excludedFreshworksIds).join(',');
        url += `&id=not.in.(${idsList})`;
 }
      const token = localStorage.getItem('login_token');
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const errText = await res.text();
        // Fallback: try with service key in case RLS blocks anon/client
        res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
        if (!res.ok) {
          const svcErr = await res.text();
          console.error('GetCase service error body:', svcErr);
          showAlert('Unable to fetch case. Please check filters or login.');
          return;
 }
 }
      const rowsRaw = await res.json();
      const rows = (rowsRaw || []).map(item => {
        // Match Appsmith SQL: derive Conversation_ID from interaction_id
        const directCid = item.con_Id || '';
        // Prefer con_Id if present, but also compute from interaction_id to match SQL
        const interaction = item.interaction_id || '';
        const dashPos = interaction.indexOf('-');
        const cid = dashPos > 0 ? interaction.slice(0, dashPos) : interaction;
        return { Conversation_ID: directCid || cid, id: item.id };
 });
      if (!rows || rows.length === 0) {
        showAlert('No conversations found for the selected criteria.');
        // Diagnostic: try querying without agent filter but same Channel/date to verify visibility
        try {
          let diagUrl = `${config.restUrl}/Freshworks?select=interaction_id,id,con_Id,first_responded_by,Channel,date_created` +
            `&Channel=eq.${encodeURIComponent(team)}` +
            `&or=(assigned_qa.is.null,assigned_qa.eq.)` +
            `&or=(HAPPIO_Status.is.null,HAPPIO_Status.eq.)` +
            `&date_created=gte.${encodeURIComponent(dateFrom)}` +
            `&date_created=lte.${encodeURIComponent(dateTo)}` +
            `&limit=5`;
          const diagRes = await fetch(diagUrl, { headers: authHeaders({ useServiceKey: true }) });
          if (diagRes.ok) {
            const diagRows = await diagRes.json();
 } else {
 }
          // Additional diagnostic: same agent and dates, but no Channel filter
          let diagUrl2 = `${config.restUrl}/Freshworks?select=interaction_id,id,con_Id,first_responded_by,Channel,date_created` +
            `&first_responded_by=eq.${encodeURIComponent(agentEmail)}` +
            `&or=(assigned_qa.is.null,assigned_qa.eq.)` +
            `&or=(HAPPIO_Status.is.null,HAPPIO_Status.eq.)` +
            `&date_created=gte.${encodeURIComponent(dateFrom)}` +
            `&date_created=lte.${encodeURIComponent(dateTo)}` +
            `&limit=5`;
          const diagRes2 = await fetch(diagUrl2, { headers: authHeaders({ useServiceKey: true }) });
          if (diagRes2.ok) {
            const diagRows2 = await diagRes2.json();
 } else {
 }
 } catch (diagErr) {
 }
        return;
 }
      const item = rows[0];
      const conversationId = item.Conversation_ID || item.conversation_id || '';
      const convInput = document.getElementById('conversationIdInput');
      if (convInput) convInput.value = conversationId;
      // Store Freshworks row id for later use (assignment and skip)
      const rowIdInput = document.getElementById('freshworksRowId');
      if (rowIdInput) rowIdInput.value = item.id || '';
      const ticketIconBtn = document.getElementById('ticketIconBtn');
      if (ticketIconBtn) ticketIconBtn.style.display = (conversationId) ? 'inline-flex' : 'none';
      document.getElementById('agentEmailInput').value = agentEmail;
      // Agent name is controlled via dropdown; do not overwrite
      const chSel = document.getElementById('channelSelect');
      if (chSel && !chSel.value) {
        const teamVal = (team || '').toLowerCase();
        const mapped = teamVal.includes('chat') ? 'Chat'
                     : teamVal.includes('email') ? 'Email'
                     : teamVal.includes('phone') ? 'Phone'
                     : '';
        if (mapped) chSel.value = mapped;
 }

      // Persist case across refresh and debug the saved values
      try {
        // localStorage
        localStorage.setItem('t1_current_case', JSON.stringify({ id: (item.id || ''), conversation_id: conversationId }));
        // URL params
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('cid', conversationId);
          u.searchParams.set('rid', item.id || '');
          window.history.replaceState({}, '', u.toString());
 } catch (urlErr) {}
        // sessionStorage and window.name
        try {
          sessionStorage.setItem('t1_last_cid', conversationId);
          sessionStorage.setItem('t1_last_rid', item.id || '');
          const nameObj = JSON.parse(window.name || '{}');
          nameObj.t1_last_cid = conversationId;
          nameObj.t1_last_rid = (item.id || '');
          window.name = JSON.stringify(nameObj);
 } catch (sessErr) {}
        // cookies
        try {
          document.cookie = `t1cid=${encodeURIComponent(conversationId)}; path=/; max-age=604800`;
          document.cookie = `t1rid=${encodeURIComponent(item.id || '')}; path=/; max-age=604800`;
 } catch (cookieErr) {}
        // Debug confirms
 } catch (persistErr) {
 }

      // On Get Case: mark conversation as QAED and assign auditor (Coach Name)
      const auditorEmail = localStorage.getItem('loggedInUserEmail') || '';
      // Ensure we have the Coach Name available; try input first, else cached name; if missing, load it
      let coachNameInput = document.getElementById('takerNameInput');
      let coachNameVal = (coachNameInput && coachNameInput.value ? coachNameInput.value.trim() : '');
      if (!coachNameVal) {
        const cachedName = localStorage.getItem('loggedInUserName') || localStorage.getItem('userName') || '';
        if (!cachedName) {
          try { await loadTakerName(); } catch(e) {}
          coachNameInput = document.getElementById('takerNameInput');
          coachNameVal = (coachNameInput && coachNameInput.value ? coachNameInput.value.trim() : '');
 } else {
          coachNameVal = cachedName;
 }
 }
      const assignedVal = coachNameVal || auditorEmail || '';
      const targetId = (rowIdInput && rowIdInput.value) ? rowIdInput.value : (item.id || '');
      if (targetId) {
        const patchUrl = `${config.restUrl}/Freshworks?id=eq.${encodeURIComponent(targetId)}`;
        const patchBody = { assigned_qa: assignedVal, HAPPIO_Status: 'QAED' };
        try {
            let patchRes = await fetch(patchUrl, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patchBody) });
            if (!patchRes.ok) {
              const pe = await patchRes.text();
              patchRes = await fetch(patchUrl, { method: 'PATCH', headers: authHeaders({ useServiceKey: true }), body: JSON.stringify(patchBody) });
              if (!patchRes.ok) {}
            }
          } catch(pErr) {
          const msg = (pErr && pErr.message) ? pErr.message : String(pErr || '');
          const abortLike = (pErr && pErr.name === 'AbortError') || /aborted|cancelled|canceled|failed to fetch/i.test(msg);
            if (!abortLike) {}
          }
 }
 } catch (error) {
      const msg = (error && error.message) ? error.message : String(error || '');
      const abortLike = (error && error.name === 'AbortError') || /aborted|cancelled|canceled|failed to fetch/i.test(msg);
      if (!abortLike) {
        console.error('An error occurred during execution:', error);
        showAlert('Error while fetching case. Please try again.');
 }
 }
 }

  async function loadAgents() {
    try {
      const urlAll = `${config.restUrl}/users?select=id,Name,email,user_role&order=Name.asc`;
      let res = await fetch(urlAll, { headers: authHeaders() });
      if (!res.ok) res = await fetch(urlAll, { headers: authHeaders({ useServiceKey: true }) });
      let rows = res.ok ? await res.json() : [];
      rows = Array.isArray(rows) ? rows : [];

      const sel = document.getElementById('agentNameSelect');
      const ddInput = document.getElementById('agentDropdownInput');
      const ddPanel = document.getElementById('agentDropdownPanel');
      const ddFilter = document.getElementById('agentDropdownFilter');
      const ddList = document.getElementById('agentDropdownList');
      if (!sel) return;
      // Clear and populate
      sel.innerHTML = '<option value="">Select agent</option>';
      // Cache agents for search filtering
      const seenAgentKeys = new Set();
      sel._allAgents = (rows || []).map(u => ({
        id: u.id,
        name: (u.Name || u.email || 'Unknown').toString().trim(),
        email: (u.email || '').toString().trim()
      })).filter((u) => {
        const key = `${u.id}::${u.name}::${u.email}`.toLowerCase();
        if (seenAgentKeys.has(key)) return false;
        seenAgentKeys.add(key);
        return true;
      });
      function renderSelect(list) {
        sel.innerHTML = '<option value="">Select agent</option>';
        list.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = u.name;
          if (u.email) opt.setAttribute('data-email', u.email);
          sel.appendChild(opt);
 });
 }
      function renderDropdown(list) {
        if (!ddList) return;
        ddList.innerHTML = '';
        list.forEach(u => {
          const li = document.createElement('li');
          li.textContent = u.name;
          li.dataset.value = u.id;
          li.dataset.email = u.email || '';
          li.addEventListener('click', () => {
            sel.value = u.id;
            const emailInput = document.getElementById('agentEmailInput');
            if (emailInput) emailInput.value = u.email || '';
            if (ddInput) ddInput.value = u.name || '';
            if (ddPanel) ddPanel.hidden = true;
 });
          ddList.appendChild(li);
 });
 }
      renderSelect(sel._allAgents);
      renderDropdown(sel._allAgents);
      // Bind change to auto-fill email and reflect in custom input
      sel.addEventListener('change', () => {
        const o = sel.selectedOptions[0];
        const email = o ? o.getAttribute('data-email') || '' : '';
        const label = o ? o.textContent || '' : '';
        const emailInput = document.getElementById('agentEmailInput');
        if (emailInput) emailInput.value = email;
        if (ddInput) ddInput.value = label;
 });
      // Bind embedded filter to list re-render
      if (ddFilter) {
        const applyFilter = () => {
          const q = ddFilter.value.trim().toLowerCase();
          const all = sel._allAgents || [];
          const filtered = q ? all.filter(a => (a.name||'').toLowerCase().includes(q) || (a.email||'').toLowerCase().includes(q)) : all;
          renderDropdown(filtered);
 };
        // Replace any previous handler safely
        ddFilter.removeEventListener('input', ddFilter.__applyFilter);
        ddFilter.addEventListener('input', applyFilter);
        ddFilter.__applyFilter = applyFilter;
 }
 } catch(e) {
 }
 }

  async function fetchRecent() {
    try {
      const url = `${config.restUrl}/${WINS_SUBMISSIONS_TABLE}?select=id,conversation_id,agent_name,channel,final_score,created_at&order=created_at.desc&limit=10`;
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        const errText = await res.text();
        // Fallback: try with service key in case RLS blocks anon/client
        res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
        if (!res.ok) {
          const svcErr = await res.text();
          console.error('Recent submissions fetch error (service):', svcErr);
          throw new Error(svcErr);
 }
 }
      const rows = await res.json();
      const tbody = document.querySelector('#recentTable tbody');
      tbody.innerHTML = '';
      (rows || []).forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r.id ?? ''}</td>
          <td>${r.conversation_id || ''}</td>
          <td>${r.agent_name || ''}</td>
          <td>${r.channel || ''}</td>
          <td>${r.final_score ?? ''}</td>
          <td>${(r.created_at ?? '').toString().replace('T',' ').replace('Z','')}</td>
        `;
        tbody.appendChild(tr);
 });
 } catch (err) {
      console.error('Failed to load recent submissions', err);
 }
 }

  function setWinsCalibrationConversation(convId) {
    const normalizedConvId = String(convId || '').trim();
    const convInput = document.getElementById('conversationIdInput');
    if (convInput) {
      convInput.value = normalizedConvId;
      convInput.setAttribute('value', normalizedConvId);
      convInput.dispatchEvent(new Event('input'));
      convInput.dispatchEvent(new Event('change'));
    }
    const icon = document.getElementById('ticketIconBtn');
    if (icon) icon.style.display = normalizedConvId ? 'inline-flex' : 'none';
    const calibYes = document.querySelector('input[name="calibration"][value="Yes"]');
    if (calibYes) {
      calibYes.checked = true;
      calibYes.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async function loadCalibrationCase(queueType) {
    try {
      calibrationMode = false;
      const base = `${config.restUrl}/Assigning_Calibration`;
      const normalizedType = String(queueType || '').trim();
      const requestedType = normalizedType.toLowerCase();
      const select = 'select=Conversation_Id,day,Score_card,id,type';
      async function fetchWithAuth(url, label) {
        let res = await fetch(url, { headers: authHeaders() });
        let data = [];
        if (res.ok) {
          data = await res.json();
 } else {
          const errText = await res.text();
 }

        // If client headers returned nothing (or failed), retry with service key
        if ((!Array.isArray(data) || data.length === 0) && config.serviceKey) {
          res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
          if (!res.ok) {
            const svcErr = await res.text();
            console.error('Calibration fetch error (service)', label, svcErr);
            showAlert('Unable to fetch calibration case. Please try again.');
            return null;
 }
          data = await res.json();
 }

        return data;
 }
      if (!requestedType) {
        showAlert('Please choose a calibration queue.');
        return;
      }
      const urlLatest = `${base}?${select}&Score_card=eq.Wins_Scorecard&order=id.desc&limit=50`;
      const fetchedRows = await fetchWithAuth(urlLatest, `wins-${requestedType}`);
      const normalizedRows = Array.isArray(fetchedRows) ? fetchedRows : [];
      let rows = normalizedRows.filter((item) => {
        const itemType = String(item?.type || '').trim().toLowerCase();
        return itemType === requestedType;
      });
      if (!rows.length && requestedType === 'retention') {
        rows = normalizedRows.filter((item) => {
          const itemType = String(item?.type || '').trim().toLowerCase();
          return itemType === 'order support';
        });
      }
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        showAlert(`No calibration cases found for ${normalizedType}.`);
        calibrationMode = false;
        return;
 }
      const row = rows[0] || {};
      const convId = (row.Conversation_Id || row.conversation_id || '').toString().trim();
      if (!convId) {
        showAlert('Calibration case found but Conversation ID is empty.');
        calibrationMode = false;
        return;
 }
      setWinsCalibrationConversation(convId);
      calibrationMode = true;
      const agentSel = document.getElementById('agentNameSelect');
      const agentDdInput = document.getElementById('agentDropdownInput');
      if (agentSel) {
        let targetOption = null;
        for (let i = 0; i < agentSel.options.length; i++) {
          const opt = agentSel.options[i];
          const label = (opt.textContent || opt.innerText || '').trim();
          if (label === 'Heba El Sobky') {
            targetOption = opt;
            break;
 }
 }
        if (targetOption) {
          agentSel.value = targetOption.value;
          const email = targetOption.getAttribute('data-email') || '';
          const emailInput = document.getElementById('agentEmailInput');
          if (emailInput) emailInput.value = email;
          if (agentDdInput) agentDdInput.value = 'Heba El Sobky';
          agentSel.dispatchEvent(new Event('change'));
 }
 }
      showAlert(`${normalizedType} calibration conversation loaded: ${convId}`, { type: 'success' });
 } catch (err) {
      console.error('Failed to load calibration case', err);
      showAlert('Failed to load calibration case. Please try again.');
 }
 }

  async function loadTakerName() {
    try {
      const email = localStorage.getItem('loggedInUserEmail') || localStorage.getItem('user_email') || localStorage.getItem('email');
      const cachedName = localStorage.getItem('userName') || localStorage.getItem('loggedInUserName');
      const input = document.getElementById('takerNameInput');
      if (cachedName && input) { input.value = cachedName; return; }
      if (!email) return;
      const url = `${config.restUrl}/users?select=Name,email&email=eq.${encodeURIComponent(email)}&limit=1`;
      // Try client headers first
      let res = await fetch(url, { headers: authHeaders() });
      let name = '';
      if (res.ok) {
        const rows = await res.json();
        name = rows && rows[0] && (rows[0].Name || rows[0].name) || '';
 }
      // Fallback to service key if needed
      if (!name) {
        res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
        if (res.ok) {
          const rows = await res.json();
          name = rows && rows[0] && (rows[0].Name || rows[0].name) || '';
 }
 }
      if (name && input) {
        input.value = name;
        // cache for quick reuse
        localStorage.setItem('userName', name);
        localStorage.setItem('loggedInUserName', name);
 }
 } catch (e) {
 }
 }

  function findWinsAttrRowByLabel(label) {
    const rows = document.querySelectorAll('.attr-row');
    for (const row of rows) {
      const nameEl = row.querySelector('.attr-name');
      const text = nameEl ? (nameEl.textContent || '').trim() : (row.dataset && row.dataset.subcategory ? row.dataset.subcategory : '');
      if (text === label) return row;
 }
    return null;
 }

  function getWinsAttrValue(label) {
    const row = findWinsAttrRowByLabel(label);
    const chk = row ? row.querySelector('input[type="radio"]:checked') : null;
    return chk ? chk.value : '';
 }

  function getWinsAttrComment(label) {
    const row = findWinsAttrRowByLabel(label);
    const ta = row ? row.querySelector('textarea') : null;
    return ta ? (ta.value || '').trim() : '';
 }

  function buildWinsAttributeRowsFromPayload(payload) {
    return WINS_ATTRIBUTE_COLUMNS.map((item) => ({
      attribute: item.label,
      score: item.score,
      answer: payload[item.answerKey] || '',
      comment: payload[item.commentKey] || ''
 }));
 }

  function buildWinsSubmissionPayload() {
    const getSelectVal = (id) => ((document.getElementById(id) || {}).value || '').trim();
    const getRadioVal = (name) => { const r = document.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };
    const agentSelect = document.getElementById('agentNameSelect');
    const selectedAgentLabel = agentSelect && agentSelect.value ? agentSelect.selectedOptions[0].textContent.trim() : '';
    const conversationId = (document.getElementById('conversationIdInput') || { value: '' }).value.trim();
    const finalScore = `${totalFromRadios()}%`;
    const scoreNum = parseFloat(String(finalScore).replace(/%/g, '')) || 0;
    const base = 'https://tempo-support.myfreshworks.com/crm/messaging/a/770177527280330/inbox/27/0/conversation/';
    const attributeValues = {};
    WINS_ATTRIBUTE_COLUMNS.forEach((item) => {
      attributeValues[item.answerKey] = getWinsAttrValue(item.label);
      attributeValues[item.commentKey] = getWinsAttrComment(item.label);
 });

    return {
      conversation_id: conversationId,
      agent_name: selectedAgentLabel,
      taker_name: ((document.getElementById('takerNameInput') || {}).value || '').trim(),
      url: conversationId ? `${base}${encodeURIComponent(conversationId)}` : '',
      channel: getSelectVal('channelSelect'),
      sme_answer: getSelectVal('smeAnswerProvided'),
      sme_name: getSelectVal('smeName'),
      sme_following_process: getSelectVal('smeFollowingProcess'),
      monitoring_type: getSelectVal('monitoringType'),
      interaction_related_to: getSelectVal('interactionRelatedTo'),
      final_score: finalScore,
      agent_email: ((document.getElementById('agentEmailInput') || {}).value || '').trim(),
      certification: getRadioVal('certification'),
      calibration: getRadioVal('calibration'),
      ticket_status: getSelectVal('ticketStatus'),
      sales: getRadioVal('salesRadio'),
      sales_comments: ((document.getElementById('salesComments') || {}).value || '').trim(),
      retained_yes_no: getRadioVal('fitnessFluency'),
      comments_sme_related: ((document.getElementById('smeGeneralComments') || {}).value || '').trim(),
      result_status: scoreNum >= PASS_THRESHOLD ? 'PASS' : 'FAIL',
      ...attributeValues
 };
 }

  function totalFromRadios() {
    // Use attributes subtotal (Final Score) instead of averaging core radios
    let total = 0;
    let anyZeroNo = false;
    attributes.forEach((item, idx) => {
      const name = `attr_${item.ID || idx}`;
      const yes = document.querySelector(`input[name="${name}"][value="Yes"]:checked`);
      const no = document.querySelector(`input[name="${name}"][value="No"]:checked`);
      if (yes) total += (item.Score != null ? item.Score : 0);
      if (no && ((item.Score != null ? item.Score : 0) === 0)) anyZeroNo = true;
 });
    return anyZeroNo ? 0 : total;
 }

  function validate() {
    // Helpers
    const getSelectVal = (id) => ((document.getElementById(id) || {}).value || '').trim();
    const getRadioVal = (name) => { const r = document.querySelector(`input[name="${name}"]:checked`); return r ? r.value : ''; };
    const findAttrRowByLabel = (label) => {
      const rows = document.querySelectorAll('.attr-row');
      for (const row of rows) {
        const nameEl = row.querySelector('.attr-name');
        const text = nameEl ? (nameEl.textContent || '').trim() : (row.dataset && row.dataset.subcategory ? row.dataset.subcategory : '');
        if (text === label) return row;
 }
      return null;
 };
    const buildAttrMap = () => {
      // Dynamic validation based on fetched attributes
      const labels = attributes.map(a => a.Subcategory);
      const res = {};
      labels.forEach((l) => {
        const row = findAttrRowByLabel(l);
        if (row) {
          const checked = row.querySelector('input[type="radio"]:checked');
          const val = checked ? checked.value : '';
          const commentEl = row.querySelector('textarea');
          const comment = commentEl ? (commentEl.value || '').trim() : '';
          res[l] = { val, comment };
 } else {
          res[l] = { val: '', comment: '' };
 }
 });
      return res;
 };

    const conversationId = (document.getElementById('conversationIdInput') || { value: '' }).value.trim();
    const agentNameSelect = document.getElementById('agentNameSelect');
    const agentName = agentNameSelect && agentNameSelect.value ? agentNameSelect.selectedOptions[0].textContent.trim() : '';
    const agentEmail = getSelectVal('agentEmailInput');
    const empties = [];

    if (!conversationId) empties.push('The Conversation ID is empty');
    if (!agentName) empties.push('The Agent Name is empty');
    if (!agentEmail) empties.push('The Agent Email is empty');

    // Dropdowns
    const selectChecks = [
      { id: 'channelSelect', label: 'Channel' },
      { id: 'smeAnswerProvided', label: 'SME Answer' },
      { id: 'smeName', label: 'SME' },
      { id: 'smeFollowingProcess', label: 'SME Following Process' },
      { id: 'ticketStatus', label: 'Ticket Status' },
      { id: 'monitoringType', label: 'Monitoring Type' },
      { id: 'interactionRelatedTo', label: 'Interaction Related To' },
    ];
    selectChecks.forEach(({ id, label }) => { if (!getSelectVal(id)) empties.push(`The ${label} is empty`); });

    // Radios
    const radioChecks = [
      { name: 'certification', label: 'Certification' },
      { name: 'calibration', label: 'Calibration' },
      { name: 'salesRadio', label: 'Sales' },
      { name: 'fitnessFluency', label: 'Retained Yes/No' },
    ];
    radioChecks.forEach(({ name, label }) => { if (!getRadioVal(name)) empties.push(`The ${label} is empty`); });

    // Attribute radios (require Yes/No for each defined attribute)
    const attrMap = buildAttrMap();
    Object.entries(attrMap).forEach(([label, obj]) => { if (!obj.val) empties.push(`The ${label} is empty`); });

    if (empties.length > 0) {
      const list = empties.map(e => `- ${e}`).join('\n');
      showAlert(list, { title: 'Missing required fields', type: 'warning' });
      return false;
 }
    return true;
 }

  async function submit() {
    if (!validate()) return;
    const token = localStorage.getItem('login_token');
    if (!token) { showAlert('Please log in to submit your scorecard.', { title: 'Login required', type: 'warning' }); return; }

    const payload = buildWinsSubmissionPayload();
    const body = JSON.stringify(payload);

    try {
      const url = `${config.restUrl}/${WINS_SUBMISSIONS_TABLE}`;
      const headers = authHeaders();
      headers['Prefer'] = 'return=minimal';
      headers['Content-Type'] = 'application/json';
      let res = await fetch(url, { method: 'POST', headers, body });
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        if (res.status === 401 || res.status === 403) {
          const svcHeaders = authHeaders({ useServiceKey: true });
          svcHeaders['Prefer'] = 'return=minimal';
          svcHeaders['Content-Type'] = 'application/json';
          const resSvc = await fetch(url, { method: 'POST', headers: svcHeaders, body });
          if (!resSvc.ok) throw new Error(await resSvc.text());
          res = resSvc;
 } else {
          throw new Error(bodyText || 'Unknown submission error');
 }
 }

      // Compose and attempt to send email summary (best-effort)
      payload.loggedInEmail = localStorage.getItem('loggedInUserEmail');
      const logoUrl = getLogoUrl();
      const logoDataUri = await fetchLogoAsDataURI();
      const emailHtml = buildEmailHTML(payload, { logoDataUri, logoUrl });
      try { await sendEmailSMTP({ html: emailHtml, to: payload.agent_email, cc: payload.loggedInEmail ? [payload.loggedInEmail] : [], subject: `QA Summary: ${payload.conversation_id} • ${payload.final_score} • ${payload.result_status}` }); } catch (mailErr) {  try { showAlert('Summary email could not be sent. Your scorecard was saved.', { title: 'Email delivery issue', type: 'warning' }); } catch(_) {} }

      try { showAlert('Scorecard submitted successfully', { title: 'Submission successful', type: 'success' }); } catch(_) {}
      reset();
      await fetchRecent();
 } catch (e) {
      console.error('Failed to submit scorecard', e);
      const msg = (e && (e.message || (typeof e === 'string' ? e : ''))) || 'Unexpected error';
      showAlert(`Failed to submit scorecard: ${msg}`, { title: 'Submission failed', type: 'error' });
 }
 }

  function buildEmailHTML(p, opts = {}) {
    const pill = (label, value) => `
      <div style="display:inline-flex; align-items:center; gap:6px; background:#f3f4f6; color:#111827; border:1px solid #e5e7eb; border-radius:999px; padding:6px 10px; font-size:12px; margin:4px 6px 0 0;">
        <span style="color:#6b7280;">${label}:</span>
        <span style="font-weight:600;">${(value || '').toString()}</span>
      </div>`;
    const attrRows = buildWinsAttributeRowsFromPayload(p).map((item) => {
      const answer = (item.answer || '').toString();
      const displayVal = answer === 'Yes'
        ? `Yes / ${Number(item.score || 0)}%`
        : (answer === 'No' ? 'No / 0%' : answer);
      return `
        <tr>
          <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; font-weight:600; color:#111827;">${item.attribute || ''}</td>
          <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; color:#111827;">${displayVal}</td>
          <td style="padding:12px 14px; border-bottom:1px solid #e5e7eb; color:#6b7280; white-space: pre-wrap;">${item.comment || ''}</td>
        </tr>`;
 }).join('');
    const logoHtml = (() => {
      const src = opts.logoDataUri || opts.logoUrl || '';
      if (!src) return '';
      return `<div style="padding:16px 0; text-align:center;">
        <div style="display:inline-flex; align-items:center; justify-content:center;">
          <img src="${src}" alt="Tempo" style="max-height:44px; width:auto; display:inline-block; filter: invert(1);">
        </div>
      </div>`;
 })();
    const header = `
      ${logoHtml}
      <div style="background:#4f46e5; background-image:linear-gradient(135deg,#6366f1,#8b5cf6); padding:22px; border-radius:16px 16px 0 0; color:#fff; text-align:center;">
        <div style="font-size:18px; font-weight:800;">QA Summary</div>
        <div style="margin-top:6px; font-size:14px; opacity:0.95;">Conversation ${p.conversation_id} • Score ${p.final_score}</div>
      </div>`;
    const ticketUrl = p.url || '';
    const scoreNum = parseFloat(String(p.final_score).replace(/%/g,'')) || 0;
    const statusLabel = scoreNum >= PASS_THRESHOLD ? 'Pass' : 'Fail';
    const meta = `
      <div style="padding:16px;">
        ${pill('Agent', p.agent_name)}
        ${pill('Coach Name', p.taker_name || '')}
        ${pill('Channel', p.channel)}
        ${pill('Monitoring', p.monitoring_type)}
        ${pill('Final Score', p.final_score)}
        ${pill('Status', statusLabel)}
        ${pill('Retained Yes/No', p.retained_yes_no || '')}
        <div style="margin-top:10px;">
          <a href="${ticketUrl}" style="display:inline-block; background:#4f46e5; color:#fff; text-decoration:none; padding:10px 16px; border-radius:999px; font-size:14px; box-shadow:0 6px 12px rgba(79,70,229,0.3);">Open Ticket</a>
        </div>
      </div>`;
    const msgBlock = statusLabel === 'Pass'
      ? `<div style="padding:16px;">
           <div style="background:#ecfdf5; border:1px solid #10b981; color:#065f46; border-radius:12px; padding:12px 16px; font-size:14px;">
             🎉 Awesome work! Keep up the momentum and continue delivering great experiences.
           </div>
         </div>`
      : `<div style="padding:16px;">
           <div style="background:#fff7ed; border:1px solid #f59e0b; color:#7c2d12; border-radius:12px; padding:12px 16px; font-size:14px;">
             💪 Thank you for your effort. Review the notes, focus on the key areas, and you’ll bounce back stronger. You've got this!
           </div>
         </div>`;
    const table = `
      <table style="width:100%; border-collapse:collapse; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;">
        <thead><tr>
          <th style="text-align:left; padding:12px 14px; background:#f9fafb; color:#374151; border-bottom:1px solid #e5e7eb; font-size:12px; text-transform:uppercase; letter-spacing:0.04em;">Attribute</th>
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
          ${msgBlock}
          <div style="padding:16px;">${table}</div>
        </div>
      </div>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body>${wrapper}</body></html>`;
 }

  async function blobToDataURI(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
 });
 }

  function getLogoUrl() {
    try {
      // Allow setting via page script: window.EMAIL_LOGO_URL = 'https://...'
      if (typeof window !== 'undefined' && window.EMAIL_LOGO_URL) return String(window.EMAIL_LOGO_URL);
 } catch (e) {}
    try {
      // Allow via config object if present: config.emailLogoUrl
      if (typeof config !== 'undefined' && config.emailLogoUrl) return String(config.emailLogoUrl);
 } catch (e) {}
    return 'https://kupaxfvjfobfdgtbfnnt.supabase.co/storage/v1/object/public/pub/image%20(2).png';
 }

  async function fetchLogoAsDataURI() {
    const candidates = [
      'https://kupaxfvjfobfdgtbfnnt.supabase.co/storage/v1/object/public/pub/image%20(2).png'
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) continue;
        const blob = await res.blob();
        return await blobToDataURI(blob);
 } catch (e) { /* ignore */ }
 }
    return null;
 }

  async function sendEmail({ html, to, subject, cc, bcc }) {
    // Use local relay in dev; Vercel Serverless route in production
    const host = (typeof location !== 'undefined') ? (location.hostname || '') : '';
    const normalizedHost = host.replace(/^\[|\]$/g, '');
    const isLocal = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::' || normalizedHost === '::1';
    const endpoint = isLocal ? 'http://127.0.0.1:8025/send-email' : '/api/send-email';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, cc, bcc })
 });
      if (!res.ok) throw new Error(await res.text());
      return true;
 } catch (e) {
      // Log and continue; email is auxiliary
      return false;
 }
 }

  async function previewEmail() {
    try {
      const payload = buildWinsSubmissionPayload();
      const logoUrl = getLogoUrl();
      const logoDataUri = await fetchLogoAsDataURI();
      const html = buildEmailHTML(payload, { logoDataUri, logoUrl });
      const overlay = document.getElementById('emailPreviewOverlay');
      const iframe = document.getElementById('emailPreviewIframe');
      if (iframe) iframe.srcdoc = html;
      if (overlay) overlay.style.display = 'flex';
 } catch (e) {
      console.error('Failed to render email preview', e);
      showAlert('Failed to render email preview', { title: 'Preview error', type: 'error' });
 }
 }

  function reset() {
    calibrationMode = false;
    ['conversationIdInput'].forEach(id => {
      const el = document.getElementById(id); if (el) { el.value = ''; el.disabled = true; }
 });
    const monSelectReset = document.getElementById('monitoringType');
    if (monSelectReset) {
      monSelectReset.disabled = false;
      monSelectReset.removeAttribute('data-sbs-locked');
      monSelectReset.dataset.pasteLocked = 'false';
      monSelectReset.title = '';
 }
    const agentEmailEl = document.getElementById('agentEmailInput');
    if (agentEmailEl) agentEmailEl.value = '';
    const channelEl = document.getElementById('channelSelect');
    if (channelEl) channelEl.value = '';
    const agentNameSelectEl = document.getElementById('agentNameSelect');
    if (agentNameSelectEl) agentNameSelectEl.selectedIndex = 0;
    const agentDropdownInputEl = document.getElementById('agentDropdownInput');
    if (agentDropdownInputEl) agentDropdownInputEl.value = '';
    const rowIdEl = document.getElementById('freshworksRowId');
    if (rowIdEl) rowIdEl.value = '';
    const ticketIconBtnReset = document.getElementById('ticketIconBtn');
    if (ticketIconBtnReset) ticketIconBtnReset.style.display = 'none';
    document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    // Restore default selections for Certification/Calibration to "No"
    const certNo = document.querySelector('input[name="certification"][value="No"]');
    if (certNo) certNo.checked = true;
    const calibNo = document.querySelector('input[name="calibration"][value="No"]');
    if (calibNo) calibNo.checked = true;

    // Clear left-side SME/Sales fields (preserve filters used by Get Case)
    ['smeAnswerProvided','smeName','smeFollowingProcess','ticketStatus','monitoringType','interactionRelatedTo']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    // Clear interaction dropdown custom UI
    const interactionInput = document.getElementById('interactionDropdownInput');
    if (interactionInput) interactionInput.value = '';
    const interactionPanel = document.getElementById('interactionDropdownPanel');
    if (interactionPanel) interactionPanel.hidden = true;
    // Clear SME-related textareas
    ['smeGeneralComments','salesComments']
      .forEach(id => { 
        const el = document.getElementById(id); 
        if (el) {
          el.value = '';
          if (el.dataset.hasRte === 'true' && el.previousElementSibling && el.previousElementSibling.classList.contains('rte-container')) {
             const ed = el.previousElementSibling.querySelector('.rte-editor');
             if (ed) ed.innerHTML = '';
 }
 }
 });
    // Clear sales and fitness radio groups and remove highlight
    document.querySelectorAll('input[name="salesRadio"]').forEach(r => r.checked = false);
    document.querySelectorAll('input[name="fitnessFluency"]').forEach(r => r.checked = false);
    document.querySelectorAll('.sme-radio-group').forEach(group => {
      group.querySelectorAll('label').forEach(l => l.classList.remove('checked'));
 });

    ['communicationComment','professionalismComment','knowledgeComment','resolutionComment']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    // Clear attributes Yes/No and comments
    resetAttributesUI();
    updateConversationIdState();
    const notice = document.getElementById('duplicateNotice');
    if (notice) notice.style.display = 'none';
    // Clear last-conversation fallback
    try { localStorage.removeItem('t1_last_conv_id'); } catch(_) {}
    try { localStorage.removeItem('t1_current_case'); } catch(_) {}
    // Preserve date range filters across submissions
    const single = document.getElementById('dateRangeSingle');
    const from = document.getElementById('dateFrom');
    const to = document.getElementById('dateTo');
    // Do not clear from/to; keep Get Case enabled if already set
    updateDateStatus();
    toggleGetCaseEnabled();
 }

  function bindCalendarAndSelectAll() {
    const calIcon = document.getElementById('calendarIcon');
    if (calIcon) calIcon.addEventListener('click', focusDateRange);
    const selectAllBtn = document.getElementById('selectAllBtn');
    if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllAttributesYes);
    // Bind single datepicker change to fill hidden From/To
    const single = document.getElementById('dateRangeSingle');
    const from = document.getElementById('dateFrom');
    const to = document.getElementById('dateTo');
    if (single && from && to) {
      single.addEventListener('change', () => {
        const val = single.value;
        if (!val) return;
        if (dateRangePickStep === 0) {
          // First pick: set From and clear To
          from.value = val;
          to.value = '';
          dateRangePickStep = 1;
          updateDateStatus();
          toggleGetCaseEnabled();
          // Sync inline calendar selection
          applyInlineSelectionFromInputs();
 } else {
          // Second pick: set To; ensure chronological order
          const fromD = new Date(from.value);
          const toD = new Date(val);
          if (isNaN(fromD.getTime())) {
            // If From somehow empty/invalid, treat current as From
            from.value = val;
            to.value = '';
            dateRangePickStep = 1;
            updateDateStatus();
            toggleGetCaseEnabled();
            applyInlineSelectionFromInputs();
            return;
 }
          if (toD.getTime() < fromD.getTime()) {
            // Swap to keep From <= To
            to.value = from.value;
            from.value = val;
 } else {
            to.value = val;
 }
          // Reset step for a new cycle
          dateRangePickStep = 0;
          updateDateStatus();
          toggleGetCaseEnabled();
          applyInlineSelectionFromInputs();
 }
 });
 }

    // Overlay picker bindings
    bindOverlayPicker();
 }
  function bindOverlayPicker() {
    const modal = document.getElementById('rangePickerModal');
    const prev = document.getElementById('rpPrev');
    const next = document.getElementById('rpNext');
    const monthL = document.getElementById('rpMonthLeft');
    const yearL = document.getElementById('rpYearLeft');
    const monthR = document.getElementById('rpMonthRight');
    const yearR = document.getElementById('rpYearRight');
    const cancel = document.getElementById('rpCancel');
    const done = document.getElementById('rpDone');
    const title = document.getElementById('rpTitle');
    const collapsed = document.getElementById('rpCollapsedLabel');
    if (!modal) return;

    // Initialize anchor month
    if (rpAnchorYear === null || rpAnchorMonth === null) {
      const today = new Date();
      rpAnchorYear = today.getFullYear();
      rpAnchorMonth = today.getMonth();
 }
    populateMonthYearSelects(monthL, yearL, rpAnchorMonth, rpAnchorYear);
    const rightMonth = (rpAnchorMonth + 1) % 12;
    const rightYear = rpAnchorMonth === 11 ? rpAnchorYear + 1 : rpAnchorYear;
    populateMonthYearSelects(monthR, yearR, rightMonth, rightYear);
    renderMonthGrid('rpDaysLeft', rpAnchorYear, rpAnchorMonth);
    renderMonthGrid('rpDaysRight', rightYear, rightMonth);
    updatePickerTitle(title);
    updateCollapsedLabel(collapsed);

    // Navigation
    if (prev) prev.addEventListener('click', () => { shiftAnchor(-1); });
    if (next) next.addEventListener('click', () => { shiftAnchor(1); });
    if (monthL) monthL.addEventListener('change', () => { rpAnchorMonth = parseInt(monthL.value, 10); syncRightFromLeft(); renderBoth(); });
    if (yearL) yearL.addEventListener('change', () => { rpAnchorYear = parseInt(yearL.value, 10); syncRightFromLeft(); renderBoth(); });
    if (monthR) monthR.addEventListener('change', () => { const m = parseInt(monthR.value,10); const y = parseInt(yearR.value,10); setRightExplicit(y,m); renderBoth(); });
    if (yearR) yearR.addEventListener('change', () => { const m = parseInt(monthR.value,10); const y = parseInt(yearR.value,10); setRightExplicit(y,m); renderBoth(); });
    if (cancel) cancel.addEventListener('click', () => { closeRangePicker(); });
    if (done) done.addEventListener('click', () => { closeRangePicker(); });
    if (collapsed) collapsed.addEventListener('click', () => { openRangePicker(); });

    // Close on outside click
    modal.addEventListener('click', (e) => { if (e.target === modal) closeRangePicker(); });
 }

  function openRangePicker() {
    const modal = document.getElementById('rangePickerModal');
    const collapsed = document.getElementById('rpCollapsedLabel');
    if (!modal) return;
    modal.style.display = 'flex';
    updateCollapsedLabel(collapsed);
    // Ensure grids reflect current hidden inputs
    const f = document.getElementById('dateFrom')?.value || '';
    if (f) {
      const fd = new Date(f);
      rpAnchorYear = fd.getFullYear();
      rpAnchorMonth = fd.getMonth();
 } else if (rpAnchorYear === null || rpAnchorMonth === null) {
      const today = new Date();
      rpAnchorYear = today.getFullYear();
      rpAnchorMonth = today.getMonth();
 }
    renderBoth();
 }

  function closeRangePicker() {
    const modal = document.getElementById('rangePickerModal');
    if (modal) modal.style.display = 'none';
    updateCollapsedLabel(document.getElementById('rpCollapsedLabel'));
 }

  function shiftAnchor(delta) {
    rpAnchorMonth += delta;
    if (rpAnchorMonth < 0) { rpAnchorMonth = 11; rpAnchorYear -= 1; }
    if (rpAnchorMonth > 11) { rpAnchorMonth = 0; rpAnchorYear += 1; }
    renderBoth();
 }

  function syncRightFromLeft() {
    const monthR = document.getElementById('rpMonthRight');
    const yearR = document.getElementById('rpYearRight');
    const rightMonth = (rpAnchorMonth + 1) % 12;
    const rightYear = rpAnchorMonth === 11 ? rpAnchorYear + 1 : rpAnchorYear;
    populateMonthYearSelects(monthR, yearR, rightMonth, rightYear);
 }

  function setRightExplicit(y, m) {
    // Keep right always trailing left by +1 month when possible
    const leftDate = new Date(rpAnchorYear, rpAnchorMonth, 1);
    const rightDate = new Date(y, m, 1);
    if (rightDate.getTime() <= leftDate.getTime()) {
      const adj = new Date(rpAnchorYear, rpAnchorMonth + 1, 1);
      populateMonthYearSelects(document.getElementById('rpMonthRight'), document.getElementById('rpYearRight'), adj.getMonth(), adj.getFullYear());
 }
 }

  function renderBoth() {
    const monthL = document.getElementById('rpMonthLeft');
    const yearL = document.getElementById('rpYearLeft');
    const rightMonth = (rpAnchorMonth + 1) % 12;
    const rightYear = rpAnchorMonth === 11 ? rpAnchorYear + 1 : rpAnchorYear;
    populateMonthYearSelects(monthL, yearL, rpAnchorMonth, rpAnchorYear);
    populateMonthYearSelects(document.getElementById('rpMonthRight'), document.getElementById('rpYearRight'), rightMonth, rightYear);
    renderMonthGrid('rpDaysLeft', rpAnchorYear, rpAnchorMonth);
    renderMonthGrid('rpDaysRight', rightYear, rightMonth);
    updatePickerTitle(document.getElementById('rpTitle'));
 }

  function populateMonthYearSelects(monthSel, yearSel, month, year) {
    if (!monthSel || !yearSel) return;
    monthSel.innerHTML = monthNames.map((m,i)=>`<option value="${i}" ${i===month?'selected':''}>${m}</option>`).join('');
    const years = [];
    const base = new Date().getFullYear();
    for (let y = base - 5; y <= base + 5; y++) years.push(y);
    yearSel.innerHTML = years.map(y=>`<option value="${y}" ${y===year?'selected':''}>${y}</option>`).join('');
 }

  function renderMonthGrid(containerId, year, month) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const firstDayIdx = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const fromVal = (document.getElementById('dateFrom') || {}).value || '';
    const toVal = (document.getElementById('dateTo') || {}).value || '';
    const fromDate = fromVal ? stripTime(new Date(fromVal)) : null;
    const toDate = toVal ? stripTime(new Date(toVal)) : null;
    let html = '';
    // Leading
    for (let i = 0; i < firstDayIdx; i++) {
      const dayNum = prevMonthDays - firstDayIdx + 1 + i;
      const d = new Date(year, month - 1, dayNum);
      html += rpDayCell(d, true, fromDate, toDate);
 }
    // Current
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      html += rpDayCell(dateObj, false, fromDate, toDate);
 }
    // Trailing to complete rows
    const totalCells = firstDayIdx + daysInMonth;
    const trailing = ((Math.ceil(totalCells / 7) * 7) - totalCells);
    for (let i = 1; i <= trailing; i++) {
      const d = new Date(year, month + 1, i);
      html += rpDayCell(d, true, fromDate, toDate);
 }
    cont.innerHTML = html;
    cont.querySelectorAll('.rp-day').forEach(el => {
      el.addEventListener('click', () => {
        const iso = el.getAttribute('data-iso');
        const from = document.getElementById('dateFrom');
        const to = document.getElementById('dateTo');
        if (dateRangePickStep === 0) {
          from.value = iso;
          to.value = '';
          dateRangePickStep = 1;
 } else {
          const f = new Date(from.value);
          const t = new Date(iso);
          if (isNaN(f.getTime())) {
            from.value = iso;
            to.value = '';
            dateRangePickStep = 1;
 } else {
            if (t.getTime() < f.getTime()) {
              to.value = from.value;
              from.value = iso;
 } else {
              to.value = iso;
 }
            dateRangePickStep = 0;
 }
 }
        updateDateStatus();
        toggleGetCaseEnabled();
        renderBoth();
        updatePickerTitle(document.getElementById('rpTitle'));
        updateCollapsedLabel(document.getElementById('rpCollapsedLabel'));
 });
 });
 }

  function rpDayCell(dateObj, otherMonth, fromDate, toDate) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const classes = ['rp-day'];
    if (otherMonth) classes.push('rp-other');
    const dStripped = stripTime(dateObj);
    const inRange = fromDate && toDate && dStripped >= fromDate && dStripped <= toDate;
    const isStart = fromDate && dStripped.getTime() === fromDate.getTime();
    const isEnd = toDate && dStripped.getTime() === toDate.getTime();
    if (isStart) classes.push('rp-selected-start');
    if (isEnd) classes.push('rp-selected-end');
    if (inRange && !isStart && !isEnd) classes.push('rp-in-range');
    return `<div class="${classes.join(' ')}" data-iso="${iso}">${dateObj.getDate()}</div>`;
 }

  function stripTime(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
 }

  function updatePickerTitle(el) {
    if (!el) return;
    const fromVal = (document.getElementById('dateFrom') || {}).value || '';
    const toVal = (document.getElementById('dateTo') || {}).value || '';
    if (fromVal && toVal) {
      // Keep concise without extra phrasing in title
      el.textContent = `${fromVal} - ${toVal}`;
 } else if (fromVal) {
      el.textContent = `${fromVal} - —`;
 } else {
      el.textContent = '—';
 }
 }

  function updateCollapsedLabel(el) {
    if (!el) return;
    const fromVal = (document.getElementById('dateFrom') || {}).value || '';
    const toVal = (document.getElementById('dateTo') || {}).value || '';
    if (fromVal && toVal) {
      // Single clean label without prefix
      el.textContent = `${fromVal} - ${toVal}`;
 } else if (fromVal) {
      el.textContent = `${fromVal} - —`;
 } else {
      el.textContent = '';
 }
 }

  function updateDateStatus() {
    const from = document.getElementById('dateFrom');
    const to = document.getElementById('dateTo');
    const fromDisp = document.getElementById('dateFromDisplay');
    const toDisp = document.getElementById('dateToDisplay');
    if (fromDisp) fromDisp.textContent = `From: ${from && from.value ? from.value : '—'}`;
    if (toDisp) toDisp.textContent = `To: ${to && to.value ? to.value : '—'}`;
 }

  function toggleGetCaseEnabled() {
    const btn = document.getElementById('getCaseBtn');
    const from = document.getElementById('dateFrom');
    const to = document.getElementById('dateTo');
    if (!btn) return;
    const bothSet = !!(from && from.value && to && to.value);
    // Keep button clickable so getCase() can show warnings when fields are missing
    btn.disabled = false;
    if (btn.classList) btn.classList.toggle('btn-disabled-look', !bothSet);
 }

  function bindEvents() {
    const conv = document.getElementById('conversationIdInput');
    if (conv) {
      // SBS Slack Notification Logic
      let sbsDebounceTimer = null;
      const triggerSbsSlack = async () => {
        const monSelect = document.getElementById('monitoringType');
        if (!monSelect || (monSelect.value !== 'SBS' && monSelect.value !== 'Selected')) return;
        
        const val = conv.value.trim();
        if (!val) return;

        // Prevent duplicate sending for the same ID in short succession if desired, 
        // but for now just debounce.
        
        const takerName = localStorage.getItem('loggedInUserName') || localStorage.getItem('userName') || localStorage.getItem('loggedInUserEmail') || '';
        const agentNameSelect = document.getElementById('agentNameSelect');
        
        if (!agentNameSelect || !agentNameSelect.value) {
           showAlert('Please select an agent first', { type: 'warning' });
           updateConversationIdState();
           return;
 }

        const agentName = agentNameSelect.selectedOptions[0].textContent.trim();

        try {
          // Use the local relay for localhost, IPv4, and IPv6 dev hosts.
          const host = (typeof location !== 'undefined') ? (location.hostname || '') : '';
          const normalizedHost = host.replace(/^\[|\]$/g, '');
          const isLocal = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::' || normalizedHost === '::1';
          const endpoint = isLocal ? 'http://127.0.0.1:8025/send-slack-sbs' : '/api/send-slack-sbs';

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId: val,
              takerName: takerName,
              agentName: agentName,
              scorecardType: 'Wins Scorecard',
              monitoringType: monSelect.value,
              title: (monSelect.value === 'Selected') ? 'Membership Cancellation Started' : 'SBS Started'
 })
 });
          const raw = await res.text();
          if (!res.ok) {
            const looksLikeHtml = /^\s*</.test(raw || '');
            const lower = String(raw || '').toLowerCase();
            const isPythonHttpServer501 = res.status === 501 && (lower.includes("unsupported method ('post')") || lower.includes('unsupported method'));
            if (isPythonHttpServer501) {
              showAlert('SBS Slack failed (501). You are running the site using python http.server which cannot handle POST requests. Run the local backend (smtp_server.py on port 8025) and open the site via http://localhost:8020 or http://[::]:8020, or use the deployed Vercel app.', { type: 'warning' });
            } else if (looksLikeHtml) {
              showAlert(`SBS Slack failed (${res.status}). Server returned HTML instead of JSON.`, { type: 'warning' });
            } else {
              showAlert(`SBS Slack failed (${res.status}). ${raw || ''}`.trim(), { type: 'warning' });
            }
            return;
 }
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch (_) {}

        // Disable Monitoring Type after successful Slack notification
        if (monSelect) {
             monSelect.disabled = true;
             monSelect.setAttribute('data-sbs-locked', 'true');
             monSelect.title = "Monitoring Type is locked after sending Slack notification. Refresh page to reset.";
 }
 } catch (e) {
        showAlert('Failed to send SBS Slack notification. Ensure backend is running.', { type: 'warning' });
 }
 };

      // Listener for Monitoring Type change
      const monSelect = document.getElementById('monitoringType');
      if (monSelect) {
        monSelect.addEventListener('change', () => {
          if (monSelect.value === 'SBS' || monSelect.value === 'Selected') {
             const agent = document.getElementById('agentNameSelect');
             if (!agent || !agent.value) {
                 showAlert('Please select an agent first', { type: 'warning' });
 }
             
            // conv.disabled = false; // Logic moved to updateConversationIdState
            // conv.readOnly = false;
            // If there's already a value, maybe trigger? 
            // User said "once the conversation Id is added or paste". 
            // If it's already there when switching to SBS, maybe we should trigger?
            // Let's stick to "added or paste" (input event).
            if (conv.value.trim()) {
               clearTimeout(sbsDebounceTimer);
               sbsDebounceTimer = setTimeout(triggerSbsSlack, 1000);
 }
 }
          updateConversationIdState();
 });
 }

      conv.addEventListener('input', () => {
        // Only trigger if SBS/Selected
        const ms = document.getElementById('monitoringType');
        if (ms && (ms.value === 'SBS' || ms.value === 'Selected')) {
          clearTimeout(sbsDebounceTimer);
          sbsDebounceTimer = setTimeout(triggerSbsSlack, 1500);
 }
 });

      conv.addEventListener('blur', async () => {
        const ticketIconBtnBlur = document.getElementById('ticketIconBtn');
        if (ticketIconBtnBlur) ticketIconBtnBlur.style.display = (conv.value.trim()) ? 'inline-flex' : 'none';
 });

      // Special handling: When user PASTES text, lock Monitoring Type to SBS
      conv.addEventListener('paste', () => {
        // Validate Agent First
        const agentSel = document.getElementById('agentNameSelect');
        if (agentSel && !agentSel.value) {
            showAlert('Please select an agent first', { type: 'warning' });
            return;
 }

        const monSelect = document.getElementById('monitoringType');
        if (monSelect) {
          if (!monSelect.value) {
            monSelect.value = 'SBS';
            monSelect.dataset.pasteLocked = 'true';
 }
 }
 });

      // Unlock paste lock on manual change
      const msLock = document.getElementById('monitoringType');
      if (msLock) {
        msLock.addEventListener('change', () => {
          msLock.dataset.pasteLocked = 'false';
          
          // Validate Agent Selection for SBS/Selected
          if (msLock.value === 'SBS' || msLock.value === 'Selected') {
             const agentSel = document.getElementById('agentNameSelect');
             if (agentSel && !agentSel.value) {
                 showAlert('Please select an agent first', { type: 'warning' });
                 msLock.value = '';
 }
 }
          updateConversationIdState();
 });
 }
      
      const agentLock = document.getElementById('agentNameSelect');
      if (agentLock) {
        agentLock.addEventListener('change', updateConversationIdState);
 }

      document.querySelectorAll('input[name="certification"]').forEach((radio) => {
        radio.addEventListener('change', updateConversationIdState);
 });
 }
    const previewBtn = document.getElementById('previewEmailBtn');
    if (previewBtn) previewBtn.addEventListener('click', previewEmail);
    const closePreviewBtn = document.getElementById('emailPreviewCloseBtn');
    const overlay = document.getElementById('emailPreviewOverlay');
    if (closePreviewBtn && overlay) closePreviewBtn.addEventListener('click', () => { overlay.style.display = 'none'; });

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.addEventListener('click', submit);
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Style Select Team placeholder color to match agent when empty
    const teamSelect = document.getElementById('teamSelect');
    const applyTeamSelectState = () => {
      if (!teamSelect) return;
      const isEmpty = !teamSelect.value;
      teamSelect.classList.toggle('select-empty', isEmpty);
      teamSelect.classList.toggle('select-filled', !isEmpty);
 };
    if (teamSelect) {
      applyTeamSelectState();
      teamSelect.addEventListener('change', applyTeamSelectState);
 }

    const ticketIconBtnClick = document.getElementById('ticketIconBtn');
    if (ticketIconBtnClick) ticketIconBtnClick.addEventListener('click', () => {
      const convId = (document.getElementById('conversationIdInput')||{value:''}).value.trim();
      if (!convId) return;
      const base = 'https://tempo-support.myfreshworks.com/crm/messaging/a/770177527280330/inbox/27/0/conversation/';
      const url = `${base}${encodeURIComponent(convId)}`;
      window.open(url, '_blank');
 });

    const getCaseBtn = document.getElementById('getCaseBtn');
    if (getCaseBtn) getCaseBtn.addEventListener('click', getCase);
  const skipBtn = document.getElementById('skipBtn');
  const skipModal = document.getElementById('skipModalOverlay');
  const skipCancel = document.getElementById('skipModalCancelBtn');
  const skipConfirm = document.getElementById('skipModalConfirmBtn');
  const skipReason = document.getElementById('skipModalReason');
  const skipActionQAED = document.getElementById('skipActionQAED');
  const skipActionNext = document.getElementById('skipActionNext');
  const skipNextCounterBadge = document.getElementById('skipNextCounterBadge');
    
    const updateSkipNextBadge = () => {
      const userKey = localStorage.getItem('loggedInUserEmail') || localStorage.getItem('userEmail') || localStorage.getItem('loggedInUserName') || '';
      const { allowed } = computeSkipWindow();
      const remain = remainingSkipNext(userKey);
      if (skipNextCounterBadge) {
        skipNextCounterBadge.textContent = allowed ? `Remaining: ${remain}/5` : `Available 17:00–06:00`;
 }
      if (skipActionNext) skipActionNext.disabled = !allowed;
 };
    const updateSkipReasonVisibility = () => {
      const sel = document.querySelector('input[name="skipAction"]:checked');
      const isQAED = sel ? sel.value === 'qaed' : true;
      if (skipReason) {
        const wrapper = skipReason.closest('.field');
        if (wrapper) wrapper.style.display = isQAED ? '' : 'none';
        skipReason.disabled = !isQAED;
 }
 };
    if (skipActionQAED) skipActionQAED.addEventListener('change', updateSkipReasonVisibility);
    if (skipActionNext) skipActionNext.addEventListener('change', updateSkipReasonVisibility);
    const openSkipModal = () => { 
      if (skipModal) {
        skipModal.style.display = 'flex'; 
 } else {
 }
 };
    const closeSkipModal = () => { if (skipModal) skipModal.style.display = 'none'; };
  // Inline restore helper for skip actions
  const restoreCaseInlineForSkip = async () => {
    try {
      const conv = document.getElementById('conversationIdInput');
      const ridEl = document.getElementById('freshworksRowId');
      const icon = document.getElementById('ticketIconBtn');
      let cid = '';
      let rid = '';
      // URL
      try {
        const u = new URL(window.location.href);
        cid = u.searchParams.get('cid') || '';
        rid = u.searchParams.get('rid') || '';
 } catch(_) {}
      // localStorage
      if (!cid || !rid) {
        try {
          const s = localStorage.getItem('t1_current_case');
          if (s) { const obj = JSON.parse(s); cid = cid || (obj && obj.conversation_id) || ''; rid = rid || (obj && obj.id) || ''; }
 } catch(_) {}
 }
      // session/window.name
      if (!cid || !rid) {
        try { cid = cid || (sessionStorage.getItem('t1_last_cid') || ''); rid = rid || (sessionStorage.getItem('t1_last_rid') || ''); } catch(_) {}
        try { if ((!cid || !rid) && window.name) { const nm = JSON.parse(window.name || '{}'); cid = cid || nm.t1_last_cid || ''; rid = rid || nm.t1_last_rid || ''; } } catch(_) {}
 }
      // cookie
      if (!cid || !rid) {
        try {
          document.cookie.split(';').map(s => s.trim()).forEach(c => {
            if (c.indexOf('t1cid=') === 0 && !cid) cid = decodeURIComponent(c.slice(6));
            if (c.indexOf('t1rid=') === 0 && !rid) rid = decodeURIComponent(c.slice(6));
 });
 } catch(_) {}
 }
      // If we have cid but still no rid, fetch Freshworks row by con_Id
      if (cid && !rid) {
        try {
          const url = `${config.restUrl}/Freshworks?select=interaction_id,id,con_Id&con_Id=eq.${encodeURIComponent(cid)}&limit=1`;
          let res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
          if (res.ok) {
            const arr = await res.json();
            if (Array.isArray(arr) && arr.length > 0) {
              rid = arr[0].id || rid;
 }
 } else {
 }
 } catch (e) {}
 }
      if (conv && cid) { conv.value = cid; conv.setAttribute('value', cid); conv.dispatchEvent(new Event('input')); conv.dispatchEvent(new Event('change')); }
      if (ridEl && rid) { ridEl.value = rid; ridEl.setAttribute('value', rid); ridEl.dispatchEvent(new Event('input')); ridEl.dispatchEvent(new Event('change')); }
      if (icon && cid) icon.style.display = 'inline-flex';
      return { cid, rid };
 } catch(e) {  return { cid: '', rid: '' }; }
 };

  if (skipBtn) skipBtn.addEventListener('click', async () => {
    // Collect conversation id from multiple sources
    let convId = (document.getElementById('conversationIdInput')||{value:''}).value.trim();
    const sources = { dom: convId };
    try { const u = new URL(window.location.href); sources.url = u.searchParams.get('cid') || ''; } catch(_) {}
    try { const s = localStorage.getItem('t1_current_case'); sources.local = s ? (JSON.parse(s).conversation_id || '') : ''; } catch(_) {}
    try { sources.session = sessionStorage.getItem('t1_last_cid') || ''; } catch(_) {}
    try { sources.name = (window.name ? (JSON.parse(window.name||'{}').t1_last_cid||'') : ''); } catch(_) {}
    try { document.cookie.split(';').map(s=>s.trim()).forEach(c=>{ if (c.indexOf('t1cid=')===0) sources.cookie = decodeURIComponent(c.slice(6)); }); } catch(_) {}
    convId = convId || sources.url || sources.local || sources.session || sources.name || sources.cookie || '';
    if (!convId) {
      const restored = await restoreCaseInlineForSkip();
      convId = restored.cid || convId;
 }
    if (!convId) { 
      showAlert('Please get a case first.'); 
      return; 
 }
      if (skipReason) skipReason.value = '';
      const defEl = document.getElementById('skipActionQAED');
      if (defEl) defEl.checked = true;
      updateSkipReasonVisibility();
      updateSkipNextBadge();
      openSkipModal();
 });
    if (skipCancel) skipCancel.addEventListener('click', () => { closeSkipModal(); });
  if (skipConfirm) skipConfirm.addEventListener('click', async () => {
    try {
      let convId = (document.getElementById('conversationIdInput')||{value:''}).value.trim();
      let storedId = (document.getElementById('freshworksRowId')||{value:''}).value.trim();
      if (!convId) {
        try { const u = new URL(window.location.href); convId = u.searchParams.get('cid') || convId; } catch(_) {}
        try { const s = localStorage.getItem('t1_current_case'); if (s && !convId) { convId = (JSON.parse(s).conversation_id || ''); } } catch(_) {}
        try { if (!convId) convId = sessionStorage.getItem('t1_last_cid') || ''; } catch(_) {}
        try { if (!convId && window.name) convId = (JSON.parse(window.name||'{}').t1_last_cid || ''); } catch(_) {}
 }
      if (!storedId) {
        try { const u = new URL(window.location.href); storedId = u.searchParams.get('rid') || storedId; } catch(_) {}
        try { const s = localStorage.getItem('t1_current_case'); if (s && !storedId) { storedId = (JSON.parse(s).id || ''); } } catch(_) {}
        try { if (!storedId) storedId = sessionStorage.getItem('t1_last_rid') || ''; } catch(_) {}
        try { if (!storedId && window.name) storedId = (JSON.parse(window.name||'{}').t1_last_rid || ''); } catch(_) {}
 }
      if (!convId || !storedId) {
        const restored = await restoreCaseInlineForSkip();
        convId = restored.cid || convId;
        storedId = restored.rid || storedId;
 }
      if (!convId) { showAlert('Please get a case first.'); return; }
        // Determine selected skip action
        const actionEl = document.querySelector('input[name="skipAction"]:checked');
        const action = actionEl ? actionEl.value : 'qaed';
        if (action === 'qaed') {
          const reason = (skipReason && skipReason.value) ? skipReason.value.trim() : '';
          if (!reason) { showAlert('Please enter a skip reason.'); return; }
          const auditorName = localStorage.getItem('loggedInUserName') || localStorage.getItem('userName') || localStorage.getItem('loggedInUserEmail') || '';
          const keyFilter = storedId ? `id=eq.${encodeURIComponent(storedId)}` : `con_Id=eq.${encodeURIComponent(convId)}`;
          const patchUrl = `${config.restUrl}/Freshworks?${keyFilter}`;
          const patchBody = { HAPPIO_Status: 'QAED', Skipped_by: auditorName, Skip_reason: reason };
          let pRes = await fetch(patchUrl, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(patchBody) });
          if (!pRes.ok) {
            pRes = await fetch(patchUrl, { method: 'PATCH', headers: authHeaders({ useServiceKey: true }), body: JSON.stringify(patchBody) });
            if (!pRes.ok) {
              showAlert('Failed to skip conversation.');
              return;
 }
 }
 } else {
          // Move to next case with time-window and usage limit; no Freshworks updates
          const userKey = localStorage.getItem('loggedInUserEmail') || localStorage.getItem('userEmail') || localStorage.getItem('loggedInUserName') || '';
          const { allowed } = computeSkipWindow();
          if (!allowed) {
            showAlert('This skip option is available daily from 17:00 to 06:00. Please try again starting 17:00.');
            return;
 }
          const { used } = getSkipNextUsed(userKey);
          if (used >= SKIP_NEXT_LIMIT) {
            showAlert('You have used all 5 skips. Please try again tomorrow starting 17:00.');
            return;
 }
          // Clear HAPPIO_Status (and assigned_qa) so the case re-enters the queue for others
          const keyFilter2 = storedId ? `id=eq.${encodeURIComponent(storedId)}` : `con_Id=eq.${encodeURIComponent(convId)}`;
          const clearUrl = `${config.restUrl}/Freshworks?${keyFilter2}`;
          const clearBody = { HAPPIO_Status: null, assigned_qa: null };
          let cRes = await fetch(clearUrl, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(clearBody) });
          if (!cRes.ok) {
            cRes = await fetch(clearUrl, { method: 'PATCH', headers: authHeaders({ useServiceKey: true }), body: JSON.stringify(clearBody) });
            if (!cRes.ok) {
              showAlert('Failed to clear conversation status for skip.');
              return;
 }
 }
        incSkipNextUsed(userKey);
        try { excludedFreshworksIds.add(storedId); } catch(e) {}
 }
        // Clear all persisted case references so refresh/intervals don't repopulate
        try {
          localStorage.removeItem('t1_current_case');
          localStorage.removeItem('t1_last_conv_id');
 } catch(_) {}
        try {
          sessionStorage.removeItem('t1_last_cid');
          sessionStorage.removeItem('t1_last_rid');
 } catch(_) {}
        try {
          const nm = JSON.parse(window.name || '{}');
          delete nm.t1_last_cid; delete nm.t1_last_rid;
          window.name = JSON.stringify(nm);
 } catch(_) {}
        try {
          document.cookie = 't1cid=; path=/; max-age=0';
          document.cookie = 't1rid=; path=/; max-age=0';
 } catch(_) {}
        try {
          const u = new URL(window.location.href);
          u.searchParams.delete('cid');
          u.searchParams.delete('rid');
          window.history.replaceState({}, '', u.origin + u.pathname);
 } catch(_) {}
        // Clear current conversation in the UI
        document.getElementById('conversationIdInput').value = '';
        document.getElementById('freshworksRowId').value = '';
        const ticketIconBtnAfterSkip = document.getElementById('ticketIconBtn');
        if (ticketIconBtnAfterSkip) ticketIconBtnAfterSkip.style.display = 'none';
        updateSkipNextBadge();
        closeSkipModal();
        // Only fetch next case if required filters are set
        const teamVal = (document.getElementById('teamSelect')||{value:''}).value;
        const dateFromVal = (document.getElementById('dateFrom')||{value:''}).value;
        const dateToVal = (document.getElementById('dateTo')||{value:''}).value;
        const agentEmailVal = (document.getElementById('agentEmailInput')||{value:''}).value.trim();
        if (teamVal && dateFromVal && dateToVal && agentEmailVal) {
          await getCase();
 } else {
          // Optional: surface a soft hint (no blocking modal)
          try { showAlert('Pick Team, Date Range, and Agent to fetch the next case.', { title: 'Filters needed', type: 'info' }); } catch(_) {}
 }
 } catch(e) {
        showAlert('Unexpected error during skip.');
 }
 });
    const calibrationBtn = document.getElementById('calibrationBtn');
    const calibrationQueueModal = document.getElementById('calibrationQueueModalOverlay');
    const calibrationRetentionBtn = document.getElementById('calibrationRetentionBtn');
    const calibrationSalesBtn = document.getElementById('calibrationSalesBtn');
    const calibrationQueueCancelBtn = document.getElementById('calibrationQueueCancelBtn');
    const openCalibrationQueueModal = () => {
      if (calibrationQueueModal) calibrationQueueModal.style.display = 'flex';
    };
    const closeCalibrationQueueModal = () => {
      if (calibrationQueueModal) calibrationQueueModal.style.display = 'none';
    };
    if (calibrationBtn) calibrationBtn.addEventListener('click', openCalibrationQueueModal);
    if (calibrationQueueCancelBtn) calibrationQueueCancelBtn.addEventListener('click', closeCalibrationQueueModal);
    if (calibrationRetentionBtn) calibrationRetentionBtn.addEventListener('click', async () => {
      closeCalibrationQueueModal();
      await loadCalibrationCase('Retention');
    });
    if (calibrationSalesBtn) calibrationSalesBtn.addEventListener('click', async () => {
      closeCalibrationQueueModal();
      await loadCalibrationCase('Sales');
    });

    // Custom inline agent dropdown interactions
    const ddRoot = document.querySelector('.agent-dropdown');
    const ddInput = document.getElementById('agentDropdownInput');
    const ddToggle = document.getElementById('agentDropdownToggle');
    const ddPanel = document.getElementById('agentDropdownPanel');
    const ddFilter = document.getElementById('agentDropdownFilter');
    const openPanel = () => {
      if (!ddPanel) return;
      ddPanel.hidden = false;
      if (ddFilter) {
        ddFilter.value = '';
        // Trigger list reset by firing input handler
        const evt = new Event('input');
        ddFilter.dispatchEvent(evt);
        ddFilter.focus();
 }
 };
    const closePanel = () => { if (ddPanel) ddPanel.hidden = true; };
    if (ddInput) ddInput.addEventListener('click', openPanel);
    if (ddToggle) ddToggle.addEventListener('click', () => {
      if (!ddPanel) return;
      ddPanel.hidden ? openPanel() : closePanel();
 });
    document.addEventListener('click', (e) => {
      if (!ddRoot) return;
      if (!ddRoot.contains(e.target)) closePanel();
 });
 }

  // Initialize searchable dropdown for Interaction Related To
  async function initInteractionDropdown() {
    const sel = document.getElementById('interactionRelatedTo');
    const ddInput = document.getElementById('interactionDropdownInput');
    const ddPanel = document.getElementById('interactionDropdownPanel');
    const ddFilter = document.getElementById('interactionDropdownFilter');
    const ddList = document.getElementById('interactionDropdownList');
    const ddToggle = document.getElementById('interactionDropdownToggle');
    const ddRoot = document.getElementById('interactionDropdownRoot');
    if (!sel || !ddInput || !ddPanel || !ddList) return;

    // Fetch topics list from API
          try {
            const response = await fetch(`${config.restUrl}/intRltdTo?select=interactionRelateTo`, {
              headers: authHeaders({ useServiceKey: true })
 });
            
            if (response.ok) {
        const data = await response.json();
        const options = data
            .map(item => (item.interactionRelateTo || '').trim())
            .filter(t => t);
        
        // Sort options
        options.sort((a, b) => a.localeCompare(b));

        // Save current value to restore if possible
        const currentValue = sel.value;

        // Update select options
        sel.innerHTML = '<option value="">Select option</option>';
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            sel.appendChild(el);
 });

        // Restore value if it exists in new options
        if (options.includes(currentValue)) {
            sel.value = currentValue;
 }

        sel._allTopics = options;
 } else {
        const options = Array.from(sel.querySelectorAll('option'))
          .map(o => (o.textContent||'').trim())
          .filter(t => t && t !== 'Select option');
        sel._allTopics = options;
 }
 } catch (error) {
      const options = Array.from(sel.querySelectorAll('option'))
        .map(o => (o.textContent||'').trim())
        .filter(t => t && t !== 'Select option');
      sel._allTopics = options;
 }

    function renderList(list) {
      ddList.innerHTML = '';
      list.forEach(label => {
        const li = document.createElement('li');
        li.textContent = label;
        li.dataset.value = label;
        li.addEventListener('click', () => {
          ddInput.value = label;
          sel.value = label;
          ddPanel.hidden = true;
 });
        ddList.appendChild(li);
 });
 }
    renderList(sel._allTopics || []);

    // Keep input in sync when select changes programmatically
    sel.addEventListener('change', () => {
      const o = sel.selectedOptions[0];
      ddInput.value = o ? (o.textContent||'') : '';
 });

    // Filter behavior
    if (ddFilter) {
      const applyFilter = () => {
        const q = ddFilter.value.trim().toLowerCase();
        const all = sel._allTopics || [];
        const filtered = q ? all.filter(t => t.toLowerCase().includes(q)) : all;
        renderList(filtered);
 };
      ddFilter.addEventListener('input', applyFilter);
 }

    // Open/close interactions panel
    const openPanel = () => {
      ddPanel.hidden = false;
      if (ddFilter) {
        ddFilter.value = '';
        const evt = new Event('input');
        ddFilter.dispatchEvent(evt);
        ddFilter.focus();
 }
 };
    const closePanel = () => { ddPanel.hidden = true; };
    ddInput.addEventListener('focus', openPanel);
    ddInput.addEventListener('click', openPanel);
    if (ddToggle) ddToggle.addEventListener('click', () => { ddPanel.hidden ? openPanel() : closePanel(); });
    document.addEventListener('click', (e) => {
      if (!ddRoot) return;
      if (!ddRoot.contains(e.target)) closePanel();
 });
 }

  // Size SME fields to match their label width (except interaction and comment textareas)
  function initSmeFieldWidths() {
    try {
      const fields = document.querySelectorAll('.sme-list .field');
      fields.forEach(field => {
        // Skip full-span (comments) and interaction dropdown field
        if (field.classList.contains('full-span')) return;
        if (field.querySelector('#interactionDropdownRoot')) return;
        // Skip SME name field to keep wider display for selected name
        if (field.querySelector('#smeName')) return;
        // Skip Ticket Status to keep hint text visible
        if (field.querySelector('#ticketStatus')) return;
        // Skip radio groups to avoid awkward sizing
        if (field.querySelector('.sme-radio-group')) return;
        const label = field.querySelector('label');
        if (!label) return;
        // Measure label width
        const rect = label.getBoundingClientRect();
        const width = Math.ceil(rect.width);
        if (width > 0) {
          // Set field width to label width and make control fill it
          field.style.width = width + 'px';
          const control = field.querySelector('select, input');
          if (control) control.style.width = '100%';
 }
 });
 } catch(e) {
 }
 }

  // Highlight selected SME radio labels consistently (fallback for browsers without :has)
  function initSmeRadioHighlight() {
    try {
      const groups = document.querySelectorAll('.sme-radio-group, .attr-controls');
      groups.forEach(group => {
        const update = () => {
          group.querySelectorAll('label').forEach(l => l.classList.remove('checked'));
          const selected = group.querySelector('input[type="radio"]:checked');
          const lbl = selected ? selected.closest('label') : null;
          if (lbl) lbl.classList.add('checked');
 };
        // Initialize current state
        update();
        // Bind update on interactions
        group.querySelectorAll('input[type="radio"]').forEach(input => {
          input.addEventListener('change', update);
          input.addEventListener('click', update);
 });
 });
 } catch(e) {
 }
 }

  function initRightPaneSync() {
    const smePane = document.getElementById('smePane');
    const attributesPane = document.getElementById('attributesPane');
    if (!smePane || !attributesPane) return;

    const syncHeight = () => {
       attributesPane.style.height = `${smePane.offsetHeight}px`;
 };

    const observer = new ResizeObserver(() => {
      syncHeight();
 });
    
    observer.observe(smePane);
    // Also sync immediately
    requestAnimationFrame(syncHeight);
 }

  return {
    init: async function() {
      // Ensure event bindings run even if config fails to load
      try {
        await loadConfig();
 } catch (e) {
 }
      bindEvents();
      bindCalendarAndSelectAll();
      // Initially disable Get Case until a valid range is picked
      toggleGetCaseEnabled();
      updateDateStatus();
      // Sync T1 configuration (Conversation ID disabled, SBS Monitoring lock)
      await syncT1Config();
      // Periodic refresh in case flag changes server-side
      setInterval(syncT1Config, 30000);
      // Set taker name from logged-in user
      await loadTakerName();
      // Load agents for dropdown and wire auto-fill
      await loadAgents();
      // Load SME list for the SME dropdown
      await loadSmeList();
      // Initialize searchable Interaction Related To dropdown
      await initInteractionDropdown();
      // Initialize static RTEs for SME/Sales comments
      initStaticRTEs();
      // Size SME fields based on label width
      initSmeFieldWidths();
      // Ensure SME radio groups visually reflect selection state
      initSmeRadioHighlight();
      // Fetch and render attributes scoring
      await fetchAttributes();
      renderAttributes();
      // Ensure attribute radios are highlighted after dynamic render
      initSmeRadioHighlight();
      // Sync right pane height to match left pane
      initRightPaneSync();
      await fetchRecent();
 }
 };
})();

window.WinsScorecard = WinsScorecard;
