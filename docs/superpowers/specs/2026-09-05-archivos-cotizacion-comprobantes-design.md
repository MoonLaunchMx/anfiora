# Archivos de cotización y comprobantes de pago — diseño

**Fecha:** 5-sep-2026
**Estado:** diseño aprobado. Dos decisiones de producto cerradas por Diego (el comprobante cuelga del pago; la cotización más reciente manda) y cuatro decisiones de durabilidad tomadas como CTO tras el encargo explícito de *"son datos muy delicados y no podemos perderlos"*.
**Mockup:** https://claude.ai/code/artifact/f9a4eb58-59d9-4f89-8fd1-8598b8245b04
**Cierra:** el §10 del spec `2026-09-01-rolodex-proveedores-design.md` (bucket privado) · el pendiente 2 de la nota `fichero-rolodex-vista` · el pendiente de comprobantes de pago de `notas-2026-09-01-seis-features`

---

## 1. Por qué

Un proveedor manda **tres cotizaciones antes de cerrar** — la primera, la que quitó el arco, la final — y recibe **cuatro pagos**, cada uno con su transferencia. Hoy los ocho papeles viven en el WhatsApp del planner. Cuando el papá de la novia pregunta *"¿ya le pagamos el anticipo a las flores?"*, la respuesta está en un chat de agosto.

La ficha del proveedor ya guarda todo lo demás de ese trato: los tres montos, la partida del presupuesto, el estatus, los pagos, la reseña. Le falta el papel.

**Lo que no se puede hacer:** reusar el bucket `event-media`. Existe y funciona (`SectionForm.tsx`, `DressCodeEditor.tsx`), pero sirve las URL con `getPublicUrl`: **público, sin sesión, para siempre**. Correcto para la foto de una boda; inaceptable para un contrato con precios y los datos del cliente.

---

## 2. Las dos decisiones de producto

### 2.1 El comprobante cuelga del pago, no del proveedor

Una bolsa común de comprobantes por proveedor es más fácil de llenar y **inútil a los seis pagos**: nadie sabe qué papel corresponde a qué transferencia. Pegado al renglón del pago, la correspondencia es un hecho de la estructura, no algo que haya que recordar.

Consecuencia útil: la pantalla `/events/[id]/pagos` podrá mostrar el comprobante el día que se quiera, sin migrar nada. **No se construye aquí.**

### 2.2 La más reciente manda, sin marcar cuál es la buena

Las cotizaciones se listan por fecha, la de arriba lleva el distintivo **Vigente**, y ya. El §10 del spec del Rolodex pedía un `quote_file_path` con "la cotización aceptada"; se descarta: es un flag más que mantener y una decisión más al subir, a cambio de un caso raro (aceptar una cotización que no es la última).

---

## 3. Las cuatro decisiones de durabilidad

Estas cuatro no son preferencias de UI. Cada una tapa una forma concreta de perder un papel.

### 3.1 Agregar ocurre en Postgres, no en el navegador

Leer el arreglo JSONB en el cliente, agregarle un elemento y reescribirlo completo es un **lost update de manual**: si dos personas suben un archivo al mismo proveedor con segundos de diferencia, la segunda escritura pisa a la primera y esa subida **desaparece sin ruido**. Ni error, ni aviso.

La corrección es que el agregar sea atómico dentro de la base:

```sql
update event_suppliers
   set quote_files = coalesce(quote_files, '[]'::jsonb) || $2::jsonb
 where id = $1
```

Se expone como dos funciones RPC — `adjuntar_archivo` y `quitar_archivo` — en **`SECURITY INVOKER`**, para que las políticas de RLS de la tabla sigan aplicando exactamente igual que hoy. La función no es una puerta trasera: es la misma puerta, cerrada con llave atómica.

### 3.2 El objeto nunca se borra del bucket

Quitar un archivo **marca el elemento del JSONB con `borrado`** y lo saca de la vista. El objeto se queda donde está.

El plan gratis de Supabase **no tiene recuperación a un punto en el tiempo**: lo que se borra, se fue. Un PDF de contrato pesa cientos de kilobytes y el tope del plan es 1 GB; el intercambio —unos KB de sobra a cambio de que un clic mal dado no destruya un contrato— no admite discusión. Recuperar un archivo quitado es un `UPDATE` de un minuto, no un ticket de soporte.

Corolario: la compensación cuando la escritura del JSONB falla después de una subida exitosa **tampoco borra**. El archivo queda huérfano en el bucket: invisible, sin costo real y recuperable.

### 3.3 Cero filas es un error, no un éxito

Un `UPDATE` que la política de RLS rechaza devuelve **cero filas y ningún error**. Ese fallo mudo ya costó el editor de la invitación (`bug-invitacion-editor-no-guardaba`) y el cambio de plan en `/admin` (`bug-admin-changeplan-no-persiste`).

Toda escritura de este feature termina en `.select()` y **cuenta las filas**; cero filas se convierte en un mensaje visible: *"No se guardó el archivo. Revisa que sigas teniendo permiso en esta boda."*

### 3.4 El enlace se firma al momento del clic

Se guarda **la ruta, nunca la URL**. La URL firmada se genera al clic con vida de **10 minutos**, se abre en pestaña nueva y no se persiste en ninguna parte. Nada de este bucket es alcanzable sin sesión.

---

## 4. Datos

### 4.1 El bucket

**`event-docs`**, privado, nuevo. Convive con `event-media`, que se queda intacto para las fotos de la invitación.

**La ruta es la que decide el permiso.** Dos segmentos con significado:

```
{event_id}/cotizaciones/{event_supplier_id}/{uuid}.pdf
{event_id}/comprobantes/{payment_id}/{uuid}.jpg
```

- El primer segmento es el evento — es lo que la política le pasa a `puede_ver`.
- El segundo segmento es el módulo: `cotizaciones` → `proveedores`, `comprobantes` → `pagos`.
- El nombre del archivo es un **uuid**, nunca el que teclea el usuario: sin traversal, sin acentos rotos, sin datos del cliente escritos en la ruta. El nombre original vive en el JSONB, que es donde se muestra.

Esto compra gratis algo que sí importa: **quien tiene Proveedores pero no Pagos ve las cotizaciones y no ve un solo comprobante de dinero.** Son módulos separados desde el Tramo 2 del epic de accesos y los archivos lo heredan sin una línea de código extra.

### 4.2 Las columnas

Sin tablas nuevas (ya hay demasiadas).

| Tabla | Columna | Guarda |
|---|---|---|
| `event_suppliers` | `quote_files JSONB DEFAULT '[]'` | las cotizaciones de ese proveedor en esa boda |
| `supplier_payments` | `receipt_files JSONB DEFAULT '[]'` | los comprobantes de ese pago |

Un solo tipo para los dos casos, en `lib/types.ts`:

```ts
export type ArchivoAdjunto = {
  path: string      // ruta dentro del bucket event-docs
  nombre: string    // el nombre original, para mostrar
  tipo: string      // MIME
  bytes: number
  subido: string    // ISO
  por: string | null    // quién lo subió (user id)
  borrado: string | null // ISO cuando se quitó de la vista; null = visible
}
```

`por` es barato hoy e imposible de rellenar después — el mismo criterio que hizo que las reseñas nazcan firmadas (§2 del spec del Rolodex).

### 4.3 Las políticas del bucket

Cuatro políticas sobre `storage.objects`, apoyadas en las funciones que **ya existen en producción** desde el cimiento del Tramo 2 (`2026-09-04-accesos-cimiento.sql`): `public.puede_ver(evento uuid, modulo text)`, `puede_editar`, `puede_borrar`, todas `SECURITY DEFINER` y otorgadas a `authenticated`.

```sql
-- leer / firmar
using (
  bucket_id = 'event-docs'
  and (storage.foldername(name))[2] in ('cotizaciones', 'comprobantes')
  and public.puede_ver(
    (storage.foldername(name))[1]::uuid,
    case (storage.foldername(name))[2]
      when 'cotizaciones' then 'proveedores'
      else 'pagos'
    end
  )
)
```

La lista explícita del segundo segmento **no es decorativa**: sin ella, un `else` que cae siempre en `'pagos'` convertiría cualquier ruta mal formada en una consulta de permiso válida. Una ruta que no es una de las dos formas conocidas no pasa, punto.

`INSERT` pide `puede_editar` con el mismo `case`. **No se crea política de `DELETE`**: nadie borra objetos de este bucket, ni la UI ni por accidente (§3.2).

Los módulos `proveedores` y `pagos` son valores reales de `MODULOS` en `lib/permisos/catalogo.ts` — la cadena que va en el `case` tiene que coincidir con esas llaves exactas, porque es lo que `nivel_en` busca en el JSON de permisos.

El seam queda donde debe: el día que cambie quién puede ver Finanzas, se cambia `nivel_en` y **los archivos se mueven solos**. No hay una segunda regla que se pueda desincronizar de la primera.

### 4.4 Los topes

| Qué | Cuánto | Por qué |
|---|---|---|
| Tamaño por archivo | 10 MB | Una foto de comprobante desde el teléfono pesa 4 MB y el free tier son 1 GB |
| Cotizaciones por proveedor | 10 | Más que eso no es historial, es un basurero |
| Comprobantes por pago | 5 | Transferencia + recibo firmado + los reintentos |
| Tipos | `application/pdf`, `image/jpeg`, `image/png`, **`image/heic`, `image/heif`** | El iPhone entrega HEIC desde la galería. Sin él, la primera foto que sube una novia rebota |

El tope se valida **en el cliente antes de subir** (para dar un mensaje útil) y **en el bucket** (`file_size_limit` y `allowed_mime_types`), porque un tope que solo vive en el navegador no es un tope.

**Trampa del HEIC:** el navegador a veces entrega `file.type` vacío para un HEIC, y con `allowed_mime_types` estricto un `contentType` vacío rebota. La subida manda el `contentType` **explícito**, deducido de la extensión cuando `file.type` viene en blanco. Es la diferencia entre "funciona en mi Android" y "funciona".

---

## 5. La pantalla

Vive en `FichaDelEvento.tsx`, que ya tiene las dos carpetas.

### 5.1 Carpeta Cotización

Debajo de "Los tres montos" y "Partida del presupuesto", un bloque **Cotizaciones guardadas · N**:

- Lista por fecha descendente. La primera lleva el distintivo **Vigente**.
- Cada renglón: glifo por tipo (PDF / imagen), nombre original, `fecha · peso · la subió Fulano`, y dos herramientas — **abrir** (firma y abre en pestaña nueva) y **quitar**.
- Vacío: zona punteada con *"Sube la cotización — PDF o foto de lo que te mandó."*
- Subiendo: el renglón aparece con barra de avance y botón de cancelar.
- Error: el aviso trae **el nombre del archivo, su peso real y la salida** — *"Contrato-escaneado.pdf pesa 24 MB. El tope son 10 MB. Vuelve a escanearlo en calidad media."* Nunca "archivo inválido".

### 5.2 Carpeta Pagos

Cada renglón de pago gana un **clip** entre la descripción y el monto:

- Con comprobantes: clip sólido con el número. Al tocarlo despliega la tira de archivos debajo del pago, con la misma lista del §5.1 y un *"Agregar otro comprobante"*.
- Sin comprobantes: clip **punteado** que dice *"Sin comprobante"*. Es la lectura de un vistazo de qué pago no tiene respaldo, que es justo lo que se pregunta cuando alguien audita.

### 5.3 Registrar un pago, en un solo golpe

`PagoModal.tsx` gana un campo **Comprobante (opcional)** al final.

El identificador del pago se genera en el cliente con `crypto.randomUUID()` y se **inserta explícito**, en vez de dejar que Postgres lo invente. Así el archivo ya sabe a qué pago pertenece desde el primer byte y no hay un *"guarda primero y luego súbele el papel"*.

Se queda **opcional**: exigirlo frenaría el registro rápido de un pago en efectivo, que es la mitad de las bodas.

### 5.4 Teléfono

Sin menús colgantes, como el resto de la ficha: **hoja desde abajo** con tres puertas, porque son tres gestos distintos y no un selector genérico de archivo.

| Puerta | Para |
|---|---|
| Tomar foto | El recibo que le acaban de dar en la mano |
| Elegir de la galería | La captura que llegó por WhatsApp |
| Buscar un archivo | El PDF que llegó por correo |

Blancos de 36px, igual que la barra del pie de la ficha.

### 5.5 Permisos

| Superficie | Módulo | `ver` | `editar` | `borrar` |
|---|---|---|---|---|
| Cotizaciones | `proveedores` | abre | sube | quita |
| Comprobantes | `pagos` | abre | sube | quita |

Dos reglas heredadas del Fichero, no negociables:

1. **El corte va dentro de la función que escribe**, no solo en el JSX. Esconder el botón no protege nada.
2. **Con nivel `ver` la carpeta abre igual**, solo sin botones de subir ni quitar. No se esconde el panel.

### 5.6 Borrar un pago que tiene comprobantes

La confirmación lo dice antes: *"Este pago tiene 2 comprobantes. Se quedan guardados, pero sin este pago ya no habrá dónde verlos."* Los objetos siguen en el bucket (§3.2); lo que se pierde es el renglón que los mostraba.

---

## 6. Cómo se parte el código

| Archivo | Qué | Cómo se verifica |
|---|---|---|
| `lib/archivos/adjuntos.ts` | Lógica pura: validar tipo y tamaño, construir la ruta, agregar/quitar del arreglo, formatear peso, elegir glifo, redactar el mensaje de error | **Vitest** |
| `lib/archivos/bucket.ts` | El I/O: subir, firmar, y las dos llamadas RPC | Manual, local → preview → main |
| `app/.../proveedores/ListaDeArchivos.tsx` | El bloque de lista + zona de subida + estados. Un solo componente para los dos casos | Manual |
| `FichaDelEvento.tsx` | Monta el bloque en las dos carpetas | Manual |
| `PagoModal.tsx` | El campo Comprobante y el id explícito | Manual |
| `lib/types.ts` | `ArchivoAdjunto` y las dos columnas nuevas | `tsc` |

`FichaDelEvento.tsx` ya tiene 978 líneas. El bloque de archivos **no se escribe adentro**: sale como componente propio desde el primer día, que es lo que permite usarlo en las dos carpetas sin duplicarlo.

---

## 7. Fuera de alcance, nombrado

- **El comprobante en `/events/[id]/pagos`.** Los datos ya lo permiten; es otra pantalla y otro chat.
- **El expediente a nivel cuenta** (`/rolodex/[id]`). El Rolodex general **no existe todavía**: lo único construido es el Fichero de cada evento. Este feature vive entero dentro de una boda.
- **La bitácora.** Proveedores y pagos no tienen ninguna acción en `lib/audit.ts` hoy — ni una. Los archivos no van a ser los que estrenen la auditoría de Finanzas; eso es una tanda propia y completa.
- **Miniaturas de las imágenes.** Obligarían a firmar en lote al pintar la carpeta. Renglón con glifo en la v1.

### Lo que sí entra, aunque no lo pedía el encargo original

**Quitar `external_files_url` y `has_pro_files` de `event_suppliers`.** Eran la primera idea de "archivos del proveedor", del commit `666a9d1` (5-may-2026) que creó el módulo. Nacieron muertas: verificado el 5-sep en las 24 ramas locales y remotas, aparecen solo en la declaración de tipo y en el bloque de esquema de `CLAUDE.md` — cero `select`, cero `insert`, cero render.

Las reemplaza `quote_files`, y por buenas razones: un `TEXT` suelto no puede guardar **varias** cotizaciones con su fecha y su dueño, y "tiene archivos PRO" es un dato derivado que se calcula contando la lista. Dejarlas sería dejar dos formas de decir lo mismo, una de ellas mentira.

SQL en `docs/superpowers/plans/sql/2026-09-05-limpiar-columnas-muertas.sql`, en dos pasos: **primero una consulta de solo lectura** que busca vistas, índices, restricciones, políticas y funciones que dependan de ellas, y el `DROP` solo si eso sale vacío. Sin `CASCADE`, para que un olvido haga fallar el `ALTER` en vez de arrastrar algo.

---

## 8. Riesgo asumido, por escrito

El free tier de Supabase da **1 GB de almacenamiento y no tiene point-in-time recovery**. Este feature es el primero que mete documentos que el planner no puede volver a conseguir de otro lado.

Las mitigaciones están en el §3, y una más: si el almacenamiento se acerca al tope, lo primero que se debe hacer **no es borrar nada de `event-docs`** — es revisar `event-media`, que guarda fotos de invitación de 15 MB y sí son reemplazables. Queda escrito aquí para que quien lo lea con prisa en seis meses no empiece por el lado equivocado.
