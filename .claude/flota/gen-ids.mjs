// La lista de los 115 ids, para que el falsador sepa cual es "desconocido".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECURSOS } from '../../src/systems/Recursos.js';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const H = JSON.parse(fs.readFileSync(path.resolve(AQUI, '..', '..', 'src', 'data', 'herramientas.json'), 'utf8'));
const cosas = (H.objetos || []).filter(o => !(o.esReceta || o.produce)).map(o => o.id);
const ids = [...Object.keys(RECURSOS), ...cosas];
fs.writeFileSync(path.join(AQUI, 'r6-ids.json'), JSON.stringify(ids, null, 0) + '\n');
console.log('escritos', ids.length, 'ids en r6-ids.json');
