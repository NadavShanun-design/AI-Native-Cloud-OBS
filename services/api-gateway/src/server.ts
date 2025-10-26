/**
 * API Gateway with WebSocket support
 * Handles LiveKit token generation and real-time score broadcasting
 */

import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';
import { createClient, RedisClientType } from 'redis';
import { WebSocket } from 'ws';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://livekit-server:7880';
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Types
interface TokenRequest {
  identity: string;
  room?: string;
  role?: 'camera' | 'viewer';
  name?: string;
}

interface ScoreData {
  cam_id: string;
  camId: string;
  score: number;
  reason: string;
  timestamp: number;
}

interface ScoreMessage {
  type: 'score';
  payload: ScoreData;
}

interface RankingEntry {
  participantId: string;
  participantName: string;
  score: number;
  reason: string;
  timestamp: number;
}

// In-memory score storage
const scores = new Map<string, RankingEntry>();

// WebSocket clients
const wsClients = new Set<WebSocket>();

// Redis clients
let redisSubscriber: RedisClientType;
let redisPublisher: RedisClientType;

/**
 * Initialize Fastify server
 */
async function createServer(): Promise<FastifyInstance> {
  const server = fastify({
    logger: {
      level: LOG_LEVEL
    }
  });

  // Register plugins
  await server.register(fastifyCors, {
    origin: true, // Allow all origins in development
    credentials: true
  });

  await server.register(fastifyWebsocket);

  return server;
}

/**
 * Generate LiveKit access token
 */
async function generateLiveKitToken(params: TokenRequest): Promise<string> {
  const { identity, room = 'geome-hackathon', role = 'camera', name } = params;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: name || identity,
    ttl: '2h'
  });

  const grants: VideoGrant = {
    roomJoin: true,
    room: room,
    canPublish: role === 'camera',
    canSubscribe: true
  };

  token.addGrant(grants);

  return await token.toJwt();
}

/**
 * Setup REST API routes
 */
function setupRoutes(server: FastifyInstance) {
  // Health check
  server.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      status: 'ok',
      timestamp: Date.now()
    };
  });

  // Token generation endpoint
  server.post<{ Body: TokenRequest }>(
    '/token',
    async (request: FastifyRequest<{ Body: TokenRequest }>, reply: FastifyReply) => {
      try {
        const { identity, room, role, name } = request.body;

        if (!identity) {
          return reply.code(400).send({
            success: false,
            error: 'Missing required field: identity'
          });
        }

        const token = await generateLiveKitToken({ identity, room, role, name });

        // Use external URL for client connections (localhost instead of internal docker name)
        const clientUrl = LIVEKIT_URL.replace('livekit-server', 'localhost');

        server.log.info(`Generated token for ${identity} (room: ${room || 'geome-hackathon'})`);

        return {
          success: true,
          data: {
            token,
            url: clientUrl
          },
          timestamp: Date.now()
        };
      } catch (error: any) {
        server.log.error(`Token generation error: ${error.message}`);
        return reply.code(500).send({
          success: false,
          error: error.message
        });
      }
    }
  );

  // Get current rankings
  server.get('/rankings', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rankings = Array.from(scores.values())
        .sort((a, b) => b.score - a.score);

      return {
        success: true,
        data: rankings,
        timestamp: Date.now()
      };
    } catch (error: any) {
      server.log.error(`Rankings fetch error: ${error.message}`);
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });

  // WebSocket endpoint for real-time scores
  server.register(async (fastify) => {
    fastify.get('/ws', { websocket: true }, (connection, request) => {
      const ws = connection;

      fastify.log.info('🔌 WebSocket client connected');
      wsClients.add(ws);

      // Send current scores on connect
      const currentScores = Array.from(scores.values());
      if (currentScores.length > 0) {
        ws.send(JSON.stringify({
          type: 'initial',
          payload: currentScores
        }));
      }

      ws.on('close', () => {
        fastify.log.info('🔌 WebSocket client disconnected');
        wsClients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        fastify.log.error(`WebSocket error: ${error.message}`);
        wsClients.delete(ws);
      });
    });
  });
}

/**
 * Setup Redis subscription for score updates
 */
async function setupRedis(server: FastifyInstance) {
  // Create Redis clients
  redisSubscriber = createClient({ url: REDIS_URL });
  redisPublisher = createClient({ url: REDIS_URL });

  // Connect clients
  await redisSubscriber.connect();
  await redisPublisher.connect();

  server.log.info('✅ Connected to Redis');

  // Subscribe to scores channel
  await redisSubscriber.subscribe('scores.stream', (message) => {
    try {
      const scoreMessage: ScoreMessage = JSON.parse(message);

      if (scoreMessage.type === 'score') {
        const { cam_id, score, reason, timestamp } = scoreMessage.payload;

        // Update in-memory scores
        scores.set(cam_id, {
          participantId: cam_id,
          participantName: cam_id, // Can be enhanced with actual names
          score,
          reason,
          timestamp
        });

        server.log.debug(`📊 Score update: ${cam_id} = ${score}`);

        // Broadcast to all WebSocket clients
        const broadcastMessage = JSON.stringify(scoreMessage);
        wsClients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(broadcastMessage);
          }
        });
      }
    } catch (error: any) {
      server.log.error(`Redis message parse error: ${error.message}`);
    }
  });

  server.log.info('📡 Subscribed to Redis scores.stream');
}

/**
 * Main server startup
 */
async function start() {
  console.log('=' .repeat(80));
  console.log('🚀 API Gateway Starting');
  console.log('='.repeat(80));
  console.log(`Port: ${PORT}`);
  console.log(`LiveKit URL: ${LIVEKIT_URL}`);
  console.log(`Redis URL: ${REDIS_URL}`);
  console.log('='.repeat(80));

  try {
    // Create server
    const server = await createServer();

    // Setup routes
    setupRoutes(server);

    // Setup Redis
    await setupRedis(server);

    // Start listening
    await server.listen({ port: PORT, host: HOST });

    console.log(`✅ API Gateway running on http://${HOST}:${PORT}`);
    console.log(`✅ WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
    console.log('Press Ctrl+C to stop');

  } catch (error: any) {
    console.error(`❌ Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');

  try {
    if (redisSubscriber) await redisSubscriber.quit();
    if (redisPublisher) await redisPublisher.quit();

    wsClients.forEach((client) => client.close());

    console.log('👋 Shutdown complete');
    process.exit(0);
  } catch (error: any) {
    console.error(`Shutdown error: ${error.message}`);
    process.exit(1);
  }
});

// Start the server
start();
