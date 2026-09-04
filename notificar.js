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

  const respuesta = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: mensajes[tipo] || mensajes.error,
      disable_web_page_preview: true,
    }),
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok || !resultado.ok) {
    throw new Error(resultado.description || `Telegram respondió ${respuesta.status}`);
  }
  console.log(`Notificación '${tipo}' enviada correctamente.`);
}

enviar().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
