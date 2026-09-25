# Protocolo de Backup y Restauración

Proyecto Nexa (Loren Estudio de Belleza)

Este documento registra el procedimiento de respaldo y recuperación de la base
de datos, y deja constancia de un simulacro real de recuperación ante
desastres (Disaster Recovery Test) ejecutado sobre un dump real de producción.

## 1. Backup automático

**Mecanismo:** GitHub Actions (`.github/workflows/backup.yml`), corre todos los
días a las 03:00 (ART). Genera un `pg_dump` en formato custom (`-F c`) de la
base de producción (Supabase) y lo guarda como artifact del run, con 30 días
de retención. También se puede disparar a mano desde la pestaña **Actions** del
repositorio (`workflow_dispatch`).

**Por qué artifact y no un archivo commiteado al repo:** un dump de la base
contiene datos personales de clientas (nombres, teléfonos, emails) y hashes de
contraseñas — nunca debe quedar en el historial de git, ni siquiera en un repo
privado.

## 2. Procedimiento manual de backup

```bash
pg_dump "postgresql://<usuario>:<password>@<host>:<puerto>/postgres" \
  --no-owner --no-acl --schema=public -F c -f nexa-backup.dump
```

`--schema=public` limita el dump a las tablas propias de la aplicación
(las que gestiona Prisma) y excluye los esquemas internos de Supabase
(`auth`, `storage`, `realtime`, etc.), que son infraestructura del proveedor,
no datos del negocio, y no tiene sentido restaurarlos en otro lado.

## 3. Procedimiento de restauración

```bash
# 1) Crear una base vacía en el destino (Postgres local, Docker, u otro proveedor)
psql -h <host> -U <usuario> -d postgres -c "CREATE DATABASE nombre_destino;"

# 2) Restaurar el dump ahí
pg_restore -h <host> -U <usuario> -d nombre_destino --no-owner --no-acl -v nexa-backup.dump
```

## 4. Simulacro real ejecutado — 25/09/2026

Se generó un dump real de la base de producción (Supabase, proyecto
`ivtesgdigllikyefhkov`) y se restauró en una base PostgreSQL local limpia
(`nexa_restore_test`, Postgres 18 local — alternativa válida a un contenedor
Docker cuando no hay Docker Desktop corriendo). Evidencia completa:

### 4.1 Generación del dump

```
$ pg_dump "postgresql://postgres.ivtesgdigllikyefhkov:***@aws-0-us-west-2.pooler.supabase.com:5432/postgres" \
    --no-owner --no-acl --schema=public -F c -f nexa-restore-drill.dump

-rw-r--r-- 1 Emily Kohler 197121 72509 Sep 25 16:21 nexa-restore-drill.dump
```

### 4.2 Conteo de filas en el ORIGEN (Supabase, producción)

```
            tabla             | filas
------------------------------+-------
 _prisma_migrations           |    46
 activity_logs                |     0
 appointments                 |     0
 auto_promotion_sends         |     0
 auto_promotions              |     0
 business_holidays            |     0
 business_schedule_days       |     7
 business_settings            |     1
 client_gallery_photos        |     0
 client_notifications         |     0
 clients                      |     0
 conversaciones_whatsapp      |     0
 inventory_movements          |     0
 invitations                  |     0
 mensajes_whatsapp_procesados |     0
 orders                       |     0
 password_resets              |     0
 payment_settings             |     1
 product_orders               |     0
 products                     |     0
 professional_availability    |     0
 professional_notifications   |     0
 professional_services        |     0
 professionals                |     0
 promotions                   |     0
 reviews                      |     0
 services                     |     0
 special_events               |     0
 users                        |     1
(29 filas)
```

### 4.3 Restauración en base local limpia

```
$ psql -h localhost -U kologic -d postgres -c "CREATE DATABASE nexa_restore_test;"
CREATE DATABASE

$ pg_restore -h localhost -U kologic -d nexa_restore_test --no-owner --no-acl -v nexa-restore-drill.dump
...
pg_restore: creando ROW SECURITY «public.users»
pg_restore: error: could not execute query: ERROR:  ya existe el esquema «public»
pg_restore: precaución: errores ignorados durante la recuperación: 1
```

El único error (`ya existe el esquema «public»`) es esperable e inofensivo:
toda base nueva de Postgres ya trae el schema `public` creado, y el dump
intenta recrearlo — `pg_restore` lo ignora y sigue. No afecta ninguna tabla ni
dato.

### 4.4 Conteo de filas en el RESTORE (base local)

```
            tabla             | filas
------------------------------+-------
 _prisma_migrations           |    46
 activity_logs                |     0
 appointments                 |     0
 auto_promotion_sends         |     0
 auto_promotions              |     0
 business_holidays            |     0
 business_schedule_days       |     7
 business_settings            |     1
 client_gallery_photos        |     0
 client_notifications         |     0
 clients                      |     0
 conversaciones_whatsapp      |     0
 inventory_movements          |     0
 invitations                  |     0
 mensajes_whatsapp_procesados |     0
 orders                       |     0
 password_resets              |     0
 payment_settings             |     1
 product_orders               |     0
 products                     |     0
 professional_availability    |     0
 professional_notifications   |     0
 professional_services        |     0
 professionals                |     0
 promotions                   |     0
 reviews                      |     0
 services                     |     0
 special_events               |     0
 users                        |     1
(29 filas)
```

**Diff entre origen y restore: sin diferencias — 29/29 tablas con el mismo
conteo de filas.**

### 4.5 Verificación de contenido (no solo cantidad)

```
$ psql -h localhost -U kologic -d nexa_restore_test -c "SELECT email, name, role FROM users;"

              email              |           name           | role
---------------------------------+--------------------------+-------
 lorenestudiodebelleza@gmail.com | Loren Estudio de Belleza | admin
(1 fila)
```

La fila del usuario admin se restauró con su email, nombre y rol intactos —
confirma que no solo coincide la CANTIDAD de filas, sino el CONTENIDO real.

### 4.6 Resultado

✅ **Restore exitoso.** 29/29 tablas restauradas, conteos de filas idénticos al
origen, contenido verificado en la tabla crítica (`users`). Tiempo total del
simulacro: menor a 2 minutos (dump + restore), sobre una base todavía chica
(recién lanzada) — el tiempo escala con el volumen de datos, así que conviene
repetir esta prueba periódicamente a medida que crezca la base real.

La base de prueba local (`nexa_restore_test`) se eliminó al terminar el
simulacro — cumplió su función de verificación, no se necesita conservarla.

## 5. Estrategia de salida (Exit Strategy) — portabilidad de Supabase

Nexa usa Supabase únicamente como hosting de PostgreSQL — la aplicación se
conecta con una connection string estándar vía Prisma, **sin usar** las
capas propias de Supabase (Auth, Storage, Edge Functions, PostgREST). Esto es
deliberado: evita vendor lock-in real. La autenticación es JWT propia
(`src/modules/auth`), y las imágenes se sirven vía Supabase Storage con el
SDK estándar de storage (compatible con S3), no con nada exclusivo del
proveedor.

**Qué SÍ depende de Supabase específicamente:**
- El trigger automático `rls_auto_enable()` que activa Row Level Security en
  tablas nuevas (una conveniencia de Supabase, no algo que el código necesite).
- Nada más — ni el esquema, ni las queries, ni la lógica de negocio usan
  sintaxis o extensiones propietarias de Supabase.

**Procedimiento de migración a otro proveedor de PostgreSQL (o self-hosted):**

1. `pg_dump --schema=public` de la base actual (ver sección 2).
2. Levantar Postgres en el destino (otro managed Postgres — Neon, Render
   Postgres, RDS — o un contenedor propio).
3. `pg_restore` del dump ahí (ver sección 3) — ya probado y documentado en la
   sección 4.
4. Cambiar `DATABASE_URL` en Render al nuevo destino.
5. Redesplegar el backend.

**Downtime estimado:** el corte real es solo el tiempo entre "último dump
consistente" y "`DATABASE_URL` apuntando al nuevo destino" — con el volumen
de datos actual, bajo 10 minutos siguiendo los pasos de arriba. Escala con el
tamaño de la base a futuro. No hace falta tocar código de la aplicación en
ningún punto de esta migración — es exactamente lo que demuestra el simulacro
de la sección 4.
