import 'dotenv/config';
import amqp from 'amqplib';
import { Pool } from 'pg';

const RABBIT_URL = process.env.RABBIT_URL || 'amqp://dev:dev@localhost:5672';
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/realtimedb';
const PREFETCH = Number(process.env.SERVICE_PREFETCH || 20);

type PersistMsg = {
  roomId: string;
  from: string;
  payload: { text?: string; [k: string]: any };
  ts: number;
};

async function main() {
  // DB
  const pool = new Pool({ connectionString: POSTGRES_URL });
  await pool.query('select 1'); // sanity check

  // MQ
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue('persist_message', { durable: true });
  ch.prefetch(PREFETCH);

  console.log('[chat-service] up. consuming persist_message…');

  ch.consume('persist_message', async (msg) => {
    if (!msg) return;
    try {
      const body: PersistMsg = JSON.parse(msg.content.toString());

      // Basic validation
      if (!body.roomId || !body.from || !body.ts) {
        throw new Error('invalid message: missing roomId/from/ts');
      }
      const text = body.payload?.text ?? null;

      // Persist
      await pool.query(
        `INSERT INTO messages (room_id, user_id, text, payload, created_at)
         VALUES ($1, $2, $3, $4, to_timestamp($5/1000.0))`,
        [body.roomId, body.from, text, body.payload, body.ts]
      );

      ch.ack(msg);
    } catch (err) {
      console.error('[chat-service] persist failed:', err);
      // No requeue here (DLQ/retry comes next step). Avoid infinite loops.
      ch.nack(msg, false, false);
    }
  });
}

main().catch((e) => {
  console.error('[chat-service] fatal:', e);
  process.exit(1);
});
