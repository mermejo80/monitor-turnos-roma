const URL_TURNOS =
  "https://turnos.argentina.gob.ar/turnos/seleccionTurno/3219/pais/37/prov/67/loc/2875/pda/3616";

async function enviar() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const tipo = process.env.NOTIFICATION_TYPE || "test";
  const detalle = process.env.NOTIFICATION_DETAIL || "";

  if (!token || !chatId) {
    throw new Error("Faltan los secretos TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.");
  }

  if (tipo === "comandos") {
    await responderComandos(token, chatId);
    return;
  }

  const mensajes = {
    disponible:
      `🚨 ¡TURNO DISPONIBLE!\n\nSe encontró una fecha u horario seleccionable. Reserva inmediatamente:\n${URL_TURNOS}`,
    cambio:
      `⚠️ REVISAR EL MONITOR\n\nLa página cambió y no se pudo reconocer su estado. Esto no confirma un turno.\n${detalle}\n\n${URL_TURNOS}`,
    error:
      `⚠️ ERROR DEL MONITOR\n\nLa comprobación online no funcionó. Esto no confirma un turno.\n${detalle}`,
    test:
      `✅ PRUEBA CORRECTA\n\nEl monitor de turnos ya puede enviarte notificaciones por Telegram.`,
  };

  if (!mensajes[tipo]) {
    throw new Error(`Tipo de notificación desconocido: ${tipo}`);
  }

  const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensajes[tipo],
      disable_web_page_preview: true,
    }),
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.description || `Telegram respondió ${respuesta.status}`);
  }
  console.log(`Notificación '${tipo}' enviada correctamente.`);
}

async function enviarTexto(token, chatId, text) {
  const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.description || `Telegram respondió ${respuesta.status}`);
  }
}

async function responderComandos(token, chatIdAutorizado) {
  const respuesta = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=0`);
  const datos = await respuesta.json();
  if (!respuesta.ok || !datos.ok) {
    throw new Error(datos.description || "No se pudieron leer los mensajes de Telegram.");
  }

  const actualizaciones = datos.result || [];
  let ultimoUpdateId = null;
  const estado = process.env.CHECK_STATUS || "desconocido";
  const detalle = process.env.CHECK_DETAIL || "Sin información adicional.";
  const fecha = new Intl.DateTimeFormat("es-AR", {
    timeZone: "Europe/Rome",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date());

  const nombresEstado = {
    normal: "Sin disponibilidad",
    disponible: "🚨 Hay una fecha u horario seleccionable",
    cambio: "La página cambió y necesita revisión",
    error: "La última comprobación tuvo un error",
  };

  for (const actualizacion of actualizaciones) {
    ultimoUpdateId = Math.max(ultimoUpdateId ?? 0, actualizacion.update_id);
    const mensaje = actualizacion.message;
    if (!mensaje || String(mensaje.chat.id) !== String(chatIdAutorizado)) continue;

    const texto = (mensaje.text || "").trim().toLowerCase().split("@")[0];
    let contestacion;
    if (texto === "/estado" || texto.includes("sigue activo") || texto.includes("estas activo")) {
      contestacion =
        `✅ Sí, el monitor está activo.\n\n` +
        `Última comprobación: ${fecha}\n` +
        `Estado: ${nombresEstado[estado] || estado}\n` +
        `Detalle: ${detalle}`;
    } else if (texto === "/ultima" || texto.includes("ultima consulta")) {
      contestacion =
        `🕒 Última consulta: ${fecha}\n` +
        `Estado: ${nombresEstado[estado] || estado}\n` +
        `Detalle: ${detalle}`;
    } else {
      contestacion =
        "Comandos disponibles:\n" +
        "/estado — confirma si el monitor está activo\n" +
        "/ultima — muestra la última comprobación";
    }
    await enviarTexto(token, chatIdAutorizado, contestacion);
  }

  // Confirma los mensajes procesados para que Telegram no los entregue nuevamente.
  if (ultimoUpdateId !== null) {
    await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${ultimoUpdateId + 1}&timeout=0`
    );
  }
  console.log(`Mensajes revisados: ${actualizaciones.length}.`);
}

enviar().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
