# Evidencia de RNF-01 (rendimiento en móvil con 4G)

Fecha de las mediciones: 2026-10-28. Criterio del catálogo (v5): *«el tiempo entre la selección del horario y la confirmación de la reserva (previo a la redirección a la pasarela de pago) es menor o igual a 5 segundos, medido en tres repeticiones consecutivas»*, en un móvil con 4G.

Hay dos mediciones y miden cosas distintas. **Solo la segunda corresponde al criterio**; la primera es evidencia complementaria.

## 1. Carga de la página de inicio en producción (Lighthouse)

- Herramienta: Lighthouse 13.6.0, perfil móvil por defecto (4G lento simulado: 1,6 Mbps, RTT 150 ms, CPU 4 veces más lenta), Chrome instalado en la máquina.
- Página: https://lorenestudiodebelleza.vercel.app/ (producción, Vercel). Cinco corridas seguidas. Script: `correr-lighthouse.sh`.
- Informe completo de la corrida mediana (la 3): `lighthouse-inicio-movil-4g-corrida3.report.html`.

| Corrida | Puntaje | FCP = LCP (s) | TTI (s) | Speed Index (s) | TBT (ms) |
|---|---|---|---|---|---|
| 1 | 65 | 4,96 | 6,31 | 4,96 | 237 |
| 2 | 65 | 4,90 | 6,36 | 5,66 | 207 |
| 3 | 63 | 4,45 | 6,58 | 6,10 | 331 |
| 4 | 69 | 4,40 | 6,30 | 6,22 | 152 |
| 5 | 70 | 4,30 | 6,33 | 5,90 | 151 |
| **Mediana** | **65** | **4,45** | **6,33** | **5,90** | **207** |

CLS 0 en las cinco; peso total 1.032 KiB. Lectura: el contenido principal se ve en menos de 5 s en las cinco corridas, pero la página tarda unos 6,3 s en quedar interactiva. Esto mide la **primera carga en frío**, no la reserva.

## 2. Recorrido de reserva: selección del horario → reserva confirmada

- Entorno: backend y base de **pruebas** locales (`NODE_ENV=test`), frontend compilado para producción (`vite build`) y servido con `vite preview`, Chrome con emulación móvil (412 × 915, táctil) y el mismo perfil de red que Lighthouse (4G lento: 1,6 Mbps de bajada, 750 kbps de subida, 150 ms de latencia, CPU 4 veces más lenta) aplicado por el protocolo de Chrome. Cuenta nueva de clienta en cada repetición. Script: `medir-reserva-4g.js`.
- Intervalos medidos (sin contar el tiempo que tarda una persona en leer o decidir): **A** clic en el horario y «Siguiente» hasta ver el resumen; **B** «Confirmar reserva» hasta ver el paso de pago; **C** elegir «Coordinar el pago por WhatsApp» (crea la reserva) hasta ver la reserva confirmada.

| Repetición (consecutivas) | Horario | A (ms) | B (ms) | C (ms) | Total (ms) |
|---|---|---|---|---|---|
| 1 | 09:00 | 368 | 93 | 355 | 816 |
| 2 | 11:00 | 375 | 82 | 321 | 778 |
| 3 | 13:00 | 388 | 125 | 308 | 821 |
| 4 | 15:00 | 379 | 90 | 300 | 769 |

Mediana del total: 0,80 s; máximo: 0,82 s. En una tanda anterior, con la misma configuración, dieron 0,82 s y 0,89 s.

**Límite de esta medición:** el backend y la base corrían en la misma máquina, así que no incluye la distancia a Render ni a Supabase. Como referencia, el tiempo hasta el primer byte de la API de producción, medido desde esta máquina sin limitar la red, fue de 0,31 a 0,77 s por pedido (mediana 0,34 s en `/api/health`, 0,35 s en `/api/services`; 8 pedidos cada uno). Sumando unas 4 rondas de pedidos seguidos en el recorrido, la estimación para producción es de **alrededor de 2 s**, todavía por debajo de 5 s. Es una estimación, no una medición: **no se reservó ningún turno en producción** para no tocar datos reales.

## Qué falta para cerrar RNF-01 como «Validado»

Repetir el recorrido (sección 2) tres veces seguidas contra producción, desde un celular real con 4G, con una cuenta y un servicio de prueba que se puedan borrar después, y anotar los tiempos. Hasta entonces el estado correcto en el catálogo sigue siendo «Pendiente», con esta evidencia como respaldo parcial.
