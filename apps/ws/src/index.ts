import {WebSocketServer } from 'ws';
import { User } from './User';
//GPT said const server = new Server(); const wss = new WebSocketServer({ server });
//this is more flexible and useful when deploying as WS might need HTTP server for proper routing and closing connection gracefully

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', function connection(ws) {
  let user = new User(ws);
  ws.on('error', console.error);

  ws.on('close',() => {
    user?.destroy();
  });
});
