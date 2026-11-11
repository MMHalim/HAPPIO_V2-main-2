// Admin Settings Page Logic
const AdminSettings = (function() {
    const config = {
        supabaseUrl: null,
        restUrl: null,
        apiKey: null,
        serviceKey: null,
 };

    // State to hold original data for discard functionality
    const state = {
        t1: [],
        wins: [],
        t2os: [],
        t2ps: [],
        t2osnew: [],
        sms: [],
        social: [],
        smeList: [],
        intRel: [],
        calibration: []
 };

    // Modified data (tracking changes)
    const modifiedState = {
        t1: [],
        wins: [],
        t2os: [],
        t2ps: [],
        t2osnew: [],
        sms: [],
        social: [],
        smeList: [],
        intRel: []
 };

    const SME_LIST_CONFIG = {
        tableName: 'sme_list',
        idField: 'id',
        nameField: 'name',
        sortField: 'sort_order',
        activeField: 'is_active'
 };
    let smeUserOptions = [];

    const etlLogsUi = {
        page: 1,
        pageSize: 25,
        total: 0
 };
    const ETL_GITHUB_REPO = 'MMHalim/HAPPIO_V2-main-2';
    const ETL_LEGACY_REPOS = new Set(['MMHalim/HAPPIO_V2']);

    function loadConfig() {
        return fetch('database_config.json')
            .then(r => r.json())
            .then(json => {
                config.supabaseUrl = json.supabase.url;
                config.restUrl = json.supabase.rest_url;
                config.apiKey = json.supabase.client_api_key;
                config.serviceKey = json.supabase.service_key || null;
 })
            .catch(e => console.error('Failed to load config', e));
 }

    function authHeaders(opts = {}) {
        const { useServiceKey = false } = opts;
        const token = localStorage.getItem('login_token') || '';
        const useBearer = (useServiceKey && config.serviceKey)
            ? config.serviceKey
            : ((token && token.length > 20) ? token : (config.apiKey || ''));
        const apiHeader = (useServiceKey && config.serviceKey) ? config.serviceKey : (config.apiKey || '');
        
        return {
            'apikey': apiHeader,
            'Authorization': `Bearer ${useBearer}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
 };
 }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeftColor = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
            <div class="toast-close" onclick="this.parentElement.remove()">✕</div>
        `;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
 }, 3000);
 }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
 }

    // --- Tab Management ---
    function initTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Deactivate all
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Activate clicked
                tab.classList.add('active');
                const contentId = tab.getAttribute('data-tab');
                document.getElementById(contentId).classList.add('active');
                
                // Update URL hash
                window.location.hash = contentId;

                // Load content
                loadTabContent(contentId);
 });
 });

        // Load initial tab from hash or default 

        const hash = window.location.hash.substring(1);
        let initialTab = null;
        
        if (hash) {
            initialTab = document.querySelector(`.tab-btn[data-tab="${hash}"]`);
 }
        
        if (!initialTab) {
            initialTab = document.querySelector('.tab-btn.active');
 }

        if (initialTab) {
            // If the hash tab is different from what might be active by default in HTML
            // triggering click ensures the UI is consistent
            initialTab.click();
 }
 }

    function loadTabContent(tabId) {
        switch(tabId) {
            case 't1': fetchAttributes('T1_SC_Att', 't1'); break;
            case 'wins': fetchAttributes('winsAttributes', 'wins'); break;
            case 't2os': fetchAttributes('New_SC_Attributes', 't2os'); break;
            case 't2ps': fetchAttributes('ps_attributes', 't2ps'); break;
            case 't2osnew': fetchAttributes('sales_ret_att', 't2osnew'); break;
            case 'sms': fetchAttributes('sms_Attributes', 'sms'); break;
            case 'social': fetchAttributes('social_attributes', 'social'); break;
            case 'smeList': fetchSmeList(); break;
            case 'intRel': fetchIntRel(); break;
            case 'calibration': fetchCalibration(); break;
            case 'etlLogs': fetchEtlLogs(); break;
 }
 }

    // --- ETL Logs Logic ---
    const etlLiveState = {
        intervalId: null,
        sinceIso: null,
        seenKeys: new Set(),
        isRunning: false
 };

    function openEtlRunModal() {
        const overlay = document.getElementById('etl-run-modal');
        const consoleEl = document.getElementById('etl-run-console');
        const subtitleEl = document.getElementById('etl-run-subtitle');
        if (!overlay || !consoleEl || !subtitleEl) return;
        consoleEl.textContent = '';
        subtitleEl.textContent = 'Starting...';
        overlay.classList.add('active');
 }

    function closeEtlRunModal() {
        stopEtlLiveLogs();
        const overlay = document.getElementById('etl-run-modal');
        if (overlay) overlay.classList.remove('active');
 }

    function setEtlRunSubtitle(text) {
        const subtitleEl = document.getElementById('etl-run-subtitle');
        if (subtitleEl) subtitleEl.textContent = text;
 }

    function appendEtlRunLine(text) {
        const consoleEl = document.getElementById('etl-run-console');
        if (!consoleEl) return;
        const next = `${consoleEl.textContent}${consoleEl.textContent ? '\n' : ''}${text}`;
        const maxChars = 120000;
        consoleEl.textContent = next.length > maxChars ? next.slice(next.length - maxChars) : next;
        consoleEl.scrollTop = consoleEl.scrollHeight;
 }

    function stopEtlLiveLogs() {
        if (etlLiveState.intervalId) {
            clearInterval(etlLiveState.intervalId);
            etlLiveState.intervalId = null;
 }
        etlLiveState.isRunning = false;
        setEtlRunSubtitle('Stopped.');
 }

    function buildRestUrl(path, params) {
        const url = new URL(`${config.restUrl}/${path}`);
        Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
        return url.toString();
 }

    async function pollEtlLogsOnce() {
        if (!etlLiveState.sinceIso) return;
        const url = buildRestUrl('etl_logs', {
            select: '*',
            created_at: `gte.${etlLiveState.sinceIso}`,
            order: 'created_at.asc'
 });

        const res = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Failed to read logs: ${res.status} ${text || res.statusText}`);
 }
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        items.forEach(item => {
            const key = item.id != null ? `id:${item.id}` : `k:${item.created_at}|${item.event_name}|${item.status}|${item.rows_processed}|${item.message}`;
            if (etlLiveState.seenKeys.has(key)) return;
            etlLiveState.seenKeys.add(key);
            const ts = item.created_at ? new Date(item.created_at).toLocaleString() : '';
            const eventName = item.event_name || '-';
            const status = item.status || '-';
            const rows = item.rows_processed != null ? item.rows_processed : '-';
            const msg = (item.message || '-').toString();
            appendEtlRunLine(`[${ts}] ${eventName} | ${status} | rows=${rows} | ${msg}`);
 });
 }

    function getCairoParts(date) {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Africa/Cairo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
 });
        const parts = formatter.formatToParts(date);
        const map = {};
        parts.forEach(p => {
            if (p.type !== 'literal') map[p.type] = p.value;
 });
        return {
            year: parseInt(map.year, 10),
            month: parseInt(map.month, 10),
            day: parseInt(map.day, 10),
            hour: parseInt(map.hour, 10),
            minute: parseInt(map.minute, 10)
 };
 }

    function formatDatetimeLocalFromUtcDate(date) {
        const pad2 = (n) => String(n).padStart(2, '0');
        return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}T${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
 }

    function getDefaultCairoRangeValues() {
        const p = getCairoParts(new Date());
        const cairoWall = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0));
        const currentHourStart = new Date(cairoWall.getTime());
        currentHourStart.setUTCMinutes(0, 0, 0);
        const from = new Date(currentHourStart.getTime() - 60 * 60 * 1000);
        const to = new Date(currentHourStart.getTime() - 1);
        return { fromValue: formatDatetimeLocalFromUtcDate(from), toValue: formatDatetimeLocalFromUtcDate(to) };
 }

    function runEtlNow() {
        openEtlRunModal();
        const savedToken = localStorage.getItem('github_actions_pat');
        const savedRepo = localStorage.getItem('github_repo');
        const savedBranch = localStorage.getItem('github_branch');
        const savedFromCairo = localStorage.getItem('github_from_cairo');
        const savedToCairo = localStorage.getItem('github_to_cairo');
        
        if (savedToken) {
            const tokenInput = document.getElementById('gh-token');
            if (tokenInput) tokenInput.value = savedToken;
 }
        if (savedRepo) {
            const repoInput = document.getElementById('gh-repo');
            const normalizedRepo = ETL_LEGACY_REPOS.has(savedRepo) ? ETL_GITHUB_REPO : savedRepo;
            if (repoInput) repoInput.value = normalizedRepo;
            if (normalizedRepo !== savedRepo) localStorage.setItem('github_repo', normalizedRepo);
 }
        if (savedBranch) {
            const branchInput = document.getElementById('gh-branch');
            if (branchInput) branchInput.value = savedBranch;
 }

        const fromInput = document.getElementById('gh-from-cairo');
        const toInput = document.getElementById('gh-to-cairo');
        const defaults = getDefaultCairoRangeValues();
        if (fromInput) fromInput.value = savedFromCairo || defaults.fromValue;
        if (toInput) toInput.value = savedToCairo || defaults.toValue;
        
        setEtlRunSubtitle('Configure & Run');
        const consoleEl = document.getElementById('etl-run-console');
        if (consoleEl) consoleEl.textContent = '';
 }

    async function triggerEtlAction() {
        const tokenInput = document.getElementById('gh-token');
        const repoInput = document.getElementById('gh-repo');
        const branchInput = document.getElementById('gh-branch');
        const fromInput = document.getElementById('gh-from-cairo');
        const toInput = document.getElementById('gh-to-cairo');
        
        const token = tokenInput ? tokenInput.value.trim() : '';
        const rawRepoStr = repoInput ? repoInput.value.trim() : '';
        const repoStr = ETL_LEGACY_REPOS.has(rawRepoStr) ? ETL_GITHUB_REPO : rawRepoStr;
        const branch = branchInput ? branchInput.value.trim() : 'main';
        const fromCairo = fromInput ? fromInput.value.trim() : '';
        const toCairo = toInput ? toInput.value.trim() : '';
        
        if (!token) {
            showToast('GitHub Token is required', 'error');
            return;
 }
        if (!repoStr || !repoStr.includes('/')) {
            showToast('Invalid Repo format (Owner/Repo)', 'error');
            return;
 }
        if (!fromCairo || !toCairo) {
            showToast('From/To is required (Egypt/Cairo)', 'error');
            return;
 }
        if (fromCairo > toCairo) {
            showToast('From must be before To', 'error');
            return;
 }

        localStorage.setItem('github_actions_pat', token);
        localStorage.setItem('github_repo', repoStr);
        localStorage.setItem('github_branch', branch);
        localStorage.setItem('github_from_cairo', fromCairo);
        localStorage.setItem('github_to_cairo', toCairo);
        if (repoInput) repoInput.value = repoStr;

        const [owner, repo] = repoStr.split('/');
        const workflowFile = 'freshchat_etl.yml';
        
        // Reset state
        etlLiveState.seenKeys = new Set();
        etlLiveState.sinceIso = new Date(Date.now() - 10000).toISOString(); // 10s buffer
        etlLiveState.isRunning = true;
        
        appendEtlRunLine(`[${new Date().toLocaleString()}] Starting workflow trigger...`);
        appendEtlRunLine(`[${new Date().toLocaleString()}] Cairo range: ${fromCairo} to ${toCairo}`);
        setEtlRunSubtitle('Triggering workflow...');
        
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;
            const payload = {
                ref: branch,
                inputs: {
                    from_cairo: fromCairo,
                    to_cairo: toCairo
 }
 };
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${token}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json'
 },
                body: JSON.stringify(payload)
 });

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(`GitHub dispatch failed: ${res.status} ${text || res.statusText}`);
 }
            
            appendEtlRunLine(`[${new Date().toLocaleString()}] Workflow dispatched successfully!`);
            showToast('Workflow triggered', 'success');
            setEtlRunSubtitle('Watching logs (it may take a moment to start)...');
            
            // Start polling
            if (etlLiveState.intervalId) clearInterval(etlLiveState.intervalId);
            
            // Poll immediately once
            try { await pollEtlLogsOnce(); } catch(e) {}
            
            etlLiveState.intervalId = setInterval(async () => {
                if (!etlLiveState.isRunning) return;
                try {
                    await pollEtlLogsOnce();
 } catch (e) {
                    // Ignore transient network errors during polling
 }
 }, 5000);
            
 } catch (e) {
            appendEtlRunLine(`[${new Date().toLocaleString()}] ERROR: ${e.message}`);
            showToast(e.message, 'error');
            setEtlRunSubtitle('Failed.');
            etlLiveState.isRunning = false;
 }
 }

    async function fetchEtlLogs() {
        const container = document.getElementById('etlLogsTableContainer');
        if (!container) return;
        container.innerHTML = 'Loading...';

        try {
            const pageSize = etlLogsUi.pageSize;
            const offset = (etlLogsUi.page - 1) * pageSize;
            const headers = { ...authHeaders({ useServiceKey: true }), Prefer: 'count=exact' };
            const url = `${config.restUrl}/etl_logs?select=*&order=created_at.desc&limit=${pageSize}&offset=${offset}`;

            const res = await fetch(url, { headers });

            if (!res.ok) throw new Error(`Failed to fetch ETL logs: ${res.status} ${res.statusText}`);

            const contentRange = res.headers.get('content-range') || res.headers.get('Content-Range') || '';
            const total = parseContentRangeTotal(contentRange);
            etlLogsUi.total = total;
            const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
            if (etlLogsUi.page > totalPages) {
                etlLogsUi.page = totalPages;
                await fetchEtlLogs();
                return;
 }

            const data = await res.json();
            await fetchEtlSyncTime();
            renderEtlLogs(data);
 } catch (error) {
            console.error(error);
            container.innerHTML = `<div style="color:red">Error loading logs: ${error.message}</div>`;
 }
 }

    function parseContentRangeTotal(contentRange) {
        if (!contentRange) return 0;
        const parts = contentRange.split('/');
        if (parts.length !== 2) return 0;
        const total = Number(parts[1]);
        return Number.isFinite(total) ? total : 0;
 }

    async function fetchEtlSyncTime() {
        const alertEl = document.getElementById('etlSyncAlert');
        if (!alertEl) return;
        try {
            const res = await fetch(`${config.restUrl}/etl_logs?select=id,created_at&order=id.desc&limit=1`, {
                headers: authHeaders({ useServiceKey: true })
 });
            if (!res.ok) throw new Error('Failed to fetch sync time');
            const rows = await res.json();
            const row = Array.isArray(rows) ? rows[0] : null;
            if (!row || !row.created_at) {
                alertEl.style.display = 'none';
                return;
 }

            const createdAt = new Date(row.created_at);
            createdAt.setMinutes(0, 0, 0);
            const now = new Date();
            const isToday = createdAt.getDate() === now.getDate() &&
                createdAt.getMonth() === now.getMonth() &&
                createdAt.getFullYear() === now.getFullYear();

            const timeStr = createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            const dayStr = isToday ? 'Today' : createdAt.toLocaleDateString();

            alertEl.innerHTML = `Data Sync till ${dayStr} ${timeStr}`;
            alertEl.style.display = 'block';
 } catch (e) {
            alertEl.style.display = 'none';
 }
 }

    function setEtlLogsPageSize(value) {
        const size = Number(value);
        if (![25, 50].includes(size)) return;
        etlLogsUi.pageSize = size;
        etlLogsUi.page = 1;
        fetchEtlLogs();
 }

    function setEtlLogsPage(value) {
        const next = Number(value);
        if (!Number.isFinite(next)) return;
        const totalPages = etlLogsUi.total > 0 ? Math.ceil(etlLogsUi.total / etlLogsUi.pageSize) : 1;
        etlLogsUi.page = Math.max(1, Math.min(totalPages, next));
        fetchEtlLogs();
 }

    function renderEtlLogs(data) {
        const container = document.getElementById('etlLogsTableContainer');
        if (!container) return;
        
        const totalPages = etlLogsUi.total > 0 ? Math.ceil(etlLogsUi.total / etlLogsUi.pageSize) : 1;
        const start = etlLogsUi.total > 0 ? ((etlLogsUi.page - 1) * etlLogsUi.pageSize + 1) : 0;
        const end = etlLogsUi.total > 0 ? Math.min((etlLogsUi.page - 1) * etlLogsUi.pageSize + (data?.length || 0), etlLogsUi.total) : 0;

        const isEmpty = !data || data.length === 0;
        let html = `
            <div class="etl-logs-controls">
                <div class="etl-logs-left">
                    <span style="color: var(--text-secondary); font-size: 13px; font-weight: 600;">Rows</span>
                    <select class="etl-logs-page-size" onchange="AdminSettings.setEtlLogsPageSize(this.value)">
                        <option value="25" ${etlLogsUi.pageSize === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${etlLogsUi.pageSize === 50 ? 'selected' : ''}>50</option>
                    </select>
                </div>
                <div class="etl-logs-right">
                    <span class="etl-logs-meta">${etlLogsUi.total > 0 ? `Showing ${start}-${end} of ${etlLogsUi.total}` : 'No records'}</span>
                    <button class="global-btn btn-secondary btn-slim" onclick="AdminSettings.setEtlLogsPage(1)" ${etlLogsUi.page <= 1 ? 'disabled' : ''}>First</button>
                    <button class="global-btn btn-secondary btn-slim" onclick="AdminSettings.setEtlLogsPage(${etlLogsUi.page - 1})" ${etlLogsUi.page <= 1 ? 'disabled' : ''}>Prev</button>
                    <span class="etl-logs-meta">Page ${etlLogsUi.page} / ${totalPages}</span>
                    <button class="global-btn btn-secondary btn-slim" onclick="AdminSettings.setEtlLogsPage(${etlLogsUi.page + 1})" ${etlLogsUi.page >= totalPages ? 'disabled' : ''}>Next</button>
                    <button class="global-btn btn-secondary btn-slim" onclick="AdminSettings.setEtlLogsPage(${totalPages})" ${etlLogsUi.page >= totalPages ? 'disabled' : ''}>Last</button>
                </div>
            </div>
        `;

        if (isEmpty) {
            container.innerHTML = `${html}<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No logs found.</div>`;
            return;
 }

        html += `<div class="etl-logs-table-wrap"><table class="settings-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Created At</th>
                    <th>Event Name</th>
                    <th>Status</th>
                    <th>Rows Processed</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>`;

        data.forEach(item => {
            const s = (item.status || '').toLowerCase();
            // Success: Green, Error/Failed: Red, Others: Amber
            const statusColor = s === 'success' ? '#10b981' : (s === 'error' || s === 'failed' ? '#ef4444' : '#f59e0b');
            html += `
                <tr>
                    <td>${item.id}</td>
                    <td>${new Date(item.created_at).toLocaleString()}</td>
                    <td>${item.event_name || '-'}</td>
                    <td><span style="color: ${statusColor}; font-weight: bold;">${item.status || '-'}</span></td>
                    <td>${item.rows_processed !== null ? item.rows_processed : '-'}</td>
                    <td style="max-width: 400px; overflow-wrap: break-word;">${item.message || '-'}</td>
                </tr>
            `;
 });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
 }

    // --- Attributes Logic ---
    function getAttributesConfig(tabKey) {
        const map = {
            t1: { tableName: 'T1_SC_Att', idField: 'ID', categoryField: 'Subcategory', criteriaField: 'Criteria', scoreField: 'Score', categoryLabel: 'Subcategory', criteriaLabel: 'Criteria', omitIdOnInsert: true, scoreInputType: 'number' },
            wins: { tableName: 'winsAttributes', idField: 'id', categoryField: 'category', criteriaField: 'criteria', scoreField: 'score', categoryLabel: 'Category', criteriaLabel: 'Criteria', omitIdOnInsert: true, scoreInputType: 'number' },
            t2os: { tableName: 'New_SC_Attributes', idField: 'ID', categoryField: 'Subcategory', criteriaField: 'Criteria', scoreField: 'Score', categoryLabel: 'Subcategory', criteriaLabel: 'Criteria', omitIdOnInsert: true, scoreInputType: 'number' },
            t2ps: { tableName: 'ps_attributes', idField: 'ID', categoryField: 'Subcategory', criteriaField: 'Criteria', scoreField: 'Score', categoryLabel: 'Subcategory', criteriaLabel: 'Criteria', omitIdOnInsert: true, scoreInputType: 'number' },
            t2osnew: { tableName: 'sales_ret_att', idField: 'id', categoryField: 'subcategory', criteriaField: 'criteria', scoreField: 'score', categoryLabel: 'Subcategory', criteriaLabel: 'Criteria', omitIdOnInsert: true, scoreInputType: 'text' },
            sms: { tableName: 'sms_Attributes', idField: 'ID', categoryField: 'Subcategory', criteriaField: 'Criteria', scoreField: 'Score', categoryLabel: 'Subcategory', criteriaLabel: 'Criteria', omitIdOnInsert: true, scoreInputType: 'number' },
            social: { tableName: 'social_attributes', idField: 'id', categoryField: 'category', criteriaField: 'subCategory', scoreField: 'score', categoryLabel: 'Category', criteriaLabel: 'Description', omitIdOnInsert: false, scoreInputType: 'number' }
 };
        return map[tabKey] || null;
 }

    async function fetchAttributes(tableName, tabKey) {
        const container = document.getElementById(`${tabKey}TableContainer`);
        container.innerHTML = 'Loading...';

        try {
            const tabCfg = getAttributesConfig(tabKey);
            const orderCol = tabCfg ? tabCfg.idField : 'ID';
            const res = await fetch(`${config.restUrl}/${tableName}?select=*&order=${encodeURIComponent(orderCol)}.asc`, {
                headers: authHeaders({ useServiceKey: true })
 });
            
            if (!res.ok) throw new Error(`Failed to fetch ${tableName}: ${res.status} ${res.statusText}`);
            
            const data = await res.json();
            state[tabKey] = JSON.parse(JSON.stringify(data)); // Deep copy
            modifiedState[tabKey] = JSON.parse(JSON.stringify(data));
            
            renderAttributesTable(tabKey);
 } catch (error) {
            console.error(error);
            container.innerHTML = `<div style="color:red">Error loading data: ${error.message}</div>`;
            showToast(`Failed to load ${tabKey} attributes`, 'error');
 }
 }

    function renderAttributesTable(tabKey) {
        const container = document.getElementById(`${tabKey}TableContainer`);
        const data = modifiedState[tabKey];
        const tabCfg = getAttributesConfig(tabKey);
        if (!tabCfg) {
            container.innerHTML = `<div style="color:red">Unsupported tab: ${tabKey}</div>`;
            return;
 }
        
        const safeData = Array.isArray(data) ? data : [];

        let html = `<table class="settings-table">
            <thead>
                <tr>
                    <th style="width: 50px">ID</th>
                    <th>${tabCfg.categoryLabel}</th>
                    <th>${tabCfg.criteriaLabel}</th>
                    <th style="width: 80px">Score</th>
                    <th style="width: 100px">Actions</th>
                </tr>
            </thead>
            <tbody>`;
        
        safeData.forEach((item, index) => {
            const rawCategory = item[tabCfg.categoryField];
            const rawCriteria = item[tabCfg.criteriaField];
            const rawScore = item[tabCfg.scoreField];
            const idVal = item[tabCfg.idField];
            html += `
                <tr>
                    <td>${idVal != null ? idVal : ''}</td>
                    <td><input type="text" value="${rawCategory || ''}" onchange="AdminSettings.updateAttribute('${tabKey}', ${index}, '${tabCfg.categoryField}', this.value)"></td>
                    <td><textarea rows="2" style="width:100%" onchange="AdminSettings.updateAttribute('${tabKey}', ${index}, '${tabCfg.criteriaField}', this.value)">${rawCriteria || ''}</textarea></td>
                    <td><input type="${tabCfg.scoreInputType || 'number'}" value="${rawScore != null ? rawScore : 0}" style="width: 80px" onchange="AdminSettings.updateAttribute('${tabKey}', ${index}, '${tabCfg.scoreField}', this.value)"></td>
                    <td>
                        <button class="global-btn btn-secondary" style="padding: 4px 8px; font-size: 12px; background: #ef4444; color: white; border: none;" onclick="AdminSettings.deleteAttribute('${tabKey}', ${index})">Delete</button>
                    </td>
                </tr>
            `;
 });
        
        html += `</tbody></table>`;
        html += `<button class="global-btn" onclick="AdminSettings.addAttribute('${tabKey}')">+ Add Attribute</button>`;
        
        container.innerHTML = html;
 }

    function updateAttribute(tabKey, index, field, value) {
        modifiedState[tabKey][index][field] = value;
 }

    function addAttribute(tabKey) {
        const tabCfg = getAttributesConfig(tabKey);
        if (!tabCfg) return;
        const current = Array.isArray(modifiedState[tabKey]) ? modifiedState[tabKey] : [];
        const maxId = current.reduce((max, item) => {
            const v = item && item[tabCfg.idField] != null ? Number(item[tabCfg.idField]) : 0;
            return Number.isFinite(v) ? Math.max(max, v) : max;
 }, 0);
        const next = {
            [tabCfg.idField]: maxId + 1,
            [tabCfg.categoryField]: '',
            [tabCfg.criteriaField]: '',
            [tabCfg.scoreField]: 0
 };
        current.push(next);
        modifiedState[tabKey] = current;
        renderAttributesTable(tabKey);
 }

    // --- Modal Logic ---
    let pendingDelete = null; // { type: 'attribute', tabKey, index } or { type: 'intRel', id } or { type: 'calibration', id }

    function showModal(title, message, onConfirm, options = {}) {
        const modal = document.getElementById('confirmation-modal');
        const h3 = modal.querySelector('h3');
        const p = modal.querySelector('p');
        const confirmBtn = modal.querySelector('.btn-danger');
        const confirmLabel = options.confirmLabel || 'Confirm';
        const confirmClassName = options.confirmClassName || 'global-btn btn-danger';
        
        h3.textContent = title;
        p.textContent = message;
        
        // Remove old listener
        const newBtn = confirmBtn.cloneNode(true);
        newBtn.textContent = confirmLabel;
        newBtn.className = confirmClassName;
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
        
        newBtn.onclick = () => {
            onConfirm();
            closeModal();
 };
        
        modal.classList.add('active');
 }

    function closeModal() {
        document.getElementById('confirmation-modal').classList.remove('active');
 }

    // Expose close to window for Cancel button
    window.closeConfirmationModal = closeModal;

    function deleteAttribute(tabKey, index) {
        showModal(
            'Delete Attribute', 
            'Are you sure you want to delete this attribute?',
            async () => {
                try {
                    const item = modifiedState[tabKey][index];
                    if (!item) return;
                    const tabCfg = getAttributesConfig(tabKey);
                    if (!tabCfg) return;

                    // Determine if item exists in DB (is in original state)
                    // We check by ID. If it's in state[tabKey], it's persisted.
                    const idVal = item[tabCfg.idField];
                    const isPersisted = state[tabKey].some(orig => orig[tabCfg.idField] === idVal);

                    if (isPersisted) {
                        const tableName = tabCfg.tableName;
                        
                        if (tableName) {
                            const res = await fetch(`${config.restUrl}/${tableName}?${encodeURIComponent(tabCfg.idField)}=eq.${encodeURIComponent(idVal)}`, {
                                method: 'DELETE',
                                headers: authHeaders({ useServiceKey: true })
 });
                            if (!res.ok) throw new Error('Failed to delete from database');
 }
 }

                    // Update local state
                    modifiedState[tabKey].splice(index, 1);
                    
                    // Also remove from original state so saveChanges doesn't get confused
                    if (isPersisted) {
                        const stateIndex = state[tabKey].findIndex(i => i[tabCfg.idField] === idVal);
                        if (stateIndex !== -1) {
                            state[tabKey].splice(stateIndex, 1);
 }
 }

                    renderAttributesTable(tabKey);
                    showToast('Attribute deleted successfully', 'success');

 } catch (e) {
                    console.error(e);
                    showToast(e.message, 'error');
 }
 }
        );
 }
    
    function deleteIntRel(id) {
        showModal(
            'Delete Item',
            'Are you sure you want to delete this interaction type?',
            async () => {
                try {
                    const res = await fetch(`${config.restUrl}/intRltdTo?id=eq.${id}`, {
                        method: 'DELETE',
                        headers: authHeaders({ useServiceKey: true })
 });
                    if (!res.ok) throw new Error('Failed to delete');
                    showToast('Item deleted', 'success');
                    fetchIntRel();
 } catch (e) {
                    showToast(e.message, 'error');
 }
 }
        );
 }
    
    function deleteCalibration(id) {
        showModal(
            'Delete Calibration',
            'Are you sure you want to delete this calibration assignment?',
            async () => {
                try {
                    const res = await fetch(`${config.restUrl}/Assigning_Calibration?id=eq.${id}`, {
                        method: 'DELETE',
                        headers: authHeaders({ useServiceKey: true })
 });
                    if (!res.ok) throw new Error('Failed to delete');
                    showToast('Deleted successfully', 'success');
                    fetchCalibration();
 } catch (e) {
                    showToast(e.message, 'error');
 }
 }
        );
 }

    async function saveChanges(tabKey) {
        const tabCfg = getAttributesConfig(tabKey);
        if (!tabCfg) return;
        const tableName = tabCfg.tableName;

        const original = state[tabKey];
        const current = modifiedState[tabKey];
        
        try {
            const originalIds = original.map(i => i[tabCfg.idField]);
            const currentIds = current.map(i => i[tabCfg.idField]);
            
            // 1. Delete removed
            const idsToDelete = originalIds.filter(id => !currentIds.includes(id));
            if (idsToDelete.length > 0) {
                const delRes = await fetch(`${config.restUrl}/${tableName}?${encodeURIComponent(tabCfg.idField)}=in.(${idsToDelete.map(v => encodeURIComponent(v)).join(',')})`, {
                    method: 'DELETE',
                    headers: authHeaders({ useServiceKey: true })
 });
                if (!delRes.ok) {
                    const errText = await delRes.text().catch(() => '');
                    throw new Error(`Failed to delete removed items: ${delRes.status} ${errText || delRes.statusText}`);
 }
 }
            
            // 2. Update existing
            const toUpdate = current.filter(item => originalIds.includes(item[tabCfg.idField]));
            if (toUpdate.length > 0) {
                const upRes = await fetch(`${config.restUrl}/${tableName}`, {
                    method: 'POST',
                    headers: { ...authHeaders({ useServiceKey: true }), 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify(toUpdate)
 });
                if (!upRes.ok) {
                    const errText = await upRes.text().catch(() => '');
                    throw new Error(`Failed to update existing items: ${upRes.status} ${errText || upRes.statusText}`);
 }
 }

            // 3. Insert new (remove fake ID)
            const toInsert = current.filter(item => !originalIds.includes(item[tabCfg.idField]))
                .map(item => {
                    if (tabCfg.omitIdOnInsert) {
                        const { [tabCfg.idField]: _omit, ...rest } = item;
                        return rest;
 }
                    return item;
 });
                
            if (toInsert.length > 0) {
                const insRes = await fetch(`${config.restUrl}/${tableName}`, {
                    method: 'POST',
                    headers: authHeaders({ useServiceKey: true }),
                    body: JSON.stringify(toInsert)
 });
                if (!insRes.ok) {
                    const errText = await insRes.text().catch(() => '');
                    throw new Error(`Failed to insert new items: ${insRes.status} ${errText || insRes.statusText}`);
 }
 }
            
            showToast('Changes saved successfully', 'success');
            // Refresh state
            fetchAttributes(tableName, tabKey);
            
 } catch (error) {
            console.error(error);
            showToast('Error saving changes: ' + error.message, 'error');
 }
 }

    function discardChanges(tabKey) {
        showModal(
            'Discard Changes',
            'Discard unsaved changes?',
            () => {
                const tabCfg = getAttributesConfig(tabKey);
                if (!tabCfg) return;
                fetchAttributes(tabCfg.tableName, tabKey);
 },
            { confirmLabel: 'Discard', confirmClassName: 'global-btn btn-secondary' }
        );
 }

    async function fetchSmeList() {
        const container = document.getElementById('smeListTableContainer');
        if (!container) return;
        container.innerHTML = 'Loading...';

        try {
            await fetchSmeUserOptions();
            const res = await fetch(`${config.restUrl}/${SME_LIST_CONFIG.tableName}?select=*&order=${SME_LIST_CONFIG.sortField}.asc,${SME_LIST_CONFIG.idField}.asc`, {
                headers: authHeaders({ useServiceKey: true })
 });
            if (!res.ok) throw new Error(`Failed to fetch SME list: ${res.status} ${res.statusText}`);

            const data = await res.json();
            state.smeList = JSON.parse(JSON.stringify(data));
            modifiedState.smeList = JSON.parse(JSON.stringify(data));
            renderSmeListTable();
 } catch (error) {
            console.error(error);
            container.innerHTML = `<div style="color:red">Error loading SME list: ${error.message}</div>`;
            showToast('Failed to load SME list', 'error');
 }
 }

    async function fetchSmeUserOptions() {
        try {
            const res = await fetch(`${config.restUrl}/users?select=Name&order=Name.asc`, {
                headers: authHeaders({ useServiceKey: true })
 });
            if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
            const rows = await res.json();
            const unique = new Map();
            (Array.isArray(rows) ? rows : []).forEach((item) => {
                const name = String(item?.Name || '').trim();
                if (!name) return;
                unique.set(name.toLowerCase(), name);
 });
            if (!unique.has('n/a')) unique.set('n/a', 'N/A');
            smeUserOptions = Array.from(unique.values()).sort((a, b) => {
                if (a === 'N/A') return 1;
                if (b === 'N/A') return -1;
                return a.localeCompare(b);
 });
 } catch (error) {
            if (!smeUserOptions.length) smeUserOptions = ['N/A'];
 }
 }

    function renderSmeListTable() {
        const container = document.getElementById('smeListTableContainer');
        if (!container) return;
        const data = Array.isArray(modifiedState.smeList) ? modifiedState.smeList : [];

        let html = `<table class="settings-table">
            <thead>
                <tr>
                    <th style="width: 60px">ID</th>
                    <th>Name</th>
                    <th style="width: 110px">Sort Order</th>
                    <th style="width: 90px">Active</th>
                    <th style="width: 100px">Actions</th>
                </tr>
            </thead>
            <tbody>`;

        data.forEach((item, index) => {
            const selectedName = String(item[SME_LIST_CONFIG.nameField] || '').trim();
            const optionNames = [...smeUserOptions];
            if (selectedName && !optionNames.includes(selectedName)) optionNames.unshift(selectedName);
            html += `
                <tr>
                    <td>${item[SME_LIST_CONFIG.idField] != null ? item[SME_LIST_CONFIG.idField] : ''}</td>
                    <td>
                        <select onchange="AdminSettings.updateSmeListItem(${index}, '${SME_LIST_CONFIG.nameField}', this.value)">
                            <option value="">Select SME</option>
                            ${optionNames.map((name) => `<option value="${escapeHtml(name)}" ${name === selectedName ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
                        </select>
                    </td>
                    <td><input type="number" value="${item[SME_LIST_CONFIG.sortField] != null ? item[SME_LIST_CONFIG.sortField] : index + 1}" style="width: 90px" onchange="AdminSettings.updateSmeListItem(${index}, '${SME_LIST_CONFIG.sortField}', this.value)"></td>
                    <td style="text-align:center;">
                        <input type="checkbox" ${item[SME_LIST_CONFIG.activeField] === false ? '' : 'checked'} onchange="AdminSettings.updateSmeListItem(${index}, '${SME_LIST_CONFIG.activeField}', this.checked)">
                    </td>
                    <td>
                        <button class="global-btn btn-secondary" style="padding: 4px 8px; font-size: 12px; background: #ef4444; color: white; border: none;" onclick="AdminSettings.deleteSmeListItem(${index})">Delete</button>
                    </td>
                </tr>
            `;
 });

        html += `</tbody></table>`;
        html += `<button class="global-btn" onclick="AdminSettings.addSmeListItem()">+ Add SME</button>`;
        container.innerHTML = html;
 }

    function updateSmeListItem(index, field, value) {
        if (!Array.isArray(modifiedState.smeList) || !modifiedState.smeList[index]) return;
        if (field === SME_LIST_CONFIG.sortField) {
            const parsed = Number(value);
            modifiedState.smeList[index][field] = Number.isFinite(parsed) ? parsed : null;
            return;
 }
        modifiedState.smeList[index][field] = value;
 }

    function addSmeListItem() {
        const current = Array.isArray(modifiedState.smeList) ? modifiedState.smeList : [];
        const maxId = current.reduce((max, item) => {
            const value = Number(item?.[SME_LIST_CONFIG.idField]);
            return Number.isFinite(value) ? Math.max(max, value) : max;
 }, 0);
        current.push({
            [SME_LIST_CONFIG.idField]: maxId + 1,
            [SME_LIST_CONFIG.nameField]: '',
            [SME_LIST_CONFIG.sortField]: current.length + 1,
            [SME_LIST_CONFIG.activeField]: true
 });
        modifiedState.smeList = current;
        renderSmeListTable();
 }

    function deleteSmeListItem(index) {
        if (!Array.isArray(modifiedState.smeList) || !modifiedState.smeList[index]) return;
        showModal(
            'Delete SME Entry',
            'Delete this SME entry from the current draft?',
            () => {
                modifiedState.smeList.splice(index, 1);
                renderSmeListTable();
 }
        );
 }

    async function saveSmeListChanges() {
        const original = Array.isArray(state.smeList) ? state.smeList : [];
        const current = Array.isArray(modifiedState.smeList) ? modifiedState.smeList : [];
        const idField = SME_LIST_CONFIG.idField;
        const hasLegacyValueColumn = original.some((item) => Object.prototype.hasOwnProperty.call(item || {}, 'value'))
            || current.some((item) => Object.prototype.hasOwnProperty.call(item || {}, 'value'));

        try {
            const sanitized = current.map((item, index) => {
                const name = String(item[SME_LIST_CONFIG.nameField] || '').trim();
                const nextItem = {
                    [idField]: item[idField],
                    [SME_LIST_CONFIG.nameField]: name,
                    [SME_LIST_CONFIG.sortField]: Number.isFinite(Number(item[SME_LIST_CONFIG.sortField])) ? Number(item[SME_LIST_CONFIG.sortField]) : (index + 1),
                    [SME_LIST_CONFIG.activeField]: item[SME_LIST_CONFIG.activeField] !== false
 };
                if (hasLegacyValueColumn) nextItem.value = name;
                return nextItem;
 });

            if (sanitized.some((item) => !item[SME_LIST_CONFIG.nameField])) {
                throw new Error('Each SME entry needs a selected name.');
 }

            const originalIds = original.map((item) => item[idField]);
            const currentIds = sanitized.map((item) => item[idField]);
            const idsToDelete = originalIds.filter((id) => !currentIds.includes(id));

            if (idsToDelete.length) {
                const delRes = await fetch(`${config.restUrl}/${SME_LIST_CONFIG.tableName}?${encodeURIComponent(idField)}=in.(${idsToDelete.map((id) => encodeURIComponent(id)).join(',')})`, {
                    method: 'DELETE',
                    headers: authHeaders({ useServiceKey: true })
 });
                if (!delRes.ok) {
                    const errText = await delRes.text().catch(() => '');
                    throw new Error(`Failed to delete removed SME entries: ${delRes.status} ${errText || delRes.statusText}`);
 }
 }

            const toUpdate = sanitized.filter((item) => originalIds.includes(item[idField]));
            if (toUpdate.length) {
                const upRes = await fetch(`${config.restUrl}/${SME_LIST_CONFIG.tableName}`, {
                    method: 'POST',
                    headers: { ...authHeaders({ useServiceKey: true }), 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify(toUpdate)
 });
                if (!upRes.ok) {
                    const errText = await upRes.text().catch(() => '');
                    throw new Error(`Failed to update SME list: ${upRes.status} ${errText || upRes.statusText}`);
 }
 }

            const toInsert = sanitized
                .filter((item) => !originalIds.includes(item[idField]))
                .map((item) => {
                    const { [idField]: _omit, ...rest } = item;
                    return rest;
 });
            if (toInsert.length) {
                const insRes = await fetch(`${config.restUrl}/${SME_LIST_CONFIG.tableName}`, {
                    method: 'POST',
                    headers: authHeaders({ useServiceKey: true }),
                    body: JSON.stringify(toInsert)
 });
                if (!insRes.ok) {
                    const errText = await insRes.text().catch(() => '');
                    throw new Error(`Failed to insert SME entries: ${insRes.status} ${errText || insRes.statusText}`);
 }
 }

            showToast('SME list saved successfully', 'success');
            fetchSmeList();
 } catch (error) {
            console.error(error);
            showToast(`Error saving SME list: ${error.message}`, 'error');
 }
 }

    function discardSmeListChanges() {
        showModal(
            'Discard SME List Changes',
            'Discard unsaved SME list changes?',
            () => fetchSmeList(),
            { confirmLabel: 'Discard', confirmClassName: 'global-btn btn-secondary' }
        );
 }

    // --- Interaction Related To Logic ---
    async function fetchIntRel() {
        const container = document.getElementById('intRelTableContainer');
        container.innerHTML = 'Loading...';
        
        try {
            const res = await fetch(`${config.restUrl}/intRltdTo?select=*&order=id.asc`, {
                headers: authHeaders({ useServiceKey: true })
 });
            if (!res.ok) throw new Error('Failed to fetch Interaction Related To');
            
            state.intRel = await res.json();
            renderIntRelTable();
 } catch (error) {
            console.error(error);
            container.innerHTML = `<div style="color:red">Error: ${error.message}</div>`;
 }
 }

    function renderIntRelTable() {
        const container = document.getElementById('intRelTableContainer');
        const data = state.intRel;
        
        if (!data || data.length === 0) {
            container.innerHTML = 'No items found.';
            return;
 }

        let html = `<table class="settings-table">
            <thead>
                <tr>
                    <th style="width: 60px">ID</th>
                    <th>Related To</th>
                    <th style="width: 100px">Actions</th>
                </tr>
            </thead>
            <tbody>`;
            
        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.interactionRelateTo}</td>
                    <td>
                        <button class="global-btn btn-secondary" style="background: #ef4444; color: white; border: none; padding: 4px 8px; font-size: 12px;" onclick="AdminSettings.deleteIntRel(${item.id})">Delete</button>
                    </td>
                </tr>
            `;
 });
        html += `</tbody></table>`;
        container.innerHTML = html;
 }

    function toggleNewIntRelForm() {
        const form = document.getElementById('newIntRelForm');
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
 }

    function discardNewIntRel() {
        document.getElementById('newIntRelInput').value = '';
        document.getElementById('newIntRelForm').style.display = 'none';
 }

    async function saveNewIntRel() {
        const val = document.getElementById('newIntRelInput').value.trim();
        if (!val) return showToast('Please enter a value', 'warning');
        
        // Calculate next ID manually since DB column is not serial
        const currentData = state.intRel || [];
        const maxId = currentData.length > 0 ? Math.max(...currentData.map(item => item.id)) : 0;
        const newId = maxId + 1;

        try {
            const res = await fetch(`${config.restUrl}/intRltdTo`, {
                method: 'POST',
                headers: authHeaders({ useServiceKey: true }),
                body: JSON.stringify({ 
                    id: newId,
                    interactionRelateTo: val 
 })
 });
            
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Failed to add: ${res.status} ${errText}`);
 }
            
            showToast('Item added', 'success');
            discardNewIntRel();
            fetchIntRel();
 } catch (e) {
            console.error(e);
            showToast(e.message, 'error');
 }
 }

    // --- Calibration Logic ---
    async function fetchCalibration() {
        const container = document.getElementById('calibrationTableContainer');
        container.innerHTML = 'Loading...';
        
        try {
            const res = await fetch(`${config.restUrl}/Assigning_Calibration?select=*&order=created_at.desc`, {
                headers: authHeaders({ useServiceKey: true })
 });
            if (!res.ok) throw new Error('Failed to fetch Calibration Assignments');
            
            state.calibration = await res.json();
            renderCalibrationTable();
 } catch (e) {
            container.innerHTML = `<div style="color:red">Error: ${e.message}</div>`;
 }
 }

    function renderCalibrationTable() {
        const container = document.getElementById('calibrationTableContainer');
        const data = state.calibration;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No active calibration assignments.</div>';
            return;
 }

        let html = `<table class="settings-table">
            <thead>
                <tr>
                    <th>Conversation ID</th>
                    <th>Scorecard</th>
                    <th>Type</th>
                    <th>Day</th>
                    <th>Assigned At</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>`;
            
        data.forEach(item => {
            html += `
                <tr>
                    <td>${item.Conversation_Id}</td>
                    <td>${item.Score_card}</td>
                    <td>${item.type || '-'}</td>
                    <td>${item.day || '-'}</td>
                    <td>${new Date(item.created_at).toLocaleString()}</td>
                    <td>
                        <button class="global-btn btn-secondary" style="background: #ef4444; color: white; border: none; padding: 4px 8px; font-size: 12px;" onclick="AdminSettings.deleteCalibration(${item.id})">Delete</button>
                    </td>
                </tr>
            `;
 });
        html += `</tbody></table>`;
        container.innerHTML = html;
 }

    async function assignCalibration() {
        const conversation_id = document.getElementById('calibrationConversationId').value.trim();
        const day = document.getElementById('calibrationDay').value;
        const scorecard_name = document.getElementById('calibrationScorecard').value;
        const typeEl = document.getElementById('calibrationType');
        const type = typeEl ? typeEl.value : '';

        if (!conversation_id || !scorecard_name) {
            return showToast('Please fill in Conversation ID and Scorecard', 'warning');
 }

        const scorecardsWithType = ['MX-T2_OS Scorecard', 'SMS_Scorecard', 'Wins_Scorecard'];

        const payload = {
            Conversation_Id: conversation_id,
            day,
            Score_card: scorecard_name,
            type: scorecardsWithType.includes(scorecard_name) ? type : null
 };

        try {
            const res = await fetch(`${config.restUrl}/Assigning_Calibration`, {
                method: 'POST',
                headers: authHeaders({ useServiceKey: true }),
                body: JSON.stringify(payload)
 });
            
            if (!res.ok) throw new Error('Failed to assign calibration');
            
            showToast('Calibration assigned successfully', 'success');
            // Clear inputs
            document.getElementById('calibrationConversationId').value = '';
            fetchCalibration();
 } catch (e) {
            showToast(e.message, 'error');
 }
 }

    function exportCsv(tabKey) {
        if (tabKey === 'intRel') {
            const data = state.intRel;
            if (!data || data.length === 0) {
                showToast('No data to export', 'error');
                return;
 }
            
            // CSV Header
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "ID,Related To\n";
            
            // CSV Rows
            data.forEach(item => {
                const row = `${item.id},"${(item.interactionRelateTo || '').replace(/"/g, '""')}"`;
                csvContent += row + "\n";
 });
            
            // Download Link
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "interaction_related_to.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
 }
 }

    function handleCsvUpload(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(e) {
            const text = e.target.result;
            const rows = text.split('\n').slice(1); // Skip header
            
            const toInsert = [];
            
            rows.forEach(row => {
                if (!row.trim()) return;
                
                let id = null;
                let relatedTo = '';
                
                // Check for quoted value
                if (row.indexOf('"') >= 0) {
                    // Try to match ID,"Value"
                    // We handle case where ID might not be present or present
                    // Regex assumes ID first if comma exists before quote
                    const firstComma = row.indexOf(',');
                    if (firstComma > -1) {
                        const idPart = row.substring(0, firstComma).trim();
                        const valPart = row.substring(firstComma + 1).trim();
                        
                        if (idPart && !isNaN(idPart)) id = parseInt(idPart);
                        
                        if (valPart.startsWith('"') && valPart.endsWith('"')) {
                            relatedTo = valPart.substring(1, valPart.length - 1).replace(/""/g, '"');
 } else {
                            relatedTo = valPart;
 }
 } else {
                        // Fallback, maybe just quoted value?
                         if (row.startsWith('"') && row.endsWith('"')) {
                            relatedTo = row.substring(1, row.length - 1).replace(/""/g, '"');
 }
 }
 } else {
                    // Simple split
                    const parts = row.split(',');
                    if (parts.length >= 2) {
                        if (parts[0] && !isNaN(parts[0])) id = parseInt(parts[0]);
                        relatedTo = parts.slice(1).join(',').trim();
 } else if (parts.length === 1) {
                         relatedTo = parts[0].trim();
 }
 }

                if (relatedTo) {
                    const item = { interactionRelateTo: relatedTo };
                    if (id) item.id = id;
                    toInsert.push(item);
 }
 });

            if (toInsert.length > 0) {
                // Generate IDs for items that don't have them
                const currentData = state.intRel || [];
                let maxId = currentData.length > 0 ? Math.max(...currentData.map(item => item.id)) : 0;
                
                toInsert.forEach(item => {
                    if (item.id) {
                        // If item has ID, ensure maxId respects it (for subsequent items)
                        maxId = Math.max(maxId, item.id);
 } else {
                        maxId++;
                        item.id = maxId;
 }
 });

                try {
                    const res = await fetch(`${config.restUrl}/intRltdTo`, {
                        method: 'POST',
                        headers: { 
                            ...authHeaders({ useServiceKey: true }),
                            'Prefer': 'resolution=merge-duplicates'
 },
                        body: JSON.stringify(toInsert)
 });
                    
                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(`Failed to import items: ${res.status} ${errText}`);
 }
                    
                    showToast(`Imported ${toInsert.length} items successfully`, 'success');
                    fetchIntRel();
 } catch (e) {
                    console.error(e);
                    showToast(e.message, 'error');
 }
 } else {
                showToast('No valid data found in CSV', 'warning');
 }
            
            // Reset input
            input.value = '';
 };
        
        reader.readAsText(file);
 }

    // --- Initialization ---
    document.addEventListener('DOMContentLoaded', async () => {
        await loadConfig();
        initTabs();
        
        // Event listeners for specific UI elementsdddddd
        const calScorecardSelect = document.getElementById('calibrationScorecard');
        if (calScorecardSelect) {
            calScorecardSelect.addEventListener('change', (e) => {
                const typeContainer = document.getElementById('calibrationTypeContainer');
                const scorecardsWithType = ['MX-T2_OS Scorecard', 'SMS_Scorecard', 'Wins_Scorecard'];
                if (scorecardsWithType.includes(e.target.value)) {
                    typeContainer.style.display = 'block';
 } else {
                    typeContainer.style.display = 'none';
 }
 });
 }
        
        const calSubmitBtn = document.getElementById('calibrationSubmitBtn');
        if (calSubmitBtn) {
            calSubmitBtn.addEventListener('click', assignCalibration);
 }
 });

    // Public API
    const api = {
        updateAttribute,
        addAttribute,
        deleteAttribute,
        deleteIntRel,
        deleteCalibration,
        refreshEtlLogs: fetchEtlLogs,
        setEtlLogsPage,
        setEtlLogsPageSize,
        runEtlNow,
        triggerEtlAction,
        stopEtlLiveLogs,
        closeEtlRunModal,
        saveChanges: (tabKey) => saveChanges(tabKey),
        discardChanges: (tabKey) => discardChanges(tabKey),
        updateSmeListItem,
        addSmeListItem,
        deleteSmeListItem,
        saveSmeListChanges,
        discardSmeListChanges,
        toggleNewIntRelForm,
        discardNewIntRel,
        saveNewIntRel,
        exportCsv,
        handleCsvUpload
 };

    window.AdminSettings = api;
    return api;
})();
