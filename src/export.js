// Eksport siatki do binarnego STL i do 3MF (ZIP bez kompresji).

export function toSTL(positions, name = 'opaska') {
  const triCount = positions.length / 9;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const header = `Generator Opasek - ${name}`.slice(0, 80);
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i) & 0x7f);
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (let t = 0; t < triCount; t++) {
    const b = t * 9;
    const ax = positions[b], ay = positions[b + 1], az = positions[b + 2];
    const ux = positions[b + 3] - ax, uy = positions[b + 4] - ay, uz = positions[b + 5] - az;
    const vx = positions[b + 6] - ax, vy = positions[b + 7] - ay, vz = positions[b + 8] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / len, true); dv.setFloat32(o + 4, ny / len, true); dv.setFloat32(o + 8, nz / len, true);
    o += 12;
    for (let k = 0; k < 9; k++) { dv.setFloat32(o, positions[b + k], true); o += 4; }
    dv.setUint16(o, 0, true); o += 2;
  }
  return new Blob([buf], { type: 'model/stl' });
}

export function to3MF(vertProperties, numProp, triVerts, name = 'opaska') {
  const nVert = vertProperties.length / numProp;
  const parts = [];
  for (let i = 0; i < nVert; i++) {
    const b = i * numProp;
    parts.push(`<vertex x="${+vertProperties[b].toFixed(4)}" y="${+vertProperties[b + 1].toFixed(4)}" z="${+vertProperties[b + 2].toFixed(4)}"/>`);
  }
  const tris = [];
  for (let i = 0; i < triVerts.length; i += 3) {
    tris.push(`<triangle v1="${triVerts[i]}" v2="${triVerts[i + 1]}" v3="${triVerts[i + 2]}"/>`);
  }
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="pl-PL" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${name}</metadata>
<metadata name="Application">Generator Opasek</metadata>
<resources><object id="1" type="model" name="${name}"><mesh>
<vertices>${parts.join('')}</vertices>
<triangles>${tris.join('')}</triangles>
</mesh></object></resources>
<build><item objectid="1"/></build>
</model>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;
  return zipStore([
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rels],
    ['3D/3dmodel.model', model],
  ]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Minimalny ZIP (metoda "store"), wystarczający dla 3MF.
function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameB = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, nameB.length, true);
    chunks.push(lh.buffer, nameB, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
    central.push(ch.buffer, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end.buffer], { type: 'model/3mf' });
}
