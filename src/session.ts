import { ControlStream } from "./control_stream";
import { ControlStreamDecoder, ObjectStreamDecoder } from "./wire/decoder";
import { Encoder } from "./wire/encoder";
import {
  FilterType,
  ControlMessageType,
  SubscribeEncoder,
  UnsubscribeEncoder,
  SubscribeOkEncoder,
  SubscribeErrorEncoder,
} from "./wire/control_messages";
import { Subscription } from "./subscription";
import type {
  ControlMessage,
  Subscribe,
  SubscribeError,
  SubscribeOk,
} from "./wire/control_messages";
import type { varint } from "./wire/varint";
import type { ObjectMsgWithHeader } from "./wire/object_messages";
import { Publisher } from "./publisher";

// so that tsup doesn't complain when producing the ts declaration file
type WebTransportReceiveStream = any;

function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export class Session {
  conn: WebTransport;
  controlStream: ControlStream;
  subscriptions: Map<varint, Subscription>;
  publishees: Map<varint, Publisher>; // one publsher class for each track
  nextSubscribeId: number = 0;

  OnSubCallback: (
    subscription: Subscribe,
    writableStream: WritableStream
  ) => SubscribeOk | SubscribeError;

  constructor(conn: WebTransport, cs: ControlStream) {
    this.subscriptions = new Map<varint, Subscription>();
    this.publishees = new Map<varint, Publisher>();

    this.conn = conn;
    this.controlStream = cs;
    cs.onmessage = this.handle.bind(this);

    this.controlStream.runReadLoop();
    this.readIncomingUnidirectionalStreams(this.conn);
    this.OnSubCallback = Session.DefaultOnSubCallback;
  }

  static DefaultOnSubCallback(
    subscription: Subscribe,
    writableStream: WritableStream
  ): SubscribeOk | SubscribeError {
    const reason = "Does not exist: " + subscription.trackName;

    const error: SubscribeError = {
      type: ControlMessageType.SubscribeError,
      subscribeId: subscription.subscribeId,
      errorCode: 4, // track does not exist
      reasonPhrase: reason,
      trackAlias: 0, // removed in draft 12
    };

    return error;
  }

  static async connect(url: string, serverCertificateHash?: string) {
    console.log("connecting WebTransport");
    let conn: WebTransport;
    try {
      if (serverCertificateHash !== undefined) {
        const certHashes = [
          {
            algorithm: "sha-256",
            value: base64ToArrayBuffer(serverCertificateHash),
          },
        ];
        console.log("hashes", certHashes);
        console.log("url", url);
        conn = new WebTransport(url, { serverCertificateHashes: certHashes });
      } else {
        console.log("connecting without serverCertificateHashes");
        conn = new WebTransport(url);
      }
    } catch (error) {
      throw new Error(`failed to connect MoQ session: ${error}`);
    }
    await conn.ready;
    console.log("WebTransport connection ready");

    const cs = await conn.createBidirectionalStream();
    const decoderStream = new ReadableStream(
      new ControlStreamDecoder(cs.readable)
    );
    const encoderStream = new WritableStream(new Encoder(cs.writable));
    const controlStream = new ControlStream(decoderStream, encoderStream);
    await controlStream.handshake();
    console.log("handshake done");
    return new Session(conn, controlStream);
  }

  async createNewStream(): Promise<WritableStream<any>> {
    return this.conn.createUnidirectionalStream();
  }

  async readIncomingUnidirectionalStreams(conn: WebTransport) {
    console.log("reading incoming streams");
    const uds = conn.incomingUnidirectionalStreams;
    const reader = uds.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      this.readIncomingUniStream(value);
    }
  }

  async readIncomingUniStream(stream: WebTransportReceiveStream) {
    console.log("got stream");
    const messageStream = new ReadableStream<ObjectMsgWithHeader>(
      new ObjectStreamDecoder(stream)
    );
    const reader = messageStream.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        console.log("stream closed");
        break;
      }
      if (!this.subscriptions.has(value.subscribeId)) {
        throw new Error(
          `got object for unknown subscribeId: ${value.subscribeId}`
        );
      }
      const writer = this.subscriptions
        .get(value.subscribeId)!
        .subscription.writable.getWriter();
      await writer.write(value);
      writer.releaseLock();
    }
  }

  async handle(m: ControlMessage) {
    console.log("got control msg: ", m.type);
    switch (m.type) {
      case ControlMessageType.SubscribeOk:
        this.subscriptions.get(m.requestID)?.subscribeOk();
        break;
      case ControlMessageType.RequestBlocked:
        console.log("Request blocked: " + m.maximumRequestID);
        break;
      case ControlMessageType.Subscribe:
        // create writable stream that puts everything into webtransport
        const writableStream = new WritableStream(
          new Publisher(this.createNewStream.bind(this))
        );
        console.log("Handler got sub msg");

        // TODO: save it for closing
        const res = this.OnSubCallback!(m, writableStream);
        switch (res.type) {
          case ControlMessageType.SubscribeOk:
            this.controlStream.send(new SubscribeOkEncoder(res));
            break;

          case ControlMessageType.SubscribeError:
            this.controlStream.send(new SubscribeErrorEncoder(res));
            break;
        }
        break;
    }
  }

  // subscribe returns a readableStream that contains all payloads as uint8arrays
  async subscribe(
    namespace: string,
    track: string
  ): Promise<{ subscribeId: number; readableStream: ReadableStream }> {
    const subId = this.nextSubscribeId++;
    const s = new Subscription(subId);
    this.subscriptions.set(subId, s);
    await this.controlStream.send(
      new SubscribeEncoder({
        type: ControlMessageType.Subscribe,
        subscribeId: subId,
        trackAlias: subId,
        trackNamespace: namespace,
        trackName: track,
        subscriberPriority: 0,
        groupOrder: 1,
        forward: 1,
        filterType: FilterType.LatestGroup,
        subscribeParameters: [],
      })
    );
    const readableStream = await s.getReadableStream(); // only returns it when we got sub ok
    return {
      subscribeId: subId,
      readableStream,
    };
  }

  async unsubscribe(subscribeId: number) {
    this.controlStream.send(
      new UnsubscribeEncoder({
        type: ControlMessageType.Unsubscribe,
        subscribeId: subscribeId,
      })
    );
  }
}
