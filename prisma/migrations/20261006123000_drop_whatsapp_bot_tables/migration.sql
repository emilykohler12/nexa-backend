-- Se retira el webhook de Meta (chatbot de WhatsApp): sus tablas de estado
-- de conversación e idempotencia quedan sin uso. WhatsApp sigue solo como
-- enlace externo (botón flotante, seña/pedido coordinados por WhatsApp).
-- BORRA todas las filas de ambas tablas.
DROP TABLE IF EXISTS "conversaciones_whatsapp";
DROP TABLE IF EXISTS "mensajes_whatsapp_procesados";
