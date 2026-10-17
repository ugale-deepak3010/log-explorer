import React, { useEffect, useMemo, useState } from 'react';

const SAMPLE_LOGS = JSON.stringify([
  { timestamp: '2026-10-17T14:23:51.402Z', level: 'INFO', service: 'gateway', message: 'Request completed', method: 'GET', path: '/api/events', status: 200, duration_ms: 42 },
  { timestamp: '2026-10-17T14:23:49.127Z', level: 'WARN', service: 'worker', message: 'Retrying event delivery', queue: 'webhooks', attempt: 2 },
  { timestamp: '2026-10-17T14:23:47.006Z', level: 'ERROR', service: 'webhooks', message: 'Endpoint returned 502', request_id: 'req_8f31a2', status: 502, duration_ms: 1204 },
  { timestamp: '2026-10-17T14:23:44.811Z', level: 'INFO', service: 'gateway', message: 'Request completed', method: 'POST', path: '/api/events', status: 202, duration_ms: 18 },
  { timestamp: '2026-10-17T14:23:40.244Z', level: 'DEBUG', service: 'worker', message: 'Polling queue', queue: 'webhooks', batch_size: 10 },
  { timestamp: '2026-10-17T14:23:36.093Z', level: 'INFO', service: 'auth', message: 'Token validated', user_id: 'usr_32a91c', duration_ms: 7 },
  { timestamp: '2026-10-17T14:23:32.680Z', level: 'ERROR', service: 'database', message: 'Connection pool reached limit', active: 20, limit: 20 },
  { timestamp: '2026-10-17T14:23:28.152Z', level: 'INFO', service: 'gateway', message: 'Request completed', method: 'GET', path: '/health', status: 200, duration_ms: 3 },
], null, 2);

const FIELD_ALIASES = {
  timestamp: ['timestamp', '@timestamp', 'time', 'datetime', 'date', 'ts'],
  level: ['level', 'severity', 'log_level', 'loglevel', 'priority'],
  message: ['message', 'msg', 'text', 'log', 'event'],
  source: ['service', 'logger', 'source', 'component', 'app'],
};

function asRecord(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return { message: String(value ?? '') };
}

function parseLogs(text) {
  const input = text.trim();
  if (!input) return [];

  try {
    const parsed = JSON.parse(input);
    return (Array.isArray(parsed) ? parsed : [parsed]).map(asRecord);
  } catch {
    return input.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
      try {
        return asRecord(JSON.parse(line));
      } catch {
        return { message: line };
      }
    });
  }
}

function detectFields(records) {
  const fields = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const normalized = new Map(fields.map((field) => [field.toLowerCase(), field]));
  const find = (aliases) => aliases.map((alias) => normalized.get(alias)).find(Boolean) ?? '';
  return {
    fields,
    timestamp: find(FIELD_ALIASES.timestamp),
    level: find(FIELD_ALIASES.level),
    message: find(FIELD_ALIASES.message),
    source: find(FIELD_ALIASES.source),
  };
}

function valueText(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return valueText(value);
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
  }).format(date);
}

function compareValues(left, right) {
  const leftText = valueText(left);
  const rightText = valueText(right);
  const leftNumber = Number(leftText);
  const rightNumber = Number(rightText);
  if (leftText && rightText && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' });
}

function App() {
  const isPopupMode = new URLSearchParams(window.location.search).get('popup') === '1';
  const [records, setRecords] = useState(() => isPopupMode ? [] : parseLogs(SAMPLE_LOGS));
  const [sourceName, setSourceName] = useState(() => isPopupMode ? 'No file selected' : 'Sample logs');
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [sortField, setSortField] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [groupField, setGroupField] = useState('');
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isExtensionFrame = window.parent !== window;

  useEffect(() => {
    if (!isExtensionFrame) return undefined;

    function receiveExtensionMessage(event) {
      if (event.source !== window.parent) return;
      if (event.data?.type === 'LOG_EXPLORER_DATA') {
        loadText(event.data.text, event.data.name || 'Current page');
      }
    }

    window.addEventListener('message', receiveExtensionMessage);
    window.parent.postMessage({ type: 'LOG_EXPLORER_READY' }, '*');
    return () => window.removeEventListener('message', receiveExtensionMessage);
  }, [isExtensionFrame]);

  const detected = useMemo(() => detectFields(records), [records]);
  const levels = useMemo(() => {
    if (!detected.level) return [];
    return [...new Set(records.map((record) => valueText(record[detected.level])).filter(Boolean))].sort();
  }, [detected.level, records]);

  const visibleRecords = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records
      .filter((record) => levelFilter === 'all' || valueText(record[detected.level]).toLowerCase() === levelFilter.toLowerCase())
      .filter((record) => !search || JSON.stringify(record).toLowerCase().includes(search))
      .sort((left, right) => {
        const result = compareValues(left[sortField], right[sortField]);
        return sortOrder === 'asc' ? result : -result;
      });
  }, [detected.level, levelFilter, query, records, sortField, sortOrder]);

  const groups = useMemo(() => {
    if (!groupField) return [['All events', visibleRecords]];
    const grouped = new Map();
    visibleRecords.forEach((record) => {
      const key = valueText(record[groupField]) || 'Missing';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(record);
    });
    return [...grouped.entries()];
  }, [groupField, visibleRecords]);

  function loadText(text, name) {
    const parsed = parseLogs(text);
    setRecords(parsed);
    setSourceName(name);
    setError(parsed.length ? '' : 'No log records found.');
    setQuery('');
    setLevelFilter('all');
    const next = detectFields(parsed);
    setSortField(next.timestamp || next.fields[0] || '');
    setGroupField('');
  }

  async function openFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      loadText(await file.text(), file.name);
    } catch {
      setError('Could not read this file.');
    }
    event.target.value = '';
  }

  async function fetchUrl(event) {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(url.trim());
      if (!response.ok) throw new Error(`Request failed (${response.status}).`);
      loadText(await response.text(), url.trim());
    } catch (fetchError) {
      setError(fetchError.message || 'Could not fetch this URL. The host may block browser requests.');
    } finally {
      setLoading(false);
    }
  }

  function useSample() {
    loadText(SAMPLE_LOGS, 'Sample logs');
    setPasteText('');
  }

  return (
    <main className={`explorer${isPopupMode ? ' popup-mode' : ''}`}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Log Explorer home">
          <span className="brand-mark">L</span>
          <span>Log Explorer</span>
        </a>
        {isExtensionFrame ? (
          <button className="close-extension" type="button" onClick={() => window.parent.postMessage({ type: 'LOG_EXPLORER_CLOSE' }, '*')}>Close explorer</button>
        ) : (
          <span className="privacy-note">Runs in your browser</span>
        )}
      </header>

      <section className="workspace" id="top">
        <div className="page-heading">
          <div>
            <p className="eyebrow">BROWSER LOG VIEWER</p>
            <h1>Explore your logs.</h1>
          </div>
          <div className="heading-count"><strong>{visibleRecords.length}</strong><span>of {records.length} events</span></div>
        </div>

        <section className="ingest" aria-label="Load logs">
          <div className="ingest-actions">
            <label className="p-button--positive upload-button">
              <input type="file" accept=".json,.jsonl,.ndjson,.log,.txt,application/json,text/plain" onChange={openFile} />
              Open log file
            </label>
            <button className="p-button--base sample-button" onClick={useSample} type="button">Load sample</button>
          </div>
          {!isPopupMode && <form className="url-form" onSubmit={fetchUrl}>
            <label className="visually-hidden" htmlFor="log-url">Log URL</label>
            <input id="log-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/logs.json" />
            <button className="p-button--base" type="submit" disabled={loading || !url.trim()}>{loading ? 'Loading…' : 'Fetch URL'}</button>
          </form>}
          {!isPopupMode && <details className="paste-panel">
            <summary>Paste logs</summary>
            <div className="paste-content">
              <label className="visually-hidden" htmlFor="pasted-logs">Log contents</label>
              <textarea id="pasted-logs" value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={'Paste JSON, JSONL, or plain-text logs'} rows="5" />
              <button className="p-button--base" type="button" disabled={!pasteText.trim()} onClick={() => loadText(pasteText, 'Pasted logs')}>Explore pasted logs</button>
            </div>
          </details>}
        </section>

        <section className="log-view" aria-label="Log events">
          <div className="source-line">
            <span className="source-dot" aria-hidden="true"></span>
            <span className="source-name" title={sourceName}>{sourceName}</span>
            {error && <span className="error-message" role="alert">{error}</span>}
          </div>

          <div className="controls">
            <label className="search-control">
              <span className="visually-hidden">Search logs</span>
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logs…" />
              {query && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery('')}>×</button>}
            </label>
            <label className="select-control"><span>Level</span>
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} disabled={!levels.length}>
                <option value="all">All levels</option>
                {levels.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </label>
            <label className="select-control"><span>Sort by</span>
              <select value={sortField} onChange={(event) => setSortField(event.target.value)} disabled={!detected.fields.length}>
                {detected.fields.map((field) => <option key={field} value={field}>{field}</option>)}
              </select>
            </label>
            <label className="select-control"><span>Order</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
            <label className="select-control"><span>Group</span>
              <select value={groupField} onChange={(event) => setGroupField(event.target.value)}>
                <option value="">No grouping</option>
                {detected.fields.map((field) => <option key={field} value={field}>{field}</option>)}
              </select>
            </label>
          </div>

          {visibleRecords.length === 0 ? (
            <div className="empty-state"><span className="empty-mark">0</span><p>{records.length ? 'No events match these filters.' : 'Load a log file to get started.'}</p></div>
          ) : (
            <div className="groups">
              {groups.map(([groupName, groupRecords]) => (
                <section className="event-group" key={groupName}>
                  {groupField && <h2 className="group-heading"><span>{groupName}</span><span>{groupRecords.length}</span></h2>}
                  <div className="table-scroll">
                    <table className="event-table">
                      <thead><tr><th>Timestamp</th><th>Level</th><th>Message</th><th>Record</th></tr></thead>
                      <tbody>
                        {groupRecords.map((record, index) => {
                          const level = valueText(record[detected.level]).toLowerCase();
                          const message = detected.message ? valueText(record[detected.message]) : valueText(record.message) || JSON.stringify(record);
                          return (
                            <tr key={`${groupName}-${index}`}>
                              <td className="timestamp-cell">{detected.timestamp ? formatTimestamp(record[detected.timestamp]) : '—'}</td>
                              <td><span className={`level-tag level-${level}`}>{level || '—'}</span></td>
                              <td className="message-cell">
                                <span>{message}</span>
                                {detected.source && <small>{valueText(record[detected.source])}</small>}
                              </td>
                              <td className="record-cell"><details><summary>JSON</summary><pre>{JSON.stringify(record, null, 2)}</pre></details></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </section>
      {!isPopupMode && <footer className="footer"><span>LOG EXPLORER</span><span>Local by default</span></footer>}
    </main>
  );
}

export default App;