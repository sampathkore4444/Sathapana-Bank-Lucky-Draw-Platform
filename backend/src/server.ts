import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import prisma from './config/database';
import { logger, morganStream, requestLogger } from './config/logger';
import { healthCheck } from './services/healthCheck';
import { setupQueueHandlers } from './services/queueSetup';
import { sanitizeBody, sanitizeQuery, preventSQLInjection, preventPathTraversal } from './middleware/sanitization';
import { auditAuth, auditSensitiveOps, detectSuspiciousActivity, blockSuspiciousIPs } from './middleware/securityAudit';

// Import routes
import authRoutes from './routes/auth.routes';
import campaignRoutes from './routes/campaign.routes';
import entryRoutes from './routes/entry.routes';
import drawRoutes from './routes/draw.routes';
import prizeRoutes from './routes/prize.routes';
import winnerRoutes from './routes/winner.routes';
import adminRoutes from './routes/admin.routes';

// Create Express app
const app = express();

// ==================== SECURITY MIDDLEWARE ====================

// Security headers with CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS - Configure for production
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? [config.corsOrigin, 'https://sathapana-luckydraw.com']
      : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  })
);

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Compression
app.use(compression());

// Request logging with Winston
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev', { stream: morganStream }));
app.use(requestLogger);

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ==================== INPUT SANITIZATION ====================

// Sanitize input data
app.use(sanitizeBody);
app.use(sanitizeQuery);

// Prevent SQL injection (additional layer)
app.use(preventSQLInjection);

// Prevent path traversal
app.use(preventPathTraversal);

// ==================== SECURITY AUDIT ====================

// Block suspicious IPs
app.use(blockSuspiciousIPs);

// Detect suspicious activity
app.use(detectSuspiciousActivity);

// Audit authentication attempts
app.use(auditAuth);

// Audit sensitive operations
app.use(auditSensitiveOps);

// ==================== RATE LIMITING ====================

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Draw execution rate limiting (very strict)
const drawLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 draws per hour
  message: {
    success: false,
    error: 'Draw execution rate limit exceeded',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== HEALTH CHECK ====================

app.get('/health', async (req, res) => {
  try {
    const health = await healthCheck.check();
    
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
    });
  }
});

app.get('/ready', async (req, res) => {
  try {
    const health = await healthCheck.check();
    
    if (health.status === 'unhealthy') {
      res.status(503).json({ status: 'not ready', services: health.services });
    } else {
      res.json({ status: 'ready', services: health.services });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: 'Health check failed' });
  }
});

// ==================== ROUTES ====================

// Apply stricter rate limiting to specific routes
app.use(`${config.apiPrefix}/auth`, authLimiter, authRoutes);
app.use(`${config.apiPrefix}/draws`, drawLimiter, drawRoutes);

// Other routes with standard rate limiting
app.use(`${config.apiPrefix}/campaigns`, campaignRoutes);
app.use(`${config.apiPrefix}/entries`, entryRoutes);
app.use(`${config.apiPrefix}/prizes`, prizeRoutes);
app.use(`${config.apiPrefix}/winners`, winnerRoutes);
app.use(`${config.apiPrefix}/admin`, adminRoutes);

// ==================== ERROR HANDLING ====================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ==================== START SERVER ====================

// Register message queue consumers before starting the server
setupQueueHandlers();

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗\n║                                                              ║\n║   🎰 Sathapana Bank Lucky Draw Platform - Backend API       ║\n║                                                              ║\n║   Server:     http://localhost:${PORT}                          ║\n║   API Base:   http://localhost:${PORT}${config.apiPrefix}            ║\n║   Health:     http://localhost:${PORT}/health                    ║\n║   Environment: ${config.nodeEnv.padEnd(44)}║\n║                                                              ║\n╚══════════════════════════════════════════════════════════════╝\n  `);
});

export default app;
