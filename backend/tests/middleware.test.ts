import jwt from 'jsonwebtoken';
import { authenticate, authorize, generateToken } from '../src/middleware/auth';
import { ApiResponseHelper } from '../src/utils/apiResponse';

// Mock config
jest.mock('../src/config', () => ({
  config: {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '24h',
  },
}));

describe('Auth Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should call next() with valid token', () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'SUPER_ADMIN' },
        'test-secret'
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.userId).toBe('user-1');
    });

    it('should return 401 without token', () => {
      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'No token provided',
        })
      );
    });

    it('should return 401 with invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid-token';

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid token',
        })
      );
    });

    it('should handle expired token', () => {
      // Create a token that's already expired by setting iat in the past
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@test.com', role: 'SUPER_ADMIN', iat: Math.floor(Date.now() / 1000) - 100000 },
        'test-secret',
        { expiresIn: '1s' }
      );
      mockReq.headers.authorization = `Bearer ${token}`;

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 with malformed authorization header', () => {
      mockReq.headers.authorization = 'InvalidFormat';

      authenticate(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('authorize', () => {
    it('should call next() with authorized role', () => {
      mockReq.user = { userId: 'user-1', role: 'SUPER_ADMIN' };
      
      const middleware = authorize('SUPER_ADMIN', 'ADMIN');
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 403 with unauthorized role', () => {
      mockReq.user = { userId: 'user-1', role: 'READ_ONLY' };
      
      const middleware = authorize('SUPER_ADMIN', 'ADMIN');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Insufficient permissions',
        })
      );
    });

    it('should return 401 without user', () => {
      const middleware = authorize('SUPER_ADMIN');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Not authenticated',
        })
      );
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'SUPER_ADMIN',
      };

      const token = generateToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, 'test-secret') as any;
      expect(decoded.userId).toBe('user-1');
      expect(decoded.email).toBe('test@test.com');
      expect(decoded.role).toBe('SUPER_ADMIN');
    });

    it('should include expiration', () => {
      const payload = {
        userId: 'user-1',
        email: 'test@test.com',
        role: 'SUPER_ADMIN',
      };

      const token = generateToken(payload);
      const decoded = jwt.verify(token, 'test-secret') as any;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });
});
