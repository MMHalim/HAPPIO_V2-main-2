// Analytics Dashboard Logic

(function() {
  // Check for authentication
  const token = localStorage.getItem('login_token');
  if (!token) {
    // If not logged in, redirect to login page
    // This ensures the global navigation (which requires login) will show up after they log in
    window.location.href = 'login.html';
 }

  const config = { supabaseUrl: null, restUrl: null, apiKey: null, serviceKey: null };
  const state = { 
    startISO: null, 
    endISO: null,
    configLoaded: false,
    data: { t1: [], sms: [], social: [], t2ps: [], t2os: [], salesret: [], certification: [], winscert: [] },
    filters: { t1: [], sms: [], social: [], t2ps: [], t2os: [], salesret: [], certification: [], winscert: [] },
    smsAttributes: [],
    socialAttributes: [],
    psAttributes: [],
    t2osAttributes: [],
    salesRetAttributes: [],
    certificationAttributes: [],
    winsScorecardAttributes: []
 };

  // --- 1. Config Loading ---
  async function loadDatabaseConfig() {
    try {
      const res = await fetch('/database_config.json');
      const json = await res.json();
      config.supabaseUrl = json.supabase.url;
      config.restUrl = json.supabase.rest_url;
      config.apiKey = json.supabase.client_api_key;
      config.serviceKey = json.supabase.service_key || null;
      state.configLoaded = true;
      
      // Fetch Attributes metadata
      fetchSmsAttributes();
      fetchSocialAttributes();
      fetchPsAttributes();
      fetchNewScAttributes();
      fetchSalesRetAttributes();
      fetchCertificationAttributes();
      fetchWinsScorecardAttributes();

      initRangePicker();
      initTableControls();
 } catch (e) { 
      console.error('Failed to load database config', e);
      showToast('Failed to load database configuration. Please refresh.', 'error');
 }
 }

  async function fetchSmsAttributes() {
    try {
      const url = `${config.restUrl}/sms_Attributes?select=*&order=ID.asc`;
      const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
      if (res.ok) {
        state.smsAttributes = await res.json();
 }
 } catch (e) {
 }
 }

  async function fetchSocialAttributes() {
    try {
      const url = `${config.restUrl}/social_attributes?select=*&order=id.asc`;
      const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
      if (res.ok) {
        state.socialAttributes = await res.json();
 }
 } catch (e) {
 }
 }

  async function fetchPsAttributes() {
    try {
      const url = `${config.restUrl}/ps_attributes?select=*&order=ID.asc`;
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
         res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
 }
      if (!res.ok) throw new Error(await res.text());
      state.psAttributes = await res.json();
 } catch (e) {
 }
 }

  async function fetchNewScAttributes() {
    try {
      const url = `${config.restUrl}/New_SC_Attributes?select=*`;
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
         res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
 }
      if (!res.ok) throw new Error(await res.text());
      state.t2osAttributes = await res.json();
 } catch (e) {
 }
 }

  function parseAttributeScoreValue(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value == null ? '' : value).trim();
    const match = text.match(/-?\d+(?:\.\d+)?/);
    if (!match) return 0;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : 0;
 }

  function pickMappedRowValue(row, candidates, fallback = '') {
    const keys = Object.keys(row || {});
    const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const candidate of candidates) {
      const exact = keys.find((key) => key === candidate);
      if (exact && row[exact] != null) return row[exact];
      const normalized = normalize(candidate);
      const fuzzy = keys.find((key) => normalize(key) === normalized);
      if (fuzzy && row[fuzzy] != null) return row[fuzzy];
 }
    return fallback;
 }

  async function fetchSalesRetAttributes() {
    try {
      const url = `${config.restUrl}/sales_ret_att?select=*&order=id.asc`;
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
 }
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      state.salesRetAttributes = Array.isArray(rows) ? rows.map((row, idx) => ({
        ...row,
        ID: pickMappedRowValue(row, ['ID', 'id'], idx + 1),
        Subcategory: String(pickMappedRowValue(row, ['Subcategory', 'subcategory', 'subcategor'], '') || '').trim(),
        Criteria: String(pickMappedRowValue(row, ['Criteria', 'criteria', 'description'], '') || '').trim(),
        Score: parseAttributeScoreValue(pickMappedRowValue(row, ['Score', 'score'], 0))
 })) : [];
 } catch (e) {
      state.salesRetAttributes = [];
 }
 }

  async function fetchCertificationAttributes() {
    try {
      const url = `${config.restUrl}/cert_attr?select=*&order=id.asc`;
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
      }
      if (!res.ok) throw new Error(await res.text());
      const rows = await res.json();
      state.certificationAttributes = Array.isArray(rows) ? rows.map((row, idx) => ({
        ...row,
        ID: pickMappedRowValue(row, ['ID', 'id'], idx + 1),
        Subcategory: String(pickMappedRowValue(row, ['Attribute', 'attribute', 'Subcategory', 'subcategory', 'subcategor'], '') || '').trim(),
        Criteria: String(pickMappedRowValue(row, ['Criteria', 'criteria', 'description'], '') || '').trim(),
        Score: parseAttributeScoreValue(pickMappedRowValue(row, ['Score', 'score'], 0))
      })) : [];
    } catch (e) {
      state.certificationAttributes = [];
    }
  }

  async function fetchWinsScorecardAttributes() {
    try {
      const url = `${config.restUrl}/wins_scorecard_attributes?select=*&order=id.asc`;
      let res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) {
        res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
      }
      if (!res.ok) throw new Error(await res.text());
      state.winsScorecardAttributes = await res.json();
    } catch (e) {
      state.winsScorecardAttributes = [];
    }
  }

  // --- Helper: Fetch SME Users for T1 ---
  let smeUsersCache = [];
  async function fetchSmeUsers() {
    if (smeUsersCache.length > 0) return smeUsersCache;
    try {
        // Fetch users with specific roles
        // We use a broader fetch and filter in JS to avoid complex URL encoding issues with spaces in roles
        const url = `${config.restUrl}/users?select=Name,email,user_role`;
        let res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
        
        if (res.ok) {
            const data = await res.json();
            const roles = ['Team Leader', 'MX-T2 PS User', 'MX-T2 OS User'];
            smeUsersCache = data
                .filter(u => u.Name && u.email && roles.includes(u.user_role))
                .map(u => ({ label: u.Name, value: u.email }));
            
            // Sort by Name
            smeUsersCache.sort((a, b) => a.label.localeCompare(b.label));
 }
        
        // Always add N/A at the end
        smeUsersCache.push({ label: 'N/A', value: 'N/A' });
        
        return smeUsersCache;
 } catch (e) {
        console.error('Error fetching SME users:', e);
        return [{ label: 'N/A', value: 'N/A' }];
 }
 }

  // --- Helper: Fetch Interaction Related To Options ---
  let interactionRelatedToOptions = [];
  async function fetchInteractionRelatedTo() {
    if (interactionRelatedToOptions.length > 0) return interactionRelatedToOptions;
    try {
        const url = `${config.restUrl}/intRltdTo?select=interactionRelateTo`;
        let res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) {
             res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
 }
        if (!res.ok) throw new Error('Failed to fetch Interaction Related To options');
        const data = await res.json();
        // Extract column values and filter empties
        interactionRelatedToOptions = data.map(item => item.interactionRelateTo).filter(Boolean).sort();
        return interactionRelatedToOptions;
 } catch (e) {
        console.error('Error fetching Interaction Related To:', e);
        return [];
 }
 }

  function isJwtLike(value) {
    return typeof value === 'string' && value.split('.').length === 3;
 }

  function parseRoleList(value) {
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    if (typeof value !== 'string') return [];
    const s = value.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
 } catch (_) {}
    return s.replace(/\s*\+\s*/g, ',').split(/[,;|]/).map(v => v.trim()).filter(Boolean);
 }

  function userHasRole(role) {
    const raw = localStorage.getItem('user_role') || localStorage.getItem('role') || localStorage.getItem('UserRole') || '';
    const roles = parseRoleList(raw).map(r => r.toLowerCase());
    return roles.includes(String(role).toLowerCase());
 }

  function authHeaders(opts = {}) {
    const useServiceKey = opts.useServiceKey === true;
    const loginToken = localStorage.getItem('login_token');
    const bearer =
      (isJwtLike(loginToken) && loginToken) ||
      (useServiceKey && isJwtLike(config.serviceKey) && config.serviceKey) ||
      (isJwtLike(config.apiKey) && config.apiKey) ||
      (isJwtLike(config.serviceKey) && config.serviceKey) ||
      null;

    const apikey =
      (isJwtLike(config.apiKey) && config.apiKey) ||
      (isJwtLike(config.serviceKey) && config.serviceKey) ||
      null;

    if (!bearer || !apikey) {
      throw new Error('Missing/invalid Supabase credentials. Check database_config.json and your login session.');
 }
    return {
      apikey,
      Authorization: `Bearer ${bearer}`,
      'Prefer': 'count=exact'
 };
 }

  // --- Email Helper (from agent-ps-audits.js) ---
  async function sendEmailSMTP({ html, to, cc = [], subject }) {
    const host = (typeof location !== 'undefined') ? (location.hostname || '') : '';
    const normalizedHost = host.replace(/^\[|\]$/g, '');
    const isLocal = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::' || normalizedHost === '::1';
    const endpoint = isLocal ? 'http://127.0.0.1:8025/send-email' : '/api/send-email';
    const payload = {
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        user: 'happio.softs@gmail.com',
        pass: 'yinyeqhnfihainsi'
 },
      to,
      cc,
      subject,
      html
 };
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      return true;
 } catch (e) {  return false; }
 }

  // --- Toast Notification ---
  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
 }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
        <div class="toast-message">${message}</div>
      </div>
      <div class="toast-close">×</div>
    `;

    // Remove on click
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
 });

    // Auto remove after 5s
    setTimeout(() => {
      if (toast.isConnected) {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
 }
 }, 5000);

    container.appendChild(toast);
 }

  function showConfirmDialog(message, opts = {}) {
    const overlay = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');

    if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
      return Promise.resolve(window.confirm(message));
 }

    titleEl.textContent = opts.title || 'Confirm Delete';
    messageEl.textContent = message || 'Are you sure?';
    confirmBtn.textContent = opts.confirmText || 'Delete';
    cancelBtn.textContent = opts.cancelText || 'Cancel';
    confirmBtn.style.background = 'var(--danger-color)';
    confirmBtn.style.color = '#fff';

    overlay.style.display = 'flex';

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        overlay.style.display = 'none';
        overlay.removeEventListener('click', onOverlayClick);
        document.removeEventListener('keydown', onKeyDown);
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        resolve(value);
 };

      const onConfirm = () => finish(true);
      const onCancel = () => finish(false);
      const onOverlayClick = (e) => {
        if (e.target === overlay) finish(false);
 };
      const onKeyDown = (e) => {
        if (e.key === 'Escape') finish(false);
 };

      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlayClick);
      document.addEventListener('keydown', onKeyDown);
 });
 }

  // --- 2. Data Fetching ---
  
  // Table Configs
  const TABLES = {
    t1: {
      name: 'T1_QA_New_Scorecards',
      scoreCol: 'Final_Score',
      cols: ['created_at', 'agent_name', 'conversation_id', 'Final_Score', 'id', 'Channel', 'Taker_Name'],
      label: 'T1 Audit'
 },
    sms: {
      name: 'sms_scorecard',
      scoreCol: 'final_score',
      cols: ['created_at', 'agent_name', 'conversation_id', 'final_score', 'id', 'taker_name'],
      label: 'SMS Audit'
 },
    social: {
      name: 'MX_Social_Media_Scorecard',
      scoreCol: 'Final_Score',
      cols: ['created_at', 'Agent_Name', 'agent_name', 'Post_url', 'Final_Score', 'id', 'Taker_Name', 'Channel'],
      label: 'Social Media Audit'
 },
    t2ps: {
      name: 't2_ps_scorecards',
      scoreCol: 'final_score',
      cols: ['created_at', 'agent_name', 'conversation_id', 'final_score', 'id', 'Channel', 'Taker_Name'],
      label: 'T2 PS Audit'
 },
    t2os: {
      name: 'T2_OS_NEW_2025',
      scoreCol: 'Final_Score',
      cols: ['created_at', 'agent_name', 'conversation_id', 'Final_Score', 'id', 'Channel', 'Taker_Name'],
      label: 'T2 OS Audit'
 },
    salesret: {
      name: 'sales_ret_audits',
      scoreCol: 'Final_Score',
      cols: ['created_at', 'Agent_Name', 'agent_name', 'Conversation_ID', 'conversation_id', 'Final_Score', 'id', 'Channel', 'Taker_Name'],
      label: 'T2 OS New Scorecard Audit'
 },
    certification: {
      name: 'certification_audits',
      scoreCol: 'Final_Score',
      cols: ['created_at', 'Agent_Name', 'Conversation_ID', 'Final_Score', 'id', 'Channel', 'Taker_Name', 'Phase'],
      label: 'Certification Audit'
    },
    winscert: {
      name: 'wins_scorecard_submissions',
      scoreCol: 'final_score',
      cols: ['created_at', 'agent_name', 'conversation_id', 'final_score', 'id', 'channel', 'taker_name', 'result_status'],
      label: 'Wins Certification'
 }
 };

  async function fetchAnalytics() {
    if (!state.configLoaded) {
      showToast('Loading database configuration, please try again in a moment.', 'warning');
      return;
 }
    if (!state.startISO || !state.endISO) {
      showToast('Please select a date range first.', 'warning');
      return;
 }

    // Parallel fetch for all 4 scorecards
    await Promise.all([
      processScorecard('t1'),
      processScorecard('sms'),
      processScorecard('social'),
      processScorecard('t2ps'),
      processScorecard('t2os'),
      processScorecard('salesret'),
      processScorecard('certification'),
      processScorecard('winscert')
    ]);
 }

  async function processScorecard(key) {
    const def = TABLES[key];
    const url = `${config.restUrl}/${def.name}?select=*&created_at=gte.${state.startISO}&created_at=lte.${state.endISO}&order=created_at.desc`;
    
    try {
      const res = await fetch(url, { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      state.data[key] = data; // Store data
      
      refreshTable(key);
 } catch (e) {
      console.error(`Error processing ${key}`, e);
      showToast(`Error loading ${def.label}: ${e.message}`, 'error');
      const countEl = document.getElementById(`${key}Count`);
      const avgEl = document.getElementById(`${key}Avg`);
      if (countEl) countEl.textContent = 'Err';
      if (avgEl) avgEl.textContent = 'Err';
 }
 }

  function updateStats(key, data, scoreCol) {
    const count = data.length;
    if (key === 'certification') {
      const passed = data.filter((row) => String(row[scoreCol] || '').trim().toLowerCase() === 'pass').length;
      const passRate = count > 0 ? ((passed / count) * 100).toFixed(1).replace(/\.0$/, '') : '0';
      const countEl = document.getElementById(`${key}Count`);
      const avgEl = document.getElementById(`${key}Avg`);
      if (countEl) countEl.textContent = count;
      if (avgEl) avgEl.textContent = `${passRate}%`;
      return;
 }

    let totalScore = 0;
    let scoredCount = 0;

    data.forEach(row => {
      let val = row[scoreCol];
      // Clean percentage signs if present
      if (typeof val === 'string') val = parseFloat(val.replace('%', ''));
      if (typeof val === 'number' && !isNaN(val)) {
        totalScore += val;
        scoredCount++;
 }
 });

    const avg = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 0;

    const countEl = document.getElementById(`${key}Count`);
    const avgEl = document.getElementById(`${key}Avg`);
    if (countEl) countEl.textContent = count;
    if (avgEl) avgEl.textContent = `${avg}%`;
 }

  function renderTable(key, data, def) {
    const tbody = document.querySelector(`#${key}Table tbody`);
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
      const colSpan = (key === 't1' || key === 'social' || key === 'certification' || key === 'winscert') ? 8 : 7;
      tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center;">No records found</td></tr>`;
      return;
 }

    // Limit to 100 for performance
    const displayData = data.slice(0, 100); 
    const isAdmin = userHasRole('Administrator');

    displayData.forEach(row => {
      const tr = document.createElement('tr');
      
      // Normalize helpers
      const getVal = (opts) => {
        for (const k of opts) {
          if (row[k] !== undefined && row[k] !== null) return row[k];
 }
        return '';
 };

      const dateStr = getVal(['created_at', 'Created_At']).replace('T', ' ').replace(/\..+/, '');
      const agent = getVal(['agent_name', 'Agent_Name', 'agent_email']);
      const convId = getVal(['conversation_id', 'Conversation_ID', 'ticket_id']);
      let score = getVal([def.scoreCol, 'Final_Score', 'final_score', 'score']);
      if (score !== null && score !== undefined) {
        score = String(score).replace(/%/g, '');
        const numScore = parseFloat(score);
        if (key !== 'certification' && !isNaN(numScore)) {
          // If integer, show no decimals. If decimal, show up to 2 decimal places but trim trailing zeros
          // standard behavior of parseFloat + string conversion does this automatically for many cases
          // but to be explicit:
          score = Number(numScore.toFixed(2)); // 100.00 -> 100, 98.50 -> 98.5
 }
 }
      
      let actionHtml = `<button class="global-btn btn-slim view-btn">View</button>`;

    if (isAdmin) {
        actionHtml += ` <button class="global-btn btn-slim delete-btn" style="background:var(--danger-color); color:white; margin-left:8px;">Delete</button>`;
 }

      if (key === 't1') {
        const channel = getVal(['Channel', 'channel']) || '-';
        const taker = getVal(['Taker_Name', 'taker_name', 'Taker Name']) || '-';
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${dateStr}</td>
          <td>${agent}</td>
          <td>${channel}</td>
          <td>${taker}</td>
          <td>${convId}</td>
          <td>${score}%</td>
          <td>${actionHtml}</td>
        `;
 } else if (key === 'sms') {
        const taker = getVal(['Taker_Name', 'taker_name', 'Taker Name']) || '-';
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${dateStr}</td>
          <td>${agent}</td>
          <td>${taker}</td>
          <td>${convId}</td>
          <td>${score}%</td>
          <td>${actionHtml}</td>
        `;
 } else if (key === 't2ps') {
        const taker = getVal(['Taker_Name', 'taker_name', 'Taker Name']) || '-';
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${dateStr}</td>
          <td>${agent}</td>
          <td>${taker}</td>
          <td>${convId}</td>
          <td>${score}%</td>
          <td>${actionHtml}</td>
        `;
 } else if (key === 'social') {
        const taker = getVal(['Taker_Name', 'taker_name', 'Taker Name']) || '-';
        const channel = getVal(['Channel', 'channel']) || '-';
        const postUrl = getVal(['Post_url', 'Post_URL', 'post_url', 'url', 'URL']) || '';
        const postCell = postUrl
          ? `<a href="${String(postUrl).replace(/"/g, '&quot;')}" target="_blank" style="color:var(--primary-color); text-decoration:underline;">Open</a>`
          : '-';
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${dateStr}</td>
          <td>${agent}</td>
          <td>${taker}</td>
          <td>${channel}</td>
          <td>${postCell}</td>
          <td>${score}%</td>
          <td>${actionHtml}</td>
        `;
 } else if (key === 'certification') {
        const taker = getVal(['Taker_Name', 'taker_name', 'Taker Name']) || '-';
        const phase = getVal(['Phase', 'phase']) || '-';
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${dateStr}</td>
          <td>${agent}</td>
          <td>${taker}</td>
          <td>${phase}</td>
          <td>${convId}</td>
          <td>${score || '-'}</td>
          <td>${actionHtml}</td>
        `;
 } else if (key === 'winscert') {
        const taker = getVal(['taker_name', 'Taker_Name', 'Taker Name']) || '-';
        const result = getVal(['result_status', 'Result_Status']) || '-';
        const scoreDisplay = score ? (String(score).endsWith('%') ? score : `${score}%`) : '-';
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${dateStr}</td>
          <td>${agent}</td>
          <td>${taker}</td>
          <td>${result}</td>
          <td>${convId}</td>
          <td>${scoreDisplay}</td>
          <td>${actionHtml}</td>
        `;
 } else {
        const taker = getVal(['Taker_Name', 'taker_name', 'Taker Name']) || '-';
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${dateStr}</td>
          <td>${agent}</td>
          <td>${taker}</td>
          <td>${convId}</td>
          <td>${score}%</td>
          <td>${actionHtml}</td>
        `;
 }

      tr.querySelector('.view-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openAuditModal(row, def, key);
 });

      if (isAdmin) {
        const delBtn = tr.querySelector('.delete-btn');
        if (delBtn) {
          delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmed = await showConfirmDialog('Are you sure you want to delete this record? This cannot be undone.', {
              title: 'Delete Record',
              confirmText: 'Delete',
              cancelText: 'Cancel'
 });
            if (confirmed) {
              deleteRecord(key, row.id);
 }
 });
 }
 }

      tr.addEventListener('click', () => openAuditModal(row, def, key));

      tbody.appendChild(tr);
 });
 }

  // --- Filter Logic ---
  const OPERATORS = [
    { value: 'contains', label: 'contains' },
    { value: 'doesNotContain', label: 'does not contain' },
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'does not equal' },
    { value: 'startsWith', label: 'starts with' },
    { value: 'endsWith', label: 'ends with' },
    { value: 'empty', label: 'is empty' },
    { value: 'notEmpty', label: 'is not empty' }
  ];

  function initFilterUI(key) {
    const toggleBtn = document.getElementById(`${key}FilterToggle`);
    const panel = document.getElementById(`${key}FilterPanel`);
    const addBtn = document.getElementById(`${key}AddFilterBtn`);
    const clearBtn = document.getElementById(`${key}ClearFilterBtn`);
    
    if (!toggleBtn || !panel) return;

    toggleBtn.addEventListener('click', () => {
      const isHidden = panel.style.display === 'none';
      panel.style.display = isHidden ? 'block' : 'none';
      if (isHidden && (!state.filters[key] || state.filters[key].length === 0)) {
        addFilterRow(key);
 }
 });

    if (addBtn) addBtn.addEventListener('click', () => addFilterRow(key));
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          state.filters[key] = [];
          renderFilterRows(key);
          refreshTable(key);
 });
 }
 }

  function addFilterRow(key) {
    const data = state.data[key] || [];
    if (data.length === 0) {
      // If no data, we can't really guess columns, but we can check if we have any cached data or just warn
      // Allow adding if data is empty? No, can't pick column.
      showToast('No data loaded to filter', 'warning');
      return;
 }
    
    // Get columns from first row
    const columns = Object.keys(data[0]).sort();
    
    if (!state.filters[key]) state.filters[key] = [];
    
    state.filters[key].push({
      column: columns[0],
      operator: 'contains',
      value: ''
 });
    
    renderFilterRows(key);
    refreshTable(key); 
 }

  function removeFilterRow(key, index) {
    state.filters[key].splice(index, 1);
    renderFilterRows(key);
    refreshTable(key);
 }

  function updateFilterRow(key, index, field, value) {
    state.filters[key][index][field] = value;
    refreshTable(key);
 }

  function autoResizeSelect(select) {
     const style = window.getComputedStyle(select);
     const tempSpan = document.createElement('span');
     tempSpan.style.visibility = 'hidden';
     tempSpan.style.position = 'absolute';
     tempSpan.style.whiteSpace = 'nowrap';
     tempSpan.style.fontFamily = style.fontFamily;
     tempSpan.style.fontSize = style.fontSize;
     tempSpan.style.fontWeight = style.fontWeight;
     tempSpan.style.letterSpacing = style.letterSpacing;
     tempSpan.textContent = select.options[select.selectedIndex]?.text || '';
     document.body.appendChild(tempSpan);
     // Add padding (approx 35px for arrow and internal padding)
     const width = tempSpan.offsetWidth + 35;
     document.body.removeChild(tempSpan);
     select.style.width = `${width}px`;
 }

  function renderFilterRows(key) {
    const container = document.getElementById(`${key}FilterRows`);
    const clearBtn = document.getElementById(`${key}ClearFilterBtn`);
    if (!container) return;
    
    container.innerHTML = '';
    const filters = state.filters[key] || [];
    
    if (clearBtn) clearBtn.style.display = filters.length > 0 ? 'inline-block' : 'none';

    if (filters.length === 0) {
       container.innerHTML = '<div style="color:var(--text-secondary); font-size:13px; font-style:italic;">No active filters</div>';
       return;
 }

    const data = state.data[key] || [];
    const columns = data.length > 0 ? Object.keys(data[0]).sort() : [];

    filters.forEach((filter, index) => {
      const row = document.createElement('div');
      row.className = 'filter-row';
      
      // Column Select
      const colSelect = document.createElement('select');
      if (columns.length === 0 && filter.column) {
          const opt = document.createElement('option');
          opt.value = filter.column; opt.textContent = filter.column;
          colSelect.appendChild(opt);
 } else {
          columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.textContent = col;
            if (col === filter.column) opt.selected = true;
            colSelect.appendChild(opt);
 });
 }
      
      // Auto-resize logic
      const resize = () => autoResizeSelect(colSelect);
      colSelect.addEventListener('change', (e) => {
         resize();
         updateFilterRow(key, index, 'column', e.target.value);
 });
      // Initial resize after append
      setTimeout(resize, 0);

      // Operator Select
      const opSelect = document.createElement('select');
      OPERATORS.forEach(op => {
        const opt = document.createElement('option');
        opt.value = op.value;
        opt.textContent = op.label;
        if (op.value === filter.operator) opt.selected = true;
        opSelect.appendChild(opt);
 });
      opSelect.addEventListener('change', (e) => updateFilterRow(key, index, 'operator', e.target.value));
      
      // Value Input
      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.value = filter.value || '';
      valInput.placeholder = 'Value';
      valInput.addEventListener('input', (e) => updateFilterRow(key, index, 'value', e.target.value));
      
      // Remove Button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'filter-btn-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => removeFilterRow(key, index));
      
      row.appendChild(colSelect);
      row.appendChild(opSelect);
      row.appendChild(valInput);
      row.appendChild(removeBtn);
      
      container.appendChild(row);
 });
 }

  function getFilteredData(key) {
    const rawData = state.data[key] || [];
    const filters = state.filters[key] || [];
    
    // 1. Apply Filters
    let data = rawData;
    if (filters.length > 0) {
        data = data.filter(row => {
          return filters.every(f => {
            const val = row[f.column];
            const strVal = String(val === null || val === undefined ? '' : val).toLowerCase();
            const filterVal = (f.value || '').toLowerCase();
            
            switch (f.operator) {
              case 'contains': return strVal.includes(filterVal);
              case 'doesNotContain': return !strVal.includes(filterVal);
              case 'equals': return strVal === filterVal;
              case 'notEquals': return strVal !== filterVal;
              case 'startsWith': return strVal.startsWith(filterVal);
              case 'endsWith': return strVal.endsWith(filterVal);
              case 'empty': return val === null || val === undefined || val === '';
              case 'notEmpty': return val !== null && val !== undefined && val !== '';
              default: return true;
 }
 });
 });
 }

    // 2. Apply Search
    const searchInput = document.getElementById(`${key}Search`);
    const query = searchInput ? searchInput.value : '';
    if (query) {
       const lowerQ = query.toLowerCase();
       data = data.filter(row => 
         Object.values(row).some(val => String(val).toLowerCase().includes(lowerQ))
       );
 }
    
    return data;
 }

  function refreshTable(key) {
    const filteredData = getFilteredData(key);
    const def = TABLES[key];
    
    updateStats(key, filteredData, def.scoreCol);
    renderTable(key, filteredData, def);
    
    // Also update clear button visibility for search
    const searchInput = document.getElementById(`${key}Search`);
    const clearBtn = document.getElementById(`${key}Clear`);
    if (searchInput && clearBtn) {
        clearBtn.style.display = searchInput.value ? 'block' : 'none';
 }
 }

  // --- 3. New Features: Search, Export, Delete ---

  function initTableControls() {
    Object.keys(TABLES).forEach(key => {
      // Initialize Filter UI
      initFilterUI(key);

      const searchInput = document.getElementById(`${key}Search`);
      const clearBtn = document.getElementById(`${key}Clear`);
      const exportBtn = document.getElementById(`${key}Export`);

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          refreshTable(key);
 });
 }

      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (searchInput) {
            searchInput.value = '';
            refreshTable(key);
 }
 });
 }

      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          exportCSV(key);
 });
 }
 });
 }

  function exportCSV(key) {
    const data = getFilteredData(key);
    if (data.length === 0) {
      showToast('No data to export', 'warning');
      return;
 }

    // Get all unique keys from data to form header
    // Ideally we use a fixed set of keys for consistent CSV, but dynamic is safer for full export
    // Let's use all keys from the first row as a base, or union of all keys.
    // For simplicity, let's take keys from first row.
    const keys = Object.keys(data[0]);
    const csvRows = [];
    
    // Header
    csvRows.push(keys.join(','));

    // Rows
    data.forEach(row => {
      const values = keys.map(k => {
        const val = row[k] === null || row[k] === undefined ? '' : row[k];
        const stringVal = String(val).replace(/"/g, '""'); // Escape quotes
        return `"${stringVal}"`; // Wrap in quotes
 });
      csvRows.push(values.join(','));
 });

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${key}_audits_${state.startISO.split('T')[0]}_${state.endISO.split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
 }

  async function deleteRecord(key, id) {
    const def = TABLES[key];
    const url = `${config.restUrl}/${def.name}?id=eq.${id}`;
    
    try {
      const res = await fetch(url, { 
        method: 'DELETE',
        headers: authHeaders() 
 });
      
      if (!res.ok) throw new Error(await res.text());
      
      // Remove from local state
      state.data[key] = state.data[key].filter(item => item.id !== id);
      
      // Re-render
      updateStats(key, state.data[key], def.scoreCol);
      renderTable(key, state.data[key], def);
      
      showToast('Record deleted successfully', 'success');
 } catch (e) {
      console.error('Delete failed', e);
      showToast('Failed to delete record: ' + e.message, 'error');
 }
 }

  let cachedAttributeDefinitions = null;

  async function fetchAttributeDefinitions() {
    if (cachedAttributeDefinitions) return cachedAttributeDefinitions;
    
    // Fetch from T1_SC_Att
    // We use the anon key / client key logic or reuse authHeaders if possible?
    // authHeaders() uses the user's stored key if available.
    // But we might need to use the service key or just public access if it's open.
    // The previous curl used the anon key from config.
    // I'll try to use the same fetch pattern as other calls.
    
    try {
        const res = await fetch(`${config.restUrl}/T1_SC_Att?select=*&order=ID.asc`, {
            headers: authHeaders()
 });
        if (!res.ok) throw new Error('Failed to fetch definitions');
        const data = await res.json();
        cachedAttributeDefinitions = data;
        return data;
 } catch (e) {
        return [];
 }
 }

  // --- 4. Modal Logic ---
  
  async function openAuditModal(row, def, key) {
    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    const modal = document.getElementById('auditModal');
    const body = document.getElementById('auditModalBody');
    body.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    
    // Fetch definitions (if applicable to this table? Assuming T1 for now or global)
    // We can try fetching; if it fails or table doesn't apply, we get empty list.
    const definitions = await fetchAttributeDefinitions();
    const defMap = new Map(definitions.map(d => [d.Subcategory.trim(), d]));
    const certificationDefMap = new Map((state.certificationAttributes || []).map((d) => [String(d.Subcategory || '').trim(), d]));
    const winsDefMap = new Map((state.winsScorecardAttributes || []).map((d) => [String(d.attribute || '').trim(), d]));
    
    body.innerHTML = ''; // Clear loading

    const isAdmin = userHasRole('Administrator');

    // Container for editable mode state
    let isEditing = false;
    const originalRow = { ...row };
    const normalizeToken = (s) => String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const pickRowKey = (rowObj, candidates) => {
      const keys = Object.keys(rowObj || {});
      const normMap = new Map(keys.map(k => [normalizeToken(k), k]));
      for (const c of candidates) {
        const direct = keys.find(k => k === c);
        if (direct) return direct;
        const found = normMap.get(normalizeToken(c));
        if (found) return found;
 }
      return null;
 };

    // Meta Section
    const metaSection = document.createElement('div');
    metaSection.className = 'detail-section';
    metaSection.innerHTML = `<h3 style="margin-top:0;">${def.label} Details</h3>`;
    
    // Helper to render a top-level meta card similar to attribute containers
    const renderMetaCard = (label, val, key = null, valueStyle = 'color:var(--text-primary);', isEditable = false, extraAttr = '') => {
      const displayVal = (val === null || val === undefined || val === '') ? '-' : val;
      const keyAttr = key && isEditable ? `data-key="${key}"` : '';
      return `
        <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--bg-nav-item);">
          <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
            <div style="font-weight:700; color:var(--text-primary); display:flex; align-items:center;">
              ${label}
            </div>
            <div style="font-weight:700; ${valueStyle}" ${keyAttr} ${extraAttr}>${displayVal}</div>
          </div>
        </div>
      `;
 };

    let metaHtml = '';
    // Common fields
    const agentKey = ['Agent_Name', 'agent_name', 'agent_email'].find(k => row[k] !== undefined) || 'agent_name';
    const convKey = ['Conversation_ID', 'conversation_id', 'ticket_id'].find(k => row[k] !== undefined) || 'conversation_id';
    
    // Format score without duplicating % sign
    let scoreDisplay = row[def.scoreCol];
    if (scoreDisplay !== null && scoreDisplay !== undefined) {
      scoreDisplay = String(scoreDisplay).trim();
      if (key !== 'certification' && scoreDisplay && !scoreDisplay.endsWith('%')) scoreDisplay = `${scoreDisplay}%`;
 } else {
      scoreDisplay = '-';
 }
    
    metaHtml += renderMetaCard('ID', row.id, 'id', 'color:var(--text-primary);', false);
     
     // Format Date: 2025-12-16 00:12:08.515... -> 2025-12-16 00:12:08
     const rawDate = (row.created_at || row.Created_At || '').replace('T',' ');
     const displayDate = rawDate.length > 19 ? rawDate.substring(0, 19) : rawDate;
     
     metaHtml += renderMetaCard('Date', displayDate, 'created_at', 'color:var(--text-primary);', false);
    metaHtml += renderMetaCard('Agent', row[agentKey], agentKey, 'color:var(--text-primary);', false); 
    
    // New Fields
    const takerKey = ['Taker_Name', 'taker_name', 'Taker Name'].find(k => row[k] !== undefined);
    if (takerKey) {
        metaHtml += renderMetaCard('Taker Name', row[takerKey], takerKey, 'color:var(--text-primary);', false);
 }

    const channelKey = ['Channel', 'channel'].find(k => row[k] !== undefined);
    if (channelKey) {
        metaHtml += renderMetaCard('Channel', row[channelKey], channelKey, 'color:var(--text-primary);', false);
 }

    if (key === 'social') {
      const postKey = pickRowKey(row, ['Post_url', 'Post_URL', 'post_url', 'url', 'URL']);
      const postUrl = postKey ? row[postKey] : '';
      const postLabelHtml = postUrl
        ? `<a href="${String(postUrl).replace(/"/g, '&quot;')}" target="_blank" style="color:var(--primary-color); text-decoration:underline;">Post URL</a>`
        : 'Post URL';
      metaHtml += renderMetaCard(postLabelHtml, '&nbsp;', null, 'color:var(--text-primary);', false);
 } else {
      const convBase = 'https://tempo-support.myfreshworks.com/crm/messaging/a/770177527280330/inbox/0/0/conversation/';
      const conversationId = row[convKey];
      if (conversationId) {
        const convLinkHtml = `<a href="${convBase}${conversationId}" target="_blank" style="color:var(--primary-color); text-decoration:underline;">${conversationId}</a>`;
        metaHtml += renderMetaCard('Conversation ID', convLinkHtml, null, 'color:var(--text-primary);', false);
 } else {
        metaHtml += renderMetaCard('Conversation ID', '-', null, 'color:var(--text-primary);', false);
 }
 }
    const scoreColor = ((key === 'certification' || key === 'winscert') && String(scoreDisplay || '').trim().toLowerCase() === 'fail')
      ? 'color:var(--danger-color);'
      : 'color:var(--success-color);';
    metaHtml += renderMetaCard('Score', scoreDisplay, def.scoreCol, scoreColor, false, 'id="scoreDisplay"');
    
    metaSection.innerHTML += metaHtml;
    body.appendChild(metaSection);

    const attributes = [];
    const usedKeys = new Set([
      'id','created_at','Created_At','agent_name','Agent_Name','agent_email',
      'conversation_id','Conversation_ID','ticket_id', def.scoreCol, 'updated_at',
      'user_id', 'Taker_Name', 'taker_name', 'Channel', 'channel'
    ]);

    // Ticket Details Section (SMS Only)
    if (key === 'sms') {
      const ticketSection = document.createElement('div');
      ticketSection.className = 'detail-section';
      ticketSection.innerHTML = `<h3>Ticket Details</h3>`;
      
      let ticketHtml = '';
      ticketHtml += renderMetaCard('Monitoring Type', row.monitoring_type, 'monitoring_type', 'color:var(--text-primary);', true);
      ticketHtml += renderMetaCard('Ticket Status', row.status, 'status', 'color:var(--text-primary);', true);
      ticketHtml += renderMetaCard('Interaction Related To', row.interaction_related_to, 'interaction_related_to', 'color:var(--text-primary);', true);
      ticketHtml += renderMetaCard('Monitoring Level', row.monitoring_level, 'monitoring_level', 'color:var(--text-primary);', true);
      
      // General Comments might be long, so maybe style it differently or just use renderMetaCard
      const commentsVal = row.general_comments || '-';
      ticketHtml += `
        <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--bg-nav-item);">
          <div style="font-weight:700; color:var(--text-primary); margin-bottom: 6px;">General Comments</div>
          <div style="color:var(--text-primary); white-space: pre-wrap;" data-key="general_comments">${commentsVal}</div>
        </div>
      `;
      
      ticketSection.innerHTML += ticketHtml;
      body.appendChild(ticketSection);
 } else if (key === 't2ps') {
      const ticketSection = document.createElement('div');
      ticketSection.className = 'detail-section';
      ticketSection.innerHTML = `<h3>Ticket Details</h3>`;
      
      let ticketHtml = '';
      ticketHtml += renderMetaCard('Monitoring Type', row.monitoring_type, 'monitoring_type', 'color:var(--text-primary);', true);
      ticketHtml += renderMetaCard('Ticket Status', row.ticket_status, 'ticket_status', 'color:var(--text-primary);', true);
      ticketHtml += renderMetaCard('Interaction Related To', row.interaction_related_to, 'interaction_related_to', 'color:var(--text-primary);', true);
      
      // SME Details
      if (row.sme_answer_provided) ticketHtml += renderMetaCard('SME Answer Provided', row.sme_answer_provided, 'sme_answer_provided', 'color:var(--text-primary);', true);
      if (row.sme_name) ticketHtml += renderMetaCard('SME Name', row.sme_name, 'sme_name', 'color:var(--text-primary);', true);
      if (row.sme_following_process) ticketHtml += renderMetaCard('SME Following Process', row.sme_following_process, 'sme_following_process', 'color:var(--text-primary);', true);

      ticketSection.innerHTML += ticketHtml;
      body.appendChild(ticketSection);
 } else if (key === 't2os') {
      const ticketSection = document.createElement('div');
      ticketSection.className = 'detail-section';
      ticketSection.innerHTML = `<h3>Ticket Details</h3>`;
      
      let ticketHtml = '';
      const fields = [
        { label: 'Monitoring Type', key: 'Monitoring_Type' },
        { label: 'Ticket Status', key: 'ticket_Status' },
        { label: 'Interaction Related To', key: 'Interaction_Related_To' },
        { label: 'Customer Retained', key: 'customer_retained' },
        { label: 'Coaching Delivered', key: 'coaching_delivered' },
        { label: 'Fitness Fluency', key: 'fitness_fluency' },
        { label: 'Queue', key: 'queue' },
        { label: 'Channel', key: 'Channel' },
        { label: 'Agent Acknowledge', key: 'Agent_Acknowledge' },
        { label: 'Appealed', key: 'appealed' }
      ];

      fields.forEach(f => {
         if (row[f.key] !== undefined && row[f.key] !== null) {
             ticketHtml += renderMetaCard(f.label, row[f.key], f.key, 'color:var(--text-primary);', true);
 }
 });

      ticketSection.innerHTML += ticketHtml;
      body.appendChild(ticketSection);
 } else if (key === 'salesret') {
      const ticketSection = document.createElement('div');
      ticketSection.className = 'detail-section';
      ticketSection.innerHTML = `<h3>Ticket Details</h3>`;

      let ticketHtml = '';
      const fields = [
        { label: 'Monitoring Type', key: 'Monitoring_Type' },
        { label: 'Ticket Status', key: 'ticket_status' },
        { label: 'Interaction Related To', key: 'Interaction_Related_To' },
        { label: 'Customer Retained', key: 'customer_retained' },
        { label: 'Coaching Delivered', key: 'coaching_delivered' },
        { label: 'Fitness Fluency', key: 'fitness_fluency' },
        { label: 'Queue', key: 'queue' },
        { label: 'Certification', key: 'Certification' },
        { label: 'Agent Acknowledge', key: 'Agent_Acknowledge' },
        { label: 'Appealed', key: 'appealed' }
      ];

      fields.forEach(f => {
        if (row[f.key] !== undefined && row[f.key] !== null) {
          ticketHtml += renderMetaCard(f.label, row[f.key], f.key, 'color:var(--text-primary);', true);
 }
 });

      if (row.URL) {
        const safeUrl = String(row.URL).replace(/"/g, '&quot;');
        ticketHtml += renderMetaCard('Ticket URL', `<a href="${safeUrl}" target="_blank" style="color:var(--primary-color); text-decoration:underline;">Open</a>`);
 }

      ticketSection.innerHTML += ticketHtml;
      body.appendChild(ticketSection);
 } else if (key === 'certification') {
      const ticketSection = document.createElement('div');
      ticketSection.className = 'detail-section';
      ticketSection.innerHTML = `<h3>Ticket Details</h3>`;

      let ticketHtml = '';
      const fields = [
        { label: 'Phase', key: 'Phase' },
        { label: 'Monitoring Type', key: 'Monitoring_Type' },
        { label: 'Ticket Status', key: 'Ticket_Status' },
        { label: 'Interaction Related To', key: 'Interaction_Related_To' },
        { label: 'SME Answer', key: 'SME_Answer' },
        { label: 'SME Name', key: 'SME_Name' },
        { label: 'SME Following Process', key: 'SME_Following_Process' },
        { label: 'Sales', key: 'Sales' },
        { label: 'Fitness Fluency', key: 'fitness_fluency' }
      ];

      fields.forEach((f) => {
        if (row[f.key] !== undefined && row[f.key] !== null) {
          usedKeys.add(f.key);
          ticketHtml += renderMetaCard(f.label, row[f.key], f.key, 'color:var(--text-primary);', true);
 }
 });

      if (row.URL) {
        const safeUrl = String(row.URL).replace(/"/g, '&quot;').trim();
        ticketHtml += renderMetaCard('Ticket URL', `<a href="${safeUrl}" target="_blank" style="color:var(--primary-color); text-decoration:underline;">Open</a>`);
 }

      if (row.Comments_SME_Related !== undefined && row.Comments_SME_Related !== null) {
        usedKeys.add('Comments_SME_Related');
        ticketHtml += `
          <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--bg-nav-item);">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom: 6px;">General SME Comments</div>
            <div style="color:var(--text-primary); white-space: pre-wrap;" data-key="Comments_SME_Related">${row.Comments_SME_Related || '-'}</div>
          </div>
        `;
 }

      if (row.Sales_Comments !== undefined && row.Sales_Comments !== null) {
        usedKeys.add('Sales_Comments');
        ticketHtml += `
          <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--bg-nav-item);">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom: 6px;">Sales Comments</div>
            <div style="color:var(--text-primary); white-space: pre-wrap;" data-key="Sales_Comments">${row.Sales_Comments || '-'}</div>
          </div>
        `;
 }

      ticketSection.innerHTML += ticketHtml;
      body.appendChild(ticketSection);
 } else if (key === 'winscert') {
      const ticketSection = document.createElement('div');
      ticketSection.className = 'detail-section';
      ticketSection.innerHTML = `<h3>Ticket Details</h3>`;

      let ticketHtml = '';
      const fields = [
        { label: 'Monitoring Type', key: 'monitoring_type' },
        { label: 'Ticket Status', key: 'ticket_status' },
        { label: 'Interaction Related To', key: 'interaction_related_to' },
        { label: 'SME Answer', key: 'sme_answer' },
        { label: 'SME Name', key: 'sme_name' },
        { label: 'SME Following Process', key: 'sme_following_process' },
        { label: 'Sales', key: 'sales' },
        { label: 'Retained Yes/No', key: 'retained_yes_no' },
        { label: 'Certification', key: 'certification' },
        { label: 'Calibration', key: 'calibration' },
        { label: 'Result Status', key: 'result_status' }
      ];

      fields.forEach((f) => {
        if (row[f.key] !== undefined && row[f.key] !== null) {
          usedKeys.add(f.key);
          ticketHtml += renderMetaCard(f.label, row[f.key], f.key, 'color:var(--text-primary);', true);
        }
      });

      if (row.url) {
        const safeUrl = String(row.url).replace(/"/g, '&quot;').trim();
        ticketHtml += renderMetaCard('Ticket URL', `<a href="${safeUrl}" target="_blank" style="color:var(--primary-color); text-decoration:underline;">Open</a>`);
      }

      if (row.comments_sme_related !== undefined && row.comments_sme_related !== null) {
        usedKeys.add('comments_sme_related');
        ticketHtml += `
          <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--bg-nav-item);">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom: 6px;">General SME Comments</div>
            <div style="color:var(--text-primary); white-space: pre-wrap;" data-key="comments_sme_related">${row.comments_sme_related || '-'}</div>
          </div>
        `;
      }

      if (row.sales_comments !== undefined && row.sales_comments !== null) {
        usedKeys.add('sales_comments');
        ticketHtml += `
          <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--bg-nav-item);">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom: 6px;">Sales Comments</div>
            <div style="color:var(--text-primary); white-space: pre-wrap;" data-key="sales_comments">${row.sales_comments || '-'}</div>
          </div>
        `;
      }

      ticketSection.innerHTML += ticketHtml;
      body.appendChild(ticketSection);
 }

    // Attributes Section (Dynamic Parsing)
    const attrSection = document.createElement('div');
    attrSection.className = 'detail-section';
    attrSection.innerHTML = `<h3>Attributes & Comments</h3>`;
    
    const toTitle = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const formatLink = (text) => {
      if (typeof text !== 'string') return text;
      return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:var(--primary-color); text-decoration:underline; cursor:pointer;">URL</a>');
 };

    // SMS SPECIFIC LOGIC
    if (key === 'sms') {
      // Explicit order requested by user
      const smsOrderedAttributes = [ 
         "Personalized Customer Engagement", 
         "Clear and Concise Communication", 
         "Professionalism and Interpersonal Skills", 
         "Language Precision and Accuracy", 
         "Product Expertise and Tempo Representation", 
         "Workflow Compliance", 
         "CRM Utilization and Accurate Documentation", 
         "Effective Sales Promotion and Customer Persuasion" 
      ];

      // Explicit mapping to DB columns (based on mx-t1-sms-scorecard.js)
      const SMS_DB_MAPPING = {
        "Personalized Customer Engagement": "Personalized_Customer_Engagement",
        "Clear and Concise Communication": "Clear_and_Concise_Communication",
        "Professionalism and Interpersonal Skills": "Professionalism_and_Interpersonal_Skills",
        "Language Precision and Accuracy": "Language_Precision_and_Accuracy",
        "Product Expertise and Tempo Representation": "Product_Expertise_and_Tempo_Representation",
        "Workflow Compliance": "Workflow_Compliance",
        "CRM Utilization and Accurate Documentation": "CRM_Utilization_and_Accurate_Documentation",
        "Effective Sales Promotion and Customer Persuasion": "Effective_Sales_Promotion_and_Customer_Persuasion"
 };

      // Use API attributes for metadata (description, score), but enforce order from smsOrderedAttributes
      const apiAttrs = state.smsAttributes || [];

      smsOrderedAttributes.forEach(attrName => {
        // Find metadata from API
        const attrItem = apiAttrs.find(a => (a.Subcategory || '').trim() === attrName);

        const description = attrItem ? (attrItem.Criteria || attrItem.Description || attrItem.description || '') : '';
        // "Score" from API is likely the Max Score / Weight
        const maxScore = (attrItem && attrItem.Score !== undefined && attrItem.Score !== null) ? attrItem.Score : null;

        // 2. Find Score/Value in Row
        // Use explicit mapping if available, fallback to fuzzy search
        const dbColName = SMS_DB_MAPPING[attrName];
        
        let scoreKey = null;
        let scoreVal = null;
        
        // Try explicit key first
        if (dbColName && row[dbColName] !== undefined) {
             scoreKey = dbColName;
             scoreVal = row[dbColName];
 } else {
            // Fallback: Convert "Personalized Customer Engagement" -> "personalized_customer_engagement"
            const snakeKey = attrName.toLowerCase().replace(/\s+/g, '_').replace(/,/g, ''); 
            
            const candidates = [
              snakeKey,
              `score_${snakeKey}`,
              attrName,
              attrName.replace(/\s+/g, '') 
            ];
            
            const rowKeys = Object.keys(row);
            for (const c of candidates) {
              const found = rowKeys.find(k => k.toLowerCase() === c.toLowerCase());
              if (found) {
                scoreKey = found;
                scoreVal = row[found];
                break;
 }
 }
 }

        // 3. Find Comment
        // Try explicit comment key first: com_ + dbColName
        let commentKey = null;
        let commentVal = '';
        
        if (dbColName) {
            const explicitComKey = `com_${dbColName}`;
            if (row[explicitComKey] !== undefined) {
                commentKey = explicitComKey;
                commentVal = row[explicitComKey];
 }
 }

        if (!commentKey) {
             // Fallback fuzzy search
             const snakeKey = attrName.toLowerCase().replace(/\s+/g, '_').replace(/,/g, '');
             const commentCandidates = [
              `comment_${snakeKey}`,
              `comments_${snakeKey}`,
              `com_${snakeKey}`,
              `${snakeKey}_comment`,
              `${snakeKey}_comments`
            ];
            const rowKeys = Object.keys(row);
            for (const c of commentCandidates) {
              const found = rowKeys.find(k => k.toLowerCase() === c.toLowerCase());
              if (found) {
                commentKey = found;
                commentVal = row[found];
                break;
 }
 }
 }

        // Even if we don't find a scoreKey, we should display the attribute if it comes from the API
        // But typically we want to show it only if we have data or if it's a required field.
        // The previous logic required scoreKey or commentKey. 
        // Given we are iterating API definitions, we might want to show it even if empty?
        // Let's stick to pushing it, maybe with empty score.
        // But for consistency with previous logic, let's keep the check, or relax it.
        // If the user wants to see ALL attributes from API, we should push even if no score found in row.
        // But if no score found, displayScore will be '-'.
        
        attributes.push({
             label: attrName,
             description: description,
             score: scoreVal,
             scoreKey: scoreKey, // Might be null
             comment: commentVal,
             commentKey: commentKey,
             maxScore: maxScore
 });
        
        if (scoreKey) usedKeys.add(scoreKey);
        if (commentKey) usedKeys.add(commentKey);
 });

 } else if (key === 'social') {
      const apiAttrs = state.socialAttributes || [];
      const sortedApiAttrs = [...apiAttrs].sort((a, b) => Number(a.id || a.ID || 0) - Number(b.id || b.ID || 0));

      sortedApiAttrs.forEach(attrItem => {
        let attrName = String(attrItem.Category || attrItem.category || '').trim();
        if (!attrName) return;
        if (attrName.endsWith(':')) attrName = attrName.slice(0, -1).trim();

        const description = String(attrItem.subCategory || attrItem.Subcategory || attrItem.Criteria || attrItem.criteria || '').trim();
        let maxScore = attrItem.score ?? attrItem.Score ?? attrItem.max_score ?? attrItem.Max_Score ?? null;
        if (maxScore !== null && maxScore !== undefined && maxScore !== '') {
          if (typeof maxScore === 'string') {
            const clean = maxScore.replace(/%/g, '').trim();
            maxScore = clean ? parseFloat(clean) : null;
 } else {
            maxScore = Number(maxScore);
 }
          if (maxScore !== null && !Number.isFinite(maxScore)) maxScore = null;
 } else {
          maxScore = null;
 }

        const norm = normalizeToken(attrName);
        const scoreKey = pickRowKey(row, [attrName, norm, norm.replace(/_/g, ' ')]);
        const scoreVal = scoreKey ? row[scoreKey] : null;

        const commentKey = pickRowKey(row, [
          `comment_${attrName}`,
          `comments_${attrName}`,
          `comment ${attrName}`,
          `comment_${attrName.replace(/\s+/g, '_')}`,
          `comments_${attrName.replace(/\s+/g, '_')}`,
          `comment_${norm}`,
          `comments_${norm}`,
          `${norm}_comment`,
          `${norm}_comments`
        ]);
        const commentVal = commentKey ? row[commentKey] : '';

        attributes.push({
          label: attrName,
          description: description,
          score: scoreVal,
          scoreKey: scoreKey,
          comment: commentVal,
          commentKey: commentKey,
          maxScore: maxScore
 });

        if (scoreKey) usedKeys.add(scoreKey);
        if (commentKey) usedKeys.add(commentKey);
 });

 } else if (key === 't2ps') {
       const apiAttrs = state.psAttributes || [];
      let t2PsOrderedAttributes = [];

      if (apiAttrs.length > 0) {
         // Dynamic ordering to match scorecard logic (Grouped + ID sort)
         const ATTR_GROUPS = {
            'Video Call Etiquette': ['Introduction','Professionalism','Closure'],
            'Soft Skills': ['Active Listening','Empathy & Positive Attitude','Friendly and Engaging'],
            'Efficiency In Communication': ['Language Skills','Explanation'],
            'Resolution': ['Product Awareness','Process Awareness','Ownership'],
            'Tempo Values': ['Brand Representation'],
            'Workflow': ['CRM Updates','Documentation','Workflow']
 };
          const ORDERED_GROUP_KEYS = [
            'Video Call Etiquette',
            'Soft Skills',
            'Efficiency In Communication',
            'Resolution',
            'Tempo Values',
            'Workflow'
          ];
          
          const sorted = [...apiAttrs].sort((a,b) => Number(a.ID||0) - Number(b.ID||0));
          const grouped = {};
          ORDERED_GROUP_KEYS.forEach(k => grouped[k] = []);
          
          sorted.forEach(item => {
              const sub = (item.Subcategory || '').trim();
              if (!sub) return;
              let g = 'Workflow';
              for (const [groupName, subs] of Object.entries(ATTR_GROUPS)) {
                  if (subs.includes(sub)) {
                      g = groupName;
                      break;
 }
 }
              if (grouped[g]) grouped[g].push(sub);
 });
          
          ORDERED_GROUP_KEYS.forEach(k => {
              if (grouped[k]) t2PsOrderedAttributes.push(...grouped[k]);
 });
 }

      if (t2PsOrderedAttributes.length === 0) {
         t2PsOrderedAttributes = [
          "Introduction",
          "Professionalism",
          "Closure",
          "Active Listening",
          "Empathy & Positive Attitude",
          "Friendly and Engaging",
          "Language Skills",
          "Explanation",
          "Product Awareness",
          "Process Awareness",
          "Ownership",
          "Brand Representation",
          "CRM Updates",
          "Documentation",
          "Workflow"
        ];
 }

      const T2_PS_DB_MAPPING = {
        "Introduction": "introduction",
        "Professionalism": "professionalism",
        "Closure": "closure",
        "Active Listening": "active_listening",
        "Empathy & Positive Attitude": "empathy_positive_attitude",
        "Friendly and Engaging": "friendly_and_engaging",
        "Language Skills": "language_skills",
        "Explanation": "explanation",
        "Product Awareness": "product_awareness",
        "Process Awareness": "process_awareness",
        "Ownership": "ownership",
        "Brand Representation": "brand_representation",
        "CRM Updates": "crm_updates",
        "Documentation": "documentation",
        "Workflow": "workflow"
 };

      t2PsOrderedAttributes.forEach(attrName => {
        // Find metadata from API
        const attrItem = apiAttrs.find(a => (a.Subcategory || '').trim() === attrName);

        const description = attrItem ? (attrItem.Criteria || '') : '';
        const maxScore = (attrItem && attrItem.Score !== undefined) ? attrItem.Score : null;

        const dbColName = T2_PS_DB_MAPPING[attrName];
        let scoreKey = null;
        let scoreVal = null;

        if (dbColName && row[dbColName] !== undefined) {
             scoreKey = dbColName;
             scoreVal = row[dbColName];
 }

        let commentKey = null;
        let commentVal = '';
        if (dbColName) {
            let explicitComKey = `com_${dbColName}`;
            // Special case for Empathy & Positive Attitude where comment key differs from score key pattern
            if (attrName === "Empathy & Positive Attitude") {
                 explicitComKey = "com_empathy_&_positive_attitude";
 }

            if (row[explicitComKey] !== undefined) {
                commentKey = explicitComKey;
                commentVal = row[explicitComKey];
 }
 }

        attributes.push({
             label: attrName,
             description: description,
             score: scoreVal,
             scoreKey: scoreKey,
             comment: commentVal,
             commentKey: commentKey,
             maxScore: maxScore
 });
        
        if (scoreKey) usedKeys.add(scoreKey);
        if (commentKey) usedKeys.add(commentKey);
 });

 } else if (key === 't2os') {
       const apiAttrs = state.t2osAttributes || [];
       
       // Filter by specific IDs (1-14) as requested and Sort by ID ascending
       const allowedIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
       const sortedApiAttrs = apiAttrs
           .filter(a => allowedIds.includes(Number(a.ID || a.id || 0)))
           .sort((a, b) => Number(a.ID || a.id || 0) - Number(b.ID || b.id || 0));

       const T2_OS_DB_MAPPING = {
           'Interaction Protocols': 'interaction_protocols',
           'Understanding': 'understanding',
           'Engagement & Langauge': 'engagement_&_Langauge', // Note: Typo in DB, but matches user request
           'Engagement & Language': 'engagement_&_Langauge', // Robustness for correct spelling
           'Effectiveness & FCR': 'effectiveness_&_FCR',
           'Retention / Sales Skills': 'retention_Skills',
           'Offering Alternatives / Options': 'offering_Alternatives',
           'Product Awareness': 'product_Awareness',
           'Process Awareness': 'process_Awareness',
           'Tempo Values': 'tempo_Values',
           'Verfication': 'verfication', // Note: Typo in DB
           'CRM Updates': 'crm_updates',
           'Documentation': 'documentation',
           'Workflow': 'workflow',
           'Ownership': 'ownership',
           // Legacy/Fallbacks kept just in case but primary ones above match user list
           'Soft Skills': 'soft_skills', 
           'Language': 'language',
           'Responsiveness': 'responsiveness',
           'Effectiveness': 'effectiveness',
           'FCR': 'fcr',
           'Verification': 'verfication'
 };

       // NEW: Explicit Comment Map provided by user
       // Maps the DB column name (from T2_OS_DB_MAPPING) to the specific Comment Column
       const T2_OS_COMMENT_MAPPING = {
           'interaction_protocols': 'comment_interaction_protocols',
           'understanding': 'comment_Understanding',
           'engagement_&_Langauge': 'comment_Engagement_&_Langauge',
           'effectiveness_&_FCR': 'comment_Effectiveness_&_FCR',
           'retention_Skills': 'comment_Retention_Skills',
           'offering_Alternatives': 'comment_Offering_Alternatives',
           'product_Awareness': 'comment_Product_Awareness',
           'process_Awareness': 'comment_Process_Awareness',
           'tempo_Values': 'comment_Tempo_Values',
           'verfication': 'comment_Verfication',
           'crm_updates': 'comment_CRM_Updates',
           'documentation': 'comment_Documentation',
           'workflow': 'comment_Workflow',
           'ownership': 'comment_ownership'
 };

       sortedApiAttrs.forEach(attrItem => {
           // Case insensitive fallback for API fields
           let attrName = (attrItem.Subcategory || attrItem.subcategory || '').trim();
           if (!attrName) return;
           
           // Normalize spaces
           attrName = attrName.replace(/\s+/g, ' ');

           const description = attrItem.Criteria || attrItem.criteria || '';
           
           let maxScore = null;
           if (attrItem.Score !== undefined) maxScore = attrItem.Score;
           else if (attrItem.score !== undefined) maxScore = attrItem.score;
           
           // Ensure maxScore is a number and handle "15%" or strings
           if (maxScore !== null) {
               if (typeof maxScore === 'string') {
                   const clean = maxScore.replace(/%/g, '').trim();
                   if (clean === '') maxScore = null;
                   else maxScore = parseFloat(clean);
 } else {
                   maxScore = Number(maxScore);
 }
 }
           
           // Safety check
           if (maxScore !== null && isNaN(maxScore)) maxScore = null;

           const dbColName = T2_OS_DB_MAPPING[attrName];
           
           let scoreVal = undefined;
           let scoreKey = null;

           // 1. Try explicit mapping
           if (dbColName && row[dbColName] !== undefined) {
               scoreVal = row[dbColName];
               scoreKey = dbColName;
 }

           // 2. Fallback fuzzy search if not found
           if (scoreVal === undefined) {
                // Normalize for snake_case matching: "Retention / Sales Skills" -> "retention_sales_skills"
                const snakeKey = attrName.toLowerCase()
                    .replace(/\//g, ' ') // Replace / with space
                    .replace(/\s+/g, '_') // Replace spaces with _
                    .replace(/,/g, '');   // Remove commas
                
                const candidates = [
                    snakeKey, 
                    `score_${snakeKey}`,
                    attrName,
                    attrName.replace(/\s+/g, ''),
                    attrName.toLowerCase().replace(/ /g, '_'),
                    // Specific fallbacks for known typos or variations
                    'verfication',
                    'verification', 
                    'engagement_&_langauge',
                    'engagement_&_language',
                    'retention_skills' // Fallback for "Retention / Sales Skills" if snakeKey doesn't match
                ];

                // Explicit Fallbacks for New API Attributes -> Old DB Columns (if new columns don't exist)
                if (attrName === 'Soft Skills') candidates.push('retention_skills', 'retention_Skills');
                if (attrName === 'Language') candidates.push('engagement_&_langauge', 'engagement_&_language');
                if (attrName === 'Effectiveness') candidates.push('effectiveness_&_FCR', 'effectiveness_&_fcr');
                if (attrName === 'FCR') candidates.push('effectiveness_&_FCR', 'effectiveness_&_fcr');
                if (attrName === 'Responsiveness') candidates.push('responsiveness'); // Likely new or standard
                
                const rowKeys = Object.keys(row);
                for (const c of candidates) {
                    const found = rowKeys.find(k => k.toLowerCase() === c.toLowerCase());
                    if (found) {
                        scoreKey = found;
                        scoreVal = row[found];
                        break;
 }
 }
 }

           // Find Comment
           let commentKey = null;
           let commentVal = '';
           
           // Define rowKeys for reuse
           const rowKeys = Object.keys(row);

           // 1. Try explicit T2_OS_COMMENT_MAPPING first (Exact Match)
           if (dbColName && T2_OS_COMMENT_MAPPING[dbColName]) {
               const explicitKey = T2_OS_COMMENT_MAPPING[dbColName];
               if (row[explicitKey] !== undefined) {
                   commentKey = explicitKey;
                   commentVal = row[explicitKey];
 }
 }

           // 2. Try explicit mapping patterns if not found
           if (!commentKey && dbColName) {
               const explicitCandidates = [
                   `com_${dbColName}`, 
                   `comment_${dbColName}`, 
                   `comments_${dbColName}`
               ];
               for (const c of explicitCandidates) {
                   if (row[c] !== undefined) {
                       commentKey = c;
                       commentVal = row[c];
                       break;
 }
 }
 }
           
           // 2. Fallback fuzzy search if not found
           if (!commentKey) {
                const snakeKey = attrName.toLowerCase()
                    .replace(/\//g, ' ')
                    .replace(/\s+/g, '_')
                    .replace(/,/g, '');
                
                const commentCandidates = [
                    `comment_${snakeKey}`,
                    `comments_${snakeKey}`,
                    `com_${snakeKey}`,
                    `${snakeKey}_comment`,
                    `${snakeKey}_comments`
                ];
                
                // Handle special characters like & 
                if (attrName.includes('&')) {
                    const andKey = attrName.toLowerCase().replace('&', 'and').replace(/\s+/g, '_');
                    commentCandidates.push(`com_${andKey}`, `comment_${andKey}`, `comments_${andKey}`);
                    
                    const noAmpKey = attrName.toLowerCase().replace('&', '').replace(/\s+/g, '_').replace(/__/g, '_');
                    commentCandidates.push(`com_${noAmpKey}`, `comment_${noAmpKey}`, `comments_${noAmpKey}`);
 }
                
                // Typo fallbacks
                if (attrName.includes('Verification')) {
                     commentCandidates.push('com_verfication', 'comment_verfication');
 }
                if (attrName.includes('Engagement & Language')) {
                     commentCandidates.push('com_engagement_&_langauge');
 }
                
                // SME Fallback
                if (attrName === 'SME Following Process' || attrName === 'SME Related') {
                     commentCandidates.push('comments_sme_related', 'comment_sme_related');
 }

                for (const c of commentCandidates) {
                    const found = rowKeys.find(k => k.toLowerCase() === c.toLowerCase());
                    if (found) {
                        commentKey = found;
                        commentVal = row[found];
                        break;
 }
 }
 }
           
           // 3. Loose Search (Token based) - catch things like "Pre_Sales_Comments" for "Sales"
           if (!commentKey) {
               // Split attribute name into significant tokens
               const parts = attrName.toLowerCase().split(/[\s&/]+/).filter(p => p.length > 2);
               if (parts.length > 0) {
                   const looseMatch = rowKeys.find(k => {
                       const lowerK = k.toLowerCase();
                       // Must look like a comment column
                       if (!lowerK.includes('comment') && !lowerK.includes('com_')) return false;
                       
                       // Must contain ALL tokens (e.g. "fitness" AND "fluency")
                       return parts.every(p => lowerK.includes(p));
 });
                   
                   if (looseMatch) {
                       commentKey = looseMatch;
                       commentVal = row[looseMatch];
 }
 }
 }

           // Push to attributes
           attributes.push({
               label: attrName,
               description: description,
               score: scoreVal,
               scoreKey: scoreKey,
               comment: commentVal,
               commentKey: commentKey,
               maxScore: maxScore
 });
           
           if (scoreKey) usedKeys.add(scoreKey);
           if (commentKey) usedKeys.add(commentKey);
 });

 } else if (key === 'salesret') {
      const apiAttrs = state.salesRetAttributes || [];
      const sortedApiAttrs = [...apiAttrs].sort((a, b) => Number(a.ID || a.id || 0) - Number(b.ID || b.id || 0));

      const SALES_RET_DB_MAPPING = {
        'Interaction Protocols': 'interaction_protocols',
        'Understanding': 'understanding',
        'Effectiveness & FCR': 'effectiveness_&_FCR',
        'Engagement & Langauge': 'engagement_&_Langauge',
        'Engagement & Language': 'engagement_&_Langauge',
        'Retention Skills/Sales Skills': 'retention_skills',
        'Retention / Sales Skills': 'retention_skills',
        'Offering Alternatives/Options': 'offering_alternatives',
        'Offering Alternatives / Options': 'offering_alternatives',
        'Product Awareness': 'product_awareness',
        'Process Awareness': 'process_awareness',
        'Tempo Values': 'tempo_values',
        'Verification': 'verfication',
        'Verfication': 'verfication',
        'Documentation & CRM Updates': 'documentation_crm',
        'Documentation / CRM Updates': 'documentation_crm',
        'Documentation': 'documentation_crm',
        'CRM Updates': 'documentation_crm',
        'Workflow': 'workflow',
        'Ownership': 'ownership'
 };

      const SALES_RET_COMMENT_MAPPING = {
        'interaction_protocols': 'comment_interaction_protocols',
        'understanding': 'comment_Understanding',
        'effectiveness_&_FCR': 'comment_Effectiveness_&_FCR',
        'engagement_&_Langauge': 'comment_Engagement_&_Langauge',
        'retention_skills': 'comment_Retention_Skills',
        'offering_alternatives': 'comment_Offering_Alternatives',
        'product_awareness': 'comment_Product_Awareness',
        'process_awareness': 'comment_Process_Awareness',
        'tempo_values': 'comment_Tempo_Values',
        'verfication': 'comment_Verification',
        'documentation_crm': 'comment_Documentation_crm',
        'workflow': 'comment_Workflow',
        'ownership': 'comment_ownership'
 };

      sortedApiAttrs.forEach(attrItem => {
        let attrName = String(attrItem.Subcategory || attrItem.subcategory || attrItem.subcategor || '').trim();
        if (!attrName) return;
        attrName = attrName.replace(/\s+/g, ' ');

        const description = String(attrItem.Criteria || attrItem.criteria || attrItem.description || '').trim();
        let maxScore = attrItem.Score ?? attrItem.score ?? null;
        if (maxScore !== null && maxScore !== undefined && maxScore !== '') {
          maxScore = parseAttributeScoreValue(maxScore);
 } else {
          maxScore = null;
 }

        const dbColName = SALES_RET_DB_MAPPING[attrName];
        let scoreKey = null;
        let scoreVal = undefined;

        if (dbColName && row[dbColName] !== undefined) {
          scoreKey = dbColName;
          scoreVal = row[dbColName];
 }

        if (scoreVal === undefined) {
          scoreKey = pickRowKey(row, [
            dbColName,
            attrName,
            attrName.replace(/\s+/g, '_'),
            normalizeToken(attrName),
            'retention_skills',
            'offering_alternatives',
            'documentation_crm',
            'verfication'
          ].filter(Boolean));
          scoreVal = scoreKey ? row[scoreKey] : undefined;
 }

        let commentKey = null;
        let commentVal = '';

        if (dbColName && SALES_RET_COMMENT_MAPPING[dbColName] && row[SALES_RET_COMMENT_MAPPING[dbColName]] !== undefined) {
          commentKey = SALES_RET_COMMENT_MAPPING[dbColName];
          commentVal = row[commentKey];
 }

        if (!commentKey) {
          commentKey = pickRowKey(row, [
            dbColName ? SALES_RET_COMMENT_MAPPING[dbColName] : null,
            dbColName ? `comment_${dbColName}` : null,
            dbColName ? `comments_${dbColName}` : null,
            dbColName ? `com_${dbColName}` : null,
            `comment_${attrName}`,
            `comments_${attrName}`,
            `comment_${attrName.replace(/\s+/g, '_')}`,
            `comments_${attrName.replace(/\s+/g, '_')}`,
            `comment_${normalizeToken(attrName)}`,
            `comments_${normalizeToken(attrName)}`
          ].filter(Boolean));
          commentVal = commentKey ? row[commentKey] : '';
 }

        attributes.push({
          label: attrName,
          description,
          score: scoreVal,
          scoreKey,
          comment: commentVal,
          commentKey,
          maxScore
 });

        if (scoreKey) usedKeys.add(scoreKey);
        if (commentKey) usedKeys.add(commentKey);
 });

 } else if (key === 'certification') {
      const certificationAttributes = [
        {
          label: 'Understanding & Effectiveness',
          scoreKey: 'Understanding_And_Effectiveness',
          commentKey: 'Comments_Understanding_And_Effectiveness'
 },
        {
          label: 'Communication',
          scoreKey: 'Communication',
          commentKey: 'Comments_Communication'
 },
        {
          label: 'Issue Resolution (Product, Process, and FCR)',
          scoreKey: 'Issue_Resolution_Product_Process_And_FCR',
          commentKey: 'Comments_Issue_Resolution_Product_Process_And_FCR'
 },
        {
          label: 'Brand Representation and Ownership',
          scoreKey: 'Brand_Representation_And_Ownership',
          commentKey: 'Comments_Brand_Representation_And_Ownership'
 },
        {
          label: 'Internal Process',
          scoreKey: 'Internal_Process',
          commentKey: 'Comments_Internal_Process'
 }
      ];

      certificationAttributes.forEach((attr) => {
        const meta = certificationDefMap.get(attr.label) || {};
        attributes.push({
          label: attr.label,
          description: String(meta.Criteria || meta.description || '').trim(),
          score: row[attr.scoreKey],
          scoreKey: attr.scoreKey,
          comment: row[attr.commentKey] || '',
          commentKey: attr.commentKey,
          maxScore: meta.Score ?? null
 });

        usedKeys.add(attr.scoreKey);
        usedKeys.add(attr.commentKey);
 });
 } else if (key === 'winscert') {
      const winsAttributes = [
        {
          label: 'Engagement And Discovery',
          scoreKey: 'engagement_and_discovery',
          commentKey: 'engagement_and_discovery_comment'
        },
        {
          label: 'Value Positioning',
          scoreKey: 'value_positioning',
          commentKey: 'value_positioning_comment'
        },
        {
          label: 'Objection Handling & Risistance',
          scoreKey: 'objection_handling_risistance',
          commentKey: 'objection_handling_risistance_comment'
        },
        {
          label: 'Win Skills',
          scoreKey: 'win_skills',
          commentKey: 'win_skills_comment'
        },
        {
          label: 'Process & Compliance',
          scoreKey: 'process_compliance',
          commentKey: 'process_compliance_comment'
        }
      ];

      winsAttributes.forEach((attr) => {
        const meta = winsDefMap.get(attr.label) || {};
        attributes.push({
          label: attr.label,
          description: String(meta.description || meta.Criteria || '').trim(),
          score: row[attr.scoreKey],
          scoreKey: attr.scoreKey,
          comment: row[attr.commentKey] || '',
          commentKey: attr.commentKey,
          maxScore: meta.score ?? meta.Score ?? null
        });

        usedKeys.add(attr.scoreKey);
        usedKeys.add(attr.commentKey);
      });
 } else {
      // GENERIC LOGIC (T1, T2PS, T2OS)
      const keys = Object.keys(row).sort();
    
    keys.forEach(k => {
      const lowerK = k.toLowerCase();
      if (usedKeys.has(k)) return;
      
      // SKIP comment keys in this primary pass. We want to find "Score" keys first.
      // We will handle orphaned comments in a second pass.
      if (lowerK.startsWith('comments_') || lowerK.startsWith('comment_') || lowerK.startsWith('comment ') || lowerK.startsWith('com ')) return;
      // Also skip suffix-style comments to prevent them from becoming attributes
      if (lowerK.endsWith('_comments') || lowerK.endsWith(' comments') || lowerK.endsWith(' comment')) return;

      let label = k;
      let scoreVal = row[k];
      let commentVal = '';
      let commentKey = null;
      
      let suffix = k;
      if (lowerK.startsWith('score_')) {
        suffix = k.substring(6);
        label = toTitle(suffix);
 } else if (lowerK.startsWith('yn_')) {
        suffix = k.substring(3);
        label = toTitle(suffix);
 } else {
         label = toTitle(k);
 }

      const foundCommentKey = keys.find(ck => {
        const lowerCK = ck.toLowerCase();
        
        const isPrefix = lowerCK.startsWith('comments_') || lowerCK.startsWith('comment_') || lowerCK.startsWith('com ');
        const isSuffix = lowerCK.endsWith('_comments') || lowerCK.endsWith(' comments') || lowerCK.endsWith(' comment');
        
        if (!isPrefix && !isSuffix) return false;

        const suffixLower = suffix.toLowerCase();

        // STRICTER MATCHING LOGIC to avoid false positives (e.g. "Pre_Sales_Comments" matching "Sales")

        if (isSuffix) {
            // Suffix-style (e.g. "Sales_Comments"). Attribute is "Sales".
            // Logic: The part BEFORE the comment suffix must match the attribute suffix EXACTLY.
            let baseName = lowerCK;
            if (lowerCK.endsWith('_comments')) baseName = lowerCK.substring(0, lowerCK.length - 9);
            else if (lowerCK.endsWith(' comments')) baseName = lowerCK.substring(0, lowerCK.length - 9);
            else if (lowerCK.endsWith(' comment')) baseName = lowerCK.substring(0, lowerCK.length - 8);

            if (baseName === suffixLower) return true;
            
            // Handle plural/singular mismatch
            if (baseName.endsWith('s') && baseName.slice(0, -1) === suffixLower) return true;
            if (suffixLower.endsWith('s') && suffixLower.slice(0, -1) === baseName) return true;
            
            return false;
 }

        if (isPrefix) {
            // Prefix-style (e.g. "Comments_Greeting"). Attribute is "Greeting".
            // Keep existing flexible logic for prefixes as they are less prone to suffix-collision issues
            
            // SPECIAL CASE: Map "Comments_SME_Related" to "SME_Following_Process"
            if (lowerK.includes('sme_following_process') && lowerCK.includes('comments_sme_related')) return true;

            if (lowerCK.includes(suffixLower)) return true;
            if (lowerCK.endsWith(k.toLowerCase())) return true;

            // Handle singular/plural mismatch
            if (suffixLower.endsWith('s') && lowerCK.includes(suffixLower.slice(0, -1))) return true;
            
            return false;
 }

        return false;
 });

      // Force include specific keys even if they don't look like scores
      const FORCED_ATTRS = new Set([
        'certification', 
        'fitness_fluency', 'fitness fluency',
        'sales', 
        // 'sales_comments' removed to prevent duplication as attribute
        'sme_following_process', 'sme following process', 'sme_related', 'sme related',
        'ticket_status', 'ticket status',
        'channel',
        'interaction_related_to', 'int_related_to', 'interaction related to',
        'monitoring_type', 'monitoring type',
        'sme_answer', 'sme answer',
        'sme_name', 'sme name'
      ]);

      if (foundCommentKey) {
        commentVal = row[foundCommentKey];
        commentKey = foundCommentKey;
        usedKeys.add(foundCommentKey);
 } else {
        const sVal = String(scoreVal).toLowerCase();
        // If no comment found, stick to strict check to avoid polluting attributes with random metadata
        // BUT allow forced attributes
        if (!FORCED_ATTRS.has(lowerK) && sVal !== 'yes' && sVal !== 'no' && isNaN(parseFloat(sVal))) {
           return; 
 }
 }

      if (FORCED_ATTRS.has(lowerK) || (scoreVal !== null && scoreVal !== '') || commentKey) {
        attributes.push({ label, score: scoreVal, scoreKey: k, comment: commentVal, commentKey: commentKey });
        usedKeys.add(k);
        if (commentKey) usedKeys.add(commentKey);
 }
 });

      // --- Second Pass: Orphaned Comments ---
    // Catch comments that didn't have a matching "Score" key (e.g. "Comments FCR" where "FCR" column is missing/null/mismatched)
    // Also catch suffixes like "Sales_Comments" if "Sales" wasn't found as a score key?
    // But if "Sales" wasn't found, then "Sales_Comments" wouldn't have been picked up.
    
    keys.forEach(k => {
      if (usedKeys.has(k)) return;
      const lowerK = k.toLowerCase();
      
      const isPrefix = lowerK.startsWith('comments_') || lowerK.startsWith('comment ') || lowerK.startsWith('com ');
      const isSuffix = lowerK.endsWith('_comments') || lowerK.endsWith(' comments');
      
      if (isPrefix || isSuffix) {
         // Promote to Attribute
         let label = toTitle(k);
         
         // Strip prefixes/suffixes
         if (isPrefix) {
             if (label.startsWith('Comments ')) label = label.substring(9);
             else if (label.startsWith('Comment ')) label = label.substring(8);
             else if (label.startsWith('Com ')) label = label.substring(4);
 } else if (isSuffix) {
             if (lowerK.endsWith('_comments')) label = toTitle(k.slice(0, -9));
             else if (lowerK.endsWith(' comments')) label = toTitle(k.slice(0, -9));
 }
         
         // Infer a Score Key? 
         // If "Comments FCR", assume score key is "FCR" or "fcr" or "Fcr"?
         // Best guess: Use the label (FCR) as the key, or try to find a key that looks like it?
         // If we use a key that doesn't exist in row, the PATCH might fail if the column doesn't exist.
         // BUT, for T1, "FCR" likely exists.
         // Let's guess the key based on the label (e.g. "FCR").
         // Warning: This is a guess.
         const inferredScoreKey = label.replace(/\s+/g, '_'); 

         // Check if this inferred key actually exists in the data (case-insensitive check)
         const realScoreKey = Object.keys(row).find(k => k.toLowerCase() === inferredScoreKey.toLowerCase());

         attributes.push({ 
             label: label, 
             score: realScoreKey ? row[realScoreKey] : null, 
             scoreKey: realScoreKey || null, // Only set key if it exists
             comment: row[k], 
             commentKey: k 
 });
         usedKeys.add(k);
 }
 });
 } // END GENERIC LOGIC
    
    // --- Post-Processing: Rename, Filter, Sort ---
    const RENAME_MAP = {
        'Crm Update': 'CRM Updates',
        'Correctly Diagnose': 'Understanding', 
        'Correctly Diagnosed': 'Understanding',
        'Diagnosis': 'Understanding',
        'Fcr': 'FCR',
        'Sme Following Process': 'SME', 
        'Sme Related': 'SME',
        'SME Following Process': 'SME', 
        'SME Related': 'SME',
        'Sales': 'Sales',
        'Sales Comments': 'Sales',
        'Int Related To': 'Interaction Related To',
        'Int_related_to': 'Interaction Related To',
        'Interaction Related To': 'Interaction Related To',
        'Documentation': 'Documentations'
 };

    const EXCLUDE_LABELS = new Set(['Date Created', 'Agent Appeal']);
    
    const NO_COMMENT_LABELS = new Set([
        'Certification', 
        'Fitness Fluency',
        'Channel',
        'Interaction Related To',
        'Monitoring Type',
        'SME Answer',
        'SME Name',
        'Ticket Status'
    ]);

    const SECTION_1_ORDER = [
        'Channel',
        'Interaction Related To',
        'Monitoring Type',
        'SME Answer',
        'SME Name',
        'Sales',
        'Certification',
        'Fitness Fluency',
        'SME',
        'Ticket Status'
    ];

    const SECTION_2_ORDER = [
        'Interaction Protocols',
        'Understanding',
        'Responsiveness',
        'Effectiveness',
        'Soft Skills',
        'Language',
        'FCR',
        'Brand Representation Ownership',
        'Product Awareness',
        'Process Awareness',
        'Verification',
        'Documentations',
        'CRM Updates',
        'Workflow'
    ];

    // Combine for sorting, but we will render in two blocks
    // If definitions are available, use them to define SECTION_2_ORDER
    // User requested specific order, so we will use SECTION_2_ORDER as primary.
    // We can merge new keys from definitions if needed, but for now we enforce user order.
    let dynamicSection2 = SECTION_2_ORDER;
    /* 
    if (definitions && definitions.length > 0) {
        dynamicSection2 = definitions.map(d => d.Subcategory.trim());
 } 
    */
    
    const FULL_DISPLAY_ORDER = [...SECTION_1_ORDER, ...dynamicSection2];

    // 1. Rename & Filter
    let processedAttributes = attributes.filter(attr => {
        // Apply Renaming
        if (RENAME_MAP[attr.label]) {
            attr.label = RENAME_MAP[attr.label];
 }
        
        // Attach Definition Data
        // Try exact match first
        let def = defMap.get(attr.label);
        
        // Try fallback lookups if not found
        if (!def) {
             // 1. Try case-insensitive lookup
             for (const [key, val] of defMap.entries()) {
                 if (key.toLowerCase() === attr.label.toLowerCase()) {
                     def = val;
                     break;
 }
 }
 }
        
        if (!def) {
             // 2. Try singular/plural
             if (attr.label.endsWith('s')) {
                 def = defMap.get(attr.label.slice(0, -1));
 } else {
                 def = defMap.get(attr.label + 's');
 }
 }

        if (def) {
            if (!attr.description) attr.description = def.Criteria;
            if (attr.maxScore === undefined || attr.maxScore === null) attr.maxScore = def.Score;
 }
        
        // Filter
        if (EXCLUDE_LABELS.has(attr.label)) return false;
        return true;
 });

    // T1-specific adjustment: replace Tempo Values and Ownership with Brand Representation Ownership
    if (key === 't1') {
        // Remove old attributes
        processedAttributes = processedAttributes.filter(attr => attr.label !== 'Tempo Values' && attr.label !== 'Ownership');

        const brandLabel = 'Brand Representation Ownership';

        // Try to locate definition for Brand Representation Ownership from T1_SC_Att
        let brandDef = defMap.get(brandLabel);
        if (!brandDef) {
            for (const [k, v] of defMap.entries()) {
                const normalized = k.replace(/\s+/g, '').toLowerCase();
                if (normalized === 'brandrepresentationownership') {
                    brandDef = v;
                    break;
 }
 }
 }
        if (!brandDef && Array.isArray(definitions)) {
            brandDef = definitions.find(d => {
                const sub = String(d.Subcategory || '').toLowerCase();
                return sub.includes('brand') && sub.includes('ownership');
 }) || definitions.find(d => Number(d.ID || d.id || 0) === 16);
 }

        // Try to find an existing attribute derived from the DB column
        let brandAttr = processedAttributes.find(attr =>
            attr.label === brandLabel ||
            attr.label === 'Brand_Representation_Ownership' ||
            attr.label === 'Brand Representation Ownership'
        );

        const brandScoreKeyCandidates = ['Brand_Representation_Ownership', 'brand_representation_ownership'];
        const brandCommentKeyCandidates = [
            'comm_Brand_Representation_Ownership',
            'Comments_Brand_Representation_Ownership',
            'comment_Brand_Representation_Ownership'
        ];

        let brandScoreKey = null;
        let brandScoreVal = null;
        for (const k of brandScoreKeyCandidates) {
            if (row[k] !== undefined) {
                brandScoreKey = k;
                brandScoreVal = row[k];
                break;
 }
 }

        let brandCommentKey = null;
        let brandCommentVal = '';
        for (const k of brandCommentKeyCandidates) {
            if (row[k] !== undefined) {
                brandCommentKey = k;
                brandCommentVal = row[k];
                break;
 }
 }

        if (brandAttr) {
            brandAttr.label = brandLabel;
            if (brandDef) {
                if (!brandAttr.description) brandAttr.description = brandDef.Criteria;
                if (brandAttr.maxScore === undefined || brandAttr.maxScore === null) brandAttr.maxScore = brandDef.Score;
 }
            if (brandScoreKey) {
                brandAttr.scoreKey = brandScoreKey;
                brandAttr.score = brandScoreVal;
 }
            if (brandCommentKey) {
                brandAttr.commentKey = brandCommentKey;
                brandAttr.comment = brandCommentVal;
 }
 } else if (brandScoreKey || brandCommentKey) {
            processedAttributes.push({
                label: brandLabel,
                description: brandDef ? brandDef.Criteria : '',
                score: brandScoreVal,
                scoreKey: brandScoreKey,
                comment: brandCommentVal,
                commentKey: brandCommentKey,
                maxScore: brandDef ? brandDef.Score : undefined
 });
 }
 }

    // Deduplicate attributes with same label (prefer ones with Score)
    const uniqueAttrs = new Map();
    processedAttributes.forEach(attr => {
        const existing = uniqueAttrs.get(attr.label);
        if (!existing) {
            uniqueAttrs.set(attr.label, attr);
 } else {
            // Merge or Replace
            // If existing has no score but new one does, replace
            const existingHasScore = existing.score !== null && existing.score !== '';
            const newHasScore = attr.score !== null && attr.score !== '';
            
            if (!existingHasScore && newHasScore) {
                // Take the new one, but preserve comment if new one lacks it?
                if (!attr.comment && existing.comment) attr.comment = existing.comment;
                uniqueAttrs.set(attr.label, attr);
 } else if (existingHasScore && !newHasScore) {
                // Keep existing, but if it lacks comment and new one has it, take comment
                if (!existing.comment && attr.comment) existing.comment = attr.comment;
 } else {
                // Both have score or both lack score.
                // Prefer the one with comment?
                if (!existing.comment && attr.comment) uniqueAttrs.set(attr.label, attr);
 }
 }
 });
    processedAttributes = Array.from(uniqueAttrs.values());

    // 2. Sort by FULL_DISPLAY_ORDER (Skip for SMS and T2 PS as they are already ordered)
    if (key !== 'sms' && key !== 't2ps' && key !== 't2os' && key !== 'salesret' && key !== 'certification' && key !== 'winscert') {
        processedAttributes.sort((a, b) => {
            const idxA = FULL_DISPLAY_ORDER.indexOf(a.label);
            const idxB = FULL_DISPLAY_ORDER.indexOf(b.label);
            
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.label.localeCompare(b.label);
 });
 }

    // 3. Render in Two Groups
    const group1 = [];
    const group2 = [];

    if (key === 'sms' || key === 't2ps' || key === 't2os' || key === 'salesret' || key === 'certification' || key === 'winscert') {
        group2.push(...processedAttributes);
 } else {
        processedAttributes.forEach(attr => {
            if (SECTION_1_ORDER.includes(attr.label)) {
                group1.push(attr);
 } else if (dynamicSection2.includes(attr.label)) {
                group2.push(attr);
 } else {
                // Fallback: Group 1
                group1.push(attr);
 }
 });
 }

    const recomputeScore = () => {
      if (key === 'certification') {
        const passingCount = processedAttributes.reduce((sum, attr) => {
          const attrKey = attr.scoreKey;
          if (!attrKey) return sum;
          const inputEl = body.querySelector(`[data-editing-key="${attrKey}"]`);
          const val = inputEl ? inputEl.value : row[attrKey];
          return String(val || '').trim().toLowerCase() === 'pass' ? sum + 1 : sum;
 }, 0);
        const newScore = passingCount >= 4 ? 'Pass' : 'Fail';
        const scoreEl = metaSection.querySelector('#scoreDisplay');
        if (scoreEl) {
          scoreEl.textContent = newScore;
          scoreEl.style.color = newScore === 'Pass' ? 'var(--success-color)' : 'var(--danger-color)';
 }
        return newScore;
 }

      let zeroGateFail = false;
      let total = 0;
      processedAttributes.forEach(attr => {
        // Strict adherence to maxScore. If maxScore is not present, we can't calculate.
        if (attr.maxScore === undefined || attr.maxScore === null) return;
        
        const key = attr.scoreKey;
        if (!key) return;
        const inputEl = body.querySelector(`[data-editing-key="${key}"]`);
        const val = inputEl ? inputEl.value : row[key];
        const sval = typeof val === 'string' ? val.trim().toLowerCase() : val;
        
        // Ensure max is a number
        const max = parseFloat(attr.maxScore);
        if (isNaN(max)) return;

        // "if the score of the attribute is 0 and it is a No then the whole score should be 0"
        if (max === 0) {
          if (sval === 'no' || sval === 0 || sval === '0') zeroGateFail = true;
 } else {
          // "if Yes is the value then add the new score if No then dedyct the score from the new score"
          // Assuming "deduct from new score" means we simply don't add points.
          if (sval === 'yes') {
            total += max;
 } else {
             // Handle numeric partial scores if present, otherwise treat as 0
             const num = parseFloat(val);
             if (!isNaN(num)) {
                 // Cap at maxScore, but allow 0
                 total += Math.min(num, max);
 } else {
                 // If "No" (and not a number), add 0. 
                 // Effectively "deducting" the potential points from the total.
                 total += 0;
 }
 }
 }
 });
      const newScore = zeroGateFail ? 0 : Math.round(total);
      const scoreEl = metaSection.querySelector('#scoreDisplay');
      if (scoreEl) scoreEl.textContent = `${newScore}%`;
      return newScore;
 };

    const escapeHtml = (text) => {
      if (typeof text !== 'string') return text;
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
 };

    // Helper to generate HTML for a list of attributes
    const renderAttrList = (list) => {
        let html = '';
        list.forEach(attr => {
            const scoreText = String(attr.score == null ? '' : attr.score).trim().toLowerCase();
            const isNegativeScore = scoreText === 'no' || scoreText === 'fail' || attr.score === 0 || attr.score === '0';
            const scoreClass = isNegativeScore ? 'color:var(--danger-color);' : 'color:var(--success-color);';
            const displayScore = (attr.score === null || attr.score === '') ? '-' : attr.score;
            
            // Only render data-key if scoreKey exists
            const scoreHtml = attr.scoreKey 
                ? `<div style="font-weight:700; ${scoreClass}" data-key="${attr.scoreKey}">${displayScore}</div>`
                : `<div style="font-weight:700; color:var(--text-secondary); opacity:0.5;">-</div>`;

            let commentHtml = '';
            // For T2 OS, show comments for all attributes as requested
            // For others, respect the NO_COMMENT_LABELS exclusion list
            if (key === 't2os' || key === 'salesret' || !NO_COMMENT_LABELS.has(attr.label)) {
                // Escape comment text but allow links
                const safeComment = escapeHtml(attr.comment || '');
                if (attr.commentKey) {
                   // If comment exists, show it. If empty, show nothing (no dash).
                   if (safeComment && safeComment.trim().length > 0) {
                        const displayContent = formatLink(safeComment);
                        commentHtml = `<div style="font-size:13px; color:var(--text-primary); white-space:pre-wrap; border-top:1px solid var(--border-color); padding-top:6px; margin-top:4px;" data-key="${attr.commentKey}">${displayContent}</div>`;
 } else {
                        commentHtml = `<div style="display:none;" data-key="${attr.commentKey}"></div>`;
 }
 } else {
                   commentHtml = '';
 }
 }

            // Description / Max Score
            let descHtml = '';
            let maxScoreLabel = '';
            
            if (attr.maxScore !== undefined && attr.maxScore !== null) {
                maxScoreLabel = `<span style="font-weight:400; color:var(--text-secondary); font-size:0.9em; margin-left:8px;">(Score: ${attr.maxScore})</span>`;
 }

            if (attr.description) {
                const safeDesc = escapeHtml(attr.description);
                // Expand if there is a comment
                const isOpen = (attr.comment && String(attr.comment).trim().length > 0) ? 'open' : '';
                const summaryText = isOpen ? 'Hide Criteria' : 'Show Criteria';
                
                descHtml = `
                  <details class="criteria-details" ${isOpen} style="margin-top:8px; border-top:1px dashed var(--border-color); padding-top:8px;">
                    <summary style="cursor:pointer; font-size:12px; font-weight:600; color:var(--primary-color); user-select:none; outline:none;">
                      ${summaryText}
                    </summary>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:6px; white-space:pre-wrap; line-height:1.4;">${safeDesc}</div>
                  </details>
                `;
 }

            html += `
                <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: 8px; margin-bottom: 12px; background: var(--bg-nav-item);">
                  <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
                    <div style="font-weight:700; color:var(--text-primary); display:flex; align-items:center;">
                        ${attr.label} ${maxScoreLabel}
                    </div>
                    ${scoreHtml}
                  </div>
                  ${commentHtml}
                  ${descHtml}
                </div>
            `;
 });
        return html;
 };

    let finalHtml = `
      <style>
        details.criteria-details > summary {
          list-style: none;
 }
        details.criteria-details > summary::-webkit-details-marker {
          display: none;
 }
        details.criteria-details > summary::before {
          content: '+ ';
          display: inline-block;
          width: 12px;
          font-weight: bold;
 }
        details.criteria-details[open] > summary::before {
          content: '- ';
 }
      </style>
    `;
    
    // Header 1
    if (group1.length > 0) {
        finalHtml += `<h3>Attributes & Comments</h3>`;
        finalHtml += renderAttrList(group1);
 }

    // Header 2
    if (group2.length > 0) {
        finalHtml += `<h3>Scorecard Attributes</h3>`;
        finalHtml += renderAttrList(group2);
 }
    
    attrSection.innerHTML = finalHtml;
    body.appendChild(attrSection);

    // Dynamic toggle for Show/Hide Criteria text
    attrSection.querySelectorAll('details.criteria-details').forEach(d => {
        d.addEventListener('toggle', () => {
            const summary = d.querySelector('summary');
            if (summary) {
                summary.textContent = d.open ? 'Hide Criteria' : 'Show Criteria';
 }
 });
 });

    // --- Header with Actions (Admin Only) ---
    // Clear previous custom buttons in header, keep only the Close button (which we can re-inject or assume is there)
    // Actually, we modified HTML to have #modalControls. Let's use that.
    const headerControls = document.getElementById('modalControls');
    // Clear everything except the Close button? 
    // Easier: Clear all and re-add Close button + others.
    headerControls.innerHTML = ''; 

    if (isAdmin) {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'global-btn';
      // Remove background override to match default global-btn gradient (like Close)
      // editBtn.style.background = 'var(--primary-color)'; 
      // editBtn.style.color = 'white';

      const saveBtn = document.createElement('button');
      saveBtn.textContent = 'Save';
      saveBtn.className = 'global-btn';
      saveBtn.style.background = 'var(--success-color)';
      saveBtn.style.color = 'white';
      saveBtn.style.display = 'none';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.className = 'global-btn';
      // Use a neutral gray for Cancel to ensure readability in all modes
      cancelBtn.style.background = '#6c757d'; 
      cancelBtn.style.color = 'white';
      cancelBtn.style.display = 'none';

      // Edit Action
      editBtn.addEventListener('click', async () => {
        isEditing = true;
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';

        // Fetch options if needed (cached internally)
        const intRltdToOpts = await fetchInteractionRelatedTo();
        
        let smeOpts = [];
        if (key === 't1') {
            smeOpts = await fetchSmeUsers();
 }

        const DROPDOWN_CONFIG = {
            'customer_retained': ['Yes', 'No', 'N/A'],
            'queue': ['Order Support', 'Sales'],
            'channel': ['Chat', 'Email', 'Phone'],
            'ticket_status': ['Open', 'Snoozed', 'Done'],
            'status': ['Open', 'Snoozed', 'Done'],
            'monitoring_type': ['SBS', 'Remote', 'Selected'],
            'interaction_related_to': intRltdToOpts,
            'fitness_fluency': ['Yes', 'No'],
            'sme_answer': ['Yes', 'No', 'N/A'],
            'sme_following_process': ['Yes', 'No', 'N/A'],
            'sales': ['Yes', 'No'],
            'phase': ['Certification', 'OJT']
 };
        
        if (key === 't1') {
            DROPDOWN_CONFIG['sme_name'] = smeOpts;
 }

        const editableElements = body.querySelectorAll('[data-key]');
        editableElements.forEach(el => {
          const key = el.getAttribute('data-key');
          const currentVal = row[key] !== undefined ? row[key] : el.innerText; // Use row value for accuracy
          
          if (el.style.display === 'none') {
             el.style.display = 'block';
 }

          // Determine input type
          const lowerKey = key.toLowerCase();
          const TEXT_KEYS = new Set([
             'monitoring_level',
             'sme_name',
             'agent_acknowledge', 'appealed'
          ]);
          
          // For T1, remove sme_name from TEXT_KEYS so it becomes a dropdown
          // We check the table key 't1' passed to openAuditModal
          // But wait, key here is the column key. The table key is in the closure variable 'key' (renamed to tableKey for clarity? No, the arg is 'key')
          // The arg to openAuditModal is (row, def, key). So 'key' is 't1', 'sms', etc.
          // The loop variable is also 'key' (shadowing). This is a bug in my previous mental model or the code.
          // Let's check:
          // editableElements.forEach(el => { const key = el.getAttribute('data-key'); ... })
          // Yes, 'key' is shadowed!
          // Access the outer 'key' as... wait, I can't access it if it's shadowed.
          // BUT, I can check def.name or def.label.
          // def.name for T1 is 'T1_QA_New_Scorecards'.
          
          if (def.name === 'T1_QA_New_Scorecards' && (lowerKey === 'sme_name' || lowerKey === 'sme name')) {
              TEXT_KEYS.delete('sme_name');
              TEXT_KEYS.delete('SME Name');
 }

          if (el.innerText.length > 50 || lowerKey.includes('comment')) {
            const textarea = document.createElement('textarea');
            textarea.value = currentVal || '';
            textarea.style.width = '100%';
            textarea.style.minHeight = '80px';
            textarea.style.background = 'var(--bg-primary)';
            textarea.style.color = 'var(--text-primary)';
            textarea.style.border = '1px solid var(--border-color)';
            textarea.style.borderRadius = '6px';
            textarea.style.padding = '8px';
            textarea.setAttribute('data-editing-key', key);
            el.innerHTML = '';
            el.appendChild(textarea);
 } else if (TEXT_KEYS.has(key) || TEXT_KEYS.has(lowerKey)) {
            // Revert to text input for Ticket Details
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentVal || '';
            input.style.width = '100%';
            input.style.background = 'var(--bg-primary)';
            input.style.color = 'var(--text-primary)';
            input.style.border = '1px solid var(--border-color)';
            input.style.borderRadius = '6px';
            input.style.padding = '6px';
            input.setAttribute('data-editing-key', key);
            el.innerHTML = '';
            el.appendChild(input);
            input.addEventListener('input', recomputeScore); // In case it affects score (unlikely but safe)
            input.addEventListener('change', recomputeScore);
 } else {
            const select = document.createElement('select');
            select.style.width = '100%';
            
            // Constrain width for Interaction Related To
            if (lowerKey === 'interaction_related_to') {
                select.style.maxWidth = '180px'; 
 }

            select.style.background = 'var(--bg-primary)';
            select.style.color = 'var(--text-primary)';
            select.style.border = '1px solid var(--border-color)';
            select.style.borderRadius = '6px';
            select.style.padding = '6px';
            select.setAttribute('data-editing-key', key);

            // Determine Options
            let options = ['Yes', 'No']; // Default

            if (def.name === 'certification_audits' && processedAttributes.some((attr) => attr.scoreKey === key)) {
              options = ['Pass', 'Fail'];
 }
            
            if (DROPDOWN_CONFIG[key]) options = DROPDOWN_CONFIG[key];
            else if (DROPDOWN_CONFIG[lowerKey]) options = DROPDOWN_CONFIG[lowerKey];
            else if (DROPDOWN_CONFIG[key.replace(/_/g, ' ')]) options = DROPDOWN_CONFIG[key.replace(/_/g, ' ')]; // Handle space vs underscore

            // Add Options
            options.forEach(opt => {
                const option = document.createElement('option');
                if (typeof opt === 'object' && opt !== null) {
                    option.value = opt.value;
                    option.textContent = opt.label;
 } else {
                    option.value = opt;
                    option.textContent = opt;
 }
                select.appendChild(option);
 });

            // Set current value
            const valStr = String(currentVal || '').trim();
            const lowerVal = valStr.toLowerCase();
            
            // Try exact match first (value)
            let matched = false;
            Array.from(select.options).forEach(opt => {
                if (opt.value === valStr) {
                    select.value = valStr;
                    matched = true;
 }
 });
            
            // Try match against text content (Label) if value match failed
            // Useful for transition from Name -> Email storage
            if (!matched) {
                 Array.from(select.options).forEach(opt => {
                    if (opt.textContent === valStr) {
                        select.value = opt.value;
                        matched = true;
 }
 });
 }

            if (!matched) {
                // Try case-insensitive match on value
                Array.from(select.options).forEach(opt => {
                    if (opt.value.toLowerCase() === lowerVal) {
                        select.value = opt.value;
                        matched = true;
 }
 });
 }
            
            if (!matched) {
                 // Try numeric logic for Yes/No if options are strictly Yes/No
                 // Only if options are simple strings 'Yes'/'No'
                 const isYesNo = options.length === 2 && options.includes('Yes') && options.includes('No');
                 if (isYesNo) {
                     const numVal = parseFloat(valStr);
                     if (!isNaN(numVal) && numVal > 0) select.value = 'Yes';
                     else if (!isNaN(numVal) && numVal === 0) select.value = 'No';
                     else select.value = 'No'; // Default fallback
 } else {
                     // For other dropdowns, select first option as default if no match
                     if (select.options.length > 0) select.selectedIndex = 0;
 }
 }

            el.innerHTML = '';
            el.appendChild(select);
            select.addEventListener('change', recomputeScore);
 }
 });
 });

      // Cancel Action
      cancelBtn.addEventListener('click', () => {
        openAuditModal(row, def, key); // Re-render original
 });

      // Save Action
      saveBtn.addEventListener('click', async () => {
        const inputs = body.querySelectorAll('[data-editing-key]');
        const updates = {};
        let hasChanges = false;

        const computedScore = recomputeScore();
        if (key === 'certification') {
          updates[def.scoreCol] = computedScore;
 } else if (!isNaN(computedScore)) {
          // SMS scorecard and T1/T2 PS scorecard convention is to store score as string with % (e.g. "85%")
          // Updated: T2 OS (T2_OS_NEW_2025) also requires % format as per user request
           if (def.name === 'sms_scorecard' || def.name === 'T1_QA_New_Scorecards' || def.name === 't2_ps_scorecards' || def.name === 'T2_OS_NEW_2025' || def.name === 'MX_Social_Media_Scorecard' || def.name === 'sales_ret_audits' || def.name === 'wins_scorecard_submissions') {
             updates[def.scoreCol] = `${computedScore}%`;
 } else {
            updates[def.scoreCol] = computedScore;
 }
 }

        inputs.forEach(input => {
          const key = input.getAttribute('data-editing-key');
          const val = input.value;
          // Loose equality check to avoid string/number mismatch false positives
          if (String(row[key]) != String(val)) {
            updates[key] = val;
            hasChanges = true;
 }
 });

        if (!hasChanges) {
          showToast('No changes detected', 'warning');
          isEditing = false;
          openAuditModal(row, def);
          return;
 }

        try {
            // Save to Database
            const url = `${config.restUrl}/${def.name}?id=eq.${row.id}`;
            const res = await fetch(url, {
              method: 'PATCH',
              headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
 },
              body: JSON.stringify(updates)
 });

            if (!res.ok) throw new Error(await res.text());

            // 3. Success
            showToast('Record updated successfully', 'success');
            
            // Update local state
            const updatedRow = { ...row, ...updates };
            // Find correct table key
            const tableKey = Object.keys(TABLES).find(k => TABLES[k].name === def.name);
            if (tableKey && state.data[tableKey]) {
                const dataIndex = state.data[tableKey].findIndex(r => r.id === row.id);
                if (dataIndex !== -1) {
                  state.data[tableKey][dataIndex] = updatedRow;
                  renderTable(tableKey, state.data[tableKey], def);
                  updateStats(tableKey, state.data[tableKey], def.scoreCol);
 }
 }

            openAuditModal(updatedRow, def, key); // Re-render with new data

 } catch (e) {
            console.error('Update failed', e);
            showToast('Failed to update record: ' + e.message, 'error');
 }
 });

      headerControls.appendChild(editBtn);
      headerControls.appendChild(saveBtn);
      headerControls.appendChild(cancelBtn);
 }

    // Always append Close button at the end
    const closeBtn = document.createElement('button');
    closeBtn.className = 'global-btn';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => {
        document.getElementById('auditModal').style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
 };

    // Toggle Descriptions Button
    const toggleDescBtn = document.createElement('button');
    toggleDescBtn.className = 'global-btn';
    toggleDescBtn.textContent = 'Expand All Criteria';
    // Style similar to Close but maybe slightly different? User said "follow it's style"
    // So just global-btn is fine.
    
    toggleDescBtn.onclick = () => {
        const details = body.querySelectorAll('details.criteria-details');
        // Check current state: if any are closed, we expand all. If all open, we collapse all.
        // Actually simpler: toggle based on button text or just toggle all to opposite of majority?
        // Let's go with: Toggle state based on button text.
        const isExpand = toggleDescBtn.textContent.includes('Expand');
        
        details.forEach(d => {
            if (isExpand) d.setAttribute('open', '');
            else d.removeAttribute('open');
 });
        
        toggleDescBtn.textContent = isExpand ? 'Collapse All Criteria' : 'Expand All Criteria';
 };
    
    headerControls.appendChild(toggleDescBtn);
    headerControls.appendChild(closeBtn);

    modal.style.display = 'flex';
 }

  // --- 5. Range Picker Logic (Simplified from mx-t1-scorecard.js) ---
  function initRangePicker() {
    const now = new Date();
    let leftDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let rightDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    let tempStart = null;
    let tempEnd = null;

    const modal = document.getElementById('rangePickerModal');
    const openBtn = document.getElementById('openRangePickerBtn');
    const display = document.getElementById('dateRangeDisplay');
    const applyBtn = document.getElementById('applyDateBtn');
    
    // Default MTD range on page load
    const pad2 = (n) => String(n).padStart(2, '0');
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startStr = `${firstOfMonth.getFullYear()}-${pad2(firstOfMonth.getMonth()+1)}-${pad2(firstOfMonth.getDate())}`;
    const endStr = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
    tempStart = startStr;
    tempEnd = endStr;
    display.textContent = `${startStr} to ${endStr}`;
    state.startISO = `${startStr}T00:00:00Z`;
    state.endISO = `${endStr}T23:59:59Z`;
    // Auto-load analytics for MTD
    fetchAnalytics();
    
    const render = () => {
      renderCalendar('Left', leftDate);
      renderCalendar('Right', rightDate);
 };

    const renderCalendar = (side, date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      
      const mSel = document.getElementById(`rpMonth${side}`);
      const ySel = document.getElementById(`rpYear${side}`);
      
      mSel.innerHTML = '';
      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = m; if(i===month) opt.selected=true;
        mSel.appendChild(opt);
 });
      
      ySel.innerHTML = '';
      for(let y=2023; y<=2030; y++){
        const opt = document.createElement('option');
        opt.value = y; opt.textContent = y; if(y===year) opt.selected=true;
        ySel.appendChild(opt);
 }

      // Grid
      const grid = document.getElementById(`rpDays${side}`);
      grid.innerHTML = '';
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month+1, 0).getDate();
      
      // Empty slots
      for(let i=0; i<firstDay; i++) {
        grid.appendChild(document.createElement('div'));
 }
      
      for(let d=1; d<=daysInMonth; d++) {
        const el = document.createElement('div');
        el.className = 'rp-day';
        el.textContent = d;
        const currentIso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
        // Selection styling
        if (tempStart && tempStart === currentIso) el.classList.add('rp-day-selected', 'rp-selected-start');
        if (tempEnd && tempEnd === currentIso) el.classList.add('rp-day-selected', 'rp-selected-end');
        if (tempStart && tempEnd && currentIso > tempStart && currentIso < tempEnd) el.classList.add('rp-day-inrange');

        el.addEventListener('click', () => {
          if (!tempStart || (tempStart && tempEnd)) {
            tempStart = currentIso;
            tempEnd = null;
 } else {
            if (currentIso < tempStart) {
              tempEnd = tempStart;
              tempStart = currentIso;
 } else {
              tempEnd = currentIso;
 }
 }
          render();
 });
        grid.appendChild(el);
 }
 };

    // Event Listeners
    openBtn.parentElement.addEventListener('click', () => {
        modal.style.display = 'flex';
        render();
 });

    document.getElementById('rpCancel').addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('rpDone').addEventListener('click', () => {
      if (tempStart && tempEnd) {
        state.startISO = tempStart + 'T00:00:00Z';
        state.endISO = tempEnd + 'T23:59:59Z';
        display.textContent = `${tempStart} to ${tempEnd}`;
        modal.style.display = 'none';
        // Auto fetch?
 } else {
        alert('Please select both start and end dates.');
 }
 });
    
    applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fetchAnalytics();
 });

    // Navigation
    document.getElementById('rpPrev').addEventListener('click', () => {
      leftDate.setMonth(leftDate.getMonth()-1);
      rightDate.setMonth(rightDate.getMonth()-1);
      render();
 });
    document.getElementById('rpNext').addEventListener('click', () => {
      leftDate.setMonth(leftDate.getMonth()+1);
      rightDate.setMonth(rightDate.getMonth()+1);
      render();
 });

    render();
 }

  // Init
  loadDatabaseConfig();

})();
