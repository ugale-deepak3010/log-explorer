(() => {
  if (window.top !== window || !document.documentElement) return;

  const timestampPattern = /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\b/g;
  const levelPattern = /\b(?:TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERROR|FATAL|CRITICAL)\b/gi;

  function hasStructuredLogRecords(text) {
    try {
      const parsed = JSON.parse(text);
      const nestedRecords = [parsed?.logs, parsed?.records, parsed?.events].find(Array.isArray);
      const records = Array.isArray(parsed) ? parsed : nestedRecords || [parsed];

      return records.slice(0, 50).some((record) => {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
        const keys = Object.keys(record);
        const hasTimestamp = keys.some((key) => /^(?:@?timestamp|time|datetime|date|ts)$/i.test(key));
        const hasLevelOrMessage = keys.some((key) => /^(?:level|severity|log_level|message|msg)$/i.test(key));
        return hasTimestamp && hasLevelOrMessage;
      });
    } catch {
      return false;
    }
  }

  function isLogPage(text) {
    if (!text.trim()) return false;
    if (hasStructuredLogRecords(text)) return true;
    return (text.match(timestampPattern) || []).length > 0 && (text.match(levelPattern) || []).length > 0;
  }

  function openExplorer(text) {
    const host = document.createElement('div');
    host.dataset.logExplorer = 'true';
    host.style.setProperty('all', 'initial', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('inset', '0', 'important');
    host.style.setProperty('width', '100vw', 'important');
    host.style.setProperty('height', '100vh', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');

    const shadow = host.attachShadow({ mode: 'closed' });
    const frame = document.createElement('iframe');
    frame.title = 'Log Explorer';
    frame.src = chrome.runtime.getURL('index.html');
    frame.style.cssText = 'display:block;width:100%;height:100%;border:0;background:#f6f7f4;';
    shadow.append(frame);

    window.addEventListener('message', function onExplorerMessage(event) {
      if (event.source !== frame.contentWindow) return;
      if (event.data?.type === 'LOG_EXPLORER_READY') {
        frame.contentWindow.postMessage({ type: 'LOG_EXPLORER_DATA', text, name: window.location.href }, '*');
      }
      if (event.data?.type === 'LOG_EXPLORER_CLOSE') {
        host.remove();
        window.removeEventListener('message', onExplorerMessage);
      }
    });

    document.documentElement.append(host);
  }

  const pageText = document.body?.innerText || '';
  if (isLogPage(pageText)) openExplorer(pageText);
})();