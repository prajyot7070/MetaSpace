import express from 'express';
import * as mediasoup from 'mediasoup';
import { RTCManager } from "./RTCManager";

const app = express();
app.use(express.json());

async function startSFU() {
  const worker = await mediasoup.createWorker({
    logLevel: 'warn',
    logTags: ['info','ice','dtls','rtp','srtp','rtcp'],
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });
  console.log('SFU worker created');

  const rtcManager = new RTCManager(worker);

  //api endpoints
  app.post('/create-transport', async (req, res) => {
    try {
      const { roomId, userId } = req.body;
      //testing log
      console.log(`RTCserver : Creating transports | roomId : ${roomId} | userId : ${userId}`);
      const result = await rtcManager.createTransport(roomId, userId);
      //testing logs;
      if (result) { console.log(`RTCserver : Transport created!`);}
      
      res.json(result);
    } catch (err) {
      res.status(500).json({error: err});
    }
  });

  app.post('/connect-transport', async (req, res) => {
    try {
      const { roomId, userId, transportId, dtlsParameters }  = req.body;
      console.log(`Connecting transport: ${transportId} for user ${userId} in room ${roomId}`);
      await rtcManager.connectTransport(roomId, userId, transportId, dtlsParameters);
      res.status(200).json({message: "Transport connected successfully"});
    } catch (error) {
      console.error("Error connecting transport:", error);
      res.status(500).json({message: "Internal server error while connecting transport"});
    }
  });

  app.post('/produce', async (req, res) => {
    try {
      const { roomId, userId, transportId, kind, rtpParameters } = req.body;
      const result = await rtcManager.produce(roomId, userId, transportId, kind, rtpParameters);
      res.json(result);
    } catch (error) {
      res.status(500).json({message: `Internal server error while calling rtcManager.produce() \n${error}`});
    }
  });

  app.post('/consume', async (req, res) => {
    try {
      const {roomId, userId, transportId, producerId, rtpCapabilities} = req.body;
      const result = await rtcManager.consume(roomId, userId, transportId, producerId, rtpCapabilities);
      res.json(result);
    } catch (error) {
      res.status(500).json({message: `Internal server error while calling rtcManager.produce() \n${error}`});
    }
  })

  app.get('/routerRTPCapabilities', async(req, res) => {
    const data = await rtcManager.getRtpCapabilities();
    //console.log(`FROM rtc/src/index.ts | rtpCapabilities :- ${JSON.stringify(data)}`);
    res.json(data);
  })

  const port = 3001;
  app.listen(port,() => {
    console.log(`SFU server listening on port ${port}`);
  })
}

startSFU();

//async function startSFU() {
//  const worker = await mediasoup.createWorker();
//  console.log("SFU Worker Created");
//
//  const rtcManager = new RTCManager(worker);
//}
//
//startSFU();
//
