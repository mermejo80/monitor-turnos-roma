# Monitor online de turnos

Este monitor se ejecuta en GitHub cada cinco minutos, aunque tu computadora esté
apagada. Si encuentra una fecha u horario seleccionable, envía una alerta por
Telegram. También distingue `Sin disponibilidad`, cambios inesperados y errores.

Lee **INSTRUCCIONES.txt** antes de subir los archivos.

El repositorio no contiene el token ni el identificador de Telegram. Ambos se
guardan en los secretos cifrados de GitHub Actions.
