import {
  CURRENT_SUPPORTED_DRAFT,
  ClientSetupEncoder,
  ControlMessageType,
  ParameterEncoder,
} from "./wire/control_messages";
import type { ControlMessage, MessageEncoder } from "./wire/control_messages";

export class ControlStream {
  readerPassedMsgs: ReadableStream<ControlMessage>;
  writer: WritableStream<MessageEncoder>;
  onmessage?: (m: ControlMessage) => {};

  constructor(r: ReadableStream<ControlMessage>, w: WritableStream<MessageEncoder>) {
    this.readerPassedMsgs = r;
    this.writer = w;
  }

  async handshake() {
    // send ClientSetup
    const writer = this.writer.getWriter();
    await writer.write(
      new ClientSetupEncoder({
        type: ControlMessageType.ClientSetup,
        versions: [CURRENT_SUPPORTED_DRAFT],
        parameters: [
          new ParameterEncoder({ type: 0, value: new Uint8Array([0x2]) }),
          new ParameterEncoder({ type: 2, value: new Uint8Array([0xa]) }),
        ],
      }),
    );
    writer.releaseLock();

    // receive ServerSetup
    const readerPassedMsgs = this.readerPassedMsgs.getReader();
    const { value, done } = await readerPassedMsgs.read();
    if (done) {
      throw new Error("control stream closed");
    }
    if (value.type != ControlMessageType.ServerSetup) {
      throw new Error("invalid first message on control stream");
    }
    // TODO: Evaluate server setup message?
    readerPassedMsgs.releaseLock();
  }

  async runReadLoop() {
    const reader = this.readerPassedMsgs.getReader();
    for (; ;) {
      const { value, done } = await reader.read();
      if (done) {
        console.log("control stream closed");
        break;
      }
      if (this.onmessage) {
        this.onmessage(value);
      }
    }
  }

  async send(m: MessageEncoder) {
    const writer = this.writer.getWriter();
    await writer.write(m);
    writer.releaseLock();
  }
}
