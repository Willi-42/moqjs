import { appendUInt16, appendUint8Arr, appendVarint } from "./varint";
import type { varint } from "./varint";
import type { MessageEncoder } from "./control_messages";

export class Encoder {
  writer: WritableStream<Uint8Array>;

  constructor(stream: WritableStream<Uint8Array>) {
    this.writer = stream;
  }

  async write(
    chunk: MessageEncoder,
    _: WritableStreamDefaultController,
  ): Promise<void> {
    await chunk.encode(this);
  }

  async writeBytes(data: Uint8Array): Promise<void> {
    const writer = this.writer.getWriter();
    await writer.write(data);
    writer.releaseLock();
  }
}

export function addHeader(type: varint, bufPayload: Uint8Array): Uint8Array {
  var bufHeader = new Uint8Array();
  bufHeader = appendVarint(type, bufHeader);

  const totalLen = bufPayload.byteLength;
  bufHeader = appendUInt16(totalLen, bufHeader);

  // compose it
  return appendUint8Arr(bufHeader, bufPayload)
}