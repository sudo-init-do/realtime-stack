import 'dotenv/config';
import { WebSocketServer, WebSocket } from 'ws';
import * as jose from 'jose';
import amqp from 'amqplib';
import { Kafka } from 'kafkajs';

const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const RABBIT_URL = process.env.RABBIT_URL || 'amqp://dev:dev@localhost:5672';
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'localhost:9094';

type Client = WebSocket & { userId?: string };
const rooms = new Map<string, Set<Client>>();

async function verifyToken(token?: string) {
  if (!token) throw new Error('No token');
  const secret = new TextEncoder().encode(JWT_SECRET);
  const { payload } = await jose.jwtVerify(token, secret);
  return payload as { sub?: string };
}

(async () => {
  const mqConn = await amqp.connect(RABBIT_URL);
  const mqCh = await mqConn.createChannel();
  await mqCh.assertQueue('persist_message', { durable: true });

  const kafka = new Kafka({ brokers: [KAFKA_BROKER] });
  const producer = kafka.producer();
  await producer.connect();

  const wss = new WebSocketServer({ port: PORT });
  console.log(`[ws-gateway] listening on ${PORT}`);

  wss.on('connection', async (ws: Client, req) => {
    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token') || '';
      const payload = await verifyToken(token);
      ws.userId = payload.sub || 'anon';
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    ws.on('message', async (buf) => {
      let msg: any;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      const { type, roomId, payload } = msg;

      if (type === 'join' && roomId) {
        if (!rooms.has(roomId)) rooms.set(roomId, new Set());
        rooms.get(roomId)!.add(ws);
        ws.send(JSON.stringify({ type: 'joined', roomId }));
        return;
      }

      if (type === 'chat' && roomId && payload) {
        const peers = rooms.get(roomId) || new Set();
        for (const peer of peers) {
          if (peer.readyState === WebSocket.OPEN) {
            peer.send(JSON.stringify({ type: 'chat', roomId, from: ws.userId, payload, ts: Date.now() }));
          }
        }
        mqCh.sendToQueue('persist_message', Buffer.from(JSON.stringify({
          roomId, from: ws.userId, payload, ts: Date.now()
        })), { persistent: true });

        await producer.send({
          topic: 'chat_events',
          messages: [{ key: roomId, value: JSON.stringify({ kind: 'message_sent', roomId, from: ws.userId, ts: Date.now() }) }]
        });
      }
    });

    ws.on('close', () => rooms.forEach(set => set.delete(ws)));
  });
})();
