import { loadConfig } from "./config.js";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
const config = loadConfig();
const store = await createStore(config);
const app = await createApp(config, store);
const server = app.listen(config.port, "0.0.0.0", () =>
  console.log(
    `CampusPilot listening on ${config.port}; storage=${config.storage}; AI=${config.ai.mode}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
