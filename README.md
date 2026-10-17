# Log Explorer

A browser-based log explorer and Manifest V3 Chrome extension. The extension checks pages for timestamped log lines or structured log JSON and opens the explorer over matching pages. Log content stays in the browser.

## Run The App

```sh
npm install
npm run dev
```

## Try The Extension In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Select **Load unpacked** and choose this project's `dist` folder.
4. Click the Log Explorer extension icon. Its popup has an **Open log file** button; choose a local `.log`, `.txt`, `.json`, or `.jsonl` file.
5. To test automatic detection, run `npm run dev` and open `http://localhost:5173/test-logs.html`. The explorer should appear over the sample log page.
6. Close the explorer to return to the page. Ordinary pages should remain unchanged.

After changing extension code, run the build again, click the extension's reload button on `chrome://extensions`, and refresh the test page. Chrome requires broad site access for automatic detection on arbitrary URLs; the extension processes page text locally and does not send it to a server.

The extension currently recognizes pages with timestamp-and-level log lines and JSON records with common timestamp, level, or message fields. URL and authentication restrictions depend on the site, but don't affect pages the extension can read after they load in the browser.
