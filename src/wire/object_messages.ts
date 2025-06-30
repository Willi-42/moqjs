import type { MessageEncoder } from "./control_messages";
import { addHeader, Encoder } from "./encoder";
import { type varint, appendVarint, appendNumber, appendBytes } from "./varint";

export type ObjectMessage = ObjectMsg;

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

export class ObjectStreamEncoder implements ObjectMsg, MessageEncoder {
  constructor(m: ObjectMsg) {
    Object.assign(this, m);
  }

  async encode(e: Encoder): Promise<void> {
    console.log("can't sent anything yet");

    // let bufPayload = new Uint8Array();

    // if (this.type === ControlMessageType.ObjectStream || this.type === ControlMessageType.ObjectDatagram) {
    //   bufPayload = appendVarint(this.type, bufPayload);
    //   bufPayload = appendVarint(this.subscribeId, bufPayload);
    //   bufPayload = appendVarint(this.trackAlias, bufPayload);
    //   bufPayload = appendVarint(this.groupId, bufPayload);
    //   bufPayload = appendVarint(this.objectId, bufPayload);
    //   bufPayload = appendNumber(this.publisherPriority, bufPayload);
    //   bufPayload = appendVarint(this.objectStatus, bufPayload);
    //   bufPayload = appendBytes(this.objectPayload, bufPayload);
    // }
    // if (this.type === ControlMessageType.StreamHeaderTrack) {
    //   bufPayload = appendVarint(this.groupId, bufPayload);
    //   bufPayload = appendVarint(this.objectId, bufPayload);
    //   bufPayload = appendVarint(this.objectPayload.length, bufPayload);
    //   if (this.objectPayload.length === 0) {
    //     bufPayload = appendVarint(this.objectStatus, bufPayload);
    //   }
    //   else {
    //     bufPayload = appendBytes(this.objectPayload, bufPayload);
    //   }

    // }
    // if (this.type === ControlMessageType.StreamHeaderGroup) {
    //   bufPayload = appendVarint(this.objectId, bufPayload);
    //   bufPayload = appendVarint(this.objectPayload.length, bufPayload);
    //   if (this.objectPayload.length === 0) {
    //     bufPayload = appendVarint(this.objectStatus, bufPayload);
    //   }
    //   else {
    //     bufPayload = appendBytes(this.objectPayload, bufPayload);
    //   }
    // }
    // else {
    //   throw new Error(`cannot encode unknown message type ${this.type}`);
    // }
    // e.writeBytes(bufPayload)
  }
}
