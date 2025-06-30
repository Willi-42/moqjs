import { addHeader } from "./encoder";
import {
  type varint,
  appendVarint,
  appendUint8Arr,
  appendString,
  appendNumber,
  appendTupleString,
} from "./varint";

export const DRAFT_IETF_MOQ_TRANSPORT_01 = 0xff000001;
export const DRAFT_IETF_MOQ_TRANSPORT_02 = 0xff000002;
export const DRAFT_IETF_MOQ_TRANSPORT_03 = 0xff000003;
export const DRAFT_IETF_MOQ_TRANSPORT_04 = 0xff000004;
export const DRAFT_IETF_MOQ_TRANSPORT_05 = 0xff000005;
export const DRAFT_IETF_MOQ_TRANSPORT_11 = 0xff00000b;
export const CURRENT_SUPPORTED_DRAFT = DRAFT_IETF_MOQ_TRANSPORT_11;

export type ControlMessage =
  | SubscribeUpdate
  | Subscribe
  | SubscribeOk
  | SubscribeError
  | Announce
  | AnnounceOk
  | AnnounceError
  | Unannounce
  | Unsubscribe
  | SubscribeDone
  | AnnounceCancel
  | GoAway
  | ClientSetup
  | ServerSetup;

export interface MessageEncoder {
  encode(e: Encoder): Promise<void>;
}

interface Encoder {
  writeBytes(b: Uint8Array): Promise<void>;
}

export enum ControlMessageType {
  SubscribeUpdate = 0x02,
  Subscribe = 0x03,
  SubscribeOk = 0x04,
  SubscribeError = 0x05,
  Announce = 0x06,
  AnnounceOk = 0x07,
  AnnounceError = 0x08,
  Unannounce = 0x09,
  Unsubscribe = 0x0a,
  SubscribeDone = 0x0b,
  AnnounceCancel = 0x0c,
  GoAway = 0x10,
  ClientSetup = 0x20,
  ServerSetup = 0x21,
  RequestBlocked = 0x1a,
}

export enum FilterType {
  LatestGroup = 0x01,
  LatestObject = 0x02,
  AbsoluteStart = 0x03,
  AbsoluteRange = 0x04,
}

export interface Subscribe {
  type: ControlMessageType.Subscribe;
  subscribeId: varint;
  trackAlias: varint;
  trackNamespace: string;
  trackName: string;
  subscriberPriority: number;
  groupOrder: number;
  forward: number;
  filterType: varint;
  startGroup?: varint;
  startObject?: varint;
  endGroup?: varint;
  endObject?: varint;
  subscribeParameters: Parameter[];
}

export interface SubscribeEncoder extends Subscribe {}

export class SubscribeEncoder implements Subscribe, MessageEncoder {
  constructor(m: Subscribe) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();

    bufPayload = appendVarint(this.subscribeId, bufPayload); // Request ID
    bufPayload = appendVarint(this.trackAlias, bufPayload);
    bufPayload = appendTupleString(this.trackNamespace, bufPayload);
    bufPayload = appendString(this.trackName, bufPayload);
    bufPayload = appendNumber(this.subscriberPriority, bufPayload);
    bufPayload = appendNumber(this.groupOrder, bufPayload);
    bufPayload = appendNumber(this.forward, bufPayload);
    bufPayload = appendVarint(this.filterType, bufPayload);
    if (
      this.filterType === FilterType.AbsoluteStart ||
      this.filterType === FilterType.AbsoluteRange
    ) {
      bufPayload = appendVarint(this.startGroup || 0, bufPayload);
      bufPayload = appendVarint(this.startObject || 0, bufPayload);
    }
    if (this.filterType === FilterType.AbsoluteRange) {
      bufPayload = appendVarint(this.endGroup || 0, bufPayload);
      bufPayload = appendVarint(this.endObject || 0, bufPayload);
    }
    bufPayload = appendVarint(this.subscribeParameters.length, bufPayload);
    for (const p of this.subscribeParameters) {
      bufPayload = await new ParameterEncoder(p).append(bufPayload);
    }

    const wholePacket = addHeader(this.type, bufPayload);
    e.writeBytes(wholePacket);
  }
}

export interface SubscribeUpdate {
  type: ControlMessageType.SubscribeUpdate;
  requestID: varint;
  startLocation: varint; // TODO: what is type of location
  endGroup: varint;
  subscriberPriority: number;
  forward: number;
  subscribeParameters: Parameter[];
}

export interface SubscribeUpdateEncoder extends SubscribeUpdate {}

export class SubscribeUpdateEncoder implements SubscribeUpdate, MessageEncoder {
  constructor(m: SubscribeUpdate) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();

    bufPayload = appendVarint(this.requestID, bufPayload);
    bufPayload = appendVarint(this.startLocation, bufPayload);
    bufPayload = appendVarint(this.endGroup, bufPayload);

    bufPayload = appendNumber(this.subscriberPriority, bufPayload);
    bufPayload = appendNumber(this.forward, bufPayload);
    bufPayload = appendVarint(this.subscribeParameters.length, bufPayload);
    for (const p of this.subscribeParameters) {
      bufPayload = await new ParameterEncoder(p).append(bufPayload);
    }

    const wholePacket = addHeader(this.type, bufPayload);
    e.writeBytes(wholePacket);
  }
}

export interface SubscribeOk {
  type: ControlMessageType.SubscribeOk;
  requestID: varint;
  expires: varint;
  groupOrder: number;
  contentExists: boolean;
  finalGroup?: varint;
  finalObject?: varint;
}

export interface SubscribeOkEncoder extends SubscribeOk {}

export class SubscribeOkEncoder implements SubscribeOk, MessageEncoder {
  constructor(m: SubscribeOk) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendVarint(this.requestID, bufPayload);
    bufPayload = appendVarint(this.expires, bufPayload);
    bufPayload = appendNumber(this.groupOrder, bufPayload);

    const contentExists: number = this.contentExists ? 1 : 0;
    bufPayload = appendNumber(contentExists, bufPayload); // TODO: Should use byte instead of varint?
    if (this.contentExists) {
      bufPayload = appendVarint(this.finalGroup!, bufPayload);
      bufPayload = appendVarint(this.finalObject!, bufPayload);
    }

    const wholePacket = addHeader(this.type, bufPayload);
    e.writeBytes(wholePacket);
  }
}

export interface SubscribeError {
  type: ControlMessageType.SubscribeError;
  subscribeId: varint;
  errorCode: varint;
  reasonPhrase: string;
  trackAlias: varint;
}

export interface SubscribeErrorEncoder extends SubscribeError {}

export class SubscribeErrorEncoder implements SubscribeError, MessageEncoder {
  constructor(m: SubscribeError) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendVarint(this.type, bufPayload);
    bufPayload = appendVarint(this.subscribeId, bufPayload);
    bufPayload = appendVarint(this.errorCode, bufPayload);
    bufPayload = appendString(this.reasonPhrase, bufPayload);
    bufPayload = appendVarint(this.trackAlias, bufPayload);

    const wholePacket = addHeader(this.type, bufPayload);
    e.writeBytes(wholePacket);
  }
}

export interface Unsubscribe {
  type: ControlMessageType.Unsubscribe;
  subscribeId: varint;
}

export interface UnsubscribeEncoder extends Unsubscribe {}

export class UnsubscribeEncoder implements Unsubscribe, MessageEncoder {
  constructor(m: Unsubscribe) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendVarint(this.subscribeId, bufPayload);

    const wholePacket = addHeader(this.type, new Uint8Array());
    e.writeBytes(wholePacket);
  }
}

export interface SubscribeDone {
  type: ControlMessageType.SubscribeDone;
  subscribeId: varint;
  statusCode: varint;
  reasonPhrase: string;
  contentExists: boolean;
  finalGroup?: varint;
  finalObject?: varint;
}

export interface SubscribeDoneEncoder extends SubscribeDone {}

export class SubscribeDoneEncoder implements SubscribeDone, MessageEncoder {
  constructor(m: SubscribeDone) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendVarint(this.subscribeId, bufPayload);

    bufPayload = appendVarint(this.subscribeId, bufPayload);
    bufPayload = appendVarint(this.statusCode, bufPayload);
    bufPayload = appendString(this.reasonPhrase, bufPayload);
    bufPayload = appendVarint(this.contentExists ? 1 : 0, bufPayload); // TODO: Should use byte instead of varint?
    if (this.contentExists) {
      bufPayload = appendVarint(this.finalGroup || 0, bufPayload);
      bufPayload = appendVarint(this.finalObject || 0, bufPayload);
    }

    const wholePacket = addHeader(this.type, new Uint8Array());
    e.writeBytes(wholePacket);
  }
}

export interface Announce {
  type: ControlMessageType.Announce;
  namespace: string;
  parameters: Parameter[];
}

export interface AnnounceEncoder extends Announce {}

export class AnnounceEncoder implements Announce, MessageEncoder {
  constructor(m: Announce) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendString(this.namespace, bufPayload);
    bufPayload = appendVarint(this.parameters.length, bufPayload);
    for (const p of this.parameters) {
      await new ParameterEncoder(p).append(bufPayload);
    }

    const wholePacket = addHeader(this.type, new Uint8Array());
    e.writeBytes(wholePacket);
  }
}

export interface AnnounceOk {
  type: ControlMessageType.AnnounceOk;
  trackNamespace: string;
}

export interface AnnounceOkEncoder extends AnnounceOk {}

export class AnnounceOkEncoder implements AnnounceOk, MessageEncoder {
  constructor(m: AnnounceOk) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendString(this.trackNamespace, bufPayload);

    const wholePacket = addHeader(this.type, new Uint8Array());
    e.writeBytes(wholePacket);
  }
}

export interface AnnounceError {
  type: ControlMessageType.AnnounceError;
  trackNamespace: string;
  errorCode: varint;
  reasonPhrase: string;
}

export interface AnnounceErrorEncoder extends AnnounceError {}

export class AnnounceErrorEncoder implements AnnounceError, MessageEncoder {
  constructor(m: AnnounceError) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendString(this.trackNamespace, bufPayload);
    bufPayload = appendVarint(this.errorCode, bufPayload);
    bufPayload = appendString(this.reasonPhrase, bufPayload);

    const wholePacket = addHeader(this.type, new Uint8Array());
    e.writeBytes(wholePacket);
  }
}

export interface Unannounce {
  type: ControlMessageType.Unannounce;
  trackNamespace: string;
}

export interface UnannounceEncoder extends Unannounce {}

export class UnannounceEncoder implements Unannounce, MessageEncoder {
  constructor(m: Unannounce) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendString(this.trackNamespace, bufPayload);

    const wholePacket = addHeader(this.type, new Uint8Array());
    e.writeBytes(wholePacket);
  }
}

export interface AnnounceCancel {
  type: ControlMessageType.AnnounceCancel;
}

export interface GoAway {
  type: ControlMessageType.GoAway;
  newSessionURI: string;
}

export interface GoAwayEncoder extends GoAway {}

export class GoAwayEncoder implements GoAway, MessageEncoder {
  constructor(m: GoAway) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    let bufPayload = new Uint8Array();
    bufPayload = appendString(this.newSessionURI, bufPayload);

    const wholePacket = addHeader(this.type, new Uint8Array());
    e.writeBytes(wholePacket);
  }
}

export interface ClientSetup {
  type: ControlMessageType.ClientSetup;
  versions: varint[];
  parameters: Parameter[];
}

export interface ClientSetupEncoder extends ClientSetup {}

export class ClientSetupEncoder implements ClientSetup, MessageEncoder {
  constructor(cs: ClientSetup) {
    Object.assign(this, cs);
  }

  async encode(e: Encoder): Promise<void> {
    // payload
    var bufPayload = new Uint8Array();

    bufPayload = appendVarint(this.versions.length, bufPayload); // number of supported versions
    for (const v of this.versions) {
      // supported versions
      bufPayload = appendVarint(v, bufPayload);
    }
    bufPayload = appendVarint(this.parameters.length, bufPayload); // number of parameters
    for (const p of this.parameters) {
      // parameters
      bufPayload = await new ParameterEncoder(p).append(bufPayload);
    }

    const wholePacket = addHeader(this.type, bufPayload);
    e.writeBytes(wholePacket);
  }
}

export interface ServerSetup {
  type: ControlMessageType.ServerSetup;
  selectedVersion: varint;
  parameters: Parameter[];
}

export interface ServerSetupEncoder extends ServerSetup {}

export class ServerSetupEncoder implements ServerSetup {
  constructor(m: ServerSetup) {
    Object.assign(this, m);
  }
}

export interface RequestsBlocked {
  type: ControlMessageType.RequestBlocked;
  maximumRequestID: varint;
}

export interface Parameter {
  type: varint;
  value: Uint8Array;
}

export interface ParameterEncoder extends Parameter {}

export class ParameterEncoder implements Parameter {
  constructor(p: Parameter) {
    Object.assign(this, p);
  }

  async append(buf: Uint8Array): Promise<Uint8Array> {
    buf = appendVarint(this.type, buf);
    buf = appendVarint(this.value.byteLength, buf);
    buf = appendUint8Arr(buf, this.value);

    return buf;
  }
}
