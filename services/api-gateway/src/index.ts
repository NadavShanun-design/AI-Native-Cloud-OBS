import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { createClient } from 'redis';
import { AccessToken } from 'livekit-server-sdk';
import { ApiResponse, CameraConfig, SystemConfig, WSEvent } from '@ai-obs/types';

const config = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  livekit: {
    url: process.env.LIVEKIT_URL || 'ws://localhost:7880',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    useHttps: process.env.USE_HTTPS === 'true',
    certPath: process.env.CERT_PATH || '/app/certs/10.103.82.101+2.pem',
    keyPath: process.env.KEY_PATH || '/app/certs/10.103.82.101+2-key.pem',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

// Configure HTTPS if enabled
const httpsOptions = config.server.useHttps ? {
  https: {
    cert: fs.existsSync(config.server.certPath) ? fs.readFileSync(config.server.certPath) : undefined,
    key: fs.existsSync(config.server.keyPath) ? fs.readFileSync(config.server.keyPath) : undefined,
  }
} : {};

const fastify = Fastify({
  logger: {
    level: config.logging.level,
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
  ...httpsOptions,
});

const redisClient = createClient({ url: config.redis.url });
const redisSubscriber = createClient({ url: config.redis.url });

async function main() {
  try {
    await redisClient.connect();
    await redisSubscriber.connect();
    fastify.log.info('Connected to Redis');

    // Register plugins
    await fastify.register(cors, {
      origin: true,
      credentials: true,
    });

    await fastify.register(websocket);

    // Serve static files (camera app)
    await fastify.register(fastifyStatic, {
      root: path.join(process.cwd(), 'web-obs/public'),
      prefix: '/static/',
    });

    // Root redirect to welcome page
    fastify.get('/', async (request, reply) => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI-OBS</title>
  <style>
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: white;
      padding: 48px;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 600px;
    }
    h1 {
      font-size: 48px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 16px;
    }
    p {
      color: #475569;
      margin-bottom: 32px;
      font-size: 18px;
    }
    .buttons {
      display: flex;
      gap: 16px;
      flex-direction: column;
    }
    button {
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 700;
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s;
      text-decoration: none;
      display: inline-block;
    }
    .primary {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    }
    .secondary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    button:hover {
      transform: translateY(-2px);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>AI-OBS</h1>
    <p>Intelligent Auto-Director</p>
    <div class="buttons">
      <button class="primary" onclick="window.location.href='http://localhost:3101'">
        📺 Open Dashboard
      </button>
      <button class="secondary" onclick="window.location.href='/camera?id=cam-1'">
        📹 Connect Camera
      </button>
    </div>
  </div>
</body>
</html>
      `;
      return reply.type('text/html').send(html);
    });

    // Health check
    fastify.get('/health', async (request, reply) => {
      // If accessed from browser, show nice HTML page
      const userAgent = request.headers['user-agent'] || '';
      const isBrowser = userAgent.includes('Mozilla') || userAgent.includes('Safari') || userAgent.includes('Chrome');

      if (isBrowser && !request.headers.accept?.includes('application/json')) {
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate Trusted ✅</title>
  <style>
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .card {
      background: white;
      padding: 48px;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
      max-width: 500px;
    }
    h1 {
      font-size: 48px;
      margin-bottom: 16px;
    }
    p {
      font-size: 18px;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .status {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border-radius: 12px;
      font-weight: 700;
      margin-bottom: 32px;
    }
    button {
      padding: 16px 32px;
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.5);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>✅</h1>
    <div class="status">Certificate Trusted!</div>
    <p><strong>Success!</strong> Your browser now trusts the SSL certificate. You can now use all camera features.</p>
    <button onclick="window.history.back()">← Back to Camera</button>
  </div>
</body>
</html>
        `;
        return reply.type('text/html').send(html);
      }

      return { status: 'ok', timestamp: Date.now() };
    });

    // Generate LiveKit token
    fastify.post<{
      Body: {
        identity: string;
        room: string;
        role: 'camera' | 'viewer' | 'producer';
      };
    }>('/token', async (request, reply) => {
      const { identity, room, role } = request.body;

      if (!identity || !room) {
        return reply.code(400).send({ error: 'Missing identity or room' });
      }

      const token = new AccessToken(
        config.livekit.apiKey,
        config.livekit.apiSecret,
        {
          identity,
          ttl: '1h',
        }
      );

      // Set grants based on role
      const grants = {
        room,
        roomJoin: true,
        canPublish: role === 'camera' || role === 'producer',
        canSubscribe: role === 'viewer' || role === 'producer',
        canPublishData: true,
        hidden: role === 'producer',
      };

      token.addGrant(grants);

      const jwt = await token.toJwt();

      // Return LiveKit URL - use same host as API request for compatibility
      // This works whether accessing from localhost or from phone on network
      const requestHost = request.hostname.split(':')[0];
      const livekitUrl = `ws://${requestHost}:7880`;

      const response: ApiResponse<{ token: string; url: string }> = {
        success: true,
        data: {
          token: jwt,
          url: livekitUrl,
        },
        timestamp: Date.now(),
      };

      return response;
    });

    // Get system configuration
    fastify.get('/config', async () => {
      // In production, this would come from database
      const systemConfig: SystemConfig = {
        cameras: [
          { id: 'cam-1', name: 'Camera 1', enabled: true, position: 'wide' },
          { id: 'cam-2', name: 'Camera 2', enabled: true, position: 'close' },
          { id: 'cam-3', name: 'Camera 3', enabled: true, position: 'medium' },
          { id: 'cam-4', name: 'Camera 4', enabled: true, position: 'overhead' },
          { id: 'cam-5', name: 'Camera 5', enabled: true, position: 'side' },
        ],
        policy: {
          minHoldSec: 2.0,
          cooldownSec: 4.0,
          deltaSThreshold: 0.15,
          maxShotDurationSec: 15.0,
          enableHysteresis: true,
          enableCooldown: true,
          enableSpeechAlign: true,
        },
        vlm: {
          enabled: true,
          model: 'moondream',
          intervalMs: 700,
        },
        yolo: {
          model: 'yolov8n',
          confidenceThreshold: 0.5,
        },
        whisper: {
          model: 'base.en',
          language: 'en',
        },
        narration: {
          enabled: true,
          voiceId: 'eleven_monica',
          maxWords: 12,
        },
      };

      const response: ApiResponse<SystemConfig> = {
        success: true,
        data: systemConfig,
        timestamp: Date.now(),
      };

      return response;
    });

    // Serve camera app for phones
    fastify.get('/camera', async (request, reply) => {
      const filePath = path.join(process.cwd(), 'web-obs/public/camera.html');
      const html = fs.readFileSync(filePath, 'utf-8');
      reply.type('text/html').send(html);
    });

    // Serve simple camera test page
    fastify.get('/camera-test', async (request, reply) => {
      const filePath = path.join(process.cwd(), 'web-obs/public/camera-test.html');
      const html = fs.readFileSync(filePath, 'utf-8');
      reply.type('text/html').send(html);
    });

    // WebSocket endpoint for real-time events
    fastify.get('/ws', { websocket: true }, (connection, req) => {
      fastify.log.info('WebSocket client connected');

      // Subscribe to Redis channels and forward to WebSocket
      const subscriber = createClient({ url: config.redis.url });

      subscriber.connect().then(() => {
        // Subscribe to all event streams
        subscriber.subscribe('switch.cmd', (message) => {
          const event: WSEvent = {
            type: 'switch',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });

        subscriber.subscribe('scores.stream', (message) => {
          const event: WSEvent = {
            type: 'score',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });

        subscriber.subscribe('narration.stream', (message) => {
          const event: WSEvent = {
            type: 'narration',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });

        subscriber.subscribe('program.changed', (message) => {
          const event: WSEvent = {
            type: 'status',
            payload: JSON.parse(message),
            timestamp: Date.now(),
          };
          connection.socket.send(JSON.stringify(event));
        });
      });

      connection.socket.on('close', () => {
        fastify.log.info('WebSocket client disconnected');
        subscriber.quit();
      });

      connection.socket.on('error', (err) => {
        fastify.log.error({ err }, 'WebSocket error');
      });
    });

    // Start server
    await fastify.listen({
      port: config.server.port,
      host: config.server.host,
    });

    const protocol = config.server.useHttps ? 'https' : 'http';
    fastify.log.info(`API Gateway running on ${protocol}://0.0.0.0:${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

const shutdown = async () => {
  fastify.log.info('Shutting down...');
  await redisClient.quit();
  await redisSubscriber.quit();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
