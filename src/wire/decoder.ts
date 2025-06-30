import { FilterType, ControlMessageType } from "./control_messages";

import type {
  Subscribe,
  SubscribeOk,
  SubscribeError,
  Announce,
  AnnounceOk,
  AnnounceError,
  Unannounce,
  Unsubscribe,
  GoAway,
  ServerSetup,
  SubscribeDone,
  Parameter,
  SubscribeUpdate,
  RequestsBlocked,
} from "./control_messages";
import {
  StreamHeaderType,
  type ObjectMessage,
  type ObjectMsgWithHeader,
} from "./object_messages";

type varint = number | bigint;

enum EncoderState {
  Init,
  Ready,
}

class Decoder {
  reader: ReadableStream<Uint8Array>;
  buffer: Uint8Array;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.reader = stream;
    this.buffer = new Uint8Array(8);
  }

  async read(
    buffer: Uint8Array,
    offset: number,
    length: number
  ): Promise<Uint8Array> {
    const reader = this.reader.getReader({ mode: "byob" });
    while (offset < length) {
      const buf = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset + offset,
        length - offset
      );
      const { value, done } = await reader.read(buf);
      if (done) {
        throw new Error("stream closed (decoder)");
      }
      buffer = new Uint8Array(
        value.buffer,
        value.byteOffset - offset,
        length - offset
      );
      offset += value.byteLength;
    }
    reader.releaseLock();
    return buffer;
  }

  async readN(n: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(n);
    const data = await this.read(buffer, 0, n);
    return data;
  }

  async readAll(): Promise<Uint8Array> {
    const reader = this.reader.getReader();
    let buffer = new Uint8Array();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      const next = new Uint8Array(buffer.byteLength + value.byteLength);
      next.set(buffer);
      next.set(value, buffer.byteLength);
      buffer = next;
    }
    reader.releaseLock();
    return buffer;
  }

  async readUint16(): Promise<number> {
    this.buffer = await this.read(this.buffer, 0, 2);
    if (this.buffer.length !== 2) {
      throw new Error("readUint16 failed");
    }

    // TODO: actually use parse field
    return 42;
  }

  async readVarint(): Promise<varint> {
    this.buffer = await this.read(this.buffer, 0, 1);
    if (this.buffer.length !== 1) {
      var errStr =
        "readVarint could not read first byte. Len: " + this.buffer.length;
      throw new Error(errStr);
    }
    const prefix = this.buffer[0]! >> 6;
    const length = 1 << prefix;
    let view = new DataView(this.buffer.buffer, 0, length);
    switch (length) {
      case 1:
        return view.getUint8(0) & 0x3f;
      case 2:
        this.buffer = await this.read(this.buffer, 1, 2);
        view = new DataView(this.buffer.buffer, 0, length);
        return view.getUint16(0) & 0x3fff;
      case 4:
        this.buffer = await this.read(this.buffer, 1, 4);
        view = new DataView(this.buffer.buffer, 0, length);
        return view.getUint32(0) & 0x3fffffff;
      case 8:
        this.buffer = await this.read(this.buffer, 1, 8);
        view = new DataView(this.buffer.buffer, 0, length);
        return view.getBigUint64(0) & 0x3fffffffffffffffn;
    }
    throw new Error("invalid varint length");
  }

  async subscribe(): Promise<Subscribe> {
    const subscribeId = await this.readVarint();
    const trackAlias = await this.readVarint();
    const trackNamespace = await this.string();
    const trackName = await this.string();
    const subscriberPriority = (await this.readN(1))[0]!;
    const groupOrder = (await this.readN(1))[0]!;
    const filterType = await this.readVarint();
    let startGroup;
    let startObject;
    let endGroup;
    let endObject;
    if (
      filterType === FilterType.AbsoluteStart ||
      filterType == FilterType.AbsoluteRange
    ) {
      startGroup = await this.readVarint();
      startObject = await this.readVarint();
    }
    if (filterType == FilterType.AbsoluteRange) {
      endGroup = await this.readVarint();
      endObject = await this.readVarint();
    }
    const forward: number = 42; // TODO
    return {
      type: ControlMessageType.Subscribe,
      subscribeId,
      trackAlias,
      trackNamespace,
      trackName,
      subscriberPriority,
      groupOrder,
      forward,
      filterType,
      startGroup,
      startObject,
      endGroup,
      endObject,
      subscribeParameters: await this.parameters(),
    };
  }

  async subscribeUpdate(): Promise<SubscribeUpdate> {
    const requestID = await this.readVarint();
    const startGroup = await this.readVarint();
    const startObject = await this.readVarint();
    const endGroup = await this.readVarint();
    const endObject = await this.readVarint();
    const subscriberPriority = (await this.readN(1))[0]!;
    return {
      type: ControlMessageType.SubscribeUpdate,
      requestID,
      startLocation: 42, // TODO
      endGroup,
      subscriberPriority,
      forward: 42, // TODO
      subscribeParameters: await this.parameters(),
    };
  }

  async subscribeOk(): Promise<SubscribeOk> {
    const requestID = await this.readVarint();
    const expires = await this.readVarint();
    const groupOrder = (await this.readN(1))[0]!;
    const contentExists = (await this.readVarint()) == 1;
    let finalGroup;
    let finalObject;
    if (contentExists) {
      finalGroup = await this.readVarint();
      finalObject = await this.readVarint();
    }
    return {
      type: ControlMessageType.SubscribeOk,
      requestID,
      expires,
      groupOrder,
      contentExists,
      finalGroup,
      finalObject,
    };
  }

  async subscribeError(): Promise<SubscribeError> {
    return {
      type: ControlMessageType.SubscribeError,
      subscribeId: await this.readVarint(),
      errorCode: await this.readVarint(),
      reasonPhrase: await this.string(),
      trackAlias: await this.readVarint(),
    };
  }

  async announce(): Promise<Announce> {
    return {
      type: ControlMessageType.Announce,
      namespace: await this.string(),
      parameters: await this.parameters(),
    };
  }

  async announceOk(): Promise<AnnounceOk> {
    return {
      type: ControlMessageType.AnnounceOk,
      trackNamespace: await this.string(),
    };
  }

  async announceError(): Promise<AnnounceError> {
    return {
      type: ControlMessageType.AnnounceError,
      trackNamespace: await this.string(),
      errorCode: await this.readVarint(),
      reasonPhrase: await this.string(),
    };
  }

  async unannounce(): Promise<Unannounce> {
    return {
      type: ControlMessageType.Unannounce,
      trackNamespace: await this.string(),
    };
  }

  async unsubscribe(): Promise<Unsubscribe> {
    return {
      type: ControlMessageType.Unsubscribe,
      subscribeId: await this.readVarint(),
    };
  }

  async subscribeDone(): Promise<SubscribeDone> {
    const subscribeId = await this.readVarint();
    const statusCode = await this.readVarint();
    const reasonPhrase = await this.string();
    const contentExists = (await this.readVarint()) == 1;
    let finalGroup;
    let finalObject;
    if (contentExists) {
      finalGroup = await this.readVarint();
      finalObject = await this.readVarint();
    }
    return {
      type: ControlMessageType.SubscribeDone,
      subscribeId,
      statusCode,
      reasonPhrase,
      contentExists,
      finalGroup,
      finalObject,
    };
  }

  async goAway(): Promise<GoAway> {
    return {
      type: ControlMessageType.GoAway,
      newSessionURI: await this.string(),
    };
  }

  async serverSetup(): Promise<ServerSetup> {
    var selectedVersion = await this.readVarint();
    var parameter = await this.parameters();

    return {
      type: ControlMessageType.ServerSetup,
      selectedVersion: selectedVersion,
      parameters: parameter,
    };
  }

  async requstsBlocked(): Promise<RequestsBlocked> {
    var maxReqID = await this.readVarint();
    console.log("Request blocked: " + maxReqID);

    return {
      type: ControlMessageType.RequestBlocked,
      maximumRequestID: maxReqID,
    };
  }

  async streamObject(extensions: boolean): Promise<ObjectMessage> {
    const objectId = await this.readVarint();

    // read extensions
    if (extensions) {
      const length = await this.readVarint();
      await this.readN(<number>length);

      // TODO: do something with it
    }

    const length = await this.readVarint();
    if (length > Number.MAX_VALUE) {
      throw new Error(
        `cannot read more then ${Number.MAX_VALUE} bytes from stream`
      );
    }
    let objectStatus: varint = 0;
    if (length === 0) {
      objectStatus = await this.readVarint();
    }
    return {
      objectId,
      objectStatus,
      objectPayload: await this.readN(<number>length),
    };
  }

  async string(): Promise<string> {
    const length = await this.readVarint();
    if (length > Number.MAX_VALUE) {
      throw new Error(
        `cannot read more then ${Number.MAX_VALUE} bytes from stream`
      );
    }
    const data = await this.readN(<number>length);
    return new TextDecoder().decode(data);
  }

  async parameter(): Promise<Parameter> {
    const type = await this.readVarint();

    // odd type -> have length fieled
    if (<number>type % 2 == 1) {
      const length = await this.readVarint();
      if (length > Number.MAX_VALUE) {
        throw new Error(
          `cannot read more then ${Number.MAX_VALUE} bytes from stream`
        );
      }
      return {
        type: type,
        value: await this.readN(<number>length),
      };
    }

    // even length -> single value
    const value = await this.readVarint();
    return {
      type: type,
      value: new Uint8Array(), // TODO: use value
    };
  }

  async parameters(): Promise<Parameter[]> {
    const numOfParameters = await this.readVarint();
    const parameters = [];
    for (let i = 0; i < numOfParameters; i++) {
      parameters.push(await this.parameter());
    }
    return parameters;
  }
}

export class ControlStreamDecoder extends Decoder {
  async pull(controller: ReadableStreamDefaultController): Promise<void> {
    const msgType = await this.readVarint();
    await this.readUint16(); // length field

    switch (msgType) {
      case ControlMessageType.Subscribe:
        return controller.enqueue(await this.subscribe());
      case ControlMessageType.SubscribeUpdate:
        return controller.enqueue(await this.subscribeUpdate());
      case ControlMessageType.SubscribeOk:
        return controller.enqueue(await this.subscribeOk());
      case ControlMessageType.SubscribeError:
        return controller.enqueue(await this.subscribeError());
      case ControlMessageType.Announce:
        return controller.enqueue(await this.announce());
      case ControlMessageType.AnnounceOk:
        return controller.enqueue(await this.announceOk());
      case ControlMessageType.AnnounceError:
        return controller.enqueue(await this.announceError());
      case ControlMessageType.Unannounce:
        return controller.enqueue(await this.unannounce());
      case ControlMessageType.Unsubscribe:
        return controller.enqueue(await this.unsubscribe());
      case ControlMessageType.SubscribeDone:
        return controller.enqueue(await this.subscribeDone());
      case ControlMessageType.GoAway:
        return controller.enqueue(await this.goAway());
      case ControlMessageType.ServerSetup:
        return controller.enqueue(await this.serverSetup());
      case ControlMessageType.RequestBlocked:
        return controller.enqueue(await this.requstsBlocked());
    }
    throw new Error(`unexpected message type: ${msgType}`);
  }
}

export class ObjectStreamDecoder extends Decoder {
  state: EncoderState;
  subscribeId?: varint;
  trackAlias?: varint;
  groupId?: varint;
  publisherPriority?: number;
  extensions: boolean;
  SubIDisFirstObjectID: boolean;
  NoSubID: boolean;

  constructor(stream: ReadableStream<Uint8Array>) {
    super(stream);
    this.state = EncoderState.Init;
    this.extensions = false;
    this.SubIDisFirstObjectID = false;
    this.NoSubID = false;
  }

  async pull(
    controller: ReadableStreamDefaultController<ObjectMsgWithHeader>
  ): Promise<void> {
    // already got header
    if (this.state === EncoderState.Ready) {
      const o = await this.streamObject(this.extensions);

      return controller.enqueue({
        subscribeId: this.subscribeId!,
        trackAlias: this.trackAlias!,
        groupId: this.groupId!,
        publisherPriority: this.publisherPriority!,
        msg: o,
      });
    }

    // first message in stream -> decode header first

    const rawMt = await this.readVarint();
    console.log("decoding message type", rawMt);

    // check if valid message type
    const headerValuies = Object.values(StreamHeaderType);
    if (!headerValuies.includes(Number(rawMt))) {
      throw new Error(`unexpected message type: ${rawMt}`);
    }

    const mt: StreamHeaderType = Number(rawMt);

    if (mt == StreamHeaderType.Fetch) {
      throw new Error(`Fetch not implemented. Message type: ${rawMt}`);
    }

    // check if objects have extensions
    const headerWithExtensions = [
      StreamHeaderType.SubgroupFirstObjectIDisSubIDwithExtensions,
      StreamHeaderType.SubgroupNoSubIDwithExtensions,
      StreamHeaderType.SubgroupSubIDpresentWithExtensions,
    ];

    if (headerWithExtensions.includes(mt)) {
      this.extensions = true;
    }

    // check subID type
    // these types do not include a subID field in the header
    if (
      mt === StreamHeaderType.SubgroupNoSubID ||
      mt === StreamHeaderType.SubgroupNoSubIDwithExtensions
    ) {
      this.NoSubID = true;
    }
    if (
      mt === StreamHeaderType.SubgroupFirstObjectIDisSubID ||
      mt === StreamHeaderType.SubgroupFirstObjectIDisSubIDwithExtensions
    ) {
      this.SubIDisFirstObjectID = true;
    }

    // read header fields
    this.trackAlias = await this.readVarint();
    this.groupId = await this.readVarint();

    if (!(this.NoSubID && this.SubIDisFirstObjectID)) {
      this.subscribeId = await this.readVarint();
    }

    this.publisherPriority = (await this.readN(1))[0]!;

    this.state = EncoderState.Ready;

    // already pull first data object
    const o = await this.streamObject(this.extensions);

    if (this.SubIDisFirstObjectID) {
      this.subscribeId = o.objectId;
    }

    return controller.enqueue({
      subscribeId: this.subscribeId!,
      trackAlias: this.trackAlias!,
      groupId: this.groupId,
      publisherPriority: this.publisherPriority!,
      msg: o,
    });
  }
}
