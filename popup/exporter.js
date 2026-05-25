(function attachPlusStatusReporter(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.PlusStatusReporter = api;
})(typeof globalThis !== 'undefined' ? globalThis : window, function createPlusStatusReporter() {
  function normalizeString(value = '') {
    return String(value || '').trim();
  }

  function normalizeEmailValue(value = '') {
    const email = normalizeString(value);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  }

  function normalizeTimestamp(value) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const date = new Date(value > 1e11 ? value : value * 1000);
      return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  function stripUnavailable(value) {
    if (Array.isArray(value)) {
      return value.map(stripUnavailable);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
          .map(([key, entryValue]) => [key, stripUnavailable(entryValue)])
      );
    }
    return value;
  }

  function normalizeGroupNames(value) {
    const parts = Array.isArray(value)
      ? value
      : String(value || '').split(/[\r\n,;]+/);
    const seen = new Set();
    const names = [];
    for (const item of parts) {
      const name = normalizeString(item);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) {
        continue;
      }
      seen.add(key);
      names.push(name);
    }
    return names.length ? names : ['condex'];
  }

  function buildAccountReport(session = {}, options = {}) {
    const email = normalizeEmailValue(session.email || session.user?.email || options.email);
    const planType = normalizeString(
      session.planType
      || session.plan_type
      || session.account?.planType
      || session.account?.plan_type
    );
    const accountId = normalizeString(
      session.accountId
      || session.account_id
      || session.chatgptAccountId
      || session.chatgpt_account_id
      || session.account?.id
    );
    const userId = normalizeString(
      session.userId
      || session.user_id
      || session.chatgptUserId
      || session.chatgpt_user_id
      || session.user?.id
    );
    const expiresAt = normalizeTimestamp(session.expires || session.expiresAt || session.expires_at);
    const isPlus = /plus|team|pro|enterprise|business/i.test(planType);

    return stripUnavailable({
      email,
      name: normalizeString(options.name) || email || 'ChatGPT Account',
      platform: 'openai',
      logged_in: Boolean(email || userId || accountId),
      plus_detected: isPlus,
      plan_type: planType,
      chatgpt_account_id: accountId,
      chatgpt_user_id: userId,
      session_expires_at: expiresAt,
      group_names: normalizeGroupNames(options.groupNames || 'condex'),
      checked_at: normalizeTimestamp(options.now || new Date()),
    });
  }

  function buildExportDocument(session = {}, options = {}) {
    return {
      exported_at: normalizeTimestamp(options.now || new Date()),
      report_type: 'chatgpt_plus_status',
      contains_credentials: false,
      accounts: [
        buildAccountReport(session, options),
      ],
    };
  }

  function buildFileName(document = {}) {
    const account = Array.isArray(document.accounts) ? document.accounts[0] : null;
    const rawName = account?.email || account?.name || 'chatgpt-plus-status';
    const safeName = normalizeString(rawName)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'chatgpt-plus-status';
    return `plus-status-${safeName}.json`;
  }

  return {
    buildAccountReport,
    buildExportDocument,
    buildFileName,
  };
});
