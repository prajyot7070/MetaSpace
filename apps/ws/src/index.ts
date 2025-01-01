import {WebSocketServer } from 'ws';
import { User } from './User';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
  let user: User | undefined;
  ws.on('error', console.error);

  ws.on('close',() => {
    user?.destroy();
  });
});
