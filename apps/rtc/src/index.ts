
import mediasoup from "mediasoup";
import { RTCManager } from "./RTCManager";

async function startSFU() {
  const worker = await mediasoup.createWorker();
  console.log("SFU Worker Created");

  const rtcManager = new RTCManager(worker);
}

startSFU();

