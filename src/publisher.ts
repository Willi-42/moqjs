import { Encoder } from "./wire/encoder";
import {
  ObjectStreamEncoder,
  type ObjectMsg,
  type ObjectMsgWithHeader,
} from "./wire/object_messages";
import type { varint } from "./wire/varint";

// Publisher -> one Publisher for exactly one track

export class Publisher {
  private newWebTranStream: () => Promise<WritableStream<any>>;
  private trackAlias: varint = 0;
  private trackAliasSet: boolean = false;

  constructor(createNewWebTStream: () => Promise<WritableStream<any>>) {
    this.newWebTranStream = createNewWebTStream;
  }

  // setTrackAlias sets the track alias for this publisher.
  // Must be set before creating a new subgroup.
  setTrackAlias(alias: varint) {
    this.trackAlias = alias;
    this.trackAliasSet = true;
  }

  async NewSubgroup(
    groupId: varint,
    subgroupID: varint,
    priority: number
  ): Promise<SubGroup> {
    if (!this.trackAliasSet) {
      throw Error("Track alias not set for publisher");
    }

    const newStream = await this.newWebTranStream();

    return SubGroup.NewSubGroup(
      newStream,
      groupId,
      subgroupID,
      priority,
      this.trackAlias
    );
  }
}

export class SubGroup {
  stream: WritableStream;
  encoder: ObjectStreamEncoder;
  streamClosed: boolean;

  private constructor(stream: WritableStream, encoder: ObjectStreamEncoder) {
    this.stream = stream;
    this.encoder = encoder;
    this.streamClosed = false;
  }
  static async NewSubGroup(
    stream: WritableStream,
    groupId: varint,
    subgroupID: varint,
    priority: number,
    trackAlias: varint
  ): Promise<SubGroup> {
    const encoder = new ObjectStreamEncoder(
      groupId,
      subgroupID,
      priority,
      new Encoder(stream),
      trackAlias
    );
    const newSubgroup = new SubGroup(stream, encoder);

    return newSubgroup;
  }

  async write(chunk: ObjectMsg) {
    if (this.streamClosed) {
      throw Error("Stream closed");
    }

    return this.encoder.encode(chunk);
  }

  async close() {
    await this.stream.close();
    this.streamClosed = true;
  }
}
