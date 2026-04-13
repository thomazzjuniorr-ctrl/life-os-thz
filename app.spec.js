import { devices, expect, test } from "@playwright/test";

const iphone13 = devices["iPhone 13"];

async function dismissAlertIfVisible(page) {
  const alertButton = page.getByRole("button", { name: "Ignorar com risco" });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const visible = await alertButton.isVisible().catch(() => false);
    if (!visible) {
      return;
    }

    await alertButton.click();
    await page.waitForTimeout(150);
  }
}

async function clickNav(page, name) {
  await page.getByRole("button", { name, exact: true }).evaluate((element) => element.click());
}

test.describe("Life OS Thz 2026", () => {
  test("abre o workspace e mostra Hoje por padrao", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Workspace de vida e trabalho" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
    await expect(page.getByText("3 prioridades do dia")).toBeVisible();
    await expect(page.getByText("Mini calendario do dia")).toBeVisible();
  });

  test("navega entre Dashboard, Dias, Priorizar e Configuracoes", async ({ page }) => {
    await page.goto("/");
    await dismissAlertIfVisible(page);

    await clickNav(page, "Dashboard");
    await expect(page.getByText("Panorama da semana")).toBeVisible();
    await expect(page.getByText("Resumo dos projetos")).toBeVisible();

    await clickNav(page, "Dias");
    await expect(page.getByText("Leitura do dia")).toBeVisible();
    await expect(page.getByText("Urgentes e alertas")).toBeVisible();

    await clickNav(page, "Priorizar");
    await expect(page.getByText("Pipeline de priorizacao")).toBeVisible();
    await expect(page.getByText("Sapo do dia e da semana")).toBeVisible();

    await clickNav(page, "Configuracoes");
    await expect(page.getByText("Modo edicao e layout")).toBeVisible();
    await expect(page.getByText("Linha de raciocinio", { exact: true })).toBeVisible();
  });

  test("captura uma nova tarefa na Entrada", async ({ page }) => {
    await page.goto("/");
    await dismissAlertIfVisible(page);
    await clickNav(page, "Entrada");

    await page.getByLabel("Titulo").fill("Validar tarefa da inbox");
    await page.getByRole("button", { name: "Adicionar na entrada" }).click();

    await expect(page.getByText("Nova tarefa capturada na inbox.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Validar tarefa da inbox" })).toBeVisible();
  });

  test("permite recalibrar energia semanal na Rotina", async ({ page }) => {
    await page.goto("/");
    await dismissAlertIfVisible(page);

    await clickNav(page, "Rotina");
    await page.locator('[data-action="set-energy"][data-energy="5"]').first().click();

    await expect(page.getByText("Energia semanal ajustada.")).toBeVisible();
  });

  test("permite editar o layout do dashboard e manter apos recarregar", async ({ page }) => {
    await page.goto("/");
    await dismissAlertIfVisible(page);

    await clickNav(page, "Configuracoes");
    await page.getByRole("button", { name: "Ligar modo edicao" }).click();
    await expect(page.getByText("Modo de edicao atualizado.")).toBeVisible();

    await clickNav(page, "Dashboard");
    const overviewCard = page.locator('[data-layout-page="dashboard"][data-layout-card="overview"]').first();
    const initialClass = await overviewCard.getAttribute("class");

    await page.getByRole("button", { name: "Aumentar altura Panorama da semana" }).click();
    await expect(overviewCard).not.toHaveClass(new RegExp(initialClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const updatedClass = await overviewCard.getAttribute("class");
    expect(updatedClass).toMatch(/layout-height-(regular|tall)/);

    await page.reload();
    const reloadedOverviewCard = page.locator('[data-layout-page="dashboard"][data-layout-card="overview"]').first();
    await expect(reloadedOverviewCard).toHaveClass(new RegExp(updatedClass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    await clickNav(page, "Configuracoes");
    await page.getByRole("button", { name: "Restaurar layout padrao" }).click();
    await expect(page.getByText("Layout restaurado.")).toBeVisible();
  });
});

test.describe("Life OS Thz 2026 mobile", () => {
  test.use({
    viewport: iphone13.viewport,
    userAgent: iphone13.userAgent,
    deviceScaleFactor: iphone13.deviceScaleFactor,
    isMobile: iphone13.isMobile,
    hasTouch: iphone13.hasTouch,
  });

  test("abre em Hoje e usa menu hamburguer com organizacao simplificada", async ({ page }) => {
    await page.goto("/");
    await dismissAlertIfVisible(page);

    await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abrir menu" })).toBeVisible();
    await expect(page.getByText("3 prioridades do dia")).toBeVisible();

    await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByRole("heading", { name: "Workspace de vida e trabalho" })).toBeVisible();

    await clickNav(page, "Organizar");
    await expect(page.locator(".organize-mobile-stack")).toBeVisible();
    await expect(page.getByText("Fazer agora")).toBeVisible();
  });
});
