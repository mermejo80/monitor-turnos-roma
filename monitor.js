const fs = require("fs");
const { chromium } = require("playwright-core");

const URL_TURNOS =
  "https://turnos.argentina.gob.ar/turnos/seleccionTurno/3219/pais/37/prov/67/loc/2875/pda/3616";

function normalizar(texto = "") {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function guardarResultado(estado, detalle) {
  console.log(`[${new Date().toISOString()}] ${estado}: ${detalle}`);
  fs.writeFileSync("resultado.json", JSON.stringify({ estado, detalle }, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=${estado}\n`);
    const mensaje = detalle.replace(/[\r\n]+/g, " ");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `detail=${mensaje}\n`);
  }
}

async function comprobar() {
  let browser;
  try {
    // Los servidores Ubuntu de GitHub ya incluyen Google Chrome.
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({ locale: "es-AR" });
    const page = await context.newPage();
    const response = await page.goto(URL_TURNOS, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(10000);

    const textoOriginal = await page.locator("body").innerText({ timeout: 15000 });
    const texto = normalizar(textoOriginal);
    const codigo = response ? response.status() : 0;
    const bloqueos = [
      "access denied",
      "acceso denegado",
      "service unavailable",
      "error interno",
      "captcha",
    ];

    if (codigo >= 400) {
      guardarResultado("error", `La página respondió con código ${codigo}.`);
      return;
    }
    if (texto.length < 40 || bloqueos.some((palabra) => texto.includes(palabra))) {
      guardarResultado("error", "La página no cargó correctamente o mostró un bloqueo.");
      return;
    }

    const controles = page.locator(
      "button:visible:enabled, " +
        "[role='button']:visible:not([aria-disabled='true']), " +
        "input[type='radio']:visible:enabled, " +
        "input[type='checkbox']:visible:enabled, " +
        "select:visible:enabled option:not([disabled])"
    );
    const cantidad = Math.min(await controles.count(), 200);
    const hora = /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/;
    const fecha = /\b(?:0?[1-9]|[12]\d|3[01])[/.\-](?:0?[1-9]|1[0-2])(?:[/.\-]\d{2,4})?\b/;
    const frasesPositivas = [
      "seleccionar turno",
      "elegir turno",
      "horario disponible",
      "turno disponible",
      "reservar turno",
    ];
    let hayTurno = false;

    for (let i = 0; i < cantidad; i += 1) {
      const control = controles.nth(i);
      const partes = [];
      try {
        partes.push(await control.innerText({ timeout: 1000 }));
      } catch (_) {}
      for (const atributo of ["aria-label", "title", "value"]) {
        partes.push((await control.getAttribute(atributo)) || "");
      }
      const etiqueta = normalizar(partes.join(" "));
      if (
        hora.test(etiqueta) ||
        fecha.test(etiqueta) ||
        frasesPositivas.some((frase) => etiqueta.includes(frase))
      ) {
        hayTurno = true;
        break;
      }
    }

    if (hayTurno) {
      await page.screenshot({ path: "turno-detectado.png", fullPage: true });
      guardarResultado("disponible", "Se encontró una fecha u horario seleccionable.");
    } else if (texto.includes("sin disponibilidad")) {
      guardarResultado("normal", "Sigue apareciendo 'Sin disponibilidad'.");
    } else {
      await page.screenshot({ path: "pagina-cambiada.png", fullPage: true });
      guardarResultado(
        "cambio",
        "La página cargó, pero no muestra el estado conocido ni turnos seleccionables."
      );
    }
  } catch (error) {
    guardarResultado("error", `No se pudo comprobar la página: ${error.message}`);
  } finally {
    if (browser) await browser.close();
  }
}

comprobar();
