# BITÁCORA DEL PROCESO Y DECISIONES

Proyecto Nexa
Emily Noralí Kohler

Esta bitácora consolida todo el proceso de decisiones del proyecto: arquitectura, backend, frontend, legal, académico y el chatbot de WhatsApp.

## Entrada — Abril 2026

1. **Qué decidí:** Antes de definirme por el problema de Loren, evalué otras ideas de tesis: algo relacionado con la yerba mate, algo para cuidar el medio ambiente, una app con escáner de auto y otra app con una cámara que detecta cosas. Terminé descartando las cuatro y eligiendo el problema real de Loren (gestión de turnos de un estudio de belleza) como base del proyecto.
2. **Alternativas evaluadas y por qué las descarté:** Yerba mate: descartada por no tener un problema concreto ni un cliente piloto real detrás, además era difícil implementar el hardware, no tenía cómo hacerlo ni nadie para que me ayude. Medio ambiente: descartada por lo mismo, era una idea muy abierta sin un caso de uso específico. Escáner de auto con cámara que detecta cosas: descartada por la complejidad técnica de visión por computadora para el alcance de un PIF y por lo económico de tener que comprar el scanner.
3. **Evidencia que sostiene la decisión:** La decisión surgió a partir del análisis de las diferentes propuestas y del acompañamiento de la profesora, quien me fue guiando para evaluar cada idea según aspectos como la existencia de un problema concreto, la viabilidad técnica, el alcance del proyecto y la posibilidad de contar con un caso real para validar la solución. Posteriormente, el contacto con Loren permitió tomar su negocio como caso real para continuar definiendo el problema.
4. **Qué aporté yo, con remisión al repositorio:** Pensé y comparé las cuatro ideas antes de decidirme por la de Loren.
5. **Desacuerdos y cómo se resolvieron:** No hubo un desacuerdo formal. La definición del tema fue un proceso de evaluación y orientación con la profesora. A partir de sus observaciones fui descartando las propuestas que tenían un problema poco definido o un alcance técnico demasiado grande, hasta llegar a una propuesta más concreta y viable.
6. **Herramienta auxiliar usada:** IA para pensar pros y contras de cada idea.

## Entrada — 04/04/2026

1. **Qué decidí:** Evalué nombres alternativos para mi empresa desarrolladora antes de quedarme con Kologic: kohframe, kohler synth, konex, kosys, kozmic, kopoint, kogrid.
2. **Alternativas evaluadas y por qué las descarté:** Cada uno de esos nombres fue una alternativa evaluada y descartada a favor de Kologic, que terminé eligiendo por sonar más simple y más cercano a un nombre de empresa de software.
3. **Evidencia que sostiene la decisión:** La evidencia de esta decisión corresponde a la lista de nombres evaluados durante la etapa inicial de definición de identidad del proyecto y a la elección posterior de Kologic como nombre de la empresa desarrolladora.
4. **Qué aporté yo, con remisión al repositorio:** Armé la lista de opciones y elegí Kologic.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** IA para generar variantes del nombre a partir de mi apellido (Kohler) y del rubro (sistemas/software).

## Entrada — Junio 2026, semana 1

1. **Qué decidí:** Recién en junio arranqué a programar de verdad (la idea la tenía desde abril). Empecé con el nombre Kologic para el sistema de gestión de estéticas de belleza, pensado como mi PIF de 5° año de Ingeniería en Sistemas. El problema de base era el de Loren: gestiona los turnos por WhatsApp y cuaderno, se le pisan turnos, pierde clientes y tiempo.
2. **Alternativas evaluadas y por qué las descarté:** No evalué otros nombres para el sistema en esta etapa (el nombre de la empresa ya lo había definido).
3. **Evidencia que sostiene la decisión:** El repo original se llamaba kologic_system.
4. **Qué aporté yo, con remisión al repositorio:** Planteé el problema central y armé la idea inicial del sistema.
5. **Desacuerdos y cómo se resolvieron:** Ninguno en esta etapa.
6. **Herramienta auxiliar usada:** IA para pensar la arquitectura inicial.

## Entrada — ~Junio 2026, semana 2

1. **Qué decidí:** Elegí como primer stack Next.js con TypeScript, Tailwind CSS y PostgreSQL. La arquitectura pensada en ese momento era multi-tenant SaaS: el mismo sistema pensado para poder ofrecérselo después a otros negocios del rubro, no solo a Loren.
2. **Alternativas evaluadas y por qué las descarté:** No registré otras opciones de stack en esta etapa.
3. **Evidencia que sostiene la decisión:** Archivos app/layout.tsx, app/api/... propios de Next.js en el repo original.
4. **Qué aporté yo, con remisión al repositorio:** Instalé Next.js y armé la estructura inicial de carpetas.
5. **Desacuerdos y cómo se resolvieron:** Ninguno, lo adopté sin cuestionarlo en su momento.
6. **Herramienta auxiliar usada:** IA para guiar la instalación y la estructura.

## Entrada — ~Junio-Julio 2026

1. **Qué decidí:** Abandoné Next.js y arranqué de cero con Vite + React, reescribiendo todo el código pero usando el diseño que ya tenía pensado. La razón fue que Next.js mezclaba código de servidor y cliente de una forma que me generaba mucha confusión y errores difíciles de rastrear.
2. **Alternativas evaluadas y por qué las descarté:** Seguir con Next.js e ir resolviendo los errores a medida que aparecían. Lo descarté porque cada vez se volvía más difícil distinguir qué corría en el servidor y qué en el cliente.
3. **Evidencia que sostiene la decisión:** El package.json final usa Vite, no Next.js. Las carpetas app/api/ del intento anterior quedaron renombradas a .bak.
4. **Qué aporté yo, con remisión al repositorio:** Corrí npx create-next-app@latest al principio, y después npm create vite@latest para migrar, reconstruyendo el frontend desde cero con el diseño que ya tenía pensado.
5. **Desacuerdos y cómo se resolvieron:** Ninguno, decisión que tomé sola al ver que Next.js me estaba generando más problemas que soluciones.
6. **Herramienta auxiliar usada:** IA para diagnosticar los errores de Next.js y guiar la migración a Vite.

## Entrada — ~Julio 2026, semana 1

1. **Qué decidí:** Cambié el nombre del proyecto a Nexa para el sistema/producto, y dejé Kologic como el nombre de mi empresa desarrolladora.
2. **Alternativas evaluadas y por qué las descarté:** Mantener un solo nombre (Kologic) para todo. Lo descarté porque mezclaba la marca del producto con la marca de la desarrolladora.
3. **Evidencia que sostiene la decisión:** Los repos se renombraron a nexa-frontend y nexa-backend. El componente KologicBar se mantiene al pie de página para identificar a la empresa.
4. **Qué aporté yo, con remisión al repositorio:** Renombré las carpetas y actualicé el package.json de ambos repos.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** IA.

## Entrada — ~Julio 2026, semana 1-2

1. **Qué decidí:** Definí la arquitectura definitiva: dos repositorios separados, nexa-frontend (Vite + React + TypeScript) y nexa-backend (Express + TypeScript + Prisma + PostgreSQL). Más adelante, terminé de confirmar que la arquitectura de fondo es single-tenant reproducible (una instancia propia por cliente, sin tabla de tenant compartida) y no la idea multi-tenant SaaS con la que había arrancado.
2. **Alternativas evaluadas y por qué las descarté:** Un solo repo full-stack (monorepo), descartado porque con Next.js ya había comprobado que mezclar todo genera confusión. Sobre la arquitectura de datos: seguir con la idea multi-tenant original, descartada porque agrega complejidad de seguridad (aislar datos entre clientes) que no tiene sentido pagar cuando todavía tengo un solo cliente real (Loren).
3. **Evidencia que sostiene la decisión:** Existencia de las dos carpetas nexa-frontend/ y nexa-backend/. Esquema de base de datos actual sin columnas de tenant_id ni lógica de aislamiento multi-cliente.
4. **Qué aporté yo, con remisión al repositorio:** Creé ambas carpetas, corrí npm init en cada una, y definí el esquema de base de datos pensado para un solo cliente por instancia.
5. **Desacuerdos y cómo se resolvieron:** Ninguno sobre la separación de repos. Sí quedó como regla clara que los secretos del backend (JWT_SECRET, DATABASE_URL) nunca deben estar en el .env del frontend, y que todo lo que empiece con VITE_ es público.
6. **Herramienta auxiliar usada:** IA para pensar la arquitectura y las reglas de seguridad básicas.

## Entrada — ~Julio 2026, semana 2

1. **Qué decidí:** Definí los roles del sistema como admin | professional | client, bien genéricos en el código (nada de "Loren" ni "estética" hardcodeado), aunque específicos en la interfaz visual. Antes había arrancado con admin | staff | customer, pensando en algo todavía más genérico.
2. **Alternativas evaluadas y por qué las descarté:** Mantener staff/customer. Terminé decidiéndome por professional/client porque era más simple y generaba menos confusión con el dominio real del negocio, aunque perdiera un poco de generalidad.
3. **Evidencia que sostiene la decisión:** shared/types/user.ts final: export type UserRole ='admin' | 'professional' | 'client'.
4. **Qué aporté yo, con remisión al repositorio:** Edité el archivo de tipos y corregí todos los imports que se rompían por la inconsistencia (ya había más de 40 archivos usando el nombre viejo).
5. **Desacuerdos y cómo se resolvieron:** Sabía que el cambio tan tarde en el proyecto iba a generar errores en cascada, así que lo hice con un refactor dirigido, archivo por archivo.
6. **Herramienta auxiliar usada:** IA para el refactor y para encontrar todos los archivos afectados por el cambio.

## Entrada — ~Julio 2026, semana 2-3

1. **Qué decidí:** Organicé la estructura de carpetas del frontend con un patrón tipo Feature-Sliced Design adaptado: app/ (config central), features/ (lógica por dominio), pages/ (vistas), shared/ (componentes reutilizables), layouts/ y assets/.
2. **Alternativas evaluadas y por qué las descarté:** Estructura plana por tipo de archivo (components/, pages/, utils/ sueltos). La descarté porque no escala bien y mezcla dominios distintos en las mismas carpetas.
3. **Evidencia que sostiene la decisión:** La carpeta src/ del proyecto sigue esta estructura.
4. **Qué aporté yo, con remisión al repositorio:** Creé las carpetas manualmente y fui ordenando cada archivo según su dominio.
5. **Desacuerdos y cómo se resolvieron:** Detecté una inconsistencia con HeroSection.tsx, que estaba en shared/ui/organisms/ pero tenía contenido específico del negocio de Loren. Quedó anotado que debería moverse a features/home/, pendiente de mover.
6. **Herramienta auxiliar usada:** IA para diseñar la estructura y detectar esta inconsistencia.

## Entrada — ~Julio 2026, semana 3

1. **Qué decidí:** Centralice todos los datos de ejemplo (mock) en src/app/data/, con subcarpetas por dominio: admin/, client/, professional/, tenant/, shared/. Ningún componente tiene datos hardcodeados adentro.
2. **Alternativas evaluadas y por qué las descarté:** Datos hardcodeados dentro de cada componente. Lo descarté porque viola la regla de tener un solo lugar para editar cuando conecte el backend real.
3. **Evidencia que sostiene la decisión:** Carpeta app/data/ con archivos como dashboard/index.ts, clients.data.ts, professionals.data.ts, etc.
4. **Qué aporté yo, con remisión al repositorio:** Creé cada archivo de datos y actualicé los imports en todos los componentes.
5. **Desacuerdos y cómo se resolvieron:** Los testimonios de ejemplo del tenant (TENANT_TESTIMONIALS) eran ficticios, y mostrar reseñas inventadas como si fueran reales podría ser publicidad engañosa. Quedó anotado como bloqueante para producción, todavía sin resolver.
6. **Herramienta auxiliar usada:** IA.

## Entrada — ~Julio 2026, semana 3

1. **Qué decidí:** Definí TenantContext como la única fuente de verdad para los datos del negocio (nombre, logo, colores, etc.), eliminando el archivo paralelo business.config.ts que tenía antes.
2. **Alternativas evaluadas y por qué las descarté:** Mantener business.config.ts y TenantContext funcionando en paralelo. Lo descarté porque tener dos fuentes de verdad con nombres de campo distintos me estaba generando errores de TypeScript (logoUrl no existía en un lado y sí en el otro).
3. **Evidencia que sostiene la decisión:** El error de TypeScript sobre logoUrl ya no existe en el código actual. business.config.ts fue eliminado del repo.
4. **Qué aporté yo, con remisión al repositorio:** Detecté el error en VSCode, lo reporté y unifiqué todo bajo TenantContext.
5. **Desacuerdos y cómo se resolvieron:** Ninguno una vez identificado el problema.
6. **Herramienta auxiliar usada:** IA para el diagnóstico de la causa raíz.

## Entrada — ~Julio 2026, semana 3-4

1. **Qué decidí:** Implementé la autenticación con JWT guardado en cookies httpOnly: access token de 15 minutos, refresh token de 7 días con rotación. El token nunca toca localStorage.
2. **Alternativas evaluadas y por qué las descarté:** Guardar el token en localStorage. Lo descarté por el riesgo de XSS — cualquier script malicioso puede leer localStorage, pero no puede leer una cookie httpOnly.
3. **Evidencia que sostiene la decisión:** auth.controller.ts con res.cookie('access_token', ..., { httpOnly: true }).
4. **Qué aporté yo, con remisión al repositorio:** Configuré las variables JWT_SECRET y JWT_REFRESH_SECRET en el .env del backend, e implementé AuthContext.tsx, auth.service.ts, auth.controller.ts y auth.repository.ts.
5. **Desacuerdos y cómo se resolvieron:** Los dos secretos tenían que tener al menos 32 caracteres y ser distintos entre sí, eso lo corregí en el .env. También apareció un bug de loop infinito al navegar a /admin/dashboard, causado porque el interceptor de Axios redirigía a /login en cualquier error 401, incluyendo la llamada inicial a /auth/me. Lo resolví excluyendo /auth/me y /auth/refresh de esa redirección automática.
6. **Herramienta auxiliar usada:** IA para la implementación de seguridad y para diagnosticar el loop infinito.

## Entrada — ~Julio-Agosto 2026

1. **Qué decidí:** En el backend terminé usando Prisma como ORM con PostgreSQL, pero el camino no fue directo: al principio tuve bastantes problemas instalando y configurando Prisma, y en el medio llegué a tener auth.repository.ts usando el paquete pg con SQL crudo mientras el resto del backend ya usaba Prisma. Después volví a instalar Prisma de cero y quedó funcionando bien. Más adelante probé Prisma 7, que rompía el formato del schema, así que bajé a Prisma 6 (6.19.3, la que uso ahora), que funciona perfectamente.
2. **Alternativas evaluadas y por qué las descarté:** Quedarme con queries SQL crudas usando pg en vez de Prisma. Lo descarté porque perdía la generación automática de tipos y la velocidad de desarrollo que me daba Prisma, una vez que lo hice funcionar bien.
3. **Evidencia que sostiene la decisión:** Migración 20260720211431_init en prisma/migrations/, y actualmente 17 migraciones aplicadas en total. package.json final con @prisma/client 6.19.3.
4. **Qué aporté yo, con remisión al repositorio:** Instalé PostgreSQL localmente, creé el usuario Kologic y la base nexa_db desde psql, y fui corriendo cada migración a medida que agregaba modelos nuevos.
5. **Desacuerdos y cómo se resolvieron:** Hubo un momento de inconsistencia entre pg y Prisma que generó el error "the table (not available) does not exist", que resolví migrando todo a Prisma. Prisma 7 después rompió el formato del schema (sacó la línea url = env("DATABASE_URL")), lo resolví bajando a Prisma 6.
6. **Herramienta auxiliar usada:** IA para diagnosticar los errores de instalación y de versión, y para guiar la migración de pg a Prisma.

## Entrada — ~Julio-Agosto 2026

1. **Qué decidí:** La recuperación de contraseña funciona con un código numérico de 6 dígitos enviado por email, no con un link. Funciona correctamente.
2. **Alternativas evaluadas y por qué las descarté:** Un link con token hexadecimal de 64 caracteres. Lo descarté porque el usuario tiene que copiar y pegar el código en la app en vez de depender de un link con una ruta que no siempre andaba bien.
3. **Evidencia que sostiene la decisión:** generateVerificationCode() en generateCode.ts usa crypto.randomInt(100000, 1000000).toString(). El email muestra el código en un recuadro con una tipografía grande.
4. **Qué aporté yo, con remisión al repositorio:** Probé que el código llegara al email real y lo ingresé en el modal para validar el flujo completo de 4 pasos.
5. **Desacuerdos y cómo se resolvieron:** Dudé si 15 minutos de expiración alcanzaban para un código (contra 1 hora que le había dado al link). Decidí mantener los 15 minutos porque un código corto es menos seguro que un token largo, así que conviene que expire rápido.
6. **Herramienta auxiliar usada:** IA para el template HTML del email y la lógica del modal de recuperación.

## Entrada — ~Julio-Agosto 2026

1. **Qué decidí:** El envío de emails lo hice con Nodemailer usando Gmail SMTP, con una Contraseña de Aplicación (no la contraseña real de la cuenta de Google).
2. **Alternativas evaluadas y por qué las descarté:** Usar un servicio externo como SendGrid. Lo descarté por costo y porque era complejidad de más para el alcance del PIF.
3. **Evidencia que sostiene la decisión:** mail.provider.ts con host: 'smtp.gmail.com', port: 587, y la variable MAIL_PASS en el .env. Prueba directa por PowerShell que devolvió "OK — conexión exitosa".
4. **Qué aporté yo, con remisión al repositorio:** Generé la Contraseña de Aplicación desde la cuenta de Google (Seguridad → Verificación en dos pasos) y corrí la prueba de conexión.
5. **Desacuerdos y cómo se resolvieron:** El primer intento falló porque MAIL_PASS estaba vacío, y el error quedaba oculto por un .catch() que no mostraba nada. Cambié eso por un try/catch con logging explícito para poder ver qué estaba fallando de verdad.
6. **Herramienta auxiliar usada:** IA para diagnosticar el envío silencioso de errores y mejorar el logging.

## Entrada — transversal al proyecto

1. **Qué decidí:** Sumé varias capas de seguridad al backend: JWT en cookie httpOnly, CORS restringido a la URL del frontend, rate limiting en los endpoints de auth (10 requests cada 15 minutos), Helmet para los headers, bcrypt con SALT_ROUNDS=12, refresh tokens con rotación, validación con Zod en todos los DTOs, validación de dominio permitido en las URLs de redes sociales, tokens de invitación de un solo uso con expiración configurable, y contraseñas que nunca viajan en texto plano.
2. **Alternativas evaluadas y por qué las descarté:** Fui agregando cada una de estas cosas a medida que la necesitaba, no las pensé todas juntas desde el principio.
3. **Evidencia que sostiene la decisión:** Configuración de helmet, express-rate-limit y bcryptjs visibles en el backend actual.
4. **Qué aporté yo, con remisión al repositorio:** Fui implementando cada capa de seguridad a medida que avanzaba con cada módulo.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** IA para revisar qué capas de seguridad me faltaban en cada etapa.

## Entrada — ~Agosto 2026, semana 1

1. **Qué decidí:** El panel de admin usa un AdminLayout con sidebar fijo a la izquierda, colapsable y responsive, con las secciones Turnos, Dashboard, Servicios, Profesionales, Tienda, Información, Solicitudes y Configuración.
2. **Alternativas evaluadas y por qué las descarté:** Navbar superior, descartada por ser más propia de una app de contenido que de gestión. Sidebar sin colapso, descartada por los problemas que generaba en pantallas chicas.
3. **Evidencia que sostiene la decisión:** AdminSidebar.tsx con lógica de colapso, versión mobile off-canvas y detección de pantalla con matchMedia.
4. **Qué aporté yo, con remisión al repositorio:** Implementé el AdminSidebar completo y probé el comportamiento en distintos tamaños de pantalla.
5. **Desacuerdos y cómo se resolvieron:** Dudé si el colapso debía activarse con un click en cualquier parte del sidebar o con un botón explícito. Elegí el botón hamburguesa explícito porque un click en área abierta generaba colapsos accidentales al navegar.
6. **Herramienta auxiliar usada:** IA para corregir el componente; la verificación visual la hice yo en el navegador.

## Entrada — ~Agosto 2026, semana 1

1. **Qué decidí:** Definí la paleta de colores del sistema (#069494 teal, #d4af37 dorado, blanco, negro, gris claro) y las tipografías: Cormorant Garamond para login/registro/página pública, Open Sans para el cuerpo general del panel, Playfair Display para los labels del sidebar del profesional, y Lato para Configuración y el onboarding. También saqué el modo oscuro que había armado al principio, quedó solo modo claro.
2. **Alternativas evaluadas y por qué las descarté:** Usar una sola tipografía para todo el sistema, descartada porque Loren pidió un diseño con personalidad. Mantener el toggle Light/Dark, descartado porque generaba bugs de doble render, sobre todo con el calendario.
3. **Evidencia que sostiene la decisión:** index.html con los links de Google Fonts. CSS de cada sección con su font-family específico. Variables [data-theme="dark"] eliminadas del proyecto.
4. **Qué aporté yo, con remisión al repositorio:** Definí la paleta, cargué las fuentes, verifiqué visualmente cada sección en el navegador y saqué el ThemeTogglePill.
5. **Desacuerdos y cómo se resolvieron:** Ninguno sobre la elección en sí; el modo oscuro lo saqué yo sola después de ver que no valía la pena mantenerlo.
6. **Herramienta auxiliar usada:** IA para implementar los estilos.

## Entrada — ~Agosto 2026, semana 1-2

1. **Qué decidí:** Armé el dashboard del admin con 4 KPIs (Ingresos, Turnos, Clientes nuevos, Ticket promedio), gráficos de área y barras con Recharts, y filtro por período (Hoy/Semana/Mes/Año).
2. **Alternativas evaluadas y por qué las descarté:** Chart.js, descartado por ser más verboso y tener peor integración con React. D3.js, descartado por ser demasiado bajo nivel para lo que necesitaba. Una tabla plana sin gráficos, descartada porque el objetivo es mostrar valor de negocio y los gráficos comunican tendencias que una tabla no muestra.
3. **Evidencia que sostiene la decisión:** Archivos RevenueChart.tsx, ServiceStats.tsx, ProfessionalStats.tsx, StatusAndPayments.tsx y KpiCard.tsx en pages/admin/dashboard/.
4. **Qué aporté yo, con remisión al repositorio:** Diseñé el layout visual (los 4 KPIs arriba, después los gráficos, después el bloque de 3 columnas) e implementé los componentes.
5. **Desacuerdos y cómo se resolvieron:** Los colores de las barras y áreas tenían el #069494 puesto directo en el código en vez de usar var(--primary), lo corregí para que se apliquen automáticamente desde la configuración del tenant. Recharts v3 además cambió el tipo del formatter del Tooltip, lo resolví con tooltips personalizados.
6. **Herramienta auxiliar usada:** IA para los componentes de Recharts y para resolver los errores de tipos.

## Entrada — ~Agosto 2026, semana 1-2

1. **Qué decidí:** Para el calendario de turnos del admin probé usar FullCalendar, pero terminé sacándolo y construyendo el calendario a mano.
2. **Alternativas evaluadas y por qué las descarté:** Seguir insistiendo con FullCalendar ajustando el CSS. Lo descarté porque quedaba feo en la interfaz —no encajaba con el diseño que ya tenía— y encima generaba un bug de texto duplicado (MesMes, SemanaSemana, DíaDía) por un conflicto entre el StrictMode de React y Tailwind v4. Probé también react-bigcalendar, pero cualquier librería con CSS global corría el mismo riesgo.
3. **Evidencia que sostiene la decisión:** npm uninstall de todos los paquetes de @fullcalendar. Calendario propio funcionando con tablas HTML y lógica de Date nativa de JavaScript.
4. **Qué aporté yo, con remisión al repositorio:** Implementé los tres componentes del calendario final (CalendarWeek.tsx, CalendarMonth.tsx, CalendarDay.tsx) desde cero, sin dependencias externas.
5. **Desacuerdos y cómo se resolvieron:** Ninguno, decisión que tomé sola después de comprobar que FullCalendar no encajaba ni visual ni técnicamente con el resto del sistema.
6. **Herramienta auxiliar usada:** IA para escribir los tres componentes del calendario custom.

## Entrada — ~Agosto 2026, semana 2

1. **Qué decidí:** El modal de turno permite ver el detalle, editar (duración, precio, profesional, notas), cancelar con confirmación y reactivar si está cancelado. Tiene dos campos de observaciones separados: uno para el cliente (alergias, preferencias) y otro para la profesional (notas post-turno).
2. **Alternativas evaluadas y por qué las descarté:** Un modal solo de lectura, descartado porque el admin necesita poder editar y cancelar desde ahí mismo. Un solo campo de notas compartido, descartado porque la información del cliente y la de la profesional tienen audiencias distintas.
3. **Evidencia que sostiene la decisión:** AppointmentModal.tsx funcionando con los dos campos de observaciones.
4. **Qué aporté yo, con remisión al repositorio:** Implementé el componente completo con toda la lógica de edición, cancelación y reactivación.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** IA para escribir el componente; yo verifiqué visualmente en el navegador.

## Entrada — ~Agosto 2026, semana 2

1. **Qué decidí:** Los profesionales no se registran libremente: el admin genera una invitación con un link y un token único para cada uno. El profesional entra por ese link y completa su propio registro.
2. **Alternativas evaluadas y por qué las descarté:** Registro abierto para cualquiera. Lo descarté por seguridad —cualquiera podría registrarse como si trabajara en el estudio de Loren.
3. **Evidencia que sostiene la decisión:** Tabla Invitation en el schema de Prisma. InviteModal.tsx generando el link con fecha de vencimiento (7 días).
4. **Qué aporté yo, con remisión al repositorio:** Implementé invitation.service.ts, invitation.controller.ts, invitation.routes.ts, invitation.repository.ts, InviteModal.tsx y ProfessionalRegisterPage.tsx, y probé el flujo completo de punta a punta.
5. **Desacuerdos y cómo se resolvieron:** El token de invitación al principio se generaba en el cliente con Math.random(), inseguro. Lo cambié a generación del lado del servidor con crypto.randomBytes(32) cuando conecté el backend real.
6. **Herramienta auxiliar usada:** IA para escribir todos los archivos del módulo.

## Entrada — ~Agosto 2026, semana 2-3

1. **Qué decidí:** El onboarding del profesional es un wizard de 6 pasos: Perfil personal → Experiencia → Horarios → Servicios → Políticas → Confirmación. Solo se muestra si el perfil todavía no está completo.
2. **Alternativas evaluadas y por qué las descarté:** Un formulario largo en una sola pantalla con todos los campos juntos. Lo descarté por experiencia de usuario — un formulario de 30 campos de una sola vez es abrumador y aumenta la tasa de abandono.
3. **Evidencia que sostiene la decisión:** OnboardingWizard.tsx con un array de 6 pasos y validación por paso antes de poder avanzar.
4. **Qué aporté yo, con remisión al repositorio:** Implementé el wizard completo.
5. **Desacuerdos y cómo se resolvieron:** El wizard al principio no aparecía porque el campo profileComplete no existía en el tipo User del AuthContext; lo agregué. Quedó anotado sin resolver que el texto "¡Bienvenida al sistema!" asume género femenino — lo dejé así porque el perfil real de Loren lo justifica, pero es un pendiente si el sistema se usa en otro contexto.
6. **Herramienta auxiliar usada:** IA para armar el wizard completo.

## Entrada — ~Agosto 2026, semana 3

1. **Qué decidí:** Agregué los modelos Professional y ProfessionalAvailability al schema de Prisma, con relación 1:1 entre User y Professional.
2. **Alternativas evaluadas y por qué las descarté:** Guardar los datos del profesional como JSON dentro de la tabla users. Lo descarté porque no permite hacer consultas eficientes, como buscar todos los profesionales disponibles un martes.
3. **Evidencia que sostiene la decisión:** prisma/schema.prisma con los modelos Professional, ProfessionalAvailability y ProfessionalService.
4. **Qué aporté yo, con remisión al repositorio:** Corrí la migración add_professional_models.
5. **Desacuerdos y cómo se resolvieron:** professional.service.ts hacía referencia a prisma.professional antes de que el modelo existiera en el schema, lo que tiraba error. Se resolvió corriendo la migración y regenerando el cliente de Prisma.
6. **Herramienta auxiliar usada:** IA.

## Entrada — ~Agosto 2026, semana 3

1. **Qué decidí:** Reactivé el guard de rol en ProfessionalLayout, que había quedado comentado con un "TODO: descomentar cuando se conecte el backend".
2. **Alternativas evaluadas y por qué las descarté:** Dejarlo comentado hasta el final del proyecto. Lo descarté apenas detecté el problema de seguridad que generaba.
3. **Evidencia que sostiene la decisión:** ProfessionalLayout.tsx con la validación de rol antes de renderizar el panel.
4. **Qué aporté yo, con remisión al repositorio:** Detecté que, logueada como admin, podía entrar sin restricción al panel de profesionales, y reactivé el guard.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** IA para el diagnóstico.

## Entrada — ~Agosto 2026, semana 3-4

1. **Qué decidí:** La sección de Configuración del profesional muestra datos reales cargados desde el backend (GET /api/professional/profile), con el email bloqueado (no editable).
2. **Alternativas evaluadas y por qué las descarté:** Mostrar datos de ejemplo en Configuración en vez de datos reales. La descarté porque el profesional necesita poder ver y editar su información real después de terminar el onboarding.
3. **Evidencia que sostiene la decisión:** Settings.tsx con un useEffect que llama al endpoint real.
4. **Qué aporté yo, con remisión al repositorio:** Probé que los datos cargados en el onboarding (nombre, teléfono, especialidad, bio) aparecieran correctamente después en Configuración.
5. **Desacuerdos y cómo se resolvieron:** El primer intento mostraba "No se pudo cargar el perfil" porque el service tiraba error cuando el profesional todavía no había completado el onboarding. Lo resolví con un fallback que devuelve el usuario con campos vacíos si el Professional todavía es null.
6. **Herramienta auxiliar usada:** IA.

## Entrada — ~Agosto 2026, semana 4

1. **Qué decidí:** Saqué Horarios de adentro de Configuración y lo dejé como una sección propia del sidebar del profesional, en la ruta /professional/schedule. También dejé los métodos de pago del onboarding en solo Efectivo, Transferencia y Tarjeta, sacando ahí la opción de Mercado Pago.
2. **Alternativas evaluadas y por qué las descarté:** Dejar Horarios como una tab más dentro de Configuración, descartado porque los horarios cambian seguido y merecen acceso directo. Dejar Mercado Pago como método de cobro del profesional en el onboarding, descartado porque Loren no lo usa para eso y hubiera sido confuso sin integración real ahí.
3. **Evidencia que sostiene la decisión:** ROUTES.PROFESSIONAL_SCHEDULE = '/professional/schedule'. PoliciesStep.tsx sin el elemento de Mercado Pago en PAYMENT_OPTIONS.
4. **Qué aporté yo, con remisión al repositorio:** Pedí explícitamente ambos cambios.
5. **Desacuerdos y cómo se resolvieron:** Ninguno. Aclaración: esto es distinto de la integración de Mercado Pago para la seña online del cliente final, que sí sigue en pie (ver Parte 6).
6. **Herramienta auxiliar usada:** IA.

## Entrada — ~Agosto 2026, semana 2

1. **Qué decidí:** Los servicios que carga el admin en el panel son la única fuente de verdad: se guardan en la base de datos y de ahí se alimentan tanto la página pública como el selector de servicios del onboarding de profesionales.
2. **Alternativas evaluadas y por qué las descarté:** Tener una lista de servicios separada para el admin y otra para la web pública. Lo descarté porque generaba duplicación y el riesgo de que un servicio esté activo en un lado y no en el otro.
3. **Evidencia que sostiene la decisión:** Migración add_service_table aplicada. El endpoint GET /api/services devuelve los servicios activos y la home los muestra en tiempo real, sin necesidad de estar logueado.
4. **Qué aporté yo, con remisión al repositorio:** Implementé service.model.ts, service.controller.ts, service.routes.ts, y actualicé ServicesPage.tsx y ServicesSection.tsx para consumir la API real.
5. **Desacuerdos y cómo se resolvieron:** Tuve un error de schema porque ProfessionalService hacía referencia a Service pero Service no tenía la relación inversa (error P1012 de Prisma). Lo resolví agregando professionalServices ProfessionalService[] al modelo Service.
6. **Herramienta auxiliar usada:** IA para escribir el módulo y diagnosticar el error de schema.

## Entrada — transversal (catálogo de Loren)

1. **Qué decidí:** Organicé el catálogo de servicios de Loren en cuatro categorías: Uñas, Cabello, Cuerpo y Rostro, con sus respectivos servicios, técnicas y talleres relevados directamente del negocio.
2. **Alternativas evaluadas y por qué las descarté:** ninguna.
3. **Evidencia que sostiene la decisión:** Catálogo proporcionado por Loren con el detalle completo de cada categoría (manos, pies, talleres, trenzas, depilación, masajes, limpieza facial, pestañas, cejas, etc.).
4. **Qué aporté yo, con remisión al repositorio:** Organicé el catálogo real para poder trasladarlo al modelo de datos del sistema.
5. **Desacuerdos y cómo se resolvieron:** ninguno.
6. **Herramienta auxiliar usada:** IA para ordenar y estructurar la información relevada.

## Entrada — transversal (reglas de depilación definitiva)

1. **Qué decidí:** Definí varias reglas específicas para el servicio de depilación definitiva: la próxima sesión no se crea automáticamente cada 30 días, la define el admin o la profesional a mano; el admin puede activar/inactivar el servicio completo y configurar profesional asignada, duración, horarios, zonas y precios; las zonas se pueden crear, modificar e inactivar, pero nunca se eliminan del todo; además del precio por zona se pueden armar paquetes (1 zona, 8 zonas, cuerpo completo); y el precio queda registrado en la reserva en el momento en que se hace, aunque el precio de lista cambie después.
2. **Alternativas evaluadas y por qué las descarté:** Crear automáticamente un turno cada 30 días para la próxima sesión, descartado porque podía generar turnos mal agendados si cambiaba la disponibilidad. Eliminar zonas viejas del sistema, descartado porque tienen que quedar en el historial de reservas pasadas.
3. **Evidencia que sostiene la decisión:** Catálogo real de Loren con las categorías de depilación definitiva (1 zona, 8 zonas, cuerpo completo).
4. **Qué aporté yo, con remisión al repositorio:** Definí toda esta lógica de negocio junto con el análisis funcional del módulo.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** IA para pensar los casos de esta lógica.

## Entrada — Agosto semana 2 - 3

1. **Qué decidí:** Los campos de salud del formulario de reserva (alergias, embarazo, etc.) los planteé como "advertencias operativas" para la profesional, no como datos médicos ni un diagnóstico.
2. **Alternativas evaluadas y por qué las descarté:** Pedir un formulario médico más completo y detallado. Lo descarté porque eso me metería en tratamiento de datos sensibles de salud, con mucha más responsabilidad legal para Kologic de la que necesito asumir en v1.
3. **Evidencia que sostiene la decisión:** Recomendación de mi abogado sobre la exposición legal de tratar datos de salud como si fueran clínicos.
4. **Qué aporté yo, con remisión al repositorio:** Redacté el texto de los campos y las validaciones correspondientes en el formulario de reserva.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** IA para pensar cómo reformular estos campos y bajar el riesgo legal.

## Entrada — Agosto semana 2 - 3

1. **Qué decidí:** Armé un plan de compliance completo, separado en tres etapas —antes del lanzamiento, durante la operación, y si el sistema escala a más clientes— tanto para Kologic como para Loren.
2. **Alternativas evaluadas y por qué las descarté:** Resolver el tema legal recién cuando el sistema ya estuviera funcionando. Lo descarté porque varias decisiones técnicas (la seña, los datos de salud) dependen de tener esto resuelto antes.
3. **Evidencia que sostiene la decisión:** documentos en borrador.
4. **Qué aporté yo, con remisión al repositorio:** Redacté el documento completo para pasárselo a mi abogado y que lo revise antes de avanzar con el desarrollo.
5. **Desacuerdos y cómo se resolvieron:** ninguno.
6. **Herramienta auxiliar usada:** IA para armar el plan legal completo, en base a las decisiones de producto que ya había tomado.

## Entrada — Agosto semana 2-3

1. **Qué decidí:** Terminé de leer el dictamen del profesor sobre mi entrega anterior y armé una checklist con las 16 secciones a corregir: números de PERT/COCOMO, el modelo financiero, el esquema de base de datos, contradicciones de alcance y huecos legales.
2. **Alternativas evaluadas y por qué las descarté:** —
3. **Evidencia que sostiene la decisión:** Dictamen del profesor sobre la entrega anterior del PIF.
4. **Qué aporté yo, con remisión al repositorio:** Ordené cada observación del dictamen en una checklist accionable, sección por sección.
5. **Desacuerdos y cómo se resolvieron:** —
6. **Herramienta auxiliar usada:** IA para analizar el dictamen completo y armar la checklist de remediación.

## Entrada — Agosto semana 3

1. **Qué decidí:** Arranqué el chatbot de WhatsApp: armé la verificación de firma del webhook con HMAC-SHA256 y el control de idempotencia para no procesar el mismo mensaje dos veces. Después agregué la persistencia del estado de conversación por número de teléfono (tabla nueva en Prisma), el servicio de Graph API para mandar mensajes, y conecté las rutas del webhook. La máquina de estados completa de la conversación la dejo para la próxima etapa. Es un deliverable obligatorio para Loren con fecha límite 1/12/2026.
2. **Alternativas evaluadas y por qué las descarté:** ninguna,
3. **Evidencia que sostiene la decisión:** Documentación oficial de Meta sobre verificación de firma de webhooks.
4. **Qué aporté yo, con remisión al repositorio:** Escribí el código de verificación HMAC, el middleware de idempotencia, la tabla de estado de conversación y el servicio de Graph API.
5. **Desacuerdos y cómo se resolvieron:** ninguno.
6. **Herramienta auxiliar usada:** IA para el código base de estos archivos y lo revisé antes de subirlo al repo.

## Entrada — 28/08/2026

1. **Qué decidí:** Hice un corte de estado del proyecto para tener claro qué me falta. Pendiente: conectar el botón "Reservar turno" para que redirija a login o a /client/book según haya sesión o no; centrar el contenido del panel del cliente; conectar la sección de turnos real (hoy usa datos de ejemplo); terminar la integración de Google/Facebook OAuth (el frontend está preparado, el backend todavía no); armar el panel de agenda del profesional y la sección de sus clientes (hoy vacíos); armar el módulo de notificaciones; terminar el módulo de tienda y el de actividad del admin (hoy son placeholders); terminar la máquina de estados del chatbot de WhatsApp; RLS en la base de datos para producción; HTTPS y headers de producción; y tests y linting, que todavía no tengo configurados en ninguno de los dos repos.
2. **Alternativas evaluadas y por qué las descarté:** ninguna.
3. **Evidencia que sostiene la decisión:** Revisión directa del estado del repo backend y frontend, y del stack de dependencias instaladas a esta fecha.
4. **Qué aporté yo, con remisión al repositorio:** Armé este corte de estado para ordenar las prioridades que me quedan.
5. **Desacuerdos y cómo se resolvieron:** ninguna.
6. **Herramienta auxiliar usada:** IA para ordenar el estado actual del proyecto y las tareas pendientes.

## Entrada — 28/08/2026

1. **Qué decidí:** leer detenidamente las consignas del AE1, y empezar a desarrollar el informe individual.
2. **Alternativas evaluadas y por qué las descarté:** ninguna.
3. **Evidencia que sostiene la decisión:** documento en word.
4. **Qué aporté yo, con remisión al repositorio:** empezar a escribir el informe.
5. **Desacuerdos y cómo se resolvieron:** ninguno.
6. **Herramienta auxiliar usada:** IA para que me explique mejor como hacer y dónde buscar información necesaria.

## Entrada — 30/08/2026

1. **Qué decidí:** Generar los Gráficos 1, 2 y 3 de la sección II.4 con Python (matplotlib) en lugar de Canva, para tener control total sobre ejes, fuente y formato exigido por la cátedra; y resolver las inconsistencias cruzadas detectadas en el informe (fecha de la evidencia de WhatsApp, alcance del objetivo general/criterio de éxito, y una fuente primaria faltante en II.1).
2. **Alternativas evaluadas y por qué las descarté:** Evalué generar los gráficos en Canva (herramienta de diseño con IA); la descarté porque, si bien el resultado visual era prolijo, no permitía declarar con precisión las variables de cada eje ni la fuente en el formato académico requerido por la consigna de II.4. También evalué un gráfico de torta simple sin etiqueta externa para el Gráfico 3, pero la porción de "turnos con superposición" (8,33%) quedaba ilegible por su tamaño, así que la descarté a favor de una etiqueta externa con línea guía.
3. **Evidencia que sostiene la decisión:** Los datos numéricos ya relevados en el apartado II.3 (120 turnos/mes de Loren, 330 turnos/mes del resto del equipo desagregados por profesional, 10 superposiciones mensuales, tasa de error del 8,33%) y la composición del equipo relevada en las entrevistas a Loren y Cintia.
4. **Qué aporté yo, con remisión al repositorio:** -
5. **Desacuerdos y cómo se resolvieron:** Sin desacuerdos relevantes en esta entrada — los ajustes fueron correcciones de consistencia interna del informe, no decisiones en disputa.
6. **Herramienta auxiliar usada:** Python (matplotlib) para la generación de gráficos; Claude para la revisión cruzada de consistencia.

## Entrada — 1/09/2026

1. **Qué decidí:** Documentar, formalizar e implementar en la plataforma Nexa las decisiones técnicas y legales previamente tomadas para el proyecto. En el aspecto legal y regulatorio, formalicé el cumplimiento de la Ley N.º 25.326 mediante la redacción del acuerdo entre partes (Loren como Responsable y Kologic como Encargado), la Política de Privacidad y la documentación del criterio de minimización de datos para menores (registrando solo la presencia de acompañante). En el software, implementé las casillas de verificación de términos y consentimiento diferenciado para datos de salud u observaciones operativas (alergias y tipo de piel), junto con la función administrativa de supresión y anonimización de datos (RF-06.03). En lo técnico, documenté el Registro de Decisiones de Arquitectura (ADR-001) para la estrategia single-tenant.
2. **Alternativas evaluadas y por qué las descarté:**
   a. **Modelado de datos sensibles de menores:** Se evaluó si convenía solicitar datos o autorizaciones firmadas de menores en el sistema; se descartó por no ser necesario operativamente para el salón y para respetar el principio de minimización de datos, limitando el registro a la opción booleana de acompañante cuando la reserva la realiza la madre o tutor.
   b. **Borrado físico de registros en la base de datos para la supresión:** Se descartó eliminar físicamente las filas de clientes que solicitan la supresión de datos, ya que esto rompería la integridad referencial y la consistencia del historial contable de los turnos cobrados; se optó por la técnica de anonimización (reemplazo de datos identificatorios por valores genéricos).
   c. **Mantener las políticas de privacidad y seguridad solo como definiciones teóricas:** Se descartó dejarlas únicamente en el texto del informe; se decidió llevarlas al código mediante componentes interactivos y columnas de auditoría en la base de datos para garantizar su verificación en la evaluación.
3. **Evidencia que sostiene la decisión:** La implementación en código se validó mediante la comprobación visual de los formularios de registro y reserva con sus casillas de aceptación obligatoria. La función de supresión se verificó comprobando en la base de datos la anonimización de los datos personales manteniendo intacto el registro del turno.
4. **Qué aporté yo, con remisión al repositorio:**
   - Redacté y estructuré el documento de decisión de arquitectura.
   - Elaboré el borrador formal del Acuerdo de Tratamiento de Datos Personales.
   - Redacté los términos de confidencialidad y tratamiento de datos en /00-gestion/POLITICA_PRIVACIDAD.md.
   - Agregué en el código frontend (React/TypeScript) los componentes con los avisos legales y casillas de consentimiento en los flujos de alta de usuario y confirmación de turno.
   - Implementé en el backend (Node.js/Prisma) las columnas de auditoría para la aceptación de términos y la función administrativa para anonimizar los datos del cliente a su solicitud.
5. **Desacuerdos y cómo se resolvieron:** No se presentaron desacuerdos de fondo, ya que las definiciones de arquitectura y alcance ya estaban acordadas. El trabajo se centró en coordinar la mejor manera de volcar esas definiciones al código y a la carpeta de gestión del proyecto sin generar sobrecarga en el desarrollo, resolviendo mantener una implementación limpia en la interfaz y respaldar los procesos complejos con la documentación correspondiente en el repositorio.
6. **Herramienta auxiliar usada:** IA

## Entrada — 02/09/2026

1. **Qué decidí:** Procesar el Dictamen Técnico-Pedagógico N.º 06/2026 completo (22 páginas) y convertirlo en un checklist de trabajo accionable, organizado en 16 bloques según el orden del propio documento.
2. **Alternativas evaluadas y por qué las descarté:** Ninguna.
3. **Evidencia que sostiene la decisión:** El checklist se armó citando y organizando exclusivamente contenido textual del propio PDF del dictamen, sin agregar criterios externos.
4. **Qué aporté yo, con remisión al repositorio:** Leer todo el checklist, e ir bien punto por punto que ya estaba hecho, que había que agregar al informe, que al código y cuales eran documentos apartes.
5. **Desacuerdos y cómo se resolvieron:** Ninguno.
6. **Herramienta auxiliar usada:** Sí. Claude leyó el PDF completo y generó el archivo Checklist_Correcciones_Kologic como documento de trabajo.

## Entrada — 02/09/2026

1. **Qué decidí:** Kologic se define como Proyecto Integrador Final (PIF, Res. 97/23, modalidad 23.2), no como tesis, con Loren Estudio de Belleza (Posadas, Misiones) como cliente real, bajo la empresa Kologic.
2. **Alternativas evaluadas y por qué las descarté:** ninguna.
3. **Evidencia que sostiene la decisión:** El propio Dictamen N.º 06/2026 confirma esta definición y la modalidad 23.2 como "modalidad ordinaria del ciclo".
4. **Qué aporté yo, con remisión al repositorio:** escribirlo en el informe.
5. **Desacuerdos y cómo se resolvieron:** ninguno.
6. **Herramienta auxiliar usada:** ninguna.

## Entrada — 02/09/2026

1. **Qué decidí:** Se redactan tres borradores para incorporar al informe:
   a. Tres RF nuevos (política de privacidad, consentimiento para datos sensibles, supresión de datos).
   b. Decisión de minimización de datos para clientas con acompañantes menores (campo booleano, sin datos identificatorios del menor).
   c. Párrafo reconociendo la obligación de inscripción ante la autoridad de aplicación (Art. 21), con nota de que el nombre del organismo necesita verificación.
2. **Alternativas evaluadas y por qué las descarté:** Para el punto de menores, se consideró (y se descartó explícitamente en el borrador) registrar más datos del menor — se prefirió el criterio de minimización de datos por ser el más simple y legalmente más seguro, siguiendo la lógica que el propio dictamen sugiere para el caso de "enfermedades" vs. "advertencia operativa".
3. **Evidencia que sostiene la decisión:** Basado en el apartado 10 del dictamen (Ley 25.326, Arts. 21 y 25) y en el criterio de minimización de datos que el docente aplica en otros puntos del mismo dictamen.
4. **Qué aporté yo, con remisión al repositorio:** escribirlos en el informe.
5. **Desacuerdos y cómo se resolvieron:** ninguno.
6. **Herramienta auxiliar usada:** Claude generó el borrador completo de los tres textos.

## Entrada — 02/09/2026

1. **Qué decidí:** Aplicar las correcciones puntuales: reformular II.2 para reflejar que sí se entrevistó a una clienta (alineándolo con II.6), sumar el puente lógico en II.3 entre "10-15 min por consulta" y la meta diaria del Objetivo 4, y declarar el alcance del objetivo de "cero superposiciones" sobre las 7 agendas (450 turnos), no solo sobre Loren.
2. **Alternativas evaluadas y por qué las descarté:** Para el alcance del objetivo, evalué dejarlo limitado solo a la agenda de Loren (que es donde hay línea de base numérica), pero lo descarté porque el sistema centraliza la disponibilidad de las 7 profesionales, no solo la de Loren.
3. **Evidencia que sostiene la decisión:** Los propios datos de II.3 sobre volumen total del estudio (450 turnos/mes, 7 profesionales).
4. **Qué aporté yo, con remisión al repositorio:** Redacté los párrafos de reemplazo para II.2, la aclaración en II.3, y la aclaración del alcance en el Resumen.
5. **Desacuerdos y cómo se resolvieron:** No hubo.
6. **Herramienta auxiliar usada:** ninguna.

## Entrada — 02/09/2026

1. **Qué decidí:** auditar el informe después de aplicar los cambios, porque mover piezas de un lado puede romper otra parte que dependía del texto original.
2. **Alternativas evaluadas y por qué las descarté:** -
3. **Evidencia que sostiene la decisión:** Se detectaron 3 problemas nuevos generados por los propios cambios: la fecha del chat de WhatsApp quedó corregida en I.3 (24/11) pero no en I.1 (seguía en 26/11); el Resumen quedó ampliado a "7 agendas / 450 turnos" pero I.2 e I.3 seguían hablando solo de la agenda de Loren; y la clienta se agregó como fuente en II.2 y II.6 pero nunca se sumó a la lista de fuentes primarias de II.1.
4. **Qué aporté yo, con remisión al repositorio:** Identifiqué los 3 problemas nuevos y redacté los textos de corrección para cada uno.
5. **Desacuerdos y cómo se resolvieron:** No hubo.
6. **Herramienta auxiliar usada:** ninguna.

## Entrada — 02/09/2026

1. **Qué decidí:** Evaluar explícitamente los 5 desencadenantes que exige la consigna de la cátedra (disfunción operativa, oportunidad de negocio, exigencia normativa, obsolescencia tecnológica, presión competitiva), no solo los 2 que ya estaban desarrollados.
2. **Alternativas evaluadas y por qué las descarté:** Descarté "oportunidad de negocio" como desencadenante dominante (la reproducibilidad de Nexa es una oportunidad de Kologic como empresa, no un desencadenante dentro de Loren Estudio); descarté "exigencia normativa" (la Ley 25.326 y la Ordenanza II N.º 45 operan como restricción de diseño, no como origen del proyecto); descarté "presión competitiva" (el propio relevamiento muestra que el 93,57% del sector no tiene sistema digital, lo que contradice la idea de presión competitiva).
3. **Evidencia que sostiene la decisión:** Dato del relevamiento propio de 140 establecimientos en Posadas (II.5, PESTEL "Tecnológico").
4. **Qué aporté yo, con remisión al repositorio:** Redacté el párrafo de evaluación y descarte de los 3 desencadenantes no aplicables, para insertar en I.1.
5. **Desacuerdos y cómo se resolvieron:** No hubo.
6. **Herramienta auxiliar usada:** Usé Claude para estructurar la evaluación de los 5 desencadenantes contra la evidencia disponible.

## Entrada — 02/09/2026

1. **Qué decidí:** Documentar el stack técnico real y exacto (versiones de TypeScript, Express, Prisma, React, Vite, etc.) en el informe, en vez de la descripción genérica que tenía.
2. **Alternativas evaluadas y por qué las descarté:** -
3. **Evidencia que sostiene la decisión:** Listado de dependencias real de los repos nexa-backend y nexa-frontend.
4. **Qué aporté yo, con remisión al repositorio:** Pasé el detalle técnico completo (lenguajes, frameworks, librerías, testing, lint).
5. **Desacuerdos y cómo se resolvieron:** No hubo.
6. **Herramienta auxiliar usada:** ninguna.

## Entrada — 02/09/2026

1. **Qué decidí:** Confirmar que el diseño del sistema (todas las señas a la cuenta de Loren) ya está bien descrito en el Resumen, el Objetivo específico 3 y el Anexo de Normativa sectorial, y que el esquema mixto (cada profesional cobra por su canal) que aparece en el Anexo I es el proceso actual informal, no una contradicción de diseño.
2. **Alternativas evaluadas y por qué las descarté:** Descarté modificar el Anexo I (las entrevistas), porque documentan correctamente el estado actual del negocio, que es distinto del diseño futuro del sistema.
3. **Evidencia que sostiene la decisión:** Texto de las entrevistas originales a Loren y a la profesional en el Anexo I.
4. **Qué aporté yo, con remisión al repositorio:** Distinguí explícitamente "estado actual" vs. "diseño propuesto" para que quede como argumento de respaldo ante el profesor.
5. **Desacuerdos y cómo se resolvieron:** No hubo.
6. **Herramienta auxiliar usada:** ninguna.

## Entrada — 02/09/2026

1. **Qué decidí:** Marcar como pendiente la elección real de la pasarela de pagos, y sacar toda mención específica a Mercado Pago del informe hasta confirmarla.
2. **Alternativas evaluadas y por qué las descarté:** Ninguna.
3. **Evidencia que sostiene la decisión:** -
4. **Qué aporté yo, con remisión al repositorio:** Reformulé los 3 párrafos del informe que mencionaban Mercado Pago como si fuera una decisión ya tomada (Resumen, Anexo III Bitácora, Anexo Normativa sectorial), reemplazándolo por "una pasarela de pagos" en términos genéricos.
5. **Desacuerdos y cómo se resolvieron:** no hubo.
6. **Herramienta auxiliar usada:** Usé Claude para localizar las 3 menciones y reformularlas sin comprometer una decisión que todavía no tomé.

## Entrada — 02/09/2026

1. **Qué decidí:** Excluir completamente cualquier funcionalidad de WhatsApp del sistema en esta entrega (ni reserva, ni recordatorios, ni notificaciones), corrigiendo el párrafo de exclusiones de I.6 que solo excluía la "atención conversacional completa" pero seguía incluyendo la identificación por WhatsApp.
2. **Alternativas evaluadas y por qué las descarté:** Descarté mantener la reserva por WhatsApp con identificación por teléfono como excepción parcial, porque decidí que el alcance de esta entrega es 100% web.
3. **Evidencia que sostiene la decisión:** -
4. **Qué aporté yo, con remisión al repositorio:** Redacté el nuevo párrafo de exclusión.
5. **Desacuerdos y cómo se resolvieron:** no hubo.
6. **Herramienta auxiliar usada:** Usé Claude para reformular el párrafo.

## Entrada — 02/09/2026

1. **Qué decidí:** Actualizar los módulos funcionales de I.6 con las respuestas nuevas de Loren: asignación automática por orden de antigüedad y disponibilidad (reemplaza "por menor carga entre profesionales"), reprogramaciones sin límite de cantidad mientras se avise con 12 horas de anticipación (reemplaza el tope de "hasta tres reprogramaciones" y las "24 horas"), seña diferenciada del 50% para talleres.
2. **Alternativas evaluadas y por qué las descarté:** Descarté dejar la regla anterior de "reparto por menor carga", porque Loren confirmó explícitamente que el criterio real es antigüedad + disponibilidad, no carga de trabajo.
3. **Evidencia que sostiene la decisión:** Respuestas nuevas de Loren al cuestionario ampliado.
4. **Qué aporté yo, con remisión al repositorio:** Reescribí el párrafo completo de "Módulos funcionales" de I.6 incorporando las 5 correcciones.
5. **Desacuerdos y cómo se resolvieron:** Detecté 3 contradicciones entre las respuestas nuevas de Loren y lo que el informe ya decía (asignación por antigüedad vs. por carga; reprogramaciones ilimitadas vs. tope de 3; la respuesta nueva sobre no-show describe en realidad una cancelación con aviso, no un no-show real sin aviso — quedó pendiente repreguntarle a Loren si la política original de no-show sin aviso sigue vigente sin excepciones).
6. **Herramienta auxiliar usada:** Usé Claude para detectar las 3 contradicciones y reformular el párrafo.

## Entrada — 02/09/2026

1. **Qué decidí:** desarrollo del informe grupal con dos compañeros.
2. **Alternativas evaluadas y por qué las descarté:** -
3. **Evidencia que sostiene la decisión:** incluida en la entrega del AE1.
4. **Qué aporté yo, con remisión al repositorio:** -
5. **Desacuerdos y cómo se resolvieron:** no hubo.
6. **Herramienta auxiliar usada:** ninguna.

## Entrada — 03/09/2026

1. **Qué decidí:** completar los instrumentos.
2. **Alternativas evaluadas y por qué las descarté:** -
3. **Evidencia que sostiene la decisión:** incluidas en la entrega del AE1.
4. **Qué aporté yo, con remisión al repositorio:** -
5. **Desacuerdos y cómo se resolvieron:** no hubo.
6. **Herramienta auxiliar usada:** ninguna.
