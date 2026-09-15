import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Jira Worklog",
    description: "Недельный учёт worklog для Jira (tasks.adv.ru)",
    version: "0.1.0",
    permissions: ["storage", "tabs", "scripting"],
    host_permissions: ["https://tasks.adv.ru/*"],
    optional_host_permissions: ["https://*/*"],
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    action: {
      default_icon: {
        16: "icon-16.png",
        32: "icon-32.png",
      },
    },
    options_ui: {
      open_in_tab: true,
    },
  },
});
