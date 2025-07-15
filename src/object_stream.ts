import {
  CURRENT_SUPPORTED_DRAFT,
  ClientSetupEncoder,
  ControlMessageType,
  ParameterEncoder,
} from "./wire/control_messages";
import type { ControlMessage, MessageEncoder } from "./wire/control_messages";

export class ObjectStream {
  readerPassedMsgs: ReadableStream<ControlMessage>;
  writer: WritableStream<MessageEncoder>;
  onmessage?: (m: ControlMessage) => {};

  constructor(r: ReadableStream<ControlMessage>, w: WritableStream<MessageEncoder>) {
    this.readerPassedMsgs = r;
    this.writer = w;
  }

}
