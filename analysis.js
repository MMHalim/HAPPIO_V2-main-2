(function() {
  const loginToken = localStorage.getItem('login_token');
  if (!loginToken) {
    window.location.href = 'login.html';
    return;
  }

  const config = {
    restUrl: '',
    apiKey: '',
    serviceKey: ''
  };

  const DATASETS = {
    t1: {
      key: 't1',
      table: 'T1_QA_New_Scorecards',
      label: 'T1 Audits',
      shortLabel: 'T1',
      definitionTable: 'T1_SC_Att',
      accentClass: 'source-chip-t1'
    },
    t2os: {
      key: 't2os',
      table: 'T2_OS_NEW_2025',
      label: 'T2 OS Audits',
      shortLabel: 'T2 OS',
      definitionTable: 'New_SC_Attributes',
      accentClass: 'source-chip-t2os'
    }
  };

  const RESERVED_KEYS = new Set([
    'id', 'created_at', 'date_created', 'date', 'agent_name', 'agent_email', 'conversation_id',
    'final_score', 'channel', 'ticket_status', 'monitoring_type', 'interaction_related_to',
    'url', 'taker_name', 'sme_name', 'sme_answer', 'sme_following_process', 'sales',
    'sales_comments', 'agent_acknowledge', 'appealed', 'qa_appeal_comments_reply',
    'customer_retained', 'coaching_delivered', 'fitness_fluency', 'queue', 'certification'
  ]);

  const NEGATIVE_COMMENT_RE = /\b(no|not|didn'?t|did not|missed|missing|failed|failure|incorrect|wrong|weak|poor|issue|problem|lack|needs improvement|should have|could have|opportunity|unclear|delay|late|didnt|wasn't|wasnt)\b/i;
  const NEGATIVE_VALUES = new Set(['no', 'n', 'fail', '0', '0%']);
  const T1_RENAME_MAP = {
    correctlydiagnose: 'Understanding',
    tempovalues: 'Brand Representation Ownership',
    ownership: 'Brand Representation Ownership',
    crmupdates: 'CRM Updates',
    documentations: 'Documentation',
    smerelated: 'SME',
    smefollowingprocess: 'SME'
  };
  const T2_RENAME_MAP = {
    engagementlangauge: 'Engagement & Language',
    engagementlanguage: 'Engagement & Language',
    effectivenessfcr: 'Effectiveness & FCR',
    retentionskills: 'Retention Skills',
    verification: 'Verification',
    verfication: 'Verification'
  };
  const CHANNEL_META = {
    chat: { label: 'Chat', color: '#6366f1' },
    email: { label: 'Email', color: '#f59e0b' },
    phone: { label: 'Phone', color: '#10b981' }
  };
  const CHANNEL_ORDER = ['chat', 'email', 'phone'];

  const state = {
    rows: [],
    rawRows: { t1: [], t2os: [] },
    definitions: { t1: [], t2os: [] },
    definitionsMap: { t1: new Map(), t2os: new Map() },
    availableAgents: [],
    activeAgent: 'Abdelrahman Fathy',
    teamFilter: 'all',
    datasetView: 'combined',
    activeTab: 'tickets',
    quickFilter: 'all',
      teamTableSearch: '',
    filters: {
      search: '',
      datePreset: 'all',
      exactDate: '',
      monthValue: '',
      weekValue: '',
      dayValue: '',
      customFrom: '',
      customTo: '',
      attribute: 'all',
      channel: 'all',
      ticketStatus: 'all',
      monitoringType: 'all',
      auditors: []
    },
    uiOnlyRows: [],
    deletedRowIds: new Set(),
    auditorFilterOpen: false,
    loading: true,
    loadError: ''
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function toTitle(value) {
    const text = String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return '';
    return text
      .split(' ')
      .map((word) => {
        const upper = word.toUpperCase();
        if (['CRM', 'FCR', 'SME', 'QA', 'OS', 'URL'].includes(upper)) return upper;
        return upper.charAt(0) + upper.slice(1).toLowerCase();
      })
      .join(' ');
  }

  function pickMappedValue(row, candidates, fallback = '') {
    const keys = Object.keys(row || {});
    for (const candidate of candidates) {
      const exact = keys.find((key) => key === candidate);
      if (exact && row[exact] != null && row[exact] !== '') return row[exact];
      const normalized = normalizeKey(candidate);
      const fuzzy = keys.find((key) => normalizeKey(key) === normalized);
      if (fuzzy && row[fuzzy] != null && row[fuzzy] !== '') return row[fuzzy];
    }
    return fallback;
  }

  function authHeaders(opts = {}) {
    const useServiceKey = opts.useServiceKey === true;
    const token = localStorage.getItem('login_token');
    const bearer = useServiceKey && config.serviceKey ? config.serviceKey : (token || config.apiKey || '');
    const apiKey = useServiceKey && config.serviceKey ? config.serviceKey : (config.apiKey || '');
    return {
      apikey: apiKey,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    };
  }

  function parseScore(value) {
    const text = String(value == null ? '' : value).trim().replace('%', '');
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function scoreToDisplay(score) {
    const safe = Number.isFinite(score) ? score : 0;
    return `${safe.toFixed(1).replace(/\.0$/, '')}%`;
  }

  function formatDateOnly(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  function formatPercent(value, fallback = '0%') {
    if (!Number.isFinite(value)) return fallback;
    return `${value.toFixed(1).replace(/\.0$/, '')}%`;
  }

  function datasetMeta(datasetKey) {
    return DATASETS[datasetKey] || DATASETS.t1;
  }

  function maybeUrl(value) {
    const text = String(value == null ? '' : value).trim();
    return /^https?:\/\//i.test(text) ? text : '';
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icon = type === 'error' ? 'circle-alert' : (type === 'warning' ? 'triangle-alert' : 'circle-check-big');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="mt-0.5 shrink-0 text-current">
        <i data-lucide="${icon}" class="h-5 w-5"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold">${escapeHtml(type.charAt(0).toUpperCase() + type.slice(1))}</div>
        <div class="mt-1 text-sm opacity-80">${escapeHtml(message)}</div>
      </div>
    `;
    container.appendChild(toast);
    renderIcons();
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  async function copyText(text) {
    const value = String(text == null ? '' : text);
    if (!value.trim()) return false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_) {}
    }

    const helper = document.createElement('textarea');
    helper.value = value;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    helper.style.pointerEvents = 'none';
    helper.style.left = '-9999px';
    document.body.appendChild(helper);
    helper.focus();
    helper.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (_) {
      copied = false;
    }

    document.body.removeChild(helper);
    return copied;
  }

  async function loadConfig() {
    const response = await fetch('database_config.json');
    const json = await response.json();
    config.restUrl = json.supabase.rest_url;
    config.apiKey = json.supabase.client_api_key;
    config.serviceKey = json.supabase.service_key || '';
  }

  async function fetchJson(url, opts = {}) {
    let response = await fetch(url, { headers: authHeaders(opts) });
    if (!response.ok && !opts.useServiceKey && config.serviceKey) {
      response = await fetch(url, { headers: authHeaders({ useServiceKey: true }) });
    }
    if (!response.ok) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function fetchDefinitions(datasetKey) {
    const dataset = datasetMeta(datasetKey);
    const url = `${config.restUrl}/${dataset.definitionTable}?select=*`;
    const rows = await fetchJson(url);
    const normalized = (Array.isArray(rows) ? rows : []).map((row, index) => {
      const label = String(pickMappedValue(row, ['Subcategory', 'Attribute', 'attribute', 'subcategory'], `Attribute ${index + 1}`)).trim();
      return {
        label,
        description: String(pickMappedValue(row, ['Criteria', 'criteria', 'description'], '')).trim(),
        score: parseScore(pickMappedValue(row, ['Score', 'score'], 0)),
        order: Number(pickMappedValue(row, ['ID', 'id'], index + 1)) || index + 1
      };
    }).sort((a, b) => a.order - b.order);

    state.definitions[datasetKey] = normalized;
    const map = new Map();
    normalized.forEach((item) => map.set(normalizeKey(item.label), item));
    state.definitionsMap[datasetKey] = map;
  }

  function cleanAttributeLabel(label, datasetKey) {
    const normalized = normalizeKey(label);
    const renameMap = datasetKey === 't1' ? T1_RENAME_MAP : T2_RENAME_MAP;
    const renamed = renameMap[normalized];
    const base = renamed || toTitle(label);
    if (base === 'Sme') return 'SME';
    return base
      .replace(/\bLangauge\b/g, 'Language')
      .replace(/\bVerfication\b/g, 'Verification')
      .replace(/\bRetentionskills\b/g, 'Retention Skills');
  }

  function getDefinitionForLabel(label, datasetKey) {
    const exact = state.definitionsMap[datasetKey].get(normalizeKey(label));
    if (exact) return exact;
    const fallback = state.definitions[datasetKey].find((item) => normalizeKey(item.label).includes(normalizeKey(label)) || normalizeKey(label).includes(normalizeKey(item.label)));
    return fallback || null;
  }

  function buildDefinitionCandidates(datasetKey) {
    return state.definitions[datasetKey].map((item) => ({
      label: item.label,
      normalized: normalizeKey(item.label)
    }));
  }

  function statusLooksNegative(value) {
    const text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return false;
    if (NEGATIVE_VALUES.has(text)) return true;
    if (text.includes('no')) return true;
    return false;
  }

  function commentLooksNegative(value) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return false;
    if (['na', 'n/a', '-', 'none'].includes(text.toLowerCase())) return false;
    return NEGATIVE_COMMENT_RE.test(text);
  }

  function buildAttributeObjects(row, datasetKey) {
    const raw = row.raw;
    const keys = Object.keys(raw);
    const usedKeys = new Set();
    const found = [];
    const candidates = buildDefinitionCandidates(datasetKey);

    function pushAttribute(label, scoreKey, commentKey) {
      const cleanLabel = cleanAttributeLabel(label, datasetKey);
      const scoreValue = scoreKey ? raw[scoreKey] : '';
      const commentValue = commentKey ? raw[commentKey] : '';
      const definition = getDefinitionForLabel(cleanLabel, datasetKey);
      const failed = statusLooksNegative(scoreValue) || commentLooksNegative(commentValue);
      if (!failed) return;
      found.push({
        label: cleanLabel,
        score: scoreValue,
        comment: String(commentValue == null ? '' : commentValue).trim(),
        scoreKey: scoreKey || '',
        commentKey: commentKey || '',
        definition,
        failed
      });
      if (scoreKey) usedKeys.add(scoreKey);
      if (commentKey) usedKeys.add(commentKey);
    }

    keys.forEach((key) => {
      const lower = key.toLowerCase();
      const normalized = normalizeKey(key);
      if (usedKeys.has(key)) return;
      if (!(lower.startsWith('comments_') || lower.startsWith('comment_') || lower.startsWith('comm_') || lower.endsWith('_comments') || lower.endsWith('_comment'))) return;

      let baseLabel = key
        .replace(/^comments?_+/i, '')
        .replace(/^comm_+/i, '')
        .replace(/_comments?$/i, '')
        .replace(/comments?$/i, '')
        .replace(/^comment /i, '');

      if (datasetKey === 't1' && normalizeKey(baseLabel) === 'brandrepresentationownership') {
        baseLabel = 'Brand Representation Ownership';
      }

      const directScoreKey = keys.find((candidate) => {
        if (candidate === key) return false;
        const candidateNorm = normalizeKey(candidate);
        if (RESERVED_KEYS.has(candidateNorm)) return false;
        return candidateNorm === normalizeKey(baseLabel);
      });

      let scoreKey = directScoreKey || '';

      if (!scoreKey) {
        const definitionMatch = candidates.find((item) => normalized.includes(item.normalized) || item.normalized.includes(normalizeKey(baseLabel)));
        if (definitionMatch) {
          scoreKey = keys.find((candidate) => normalizeKey(candidate) === definitionMatch.normalized) || '';
          if (!baseLabel || baseLabel === key) baseLabel = definitionMatch.label;
        }
      }

      pushAttribute(baseLabel, scoreKey, key);
    });

    keys.forEach((key) => {
      const normalized = normalizeKey(key);
      if (usedKeys.has(key) || RESERVED_KEYS.has(normalized)) return;
      const value = raw[key];
      const definitionMatch = candidates.find((item) => item.normalized === normalized);
      if (!definitionMatch) return;
      if (!statusLooksNegative(value)) return;
      const commentKey = keys.find((candidate) => {
        const lower = candidate.toLowerCase();
        if (!(lower.startsWith('comments_') || lower.startsWith('comment_') || lower.startsWith('comm_') || lower.endsWith('_comments') || lower.endsWith('_comment'))) return false;
        return normalizeKey(candidate).includes(definitionMatch.normalized);
      }) || '';
      pushAttribute(definitionMatch.label, key, commentKey);
    });

    const unique = new Map();
    found.forEach((item) => {
      const id = normalizeKey(item.label);
      if (!unique.has(id)) {
        unique.set(id, item);
        return;
      }
      const existing = unique.get(id);
      if (!existing.comment && item.comment) {
        existing.comment = item.comment;
      } else if (existing.comment && item.comment && existing.comment !== item.comment) {
        existing.comment = `${existing.comment}\n${item.comment}`;
      }
      if (!existing.score && item.score) existing.score = item.score;
    });

    return Array.from(unique.values()).sort((a, b) => {
      const aOrder = a.definition ? a.definition.order : 999;
      const bOrder = b.definition ? b.definition.order : 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.label.localeCompare(b.label);
    });
  }

  function normalizeRow(raw, datasetKey, index) {
    const dataset = datasetMeta(datasetKey);
    const dateValue = pickMappedValue(raw, ['created_at', 'date_created', 'Date', 'date'], '');
    const agent = String(pickMappedValue(raw, ['Agent_Name', 'agent_name', 'agent_email', 'Agent', 'Name'], 'Unknown')).trim() || 'Unknown';
    const email = String(pickMappedValue(raw, ['agent_email', 'Agent_Email', 'email'], '')).trim();
    const conversationId = String(pickMappedValue(raw, ['Conversation_ID', 'conversation_id', 'ticket_id', 'ID'], '')).trim();
    const baseId = String(pickMappedValue(raw, ['id', 'ID'], conversationId || `${datasetKey}-${index}`)).trim();
    const rowId = `${datasetKey}:${baseId || conversationId || index}`;
    const score = parseScore(pickMappedValue(raw, ['Final_Score', 'final_score', 'score'], 0));
    const ticketStatus = String(pickMappedValue(raw, ['Ticket_Status', 'ticket_Status', 'ticket_status', 'status'], '')).trim();
    const monitoringType = String(pickMappedValue(raw, ['Monitoring_Type', 'monitoring_type'], '')).trim();
    const topic = String(pickMappedValue(raw, ['Interaction_Related_To', 'interaction_related_to', 'topic'], '')).trim();
    const url = maybeUrl(pickMappedValue(raw, ['URL', 'url', 'Post_url', 'Post_URL'], ''));
    const channel = String(pickMappedValue(raw, ['Channel', 'channel'], '')).trim();
    const takerName = String(pickMappedValue(raw, ['Taker_Name', 'taker_name'], '')).trim();
    const smeName = String(pickMappedValue(raw, ['SME_Name', 'sme_name'], '')).trim();
    const smeAnswer = String(pickMappedValue(raw, ['SME_Answer', 'sme_answer'], '')).trim();
    const smeFollowing = String(pickMappedValue(raw, ['SME_Following_Process', 'sme_following_process'], '')).trim();
    const salesValue = String(pickMappedValue(raw, ['Sales', 'sales'], '')).trim();
    const salesComments = String(pickMappedValue(raw, ['Sales_Comments', 'sales_comments'], '')).trim();
    const certification = String(pickMappedValue(raw, ['Certification', 'certification'], '')).trim();
    const fitnessFluency = String(pickMappedValue(raw, ['fitness_fluency', 'Fitness_Fluency'], '')).trim();
    const coachingDelivered = String(pickMappedValue(raw, ['coaching_delivered', 'Coaching_Delivered'], '')).trim();
    const retained = String(pickMappedValue(raw, ['customer_retained', 'Customer_Retained'], '')).trim();

    const row = {
      rowId,
      baseId,
      datasetKey,
      sourceLabel: dataset.label,
      sourceShortLabel: dataset.shortLabel,
      sourceAccentClass: dataset.accentClass,
      raw: { ...raw },
      date: dateValue,
      dateObj: new Date(dateValue),
      agent,
      agentEmail: email,
      conversationId,
      score,
      ticketStatus,
      monitoringType,
      topic,
      url,
      channel,
      takerName,
      smeName,
      smeAnswer,
      smeFollowing,
      salesValue,
      salesComments,
      certification,
      fitnessFluency,
      coachingDelivered,
      retained,
      failedAttributes: []
    };

    row.failedAttributes = buildAttributeObjects(row, datasetKey);
    return row;
  }

  async function fetchDataset(datasetKey) {
    const dataset = datasetMeta(datasetKey);
    const url = `${config.restUrl}/${dataset.table}?select=*&order=created_at.desc&limit=2000`;
    const rows = await fetchJson(url);
    state.rawRows[datasetKey] = Array.isArray(rows) ? rows : [];
  }

  function rebuildRows() {
    const remoteRows = Object.keys(DATASETS).flatMap((datasetKey) =>
      (state.rawRows[datasetKey] || []).map((row, index) => normalizeRow(row, datasetKey, index))
    );

    state.rows = [...remoteRows, ...state.uiOnlyRows].sort((a, b) => {
      const aTime = a.dateObj && !Number.isNaN(a.dateObj.getTime()) ? a.dateObj.getTime() : 0;
      const bTime = b.dateObj && !Number.isNaN(b.dateObj.getTime()) ? b.dateObj.getTime() : 0;
      return bTime - aTime;
    });

    const agentMap = new Map();
    state.rows.forEach((row) => {
      const key = row.agent.toLowerCase();
      if (!agentMap.has(key)) agentMap.set(key, row.agent);
    });
    state.availableAgents = Array.from(agentMap.values()).sort((a, b) => a.localeCompare(b));

    if (!state.availableAgents.some((agent) => agent.toLowerCase() === state.activeAgent.toLowerCase())) {
      state.activeAgent = state.availableAgents.includes('Abdelrahman Fathy')
        ? 'Abdelrahman Fathy'
        : (state.availableAgents[0] || '');
    }
  }

    function isAgentMode() {
      return state.teamFilter === 'all';
    }

    function isTeamMode() {
      return state.teamFilter === 'team';
    }

    function getDatasetScopedRows(includeDatasetView = true, options = {}) {
    const includeAuditorFilter = options.includeAuditorFilter !== false;
    let rows = state.rows.filter((row) => !state.deletedRowIds.has(row.rowId));

      if (state.teamFilter === 't1' || state.teamFilter === 't2os') {
      rows = rows.filter((row) => row.datasetKey === state.teamFilter);
      } else if (isAgentMode() && state.activeAgent) {
      rows = rows.filter((row) => row.agent.toLowerCase() === state.activeAgent.toLowerCase());
    }

    if (includeDatasetView && state.datasetView !== 'combined') {
      rows = rows.filter((row) => row.datasetKey === state.datasetView);
    }

    if (state.filters.search) {
      const needle = state.filters.search.toLowerCase();
      rows = rows.filter((row) => {
        const haystack = [
          row.baseId,
          row.conversationId,
          row.agent,
          row.topic,
          row.channel,
          row.ticketStatus,
          row.monitoringType,
          row.takerName,
          row.salesComments,
          row.failedAttributes.map((item) => `${item.label} ${item.comment}`).join(' ')
        ].join(' ').toLowerCase();
        return haystack.includes(needle);
      });
    }

    rows = rows.filter((row) => passesDateFilter(row));

    if (state.filters.attribute !== 'all') {
      rows = rows.filter((row) => row.failedAttributes.some((item) => normalizeKey(item.label) === state.filters.attribute));
    }

    if (state.filters.channel !== 'all') {
      rows = rows.filter((row) => normalizeKey(row.channel) === state.filters.channel);
    }

    if (state.filters.ticketStatus !== 'all') {
      rows = rows.filter((row) => normalizeKey(row.ticketStatus) === state.filters.ticketStatus);
    }

    if (state.filters.monitoringType !== 'all') {
      rows = rows.filter((row) => normalizeKey(row.monitoringType) === state.filters.monitoringType);
    }

    if (includeAuditorFilter) {
      const selectedAuditors = new Set(getEffectiveAuditorSelection(getFilterOptionSets().auditors));
      if (selectedAuditors.size) {
      rows = rows.filter((row) => selectedAuditors.has(normalizeKey(row.takerName)));
      }
    }

    if (state.quickFilter === 'errors') {
      rows = rows.filter((row) => row.failedAttributes.length > 0);
    } else if (state.quickFilter === 'perfect') {
      rows = rows.filter((row) => row.score >= 100);
    }

    return rows;
  }

  function passesDateFilter(row) {
    const date = row.dateObj;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return state.filters.datePreset === 'all';

    if (state.filters.exactDate) {
      const exactDate = new Date(state.filters.exactDate);
      if (!Number.isNaN(exactDate.getTime())) {
        if (
          date.getFullYear() !== exactDate.getFullYear() ||
          date.getMonth() !== exactDate.getMonth() ||
          date.getDate() !== exactDate.getDate()
        ) {
          return false;
        }
      }
    }

    const preset = state.filters.datePreset;
    if (preset === 'all') return true;

    if (preset === 'month' && state.filters.monthValue) {
      const [year, month] = state.filters.monthValue.split('-').map(Number);
      return date.getFullYear() === year && (date.getMonth() + 1) === month;
    }

    if (preset === 'week' && state.filters.weekValue) {
      const start = weekValueToRange(state.filters.weekValue).start;
      const end = weekValueToRange(state.filters.weekValue).end;
      return date >= start && date <= end;
    }

    if (preset === 'day' && state.filters.dayValue) {
      const day = new Date(state.filters.dayValue);
      if (Number.isNaN(day.getTime())) return true;
      return date.getFullYear() === day.getFullYear() &&
        date.getMonth() === day.getMonth() &&
        date.getDate() === day.getDate();
    }

    if (preset === 'custom' && (state.filters.customFrom || state.filters.customTo)) {
      const from = state.filters.customFrom ? new Date(state.filters.customFrom) : null;
      const to = state.filters.customTo ? new Date(state.filters.customTo) : null;
      if (from && !Number.isNaN(from.getTime()) && date < from) return false;
      if (to && !Number.isNaN(to.getTime())) {
        const inclusiveTo = new Date(to);
        inclusiveTo.setHours(23, 59, 59, 999);
        if (date > inclusiveTo) return false;
      }
      return true;
    }

    return true;
  }

  function weekValueToRange(value) {
    const parts = String(value || '').split('-W');
    if (parts.length !== 2) return { start: new Date(0), end: new Date(8640000000000000) };
    const year = Number(parts[0]);
    const week = Number(parts[1]);
    const start = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const day = start.getUTCDay();
    const isoStart = new Date(start);
    if (day <= 4) {
      isoStart.setUTCDate(start.getUTCDate() - start.getUTCDay() + 1);
    } else {
      isoStart.setUTCDate(start.getUTCDate() + 8 - start.getUTCDay());
    }
    const end = new Date(isoStart);
    end.setUTCDate(isoStart.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return { start: new Date(isoStart), end: new Date(end) };
  }

  function getFilteredRows() {
    return getDatasetScopedRows(true);
  }

  function getComparisonRows() {
    return getDatasetScopedRows(false);
  }

  function getFilterOptionSets() {
    const rows = getDatasetScopedRows(false, { includeAuditorFilter: false });
    const collect = (getter) => {
      const values = new Map();
      rows.forEach((row) => {
        const value = getter(row);
        if (!value) return;
        const key = normalizeKey(value);
        if (!values.has(key)) values.set(key, value);
      });
      return Array.from(values.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
    };

    const attributeMap = new Map();
    rows.forEach((row) => {
      row.failedAttributes.forEach((item) => {
        const key = normalizeKey(item.label);
        if (!attributeMap.has(key)) attributeMap.set(key, item.label);
      });
    });

    return {
      attributes: Array.from(attributeMap.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
      channels: collect((row) => row.channel),
      ticketStatuses: collect((row) => row.ticketStatus),
      monitoringTypes: collect((row) => row.monitoringType),
      auditors: collect((row) => row.takerName)
    };
  }

  function computeKpis(rows) {
    const totalEvaluated = rows.length;
    const failedAttributes = rows.reduce((sum, row) => sum + row.failedAttributes.length, 0);
    const avgScore = totalEvaluated ? rows.reduce((sum, row) => sum + row.score, 0) / totalEvaluated : 0;
    const perfectCount = rows.filter((row) => row.score >= 100).length;
    const passRate = totalEvaluated ? (perfectCount / totalEvaluated) * 100 : 0;
    const frequency = buildErrorFrequency(rows);
    const topError = frequency[0] || null;
    const channelBreakdown = computeChannelBreakdown(rows);
    return { totalEvaluated, failedAttributes, avgScore, passRate, perfectCount, topError, channelBreakdown };
  }

  function normalizeChannelCategory(value) {
    const key = normalizeKey(value);
    if (!key) return '';
    if (key.includes('chat')) return 'chat';
    if (key.includes('email') || key.includes('mail')) return 'email';
    if (key.includes('phone') || key.includes('call') || key.includes('voice')) return 'phone';
    return '';
  }

  function buildChannelPieChart(segments) {
    let cursor = 0;
    const slices = [];
    segments.forEach((segment) => {
      if (!segment.percent) return;
      const next = cursor + segment.percent;
      slices.push(`${segment.color} ${cursor}% ${next}%`);
      cursor = next;
    });
    if (cursor < 100) {
      slices.push(`rgba(148, 163, 184, 0.16) ${cursor}% 100%`);
    }
    return `conic-gradient(${slices.join(', ')})`;
  }

  function summarizeChannelBreakdown(rows, label) {
    const counts = { chat: 0, email: 0, phone: 0 };
      const scoreTotals = { chat: 0, email: 0, phone: 0 };
    rows.forEach((row) => {
      const category = normalizeChannelCategory(row.channel);
        if (category) {
          counts[category] += 1;
          scoreTotals[category] += row.score;
        }
    });

    const total = rows.length;
    const segments = CHANNEL_ORDER.map((key) => ({
      key,
      label: CHANNEL_META[key].label,
      color: CHANNEL_META[key].color,
      count: counts[key],
        percent: total ? (counts[key] / total) * 100 : 0,
        averageScore: counts[key] ? (scoreTotals[key] / counts[key]) : 0
    }));

    return {
      label,
      total,
      segments,
      chart: total ? buildChannelPieChart(segments) : 'conic-gradient(rgba(148, 163, 184, 0.18) 0 100%)'
    };
  }

  function computeChannelBreakdown(rows) {
    return {
      all: summarizeChannelBreakdown(rows, 'All Teams'),
      t1: summarizeChannelBreakdown(rows.filter((row) => row.datasetKey === 't1'), 'MX T1'),
      t2os: summarizeChannelBreakdown(rows.filter((row) => row.datasetKey === 't2os'), 'MX T2 OS')
    };
  }

  function buildErrorFrequency(rows) {
    const counts = new Map();
    rows.forEach((row) => {
      row.failedAttributes.forEach((item) => {
        const key = normalizeKey(item.label);
        const current = counts.get(key) || { label: item.label, count: 0, comments: [] };
        current.count += 1;
        if (item.comment) current.comments.push(item.comment);
        counts.set(key, current);
      });
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function buildCoachingGroups(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      row.failedAttributes.forEach((item) => {
        if (!item.comment) return;
        const key = normalizeKey(item.label);
        const entry = groups.get(key) || { label: item.label, items: [] };
        entry.items.push({
          rowId: row.rowId,
          agent: row.agent,
          sourceLabel: row.sourceLabel,
          comment: item.comment,
          date: row.date,
          conversationId: row.conversationId
        });
        groups.set(key, entry);
      });
    });
    return Array.from(groups.values()).sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label));
  }

  function computeBreakdown(rows) {
    const groups = {
      combined: rows,
      t1: rows.filter((row) => row.datasetKey === 't1'),
      t2os: rows.filter((row) => row.datasetKey === 't2os')
    };
    return Object.fromEntries(Object.entries(groups).map(([key, groupRows]) => {
      const audits = groupRows.length;
      const totalPoints = groupRows.reduce((sum, row) => sum + (row.score / 100), 0);
      const averageScore = audits ? groupRows.reduce((sum, row) => sum + row.score, 0) / audits : 0;
      return [key, { audits, totalPoints, averageScore }];
    }));
  }

    function buildTeamScoreRows(rows) {
      const grouped = new Map();

      rows.forEach((row) => {
        const key = row.agent.toLowerCase();
        const entry = grouped.get(key) || {
          agent: row.agent,
          t1Scores: [],
          t2osScores: [],
          allScores: []
        };

        entry.allScores.push(row.score);
        if (row.datasetKey === 't1') entry.t1Scores.push(row.score);
        if (row.datasetKey === 't2os') entry.t2osScores.push(row.score);
        grouped.set(key, entry);
      });

      const average = (scores) => {
        if (!scores.length) return null;
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
      };

      return Array.from(grouped.values())
        .map((entry) => ({
          agent: entry.agent,
          t1Score: average(entry.t1Scores),
          t2osScore: average(entry.t2osScores),
          overallScore: average(entry.allScores)
        }))
        .sort((a, b) => {
          const diff = (b.overallScore || 0) - (a.overallScore || 0);
          if (diff !== 0) return diff;
          return a.agent.localeCompare(b.agent);
        });
    }

    function filterTeamScoreRows(rows) {
      const needle = String(state.teamTableSearch || '').trim().toLowerCase();
      if (!needle) return rows;
      return rows.filter((row) => {
        const haystack = [
          row.agent,
          Number.isFinite(row.t1Score) ? formatPercent(row.t1Score) : '',
          Number.isFinite(row.t2osScore) ? formatPercent(row.t2osScore) : '',
          Number.isFinite(row.overallScore) ? formatPercent(row.overallScore) : ''
        ].join(' ').toLowerCase();
        return haystack.includes(needle);
      });
    }

  function buildCopySummary(rows) {
    const lines = [];
    rows.forEach((row) => {
      const commentedFailures = row.failedAttributes.filter((item) => item.comment);
      if (!commentedFailures.length) return;
      lines.push(`${row.agent} | ${row.sourceLabel} | ID ${row.conversationId || row.baseId || row.rowId} | ${scoreToDisplay(row.score)}`);
      commentedFailures.forEach((item) => {
        lines.push(`- ${item.label}: ${item.comment}`);
      });
      lines.push('');
    });
    return lines.join('\n').trim();
  }

  function buildGroupedCoachingSummary(groups, selectedKey = '') {
    const filteredGroups = selectedKey
      ? groups.filter((group) => normalizeKey(group.label) === selectedKey)
      : groups;

    const lines = [];
    filteredGroups.forEach((group) => {
      lines.push(group.label);
      lines.push('-'.repeat(group.label.length));
      group.items.forEach((item) => {
        lines.push(item.comment);
        lines.push('');
      });
      lines.push('');
    });

    return lines.join('\n').trim();
  }

  function initialsFor(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return words.map((word) => word.charAt(0).toUpperCase()).join('') || 'QA';
  }

  function normalizeAuditorSelection(values, options) {
    const validValues = new Set(options.map((item) => item.value));
    return Array.from(new Set((Array.isArray(values) ? values : []).filter((value) => validValues.has(value))));
  }

  function getEffectiveAuditorSelection(options) {
    if (!options.length) return [];
    const normalizedSelection = normalizeAuditorSelection(state.filters.auditors, options);
    if (!normalizedSelection.length) {
      return options.map((item) => item.value);
    }
    return normalizedSelection;
  }

  function isAuditorFilterAllSelected(options) {
    const effectiveSelection = getEffectiveAuditorSelection(options);
    return !options.length || effectiveSelection.length === options.length;
  }

  function getAuditorFilterSummary(options) {
    if (isAuditorFilterAllSelected(options)) {
      return 'All Auditors';
    }
    const selectedLabels = options
      .filter((item) => state.filters.auditors.includes(item.value))
      .map((item) => item.label);
    if (!selectedLabels.length || selectedLabels.length === options.length) {
      return 'All Auditors';
    }
    if (selectedLabels.length === 1) return selectedLabels[0];
    if (selectedLabels.length === 2) return selectedLabels.join(', ');
    return `${selectedLabels.length} auditors selected`;
  }

  function renderAuditorFilter(options) {
    const normalizedSelection = normalizeAuditorSelection(state.filters.auditors, options);
    if (normalizedSelection.length !== state.filters.auditors.length) {
      state.filters.auditors = normalizedSelection;
    }
    const isAllSelected = isAuditorFilterAllSelected(options);
    const effectiveSelection = new Set(getEffectiveAuditorSelection(options));
    return `
      <label class="block">
        <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Auditor Name</span>
        <details id="auditorFilterDetails" class="analysis-dropdown" ${options.length ? '' : 'data-empty="true"'} ${state.auditorFilterOpen ? 'open' : ''}>
          <summary class="analysis-dropdown-trigger">
            <span class="analysis-dropdown-summary">${escapeHtml(getAuditorFilterSummary(options))}</span>
            <i data-lucide="chevron-down" class="h-4 w-4 shrink-0"></i>
          </summary>
          <div class="analysis-dropdown-panel">
            <label class="analysis-checkbox-item analysis-checkbox-item-all">
              <input id="auditorFilterAll" type="checkbox" ${isAllSelected ? 'checked' : ''} />
              <span>All Auditors</span>
            </label>
            <div class="analysis-checklist">
              ${options.length
                ? options.map((item) => `
                  <label class="analysis-checkbox-item">
                    <input type="checkbox" value="${escapeHtml(item.value)}" data-auditor-filter-option ${effectiveSelection.has(item.value) ? 'checked' : ''} />
                    <span>${escapeHtml(item.label)}</span>
                  </label>
                `).join('')
                : '<div class="analysis-muted text-sm">No auditor names found in the current data.</div>'}
            </div>
          </div>
        </details>
      </label>
    `;
  }

  function render() {
    const root = document.getElementById('analysisRoot');
    if (!root) return;

    if (state.loading) {
      root.innerHTML = `
        <section class="analysis-card p-10 text-center">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
            <i data-lucide="loader-circle" class="h-6 w-6 animate-spin"></i>
          </div>
          <h1 class="text-2xl font-extrabold text-[var(--text-primary)]">Loading Analysis Dashboard</h1>
          <p class="analysis-muted mt-3 text-sm">Fetching T1 and T2 OS evaluations from Supabase.</p>
        </section>
      `;
      renderIcons();
      return;
    }

    if (state.loadError) {
      root.innerHTML = `
        <section class="analysis-card p-10 text-center">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-300">
            <i data-lucide="triangle-alert" class="h-6 w-6"></i>
          </div>
          <h1 class="text-2xl font-extrabold text-[var(--text-primary)]">Could not load the dashboard</h1>
          <p class="analysis-muted mt-3 text-sm">${escapeHtml(state.loadError)}</p>
          <div class="mt-6">
            <button id="retryLoadBtn" class="analysis-btn analysis-btn-primary">Retry</button>
          </div>
        </section>
      `;
      const retryBtn = document.getElementById('retryLoadBtn');
      if (retryBtn) retryBtn.addEventListener('click', init);
      renderIcons();
      return;
    }

    const filteredRows = getFilteredRows();
    const comparisonRows = getComparisonRows();
    const kpis = computeKpis(filteredRows);
    const breakdown = computeBreakdown(comparisonRows);
    const frequency = buildErrorFrequency(filteredRows);
    const coaching = buildCoachingGroups(filteredRows);
      const filterOptions = getFilterOptionSets();
      const currentAgentRow = state.rows.find((row) => row.agent.toLowerCase() === state.activeAgent.toLowerCase()) || null;
      const teamScoreRows = isTeamMode() ? buildTeamScoreRows(comparisonRows) : [];
      const visibleTeamScoreCount = isTeamMode() ? filterTeamScoreRows(teamScoreRows).length : 0;
      const displayTitle = isAgentMode()
        ? (state.activeAgent || 'Select an agent')
        : (isTeamMode() ? 'Team Performance ' : (state.teamFilter === 't1' ? 'MX T1 Team Performance' : 'MX T2 OS Team Performance'));
      const displaySubtitle = isAgentMode()
        ? 'QA Error Tracking & Attribute Feedback Dashboard'
        : 'Team-level QA Error Tracking';

    root.innerHTML = `
      <section class="analysis-card p-6 sm:p-8">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div class="flex min-w-0 items-start gap-4">
            <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-xl font-extrabold text-white shadow-lg shadow-indigo-500/25">
                ${escapeHtml(isAgentMode() ? initialsFor(state.activeAgent) : 'TM')}
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="truncate text-2xl font-extrabold text-[var(--text-primary)]">${escapeHtml(displayTitle)}</h1>
                  <span class="analysis-chip analysis-chip-active">${escapeHtml(isAgentMode() ? 'Target Agent' : 'Team View')}</span>
              </div>
                <div class="mt-1 text-sm text-indigo-300">${escapeHtml(isAgentMode() ? (currentAgentRow?.agentEmail || 'No direct email found in the current filtered data') : 'Showing all evaluations for the selected team')}</div>
              <p class="analysis-muted mt-2 text-sm">${escapeHtml(displaySubtitle)}</p>
            </div>
          </div>
          <div class="flex w-full flex-col gap-3 xl:min-w-0 xl:flex-1">
            <div class="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_270px] xl:items-end">
              <div class="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
                <label class="block">
                  <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Agent Spotlight</span>
                    <select id="agentSelect" class="analysis-select" ${isTeamMode() ? 'disabled' : ''}>
                    ${state.availableAgents.map((agent) => `<option value="${escapeHtml(agent)}" ${agent === state.activeAgent ? 'selected' : ''}>${escapeHtml(agent)}</option>`).join('')}
                  </select>
                </label>
                <label class="block">
                  <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Team Performance</span>
                  <select id="teamFilterSelect" class="analysis-select">
                    <option value="all" ${state.teamFilter === 'all' ? 'selected' : ''}>Agent</option>
                      <option value="team" ${state.teamFilter === 'team' ? 'selected' : ''}>Team</option>
                    <option value="t1" ${state.teamFilter === 't1' ? 'selected' : ''}>MX T1</option>
                    <option value="t2os" ${state.teamFilter === 't2os' ? 'selected' : ''}>MX T2 OS</option>
                  </select>
                </label>
                ${renderAuditorFilter(filterOptions.auditors)}
              </div>
              <div class="flex w-full flex-col gap-3 xl:w-[270px] xl:shrink-0">
                <button id="openLogModalBtn" class="analysis-btn analysis-btn-primary w-full">
                  <i data-lucide="plus" class="h-4 w-4"></i>
                  Log Evaluation
                </button>
                <button id="copyCommentsBtn" class="analysis-btn analysis-btn-secondary w-full !px-4 text-sm">
                  <i data-lucide="copy" class="h-4 w-4"></i>
                  Copy All Attribute Failure Comments
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] xl:items-stretch">
        <div class="xl:h-full">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:h-full">
            <div class="md:col-span-2">
                ${renderTotalEvaluatedCard(kpis.totalEvaluated, kpis.channelBreakdown, isTeamMode() ? 'all' : state.teamFilter)}
            </div>
            <div class="md:col-span-2">
              ${renderCompactFailedAttributesCard(kpis.failedAttributes)}
            </div>
            ${renderAverageScoreCard(kpis.avgScore)}
            ${renderKpiCard('badge-check', '100% Pass Rate', formatPercent(kpis.passRate), `${kpis.perfectCount} perfect audits (0 errors)`)}
          </div>
        </div>
        <article class="analysis-card kpi-card h-full border-rose-400/25">
          <div class="flex items-center justify-between">
            <div class="text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Top Error Category</div>
            <span class="analysis-chip border-rose-400/25 bg-rose-500/12 text-rose-300">Top Error</span>
          </div>
          ${renderTopErrorWidget(frequency, kpis.failedAttributes)}
        </article>
      </section>

      <section class="analysis-card p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <i data-lucide="sparkles" class="h-4 w-4 text-indigo-300"></i>
              <h2 class="text-lg font-extrabold text-[var(--text-primary)]">Score Comparison &amp; Dataset Breakdown</h2>
            </div>
            <p class="analysis-muted mt-2 text-sm">View total points and average scores combined across both sheets or split by source.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            ${renderDatasetButton('combined', 'Combined')}
            ${renderDatasetButton('t1', 'T1 Audits')}
            ${renderDatasetButton('t2os', 'T2 OS Audits')}
          </div>
        </div>
        <div class="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          ${renderBreakdownCard('combined', 'Combined Score', breakdown.combined, state.datasetView === 'combined')}
          ${renderBreakdownCard('t1', 'T1 Score', breakdown.t1, state.datasetView === 't1')}
            ${renderBreakdownCard('t2os', 'T2 OS Score', breakdown.t2os, state.datasetView === 't2os')}
        </div>
          ${isTeamMode() ? renderTeamScoreTable(teamScoreRows, visibleTeamScoreCount) : ''}
      </section>

      <section class="analysis-card p-6">
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div class="flex flex-wrap gap-2">
              ${renderTabButton('tickets', `Audited Tickets (${filteredRows.length})`)}
              ${renderTabButton('distribution', 'Error Distribution')}
              ${renderTabButton('coaching', 'Coaching Feedback Grid')}
            </div>
            <div class="flex flex-wrap gap-2">
              ${renderQuickFilterButton('all', `All Audits (${getComparisonRows().length})`)}
              ${renderQuickFilterButton('errors', `With Errors (${getComparisonRows().filter((row) => row.failedAttributes.length > 0).length})`)}
              ${renderQuickFilterButton('perfect', `100% Score (${getComparisonRows().filter((row) => row.score >= 100).length})`)}
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,1fr))]">
            <label class="block">
              <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Search</span>
              <input id="searchInput" class="analysis-input" placeholder="Search ID, comments, topic, agent..." value="${escapeHtml(state.filters.search)}" />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Date Filter</span>
              <select id="datePresetSelect" class="analysis-select">
                ${renderOption(state.filters.datePreset, 'all', 'All Dates')}
                ${renderOption(state.filters.datePreset, 'month', 'Month')}
                ${renderOption(state.filters.datePreset, 'week', 'Week')}
                ${renderOption(state.filters.datePreset, 'day', 'Day')}
                ${renderOption(state.filters.datePreset, 'custom', 'Custom Range')}
              </select>
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Filter By Date</span>
              <input id="exactDateInput" type="date" class="analysis-input" value="${escapeHtml(state.filters.exactDate)}" />
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Attribute Error</span>
              <select id="attributeFilterSelect" class="analysis-select">
                <option value="all">All Attribute Errors</option>
                ${filterOptions.attributes.map((item) => `<option value="${item.value}" ${item.value === state.filters.attribute ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
              </select>
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Channel</span>
              <select id="channelFilterSelect" class="analysis-select">
                <option value="all">All Channels</option>
                ${filterOptions.channels.map((item) => `<option value="${item.value}" ${item.value === state.filters.channel ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
              </select>
            </label>
            <label class="block">
              <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Ticket Status</span>
              <select id="ticketStatusFilterSelect" class="analysis-select">
                <option value="all">All Ticket Statuses</option>
                ${filterOptions.ticketStatuses.map((item) => `<option value="${item.value}" ${item.value === state.filters.ticketStatus ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label class="block">
              <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Monitoring Type</span>
              <select id="monitoringTypeFilterSelect" class="analysis-select">
                <option value="all">All Monitoring Types</option>
                ${filterOptions.monitoringTypes.map((item) => `<option value="${item.value}" ${item.value === state.filters.monitoringType ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
              </select>
            </label>
            ${renderDateDetailControl()}
            <div class="flex items-end justify-end">
              <button id="resetFiltersBtn" class="analysis-btn analysis-btn-secondary w-full xl:w-auto">
                <i data-lucide="rotate-ccw" class="h-4 w-4"></i>
                Reset Filters
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="analysisTabContent">
        ${state.activeTab === 'tickets' ? renderTicketsTab(filteredRows) : ''}
        ${state.activeTab === 'distribution' ? renderDistributionTab(filteredRows, frequency) : ''}
        ${state.activeTab === 'coaching' ? renderCoachingTab(filteredRows, coaching) : ''}
      </section>
    `;

      bindRenderedEvents(filteredRows);
    renderIcons();
  }

  function renderKpiCard(icon, label, value, subtext, valueClass = '') {
    return `
      <article class="analysis-card kpi-card">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold uppercase tracking-[0.18em] analysis-muted">${escapeHtml(label)}</div>
          <i data-lucide="${icon}" class="h-4 w-4 analysis-muted"></i>
        </div>
        <div class="kpi-value ${valueClass}">${escapeHtml(value)}</div>
        <div class="analysis-muted text-sm">${escapeHtml(subtext)}</div>
      </article>
    `;
  }

  function renderCompactFailedAttributesCard(failedAttributes) {
    return `
      <article class="analysis-card kpi-card kpi-card-compact">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Failed Attributes</div>
            <div class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="kpi-value text-rose-400">${escapeHtml(String(failedAttributes))}</span>
              <span class="analysis-muted text-sm">Total QA error points logged</span>
            </div>
          </div>
          <i data-lucide="triangle-alert" class="mt-0.5 h-4 w-4 shrink-0 analysis-muted"></i>
        </div>
      </article>
    `;
  }

  function renderTotalEvaluatedCard(totalEvaluated, channelBreakdown, teamFilter = 'all') {
    const panel = channelBreakdown[teamFilter] || channelBreakdown.all;
    return `
      <article class="analysis-card kpi-card">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Total Evaluated</div>
          <i data-lucide="clipboard-list" class="h-4 w-4 analysis-muted"></i>
        </div>
        <div class="kpi-value">${escapeHtml(String(totalEvaluated))}</div>
        <div class="analysis-muted text-sm">Audited interactions</div>
        <div class="channel-breakdown-grid">
          <div class="channel-breakdown-card">
            <div class="flex items-center justify-between gap-3">
              <div class="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-primary)] whitespace-nowrap">${escapeHtml(panel.label)}</div>
              <span class="analysis-chip !px-2.5 !py-1">${escapeHtml(String(panel.total))} audits</span>
            </div>
            <div class="channel-breakdown-body">
              <div class="channel-chart-wrap">
                <div class="mini-pie-chart" style="background:${escapeHtml(panel.chart)}">
                  <div class="mini-pie-chart-inner">
                    <span>${escapeHtml(String(panel.total))}</span>
                  </div>
                </div>
              </div>
              <div class="channel-legend">
                ${panel.segments.map((segment) => `
                  <div class="channel-legend-item">
                    <div class="channel-legend-label">
                      <span class="channel-dot" style="background:${escapeHtml(segment.color)}"></span>
                      <span>${escapeHtml(segment.label)}</span>
                    </div>
                      <span class="channel-legend-value">${escapeHtml(String(segment.count))} · Avg ${escapeHtml(formatPercent(segment.averageScore, '0%'))}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderAverageScoreCard(avgScore) {
    return `
      <article class="analysis-card kpi-card">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Average Score</div>
          <i data-lucide="gauge" class="h-4 w-4 analysis-muted"></i>
        </div>
        <div class="kpi-value text-amber-400">${formatPercent(avgScore)}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, avgScore))}%"></div></div>
        <div class="analysis-muted text-sm">Live average across the current filter set</div>
      </article>
    `;
  }

  function renderTopErrorWidget(frequency, totalFailedAttributes) {
    if (!frequency.length) {
      return `
        <div class="flex h-full items-center rounded-2xl border border-dashed border-[var(--border-color)] px-4 py-5 text-sm analysis-muted">
          No failed attributes for the current filter set.
        </div>
      `;
    }

    const topFive = frequency.slice(0, 5);
    return `
      <div class="grid grid-cols-1 gap-3">
        ${topFive.map((item, index) => `
          <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-nav-item)] px-4 py-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="analysis-chip">#${index + 1}</span>
                  <div class="truncate text-base font-extrabold text-[var(--text-primary)]">${escapeHtml(item.label)}</div>
                </div>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2 text-xs">
                <span class="analysis-chip">${item.count} occurrence${item.count === 1 ? '' : 's'}</span>
                <span class="analysis-chip">${totalFailedAttributes ? formatPercent((item.count / totalFailedAttributes) * 100, '0%') : '0%'} of errors</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDatasetButton(key, label) {
    return `<button type="button" class="segment-btn ${state.datasetView === key ? 'active' : ''} px-4 py-2 text-sm" data-dataset-view="${key}">${escapeHtml(label)}</button>`;
  }

  function renderBreakdownCard(key, label, data, isActive) {
    const subtitle = key === 'combined' ? 'Combined current filter set' : datasetMeta(key).label;
    return `
      <button type="button" class="analysis-card breakdown-card ${isActive ? 'active' : ''} flex flex-col gap-4 p-5 text-left" data-dataset-view="${key}">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm font-bold text-[var(--text-primary)]">${escapeHtml(label)}</div>
            <div class="analysis-muted mt-1 text-xs">${escapeHtml(subtitle)}</div>
          </div>
          <span class="analysis-chip">${data.audits} audits</span>
        </div>
        <div class="text-3xl font-extrabold text-[var(--text-primary)]">${formatPercent(data.averageScore)}</div>
        <div class="flex items-center justify-between text-sm">
          <span class="analysis-muted">Total points</span>
          <span class="font-bold text-[var(--text-primary)]">${data.totalPoints.toFixed(2)}</span>
        </div>
      </button>
    `;
  }

  function renderTabButton(key, label) {
    return `<button type="button" class="tab-btn ${state.activeTab === key ? 'active' : ''} px-4 py-2 text-sm" data-tab="${key}">${escapeHtml(label)}</button>`;
  }

  function renderQuickFilterButton(key, label) {
    return `<button type="button" class="quick-filter-btn ${state.quickFilter === key ? 'active' : ''} px-4 py-2 text-sm" data-quick-filter="${key}">${escapeHtml(label)}</button>`;
  }

  function renderOption(current, value, label) {
    return `<option value="${value}" ${current === value ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }

    function scoreTone(value) {
      if (!Number.isFinite(value)) return '';
      if (value >= 90) return 'score-good';
      if (value >= 85) return 'score-mid';
      return 'score-bad';
    }

    function renderScoreCell(value) {
      if (!Number.isFinite(value)) {
        return '<span class="analysis-muted">-</span>';
      }
      return `<span class="team-score-value ${scoreTone(value)}">${escapeHtml(formatPercent(value))}</span>`;
    }

    function renderTeamScoreTable(rows, visibleRows = rows.length) {
      return `
        <div class="mt-5 team-score-shell">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 class="text-base font-extrabold text-[var(--text-primary)]">Agent Score Table</h3>
              <p class="analysis-muted mt-1 text-sm">Average score per agent across the current team-level filter set.</p>
            </div>
            <div class="team-score-toolbar">
              <label class="team-score-search">
                <span class="sr-only">Search team score table</span>
                <input id="teamScoreSearchInput" class="analysis-input" placeholder="Search agent or score..." value="${escapeHtml(state.teamTableSearch)}" />
              </label>
              <label class="team-score-export">
                <span class="sr-only">Export team score table</span>
                <select id="teamScoreExportSelect" class="analysis-select">
                  <option value="">Export</option>
                  <option value="csv">CSV</option>
                  <option value="xlsx">XLSX</option>
                </select>
              </label>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span id="teamScoreVisibleCount" class="analysis-chip">${visibleRows} visible</span>
            <span id="teamScoreTotalCount" class="analysis-chip">${rows.length} total</span>
          </div>
          <div class="team-score-table-wrap">
            <table class="team-score-table">
              <thead>
                <tr>
                  <th>Name of the agent</th>
                  <th>T1 Score</th>
                  <th>T2 OS Score</th>
                  <th>Overall Score</th>
                </tr>
              </thead>
              <tbody id="teamScoreTableBody">
                ${rows.length ? rows.map((row) => `
                  <tr data-team-score-row data-search-text="${escapeHtml([
                    row.agent,
                    Number.isFinite(row.t1Score) ? formatPercent(row.t1Score) : '',
                    Number.isFinite(row.t2osScore) ? formatPercent(row.t2osScore) : '',
                    Number.isFinite(row.overallScore) ? formatPercent(row.overallScore) : ''
                  ].join(' ').toLowerCase())}">
                    <td class="team-score-agent-cell">${escapeHtml(row.agent)}</td>
                    <td>${renderScoreCell(row.t1Score)}</td>
                    <td>${renderScoreCell(row.t2osScore)}</td>
                    <td>${renderScoreCell(row.overallScore)}</td>
                  </tr>
                `).join('') : `
                  <tr id="teamScoreEmptyRow">
                    <td colspan="4" class="team-score-empty">No team score rows match the current table search.</td>
                  </tr>
                `}
                ${rows.length ? `
                  <tr id="teamScoreEmptyRow" hidden>
                    <td colspan="4" class="team-score-empty">No team score rows match the current table search.</td>
                  </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function getCurrentVisibleTeamScoreRows() {
      return filterTeamScoreRows(buildTeamScoreRows(getComparisonRows()));
    }

    function applyTeamScoreTableSearch() {
      const tableBody = document.getElementById('teamScoreTableBody');
      if (!tableBody) return;

      const needle = String(state.teamTableSearch || '').trim().toLowerCase();
      const rows = Array.from(tableBody.querySelectorAll('[data-team-score-row]'));
      let visibleCount = 0;

      rows.forEach((row) => {
        const haystack = String(row.getAttribute('data-search-text') || '').toLowerCase();
        const matches = !needle || haystack.includes(needle);
        row.hidden = !matches;
        if (matches) visibleCount += 1;
      });

      const visibleChip = document.getElementById('teamScoreVisibleCount');
      if (visibleChip) visibleChip.textContent = `${visibleCount} visible`;

      const emptyRow = document.getElementById('teamScoreEmptyRow');
      if (emptyRow) emptyRow.hidden = visibleCount > 0;
    }

    function buildTeamScoreExportRows(rows) {
      return rows.map((row) => ({
        'Name of the agent': row.agent,
        'T1 Score': Number.isFinite(row.t1Score) ? formatPercent(row.t1Score) : '',
        'T2 OS Score': Number.isFinite(row.t2osScore) ? formatPercent(row.t2osScore) : '',
        'Overall Score': Number.isFinite(row.overallScore) ? formatPercent(row.overallScore) : ''
      }));
    }

    function downloadBlob(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }

    function exportTeamScoreCsv(rows) {
      const exportRows = buildTeamScoreExportRows(rows);
      const headers = ['Name of the agent', 'T1 Score', 'T2 OS Score', 'Overall Score'];
      const lines = [
        headers.join(','),
        ...exportRows.map((row) => headers.map((key) => `"${String(row[key] || '').replace(/"/g, '""')}"`).join(','))
      ];
      downloadBlob('analysis-team-score-table.csv', lines.join('\n'), 'text/csv;charset=utf-8;');
    }

    function exportTeamScoreXlsx(rows) {
      if (!window.XLSX) {
        showToast('XLSX export library is not available.', 'error');
        return;
      }
      const exportRows = buildTeamScoreExportRows(rows);
      const worksheet = window.XLSX.utils.json_to_sheet(exportRows);
      const workbook = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(workbook, worksheet, 'Team Scores');
      window.XLSX.writeFile(workbook, 'analysis-team-score-table.xlsx');
    }

  function renderDateDetailControl() {
    if (state.filters.datePreset === 'month') {
      return `
        <label class="block">
          <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Month</span>
          <input id="monthValueInput" type="month" class="analysis-input" value="${escapeHtml(state.filters.monthValue)}" />
        </label>
      `;
    }
    if (state.filters.datePreset === 'week') {
      return `
        <label class="block">
          <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Week</span>
          <input id="weekValueInput" type="week" class="analysis-input" value="${escapeHtml(state.filters.weekValue)}" />
        </label>
      `;
    }
    if (state.filters.datePreset === 'day') {
      return `
        <label class="block">
          <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">Day</span>
          <input id="dayValueInput" type="date" class="analysis-input" value="${escapeHtml(state.filters.dayValue)}" />
        </label>
      `;
    }
    if (state.filters.datePreset === 'custom') {
      return `
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="block">
            <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">From</span>
            <input id="customFromInput" type="date" class="analysis-input" value="${escapeHtml(state.filters.customFrom)}" />
          </label>
          <label class="block">
            <span class="mb-2 block text-xs font-bold uppercase tracking-[0.18em] analysis-muted">To</span>
            <input id="customToInput" type="date" class="analysis-input" value="${escapeHtml(state.filters.customTo)}" />
          </label>
        </div>
      `;
    }
    return `
      <div class="flex items-end">
        <div class="analysis-card flex min-h-[50px] w-full items-center rounded-2xl border border-dashed px-4 py-3 text-sm analysis-muted">
          All dates are currently included.
        </div>
      </div>
    `;
  }

  function renderTicketsTab(rows) {
    if (!rows.length) {
      return renderEmptyState('No evaluations match the current filters.', 'Try broadening the date range, quick filter, or selected attribute.');
    }

    return `
      <div class="flex flex-col gap-4">
        ${rows.map((row) => `
          <article class="analysis-card ticket-card">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex flex-wrap items-center gap-2">
                <span class="analysis-chip ${row.sourceAccentClass}">${escapeHtml(row.sourceLabel)}</span>
                ${row.channel ? `<span class="analysis-chip">${escapeHtml(row.channel)}</span>` : ''}
                ${row.ticketStatus ? `<span class="analysis-chip">${escapeHtml(row.ticketStatus)}</span>` : ''}
                ${row.monitoringType ? `<span class="analysis-chip">${escapeHtml(row.monitoringType)}</span>` : ''}
                ${row.certification ? `<span class="analysis-chip">Cert: ${escapeHtml(row.certification)}</span>` : ''}
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="analysis-chip">${escapeHtml(formatDateOnly(row.date))}</span>
                <span class="analysis-chip">${escapeHtml(scoreToDisplay(row.score))}</span>
                ${row.url ? `<button type="button" class="analysis-btn analysis-btn-secondary !px-3 !py-2 text-sm" data-follow-link="${escapeHtml(row.rowId)}"><i data-lucide="external-link" class="h-4 w-4"></i>Open</button>` : ''}
                <button type="button" class="analysis-btn analysis-btn-danger !px-3 !py-2 text-sm" data-delete-row="${escapeHtml(row.rowId)}">
                  <i data-lucide="trash-2" class="h-4 w-4"></i>Delete
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-xl font-extrabold text-[var(--text-primary)]">${escapeHtml(row.agent)}</h3>
                  ${row.conversationId ? `<span class="analysis-chip">ID: ${escapeHtml(row.conversationId)}</span>` : ''}
                </div>
                <div class="analysis-muted text-sm">${escapeHtml(row.topic || 'No interaction topic recorded')}</div>
                <div class="flex flex-wrap gap-2 text-sm">
                  ${row.smeName ? `<span class="analysis-chip">SME: ${escapeHtml(row.smeName)}</span>` : ''}
                  ${row.smeAnswer ? `<span class="analysis-chip">SME Answer: ${escapeHtml(row.smeAnswer)}</span>` : ''}
                  ${row.smeFollowing ? `<span class="analysis-chip">SME Process: ${escapeHtml(row.smeFollowing)}</span>` : ''}
                  ${row.salesValue ? `<span class="analysis-chip">Sales: ${escapeHtml(row.salesValue)}</span>` : ''}
                  ${row.fitnessFluency ? `<span class="analysis-chip">Fitness Fluency: ${escapeHtml(row.fitnessFluency)}</span>` : ''}
                  ${row.retained ? `<span class="analysis-chip">Retained: ${escapeHtml(row.retained)}</span>` : ''}
                  ${row.takerName ? `<span class="analysis-chip">Auditor: ${escapeHtml(row.takerName)}</span>` : ''}
                </div>
              </div>
              <div class="analysis-card rounded-2xl p-4">
                <div class="text-sm font-bold text-[var(--text-primary)]">Sales Feedback</div>
                <div class="analysis-muted mt-2 text-sm">${escapeHtml(row.salesComments || 'No sales feedback captured for this audit.')}</div>
              </div>
            </div>

            <div>
              <div class="mb-3 flex items-center justify-between">
                <div class="text-sm font-bold uppercase tracking-[0.16em] text-rose-300">Failed QA Attributes (${row.failedAttributes.length})</div>
                <div class="analysis-muted text-xs">No / negative-comment attributes only</div>
              </div>
              <div class="grid grid-cols-1 gap-3">
                ${row.failedAttributes.length ? row.failedAttributes.map((item) => `
                  <div class="ticket-attr">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-extrabold text-rose-300">${escapeHtml(item.label)}</span>
                        ${item.score ? `<span class="analysis-chip">Status: ${escapeHtml(String(item.score))}</span>` : ''}
                      </div>
                      <div class="mt-2 whitespace-pre-wrap text-sm text-[var(--text-primary)]">${escapeHtml(item.comment || 'Marked as a failure with no written comment.')}</div>
                    </div>
                  </div>
                `).join('') : `
                  <div class="analysis-card rounded-2xl p-5 text-sm analysis-muted">
                    No failed attributes remain after the current filters.
                  </div>
                `}
              </div>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderDistributionTab(rows, frequency) {
    if (!rows.length || !frequency.length) {
      return renderEmptyState('No failed attributes are available for the current filter set.', 'Try switching to Combined view or the "With Errors" quick filter.');
    }
    const maxCount = frequency[0].count || 1;
    return `
      <div class="analysis-card p-6">
        <div class="mb-6">
          <h3 class="text-2xl font-extrabold text-[var(--text-primary)]">Failed Attribute Frequency</h3>
            <p class="analysis-muted mt-2 text-sm">${escapeHtml(isAgentMode() ? `Distribution of QA attribute errors for ${state.activeAgent} across the filtered evaluation set.` : 'Distribution of QA attribute errors across the current filtered team view.')}</p>
        </div>
        <div>
          ${frequency.map((item) => `
            <div class="distribution-row">
              <div class="mb-2 flex items-center justify-between gap-3 text-sm">
                <span class="font-bold text-[var(--text-primary)]">${escapeHtml(item.label)}</span>
                <span class="analysis-muted">${item.count} error${item.count === 1 ? '' : 's'}</span>
              </div>
              <div class="distribution-track">
                <div class="distribution-fill" style="width:${Math.max(6, (item.count / maxCount) * 100)}%"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderCoachingTab(rows, coaching) {
    if (!rows.length || !coaching.length) {
      return renderEmptyState('No coaching comments are available for the current filter set.', 'Comments show up here when a failed attribute has written feedback.');
    }
    return `
      <div class="flex flex-col gap-4">
        <div class="flex justify-end">
          <button type="button" class="analysis-btn analysis-btn-secondary" data-copy-grouped-comments="all">
            <i data-lucide="copy" class="h-4 w-4"></i>
            Copy All Grouped Comments
          </button>
        </div>
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        ${coaching.map((group) => `
          <article class="analysis-card feedback-card">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-extrabold text-[var(--text-primary)]">${escapeHtml(group.label)}</h3>
                <p class="analysis-muted mt-1 text-sm">${group.items.length} comment${group.items.length === 1 ? '' : 's'} linked to this attribute.</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="analysis-chip">${group.items.length}</span>
                <button type="button" class="analysis-btn analysis-btn-secondary !px-3 !py-2 text-sm" data-copy-grouped-comments="${escapeHtml(normalizeKey(group.label))}">
                  <i data-lucide="copy" class="h-4 w-4"></i>
                  Copy
                </button>
              </div>
            </div>
            <div class="flex max-h-[420px] flex-col gap-3 overflow-auto pr-1">
              ${group.items.map((item) => `
                <div class="feedback-item">
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    <span class="analysis-chip">${escapeHtml(item.agent)}</span>
                    <span class="analysis-chip">${escapeHtml(item.sourceLabel)}</span>
                    ${item.conversationId ? `<span class="analysis-chip">${escapeHtml(item.conversationId)}</span>` : ''}
                  </div>
                  <div class="mt-3 whitespace-pre-wrap text-sm text-[var(--text-primary)]">${escapeHtml(item.comment)}</div>
                  <div class="analysis-muted mt-3 text-xs">${escapeHtml(formatDateOnly(item.date))}</div>
                </div>
              `).join('')}
            </div>
          </article>
        `).join('')}
        </div>
      </div>
    `;
  }

  function renderEmptyState(title, subtitle) {
    return `
      <section class="analysis-card p-10 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-300">
          <i data-lucide="inbox" class="h-6 w-6"></i>
        </div>
        <h3 class="text-xl font-extrabold text-[var(--text-primary)]">${escapeHtml(title)}</h3>
        <p class="analysis-muted mt-3 text-sm">${escapeHtml(subtitle)}</p>
      </section>
    `;
  }

    function bindRenderedEvents(filteredRows) {
    const agentSelect = document.getElementById('agentSelect');
    if (agentSelect) {
      agentSelect.addEventListener('change', (event) => {
          if (isTeamMode()) return;
        state.activeAgent = event.target.value;
        render();
      });
    }

    const teamFilterSelect = document.getElementById('teamFilterSelect');
    if (teamFilterSelect) {
      teamFilterSelect.addEventListener('change', (event) => {
        state.teamFilter = event.target.value;
        if (state.teamFilter === 't1' && state.datasetView === 't2os') {
          state.datasetView = 'combined';
        }
        if (state.teamFilter === 't2os' && state.datasetView === 't1') {
          state.datasetView = 'combined';
        }
        render();
      });
    }

    const copyBtn = document.getElementById('copyCommentsBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const summary = buildCopySummary(filteredRows);
        if (!summary) {
          showToast('No filtered failure comments are available to copy.', 'warning');
          return;
        }
        const copied = await copyText(summary);
        if (copied) {
          showToast('Copied the current failure comments summary.');
        } else {
          showToast('Clipboard access failed in this browser.', 'error');
        }
      });
    }

    document.querySelectorAll('[data-copy-grouped-comments]').forEach((button) => {
      button.addEventListener('click', async () => {
        const selectedKey = button.getAttribute('data-copy-grouped-comments');
        const summary = buildGroupedCoachingSummary(buildCoachingGroups(filteredRows), selectedKey === 'all' ? '' : selectedKey);
        if (!summary) {
          showToast('No coaching comments are available to copy.', 'warning');
          return;
        }
        const copied = await copyText(summary);
        if (copied) {
          showToast(selectedKey === 'all' ? 'Copied all grouped coaching comments.' : 'Copied the selected attribute comments.');
        } else {
          showToast('Clipboard access failed in this browser.', 'error');
        }
      });
    });

    const openLogBtn = document.getElementById('openLogModalBtn');
    if (openLogBtn) openLogBtn.addEventListener('click', openLogModal);

    document.querySelectorAll('[data-dataset-view]').forEach((button) => {
      button.addEventListener('click', () => {
        state.datasetView = button.getAttribute('data-dataset-view');
        render();
      });
    });

    document.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeTab = button.getAttribute('data-tab');
        render();
      });
    });

    document.querySelectorAll('[data-quick-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.quickFilter = button.getAttribute('data-quick-filter');
        render();
      });
    });

    bindFilterControl('searchInput', 'input', (value) => { state.filters.search = value; });
    bindFilterControl('datePresetSelect', 'change', (value) => { state.filters.datePreset = value; });
    bindFilterControl('exactDateInput', 'change', (value) => { state.filters.exactDate = value; });
    bindFilterControl('attributeFilterSelect', 'change', (value) => { state.filters.attribute = value; });
    bindFilterControl('channelFilterSelect', 'change', (value) => { state.filters.channel = value; });
    bindFilterControl('ticketStatusFilterSelect', 'change', (value) => { state.filters.ticketStatus = value; });
    bindFilterControl('monitoringTypeFilterSelect', 'change', (value) => { state.filters.monitoringType = value; });
    bindFilterControl('monthValueInput', 'change', (value) => { state.filters.monthValue = value; });
    bindFilterControl('weekValueInput', 'change', (value) => { state.filters.weekValue = value; });
    bindFilterControl('dayValueInput', 'change', (value) => { state.filters.dayValue = value; });
    bindFilterControl('customFromInput', 'change', (value) => { state.filters.customFrom = value; });
    bindFilterControl('customToInput', 'change', (value) => { state.filters.customTo = value; });

    const auditorOptions = getFilterOptionSets().auditors;
    const auditorAll = document.getElementById('auditorFilterAll');
    const auditorDetails = document.getElementById('auditorFilterDetails');
    if (auditorDetails) {
      auditorDetails.addEventListener('toggle', () => {
        state.auditorFilterOpen = auditorDetails.open;
      });
    }
    if (auditorAll) {
      auditorAll.addEventListener('change', (event) => {
        state.auditorFilterOpen = true;
        state.filters.auditors = event.target.checked ? auditorOptions.map((item) => item.value) : [];
        render();
      });
    }

    document.querySelectorAll('[data-auditor-filter-option]').forEach((input) => {
      input.addEventListener('change', () => {
        state.auditorFilterOpen = true;
        const selectedValues = Array.from(document.querySelectorAll('[data-auditor-filter-option]:checked')).map((element) => element.value);
        state.filters.auditors = normalizeAuditorSelection(selectedValues, auditorOptions);
        render();
      });
    });

    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetFilters();
        render();
      });
    }

      const teamScoreSearchInput = document.getElementById('teamScoreSearchInput');
      if (teamScoreSearchInput) {
        teamScoreSearchInput.addEventListener('input', (event) => {
          state.teamTableSearch = event.target.value;
          applyTeamScoreTableSearch();
        });
      }

      const teamScoreExportSelect = document.getElementById('teamScoreExportSelect');
      if (teamScoreExportSelect) {
        teamScoreExportSelect.addEventListener('change', (event) => {
          const format = event.target.value;
          const exportRows = getCurrentVisibleTeamScoreRows();
          if (format === 'csv') {
            exportTeamScoreCsv(exportRows);
          } else if (format === 'xlsx') {
            exportTeamScoreXlsx(exportRows);
          }
          event.target.value = '';
        });
      }

      applyTeamScoreTableSearch();

    document.querySelectorAll('[data-follow-link]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = state.rows.find((item) => item.rowId === button.getAttribute('data-follow-link'));
        if (row && row.url) window.open(row.url, '_blank', 'noopener,noreferrer');
      });
    });

    document.querySelectorAll('[data-delete-row]').forEach((button) => {
      button.addEventListener('click', () => {
        const rowId = button.getAttribute('data-delete-row');
        state.deletedRowIds.add(rowId);
        showToast('Removed the evaluation from the current view.');
        render();
      });
    });

  }

  function bindFilterControl(id, eventName, setter) {
    const element = document.getElementById(id);
    if (!element) return;
    element.addEventListener(eventName, (event) => {
      setter(event.target.value);
      render();
    });
  }

  function resetFilters() {
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setDate(now.getDate() - 30);
    state.filters = {
      search: '',
      datePreset: 'custom',
      exactDate: '',
      monthValue: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      weekValue: getCurrentWeekValue(now),
      dayValue: now.toISOString().slice(0, 10),
      customFrom: lastMonth.toISOString().slice(0, 10),
      customTo: now.toISOString().slice(0, 10),
      attribute: 'all',
      channel: 'all',
      ticketStatus: 'all',
      monitoringType: 'all',
      auditors: []
    };
    state.quickFilter = 'all';
  }

  function getCurrentWeekValue(date) {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target) / 604800000);
    return `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    renderIcons();
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function openLogModal() {
    const form = document.getElementById('logEvaluationForm');
    if (form) form.reset();
    const dateInput = document.getElementById('logDate');
    if (dateInput) dateInput.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const agentInput = document.getElementById('logAgent');
    if (agentInput) agentInput.value = state.activeAgent || '';
    openModal('logModal');
  }

  function bindStaticEvents() {
    document.querySelectorAll('[data-close-modal]').forEach((button) => {
      button.addEventListener('click', () => closeModal(button.getAttribute('data-close-modal')));
    });

    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal(overlay.id);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach((overlay) => closeModal(overlay.id));
      }
    });

    const logForm = document.getElementById('logEvaluationForm');
    if (logForm) {
      logForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const source = document.getElementById('logSource').value;
        const agent = document.getElementById('logAgent').value.trim();
        const date = document.getElementById('logDate').value;
        const conversationId = document.getElementById('logConversationId').value.trim();
        const score = parseScore(document.getElementById('logScore').value);
        const channel = document.getElementById('logChannel').value.trim();
        const ticketStatus = document.getElementById('logTicketStatus').value.trim();
        const monitoringType = document.getElementById('logMonitoringType').value.trim();
        const topic = document.getElementById('logTopic').value.trim();
        const failedAttributesText = document.getElementById('logFailedAttributes').value.trim();

        if (!agent || !date) {
          showToast('Agent and evaluation date are required.', 'warning');
          return;
        }

        const dataset = datasetMeta(source);
        const failedAttributes = failedAttributesText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, index) => {
            const parts = line.split(':');
            const label = parts.shift() || `Attribute ${index + 1}`;
            const comment = parts.join(':').trim();
            return {
              label: cleanAttributeLabel(label, source),
              score: 'No',
              comment,
              scoreKey: `local_score_${index}`,
              commentKey: `local_comment_${index}`,
              definition: getDefinitionForLabel(label, source),
              failed: true
            };
          });

        const uiRow = {
          rowId: `${source}:local:${Date.now()}`,
          baseId: `local-${Date.now()}`,
          datasetKey: source,
          sourceLabel: dataset.label,
          sourceShortLabel: dataset.shortLabel,
          sourceAccentClass: dataset.accentClass,
          raw: {},
          date,
          dateObj: new Date(date),
          agent,
          agentEmail: '',
          conversationId,
          score,
          ticketStatus,
          monitoringType,
          topic,
          url: '',
          channel,
          takerName: 'Local Entry',
          smeName: '',
          smeAnswer: '',
          smeFollowing: '',
          salesValue: '',
          salesComments: '',
          certification: '',
          fitnessFluency: '',
          coachingDelivered: '',
          retained: '',
          failedAttributes
        };

        state.uiOnlyRows.unshift(uiRow);
        rebuildRows();
        closeModal('logModal');
        showToast('Added a local evaluation row to the current view.');
        render();
      });
    }

  }

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  async function init() {
    state.loading = true;
    state.loadError = '';
    render();
    try {
      resetFilters();
      await loadConfig();
      await Promise.all([
        fetchDefinitions('t1'),
        fetchDefinitions('t2os'),
        fetchDataset('t1'),
        fetchDataset('t2os')
      ]);
      rebuildRows();
      state.loading = false;
      render();
    } catch (error) {
      console.error('Analysis dashboard failed to initialize:', error);
      state.loading = false;
      state.loadError = 'Supabase data could not be loaded. Please verify the table access and try again.';
      render();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindStaticEvents();
    init();
  });
})();
