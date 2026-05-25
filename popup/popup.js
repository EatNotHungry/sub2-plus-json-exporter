(function initPopup() {
  const reporter = window.PlusStatusReporter;
  const STORAGE_KEY = 'plusStatusReporterState';
  const elements = {
    readBtn: document.getElementById('readBtn'),
    copyBtn: document.getElementById('copyBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    appendBatchBtn: document.getElementById('appendBatchBtn'),
    downloadBatchBtn: document.getElementById('downloadBatchBtn'),
    statusText: document.getElementById('statusText'),
    groupNamesInput: document.getElementById('groupNamesInput'),
    accountsInput: document.getElementById('accountsInput'),
    loadQueueBtn: document.getElementById('loadQueueBtn'),
    openLoginBtn: document.getElementById('openLoginBtn'),
    queueStatus: document.getElementById('queueStatus'),
    jsonOutput: document.getElementById('jsonOutput'),
    emailValue: document.getElementById('emailValue'),
    planValue: document.getElementById('planValue'),
    accountIdValue: document.getElementById('accountIdValue'),
    expiresValue: document.getElementById('expiresValue'),
  };

  const missingElements = Object.entries(elements)
    .filter(([, element]) => !element)
    .map(([key]) => key);
  if (missingElements.length) {
    throw new Error(`Popup 初始化失败，缺少元素：${missingElements.join(', ')}`);
  }

  let currentDocument = null;
  let queue = [];
  let queueIndex = 0;
  let batchDocument = createEmptyBatchDocument();

  function createEmptyBatchDocument() {
    return {
      exported_at: new Date().toISOString(),
      report_type: 'chatgpt_plus_status_batch',
      contains_credentials: false,
      accounts: [],
    };
  }

  function setStatus(message, isError = false) {
    elements.statusText.textContent = message;
    elements.statusText.style.color = isError ? '#a12622' : '#5d6b7a';
  }

  function setBusy(isBusy) {
    elements.readBtn.disabled = isBusy;
    elements.readBtn.textContent = isBusy ? '检测中' : '检测并下载';
  }

  function setActionsEnabled(enabled) {
    elements.copyBtn.disabled = !enabled;
    elements.downloadBtn.disabled = !enabled;
    elements.appendBatchBtn.disabled = !enabled;
  }

  function getOptions() {
    return {
      groupNames: elements.groupNamesInput.value,
      now: new Date(),
    };
  }

  function renderSummary(document) {
    const account = document?.accounts?.[0] || {};
    elements.emailValue.textContent = account.email || account.name || '-';
    elements.planValue.textContent = account.plan_type || '-';
    elements.accountIdValue.textContent = account.chatgpt_account_id || '-';
    elements.expiresValue.textContent = account.session_expires_at || '-';
  }

  function renderQueueStatus() {
    elements.queueStatus.textContent = `${Math.min(queueIndex + (queue.length ? 1 : 0), queue.length)} / ${queue.length}`;
    elements.openLoginBtn.disabled = !queue[queueIndex];
    elements.downloadBatchBtn.disabled = !batchDocument.accounts.length;
  }

  function parseAccounts(text = '') {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const emailMatch = line.match(/[^\s,;，；|]+@[^\s,;，；|]+\.[^\s,;，；|]+/);
        return emailMatch ? { email: emailMatch[0] } : null;
      })
      .filter(Boolean);
  }

  async function saveState() {
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        accountsText: elements.accountsInput.value,
        queue,
        queueIndex,
        batchDocument,
        settings: {
          groupNames: elements.groupNamesInput.value,
        },
      },
    });
  }

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const state = stored?.[STORAGE_KEY] || {};
    elements.accountsInput.value = state.accountsText || '';
    if (state.settings) {
      elements.groupNamesInput.value = state.settings.groupNames || 'codex';
    }
    queue = Array.isArray(state.queue) ? state.queue : [];
    queueIndex = Math.max(0, Number(state.queueIndex) || 0);
    batchDocument = state.batchDocument && Array.isArray(state.batchDocument.accounts)
      ? state.batchDocument
      : createEmptyBatchDocument();
    renderQueueStatus();
  }

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs[0];
    if (!tab?.id) {
      throw new Error('未找到当前标签页。');
    }
    return tab;
  }

  function isSupportedUrl(url = '') {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host === 'chatgpt.com'
        || host.endsWith('.chatgpt.com')
        || host === 'chat.openai.com'
        || host === 'openai.com'
        || host.endsWith('.openai.com');
    } catch {
      return false;
    }
  }

  async function readStatusFromTab(tabId) {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const decodeBase64UrlSegment = (segment = '') => {
          const normalized = String(segment || '').replace(/-/g, '+').replace(/_/g, '/');
          if (!normalized) return '';
          const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
          try {
            const binary = atob(padded);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
            return new TextDecoder().decode(bytes);
          } catch {
            return '';
          }
        };
        const parseClaims = (token = '') => {
          const parts = String(token || '').split('.');
          if (parts.length !== 3) return {};
          try {
            return JSON.parse(decodeBase64UrlSegment(parts[1]));
          } catch {
            return {};
          }
        };
        const response = await fetch('/api/auth/session', { credentials: 'include' });
        const session = await response.json().catch(() => ({}));
        const claims = parseClaims(session?.accessToken);
        const authClaims = claims['https://api.openai.com/auth'] || {};
        return {
          ok: response.ok,
          status: response.status,
          email: session?.user?.email || claims.email || '',
          user: {
            id: session?.user?.id || authClaims.chatgpt_user_id || authClaims.user_id || '',
            email: session?.user?.email || claims.email || '',
          },
          account: {
            id: session?.account?.id || authClaims.chatgpt_account_id || '',
            planType: session?.account?.planType || session?.account?.plan_type || authClaims.chatgpt_plan_type || '',
          },
          expires: session?.expires || '',
          url: location.href,
        };
      },
    });
    const value = result?.result;
    if (!value?.ok) {
      throw new Error(`读取 /api/auth/session 失败（HTTP ${value?.status || 'unknown'}）。`);
    }
    if (!value.email && !value.user?.id && !value.account?.id) {
      throw new Error('当前页面未检测到有效登录状态，请确认 ChatGPT 已登录。');
    }
    return value;
  }

  async function readAndBuild() {
    setBusy(true);
    setActionsEnabled(false);
    setStatus('正在检测当前页面的 ChatGPT Plus 状态...');
    try {
      const tab = await getActiveTab();
      if (!isSupportedUrl(tab.url)) {
        throw new Error('请先切到已登录的 ChatGPT / OpenAI 页面。');
      }
      const session = await readStatusFromTab(tab.id);
      currentDocument = reporter.buildExportDocument(session, getOptions());
      elements.jsonOutput.value = JSON.stringify(currentDocument, null, 2);
      renderSummary(currentDocument);
      setActionsEnabled(true);
      const hasBatchInput = parseAccounts(elements.accountsInput.value).length > 0;
      if (!hasBatchInput) {
        await downloadObject(currentDocument, reporter.buildFileName(currentDocument));
        setStatus('已生成并下载当前账号 Plus 状态报告。');
      } else {
        setStatus('已生成 Plus 状态报告，可加入批量结果。');
      }
      await saveState();
    } catch (error) {
      currentDocument = null;
      elements.jsonOutput.value = '';
      renderSummary(null);
      setStatus(error?.message || String(error || '检测失败。'), true);
    } finally {
      setBusy(false);
    }
  }

  async function copyJson() {
    if (!currentDocument) return;
    await navigator.clipboard.writeText(elements.jsonOutput.value);
    setStatus('JSON 已复制到剪贴板。');
  }

  async function downloadJson() {
    if (!currentDocument) return;
    await downloadObject(currentDocument, reporter.buildFileName(currentDocument));
    setStatus('JSON 下载已开始。');
  }

  async function downloadObject(object, fileName) {
    const blob = new Blob([JSON.stringify(object, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      await chrome.downloads.download({ url, filename: fileName, saveAs: false });
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function rebuildFromCurrentOutput() {
    if (!currentDocument) {
      await saveState();
      return;
    }
    await readAndBuild();
  }

  async function loadQueue() {
    try {
      elements.loadQueueBtn.disabled = true;
      elements.loadQueueBtn.textContent = '载入中';
      const rawText = elements.accountsInput.value;
      queue = parseAccounts(rawText);
      queueIndex = 0;
      batchDocument = createEmptyBatchDocument();
      currentDocument = null;
      elements.jsonOutput.value = '';
      renderSummary(null);
      setActionsEnabled(false);
      renderQueueStatus();
      await saveState();
      if (queue.length) {
        elements.loadQueueBtn.textContent = '已载入';
        setTimeout(() => {
          elements.loadQueueBtn.textContent = '载入队列';
          elements.loadQueueBtn.disabled = false;
        }, 900);
        setStatus(`已载入 ${queue.length} 个账号，当前：${queue[0].email}`);
        return;
      }
      setStatus(rawText.trim() ? '没有识别到有效邮箱，请检查格式。' : '账号列表为空。', true);
    } catch (error) {
      setStatus(error?.message || String(error || '载入队列失败。'), true);
    } finally {
      if (elements.loadQueueBtn.textContent !== '已载入') {
        elements.loadQueueBtn.textContent = '载入队列';
        elements.loadQueueBtn.disabled = false;
      }
    }
  }

  function buildLoginUrl(email) {
    const url = new URL('https://chatgpt.com/auth/login');
    url.searchParams.set('login_hint', email);
    return url.toString();
  }

  async function openCurrentLogin() {
    const current = queue[queueIndex];
    if (!current) return;
    await chrome.tabs.create({ url: buildLoginUrl(current.email), active: true });
    setStatus(`已打开 ChatGPT 登录页：${current.email}。请手动完成登录后点击“检测并下载”。`);
  }

  async function appendCurrentToBatch() {
    const account = currentDocument?.accounts?.[0];
    if (!account) return;
    const current = queue[queueIndex];
    const accountEmail = account.email || current?.email || '';
    const existingIndex = batchDocument.accounts.findIndex((item) => {
      const existingEmail = item?.email || '';
      return existingEmail && accountEmail && existingEmail.toLowerCase() === accountEmail.toLowerCase();
    });
    if (existingIndex >= 0) {
      batchDocument.accounts[existingIndex] = account;
    } else {
      batchDocument.accounts.push(account);
    }
    batchDocument.exported_at = new Date().toISOString();
    if (current && queueIndex < queue.length - 1) {
      queueIndex += 1;
    }
    currentDocument = null;
    elements.jsonOutput.value = JSON.stringify(batchDocument, null, 2);
    renderSummary(null);
    setActionsEnabled(false);
    renderQueueStatus();
    await saveState();
    setStatus(`已加入批量结果：${accountEmail || '当前账号'}。`);
  }

  async function downloadBatch() {
    if (!batchDocument.accounts.length) return;
    batchDocument.exported_at = new Date().toISOString();
    await downloadObject(batchDocument, `plus-status-batch-${batchDocument.accounts.length}.json`);
    await saveState();
    setStatus(`已下载批量状态报告，共 ${batchDocument.accounts.length} 个账号。`);
  }

  elements.readBtn.addEventListener('click', readAndBuild);
  elements.copyBtn.addEventListener('click', copyJson);
  elements.downloadBtn.addEventListener('click', downloadJson);
  elements.appendBatchBtn.addEventListener('click', appendCurrentToBatch);
  elements.downloadBatchBtn.addEventListener('click', downloadBatch);
  elements.loadQueueBtn.addEventListener('click', loadQueue);
  elements.openLoginBtn.addEventListener('click', openCurrentLogin);
  elements.groupNamesInput.addEventListener('change', rebuildFromCurrentOutput);
  elements.accountsInput.addEventListener('change', saveState);

  loadState().catch((error) => {
    setStatus(error?.message || String(error || '初始化失败。'), true);
  });
})();
