# Log Explorer

## Goal

Build a lightweight React app for viewing and exploring logs in the browser. Use Vanilla Framework from its CDN for the UI foundation, and keep log contents in the browser.

## MVP

1. Provide a usable explorer as the first screen, with a small sample log set.
2. Let users load logs from a local file, paste text, or fetch a URL when the browser permits it.
3. Parse JSON objects, JSON arrays, and newline-delimited JSON. Keep malformed lines visible as raw text.
4. Detect common timestamp, level, message, and source fields; show full record JSON on demand.
5. Support searching, filtering by level, sorting by a selected field, and grouping by a selected field.
6. Include clear loading, empty, and error states. Do not upload or persist logs by default.
7. Validate with a production build and representative log formats.

## Extension

The Chrome extension detects timestamped log pages and structured log JSON. On a match, it opens the explorer in a full-page overlay without replacing the original page. The extension reads page content locally and offers a close control to return to the site.

## Keep Out Of Scope For Now

- Accounts, a database, and a backend proxy.
- Reusable log profiles or custom field mappings until their expected behavior is confirmed.
- Extension-store publishing and custom site-specific parsers.

## Implementation Order

1. Establish the React app and the log input and parsing flow.
2. Add the exploration controls and record details.
3. Package the app as an unpacked Chrome extension with automatic log-page detection.
4. Verify the production build and manually exercise the extension on the included test page.


