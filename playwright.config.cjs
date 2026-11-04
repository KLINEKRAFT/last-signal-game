const { defineConfig } = require("@playwright/test");
const webkit = process.env.PLAYWRIGHT_BROWSER === "webkit";
module.exports = defineConfig({
  testDir: "./tests",
  timeout: 120000,
  workers: 1,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://127.0.0.1:8000",
    browserName: webkit ? "webkit" : "chromium",
    launchOptions: webkit
      ? {}
      : {
          executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
          args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
        },
  },
  webServer: {
    command: "python3 -m http.server 8000",
    port: 8000,
    reuseExistingServer: true,
  },
});
