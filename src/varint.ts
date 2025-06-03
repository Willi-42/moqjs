export const MAX_VAR_INT_1 = 63;
export const MAX_VAR_INT_2 = 16383;
export const MAX_VAR_INT_4 = 1073741823;
export const MAX_VAR_INT_8: bigint = 4611686018427387903n;

export type varint = number | bigint;

export function encodeVarint(chunk: varint): Uint8Array {
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

// TODO: move function to different file
export function encodeUInt16(chunk: number): Uint8Array {
 if (chunk <= MAX_VAR_INT_2) {
    const data = new Uint8Array(2);
    const view = new DataView(data.buffer);
    view.setUint16(0, chunk);
    return data;
  }
  throw new Error("value too large for varint encoding");
}

export function encodedVarintLength(chunk: varint): number {
  if (chunk <= MAX_VAR_INT_1) {
    return 1;
  } else if (chunk <= MAX_VAR_INT_2) {
    return 2;
  } else if (chunk <= MAX_VAR_INT_4) {
    return 4;
  } else if (chunk <= MAX_VAR_INT_8) {
    return 8;
  }
  throw new Error("value too large for varint encoding");
}

export function encdoedVarintArrayLength(arr: varint[]): number {
  let total_len: number = 0;
  for (const v of arr) {
    total_len += encodedVarintLength(v);
  }

  return total_len;
}

