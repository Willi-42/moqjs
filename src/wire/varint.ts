export const MAX_VAR_INT_1 = 63;
export const MAX_VAR_INT_2 = 16383;
export const MAX_VAR_INT_4 = 1073741823;
export const MAX_VAR_INT_8: bigint = 4611686018427387903n;

export type varint = number | bigint;

function encodeVarint(chunk: varint): Uint8Array {
  if (chunk <= MAX_VAR_INT_1) {
    const data = new Uint8Array(1);
    const view = new DataView(data.buffer);
    view.setUint8(0, <number>chunk);
    return data;
  } else if (chunk <= MAX_VAR_INT_2) {
    const data = new Uint8Array(2);
    const view = new DataView(data.buffer);
    view.setUint16(0, (<number>chunk) | 0x4000);
    return data;
  } else if (chunk <= MAX_VAR_INT_4) {
    const data = new Uint8Array(4);
    const view = new DataView(data.buffer);
    view.setUint32(0, (<number>chunk) | 0x80000000);
    return data;
  } else if (chunk <= MAX_VAR_INT_8) {
    const data = new Uint8Array(8);
    const view = new DataView(data.buffer);
    view.setBigUint64(0, BigInt(chunk) | 0xc000000000000000n, false);
    return data;
  }
  throw new Error("value too large for varint encoding");
}

export function appendVarint(chunk: varint, buf: Uint8Array): Uint8Array {
  const encVarint = encodeVarint(chunk)

  return appendUint8Arr(buf, encVarint);
}

// TODO: move function to different file
function encodeUInt16(chunk: number): Uint8Array {
  if (chunk <= MAX_VAR_INT_2) {
    const data = new Uint8Array(2);
    const view = new DataView(data.buffer);
    view.setUint16(0, chunk);
    return data;
  }
  throw new Error("value too large for varint encoding");
}

export function appendUInt16(chunk: number, buf: Uint8Array): Uint8Array {
  const encUint = encodeUInt16(chunk)

  return appendUint8Arr(buf, encUint);
}

export function appendUint8Arr(arrayOne: Uint8Array, arrayTwo: Uint8Array): Uint8Array {
  var mergedArray = new Uint8Array(arrayOne.length + arrayTwo.length);
  mergedArray.set(arrayOne);
  mergedArray.set(arrayTwo, arrayOne.length);

  return mergedArray
}

export function appendString(s: string, buf: Uint8Array): Uint8Array {
  const data = new TextEncoder().encode(s);
  buf = appendVarint(data.byteLength, buf);
  buf = appendUint8Arr(buf, data); // append sting bytes directly

  return buf
}

export function appendTupleString(s: string, buf: Uint8Array): Uint8Array {
  const data = new TextEncoder().encode(s);

  buf = appendVarint(1, buf);
  buf = appendVarint(data.byteLength, buf);
  buf = appendUint8Arr(buf, data); // append sting bytes directly

  return buf
}

export function appendNumber(n: number, buf: Uint8Array): Uint8Array {
  return appendUint8Arr(buf, new Uint8Array([n]));
}

export function appendBytes(bytes: Uint8Array, buf: Uint8Array): Uint8Array {
  return appendUint8Arr(buf, bytes);
}
