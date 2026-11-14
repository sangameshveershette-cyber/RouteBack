import 'dotenv/config';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db/adapter.ts';
import { seedDemoDatabase } from './server/db/seed.ts';
import { authRouter } from './server/routes/authRoutes.ts';
import { vehicleRouter } from './server/routes/vehicleRoutes.ts';
import { tripAndShipmentRouter } from './server/routes/tripAndShipmentRoutes.ts';
import { bookingAndTrackingRouter } from './server/routes/bookingAndTrackingRoutes.ts';

async function bootstrap() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Connect database (MongoDB via Mongoose or persistent local Mongo-compatible adapter)
  const dbMode = await db.connect();
  await seedDemoDatabase();

  // Serve uploaded images/documents safely
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

  // Health & Maps configuration endpoints
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'RouteBack API',
      dbMode,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/config/maps', (_req, res) => {
    const key =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({
      hasKey: Boolean(key && !key.includes('MY_')),
      apiKey: key && !key.includes('MY_') ? key : '',
    });
  });

  // Mount API routes
  app.use('/api/auth', authRouter);
  app.use('/api/vehicles', vehicleRouter);
  app.use('/api', tripAndShipmentRouter);
  app.use('/api', bookingAndTrackingRouter);

  // API 404 handler
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[RouteBack] Full-stack server running on http://0.0.0.0:${PORT} (DB mode: ${dbMode})`);
  });
}

bootstrap().catch((err) => {
  console.error('[RouteBack Fatal Bootstrap Error]', err);
  process.exit(1);
});
