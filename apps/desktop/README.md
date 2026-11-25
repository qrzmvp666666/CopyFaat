# CopyFast Desktop

Run from the repository root:

```sh
pnpm desktop:dev
```

The workspace groups channels by task. Selecting a task opens its first channel; selecting a channel scopes both the message list and the collection log. The “全部频道” entry combines the current scope. Switching between messages and logs retains the selected channel. Task rules, pause/run, and deletion remain in the task header.

Message lists support author/content search, time filtering, pagination and a detail dialog. Each channel log records its batch, discovered messages, saved messages and skipped messages. Empty completed rounds show “无新增”; interrupted rounds leave counts unconfirmed. Older task logs remain labeled as task batch totals. Deleting a task preserves its messages and channel history.

Failed rounds wait for the configured retry interval and stop after the retry allowance is exhausted. Pausing a task cancels pending retries. Channel results are stored locally alongside existing task data.

Verification commands:

```sh
pnpm desktop:test
pnpm desktop:type-check
pnpm desktop:build
```

To check the UI, create a task containing multiple channels, collect messages, then select each channel and switch between messages and logs. Verify that channel counts differ as expected, empty channels remain visible, and “查看本轮消息” opens a message from that channel and batch. These UI checks do not by themselves verify collection against a real desktop application.
