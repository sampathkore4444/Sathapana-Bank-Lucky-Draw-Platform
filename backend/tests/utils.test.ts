import { ApiResponseHelper } from '../src/utils/apiResponse';

describe('ApiResponseHelper', () => {
  let mockRes: any;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('success', () => {
    it('should return success response with data', () => {
      const data = { id: 1, name: 'Test' };
      
      ApiResponseHelper.success(mockRes, data, 'Success message');

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'Success message',
      });
    });

    it('should return success response with custom status code', () => {
      const data = { id: 1 };
      
      ApiResponseHelper.success(mockRes, data, undefined, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  describe('created', () => {
    it('should return 201 status', () => {
      const data = { id: 1, name: 'New Item' };
      
      ApiResponseHelper.created(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message: 'Created successfully',
      });
    });
  });

  describe('error', () => {
    it('should return error response', () => {
      ApiResponseHelper.error(mockRes, 'Something went wrong', 400);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Something went wrong',
      });
    });

    it('should use default status code 400', () => {
      ApiResponseHelper.error(mockRes, 'Error');

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('notFound', () => {
    it('should return 404 with resource name', () => {
      ApiResponseHelper.notFound(mockRes, 'User');

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should use default resource name', () => {
      ApiResponseHelper.notFound(mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Resource not found',
      });
    });
  });

  describe('unauthorized', () => {
    it('should return 401', () => {
      ApiResponseHelper.unauthorized(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
    });
  });

  describe('forbidden', () => {
    it('should return 403', () => {
      ApiResponseHelper.forbidden(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
      });
    });
  });

  describe('paginated', () => {
    it('should return paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      
      ApiResponseHelper.paginated(mockRes, data, 100, 1, 10);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10,
        },
      });
    });

    it('should calculate total pages correctly', () => {
      const data = [{ id: 1 }];
      
      ApiResponseHelper.paginated(mockRes, data, 25, 3, 10);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            totalPages: 3,
          }),
        })
      );
    });
  });
});
