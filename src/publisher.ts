import { Encoder } from "./wire/encoder";
import {
  ObjectStreamEncoder,
  type ObjectMsgWithHeader,
} from "./wire/object_messages";
import type { varint } from "./wire/varint";

// Publisher -> one Publisher for exactly one track
export class Publisher {
  newWebTranStream: () => Promise<WritableStream<any>>;

  constructor(createNewWebTStream: () => Promise<WritableStream<any>>) {
    this.newWebTranStream = createNewWebTStream;
  }

  async write(chunk: ObjectMsgWithHeader) {
    const newStream = await this.newWebTranStream();

    const encoder = new ObjectStreamEncoder(chunk.msg);

    await encoder.encode(new Encoder(newStream));

    newStream.close();
  }
}
