import { LifeOSApp } from "./app.js";

const root = document.getElementById("app");

if (root) {
  const app = new LifeOSApp(root);
  void app.init();
  window.lifeOSApp = app;
}
