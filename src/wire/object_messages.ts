import type { MessageEncoder } from "./control_messages";
import { addHeader, Encoder } from "./encoder";
import {
  type varint,
  appendVarint,
  appendNumber,
  appendBytes,
  appendUInt16,
} from "./varint";

export type ObjectMessage = ObjectMsg;

enum ObjectStreamState {
  Init,
  Ready,
}

export enum DatagramMessageType {
  ObjectDatagram = 0x00,
  ObjectDatagramWithExtension = 0x01,
  ObjectDatagramStatus = 0x02,
  ObjectDatagramStatusWithExtension = 0x03,
}

export enum StreamHeaderType {
  Fetch = 0x05,
  SubgroupNoSubID = 0x08,
  SubgroupNoSubIDwithExtensions = 0x09,
  SubgroupFirstObjectIDisSubID = 0x0a,
  SubgroupFirstObjectIDisSubIDwithExtensions = 0x0b,
  SubgroupSubIDpresent = 0x0c,
  SubgroupSubIDpresentWithExtensions = 0x0d,
}

export interface ObjectMsgWithHeader {
  subscribeId: varint;
  trackAlias: varint;
  groupId: varint;
  publisherPriority: number;

  msg: ObjectMsg;
}

export interface ObjectMsg {
  objectId: varint;
  objectStatus: varint;
  objectPayload: Uint8Array;
}

export interface ObjectStreamEncoder extends ObjectMsg {}

export class ObjectStreamEncoder implements ObjectMsg {
  state: ObjectStreamState;
  groupId: varint;
  subgroupID: varint;
  priority: number;
  baseEncoder: Encoder;
  trackAlias: varint;

  constructor(
    groupId: varint,
    subgroupID: varint,
    priority: number,
    encoder: Encoder,
    trackAlias: varint
  ) {
    this.state = ObjectStreamState.Init;
    this.groupId = groupId;
    this.subgroupID = subgroupID;
    this.priority = priority;
    this.baseEncoder = encoder;
    this.trackAlias = trackAlias;
  }

  async encode(m: ObjectMessage): Promise<void> {
    let bufPayload = new Uint8Array();

    if (this.state == ObjectStreamState.Init) {
      // send header first

      bufPayload = appendVarint(
        StreamHeaderType.SubgroupSubIDpresent,
        bufPayload
      );
      bufPayload = appendVarint(this.trackAlias, bufPayload); // alias
      bufPayload = appendVarint(this.groupId, bufPayload); // groupid
      bufPayload = appendVarint(this.subgroupID, bufPayload); // subGroupID
      bufPayload = appendNumber(this.priority, bufPayload); // priority

      this.state = ObjectStreamState.Ready;
    }

    // encode message
    bufPayload = appendVarint(m.objectId, bufPayload);
    bufPayload = appendVarint(m.objectPayload.length, bufPayload);
    bufPayload = appendBytes(m.objectPayload, bufPayload);

    return this.baseEncoder.writeBytes(bufPayload);
  }
}
