# Bright Star Catalogue, 5.ª edición revisada

Datos crudos para la fase 6 de la ronda 7 (`cielo`). **No se sirven al juego tal
cual**: la fase hornea de acá una tabla chica con lo que el cielo necesita.

| | |
|---|---|
| Catálogo | *The Bright Star Catalogue, 5th Revised Ed. (Preliminary Version)* |
| Autores | Hoffleit D., Warren Jr W.H. — Astronomical Data Center, NSSDC/ADC, 1991 |
| Origen | CDS Estrasburgo, catálogo **V/50** — `https://cdsarc.cds.unistra.fr/ftp/V/50/` |
| Archivos | `catalog.gz` (573 921 bytes; 1 704 879 descomprimido; 9110 renglones) y `ReadMe` (el formato de columnas) |
| Descargado | 12/9/2026, con permiso del dueño |

**Uso y cita.** Es una compilación del Astronomical Data Center de la NASA,
distribuida libremente por el CDS para uso científico y educativo, con el pedido
de citar la fuente. Se cita así, en el código que la use y en el códice:

> Hoffleit, D. & Warren Jr., W. H. (1991), *The Bright Star Catalogue, 5th Revised
> Ed.*, NASA ADC; vía CDS, catálogo V/50.

**Lo que hay que saber antes de usarlo** (del `ReadMe`):

- Son 9110 objetos, **de los cuales 9096 son estrellas**. Los otros 14 son novas u
  objetos extragalácticos que se conservaron para no romper la numeración, y casi
  no tienen datos: hay que descartarlos.
- Llega hasta magnitud 6,5, que es lo que ve el ojo desnudo en un cielo muy oscuro.
- Las posiciones de interés están en J2000.0. La precesión desde el 2000 a la fecha
  del juego es de unos 0,4°, del orden del tamaño de la luna: hay que decidir con un
  número si se aplica.
- **Las designaciones de Bayer y Flamsteed sí están**, en la columna `Name` (bytes
  5 a 14): «Alp1Cru», «Bet Cen», «58Alp Ori». Lo que **no** está son los nombres
  propios —Acrux, Hadar, Rigil Kentaurus—, que viven en el archivo de
  observaciones, no bajado. *Corregido el mismo día: la primera versión de este
  archivo decía que no había ningún nombre, y no se había leído la columna.*
- Verificado contra el catálogo el 12/9/2026, parseando con las columnas del
  `ReadMe`: Acrux α¹ Cru HR 4730 (AR 186,650° · Dec −63,099° · V 1,33), α² HR 4731,
  Mimosa β Cru HR 4853 (V 1,25), Gacrux γ Cru HR 4763 (V 1,63), δ Cru HR 4656, ε Cru
  HR 4700; los punteros α¹ Cen HR 5459 (V −0,01) y β Cen HR 5267 (V 0,61); Sirio
  V −1,46 y Canopo V −0,72.
