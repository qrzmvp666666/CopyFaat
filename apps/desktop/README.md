# CopyFast Desktop

Run from the repository root:

```sh
pnpm desktop:dev
```

On macOS, development starts a locally signed `dist/dev/CopyFast.app`, using the CopyFast name, icon, application identifier and package version. The first launch prepares this bundle; subsequent launches reuse it. Grant accessibility access to this CopyFast app when prompted. Existing development task records are copied from the previous data directory only when the CopyFast data file does not exist.

Each task currently selects one server/source and one or more channels. The workspace keeps task scopes separate and labels each channel group with its server/source name; the task name remains available on hover and in the task sidebar. Selecting a task opens its first channel; selecting a channel scopes both the message list and the collection log. The “全部频道” entry combines the current scope. Switching between messages and logs retains the selected channel. Task rules, pause/run, and deletion remain in the task header.

Future multi-source support should introduce stable source identity in task configuration, channel keys, collection cursors, messages, and logs before allowing a task to select multiple sources. Source display names must not be used as identifiers or used to merge channels across tasks. The current single-source storage and collector contract remain unchanged.

The channel panel has a top-right expand/restore button. Expanding temporarily collapses the app sidebar and hides the page heading, demo banner, and metrics while retaining channel navigation and list state. Restoring returns to the previous sidebar preference.

Message lists support author/content search, time filtering, pagination and a detail dialog. Each channel log records its batch, discovered messages, saved messages and skipped messages. Empty completed rounds show “无新增”; interrupted rounds leave counts unconfirmed. Older task logs remain labeled as task batch totals. Deleting a task preserves its messages and channel history.

Failed rounds wait for the configured retry interval and stop after the retry allowance is exhausted. Pausing a task cancels pending retries. Channel results are stored locally alongside existing task data.

Use “查看演示数据” in the workspace to preview three tasks, six channels, sample messages, attachments, and successful/failed/empty collection rounds. “退出演示” restores the live workspace. The preview preference survives reloads; all fixtures stay in the renderer and never enter the local task store or collection engine. Creating, running, deleting, and editing tasks are disabled during preview. Search, channel selection, logs, message details, and pagination remain interactive.

Verification commands:

```sh
pnpm desktop:test
pnpm desktop:type-check
pnpm desktop:build
```

To check the UI, create a task containing multiple channels, collect messages, then select each channel and switch between messages and logs. Verify that channel counts differ as expected, empty channels remain visible, and “查看本轮消息” opens a message from that channel and batch. These UI checks do not by themselves verify collection against a real desktop application.

The sidebar “联系客服” button reuses the SaaS Discord/Telegram monochrome icons and opens `/zh/contact` on `NEXT_PUBLIC_MARKETING_URL`. Without that environment variable it uses the current local marketing address, `http://copyfast.localhost:4101`. Configure the marketing origin in the desktop runtime environment when using another deployment.
