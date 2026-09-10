import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createClaimSchema,
  claimIdSchema,
  claimQuerySchema,
  addDocumentSchema,
  verifyDocumentSchema,
  reviewClaimSchema,
} from '../validations';
import { AuthRequest } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { claimService } from '../services/claim.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

const getCustomerId = (req: Request): string | undefined => {
  const header = req.headers['x-customer-id'];
  if (header) return String(header);
  const query = req.query.customerId;
  if (typeof query === 'string') return query;
  return undefined;
};

// POST /claims - Create a claim for a winner (customer or coordinator)
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR', 'COMPLIANCE_OFFICER', 'READ_ONLY'),
  validate(createClaimSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { winnerId } = req.body;
      const customerId = getCustomerId(req);
      const claim = await claimService.createClaim(winnerId, customerId);
      ApiResponseHelper.created(res, claim, 'Claim submitted');
    } catch (error) {
      handleError(res, error, 'Failed to create claim');
    }
  }
);

// GET /claims - List claims (admin)
router.get(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR', 'COMPLIANCE_OFFICER'),
  validate(claimQuerySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as any;
      const { data, total, page, limit } = await claimService.listClaims(query);
      ApiResponseHelper.paginated(res, data, total, page, limit);
    } catch (error) {
      handleError(res, error, 'Failed to fetch claims');
    }
  }
);

// GET /claims/:id - Get claim detail (admin)
router.get(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR', 'COMPLIANCE_OFFICER'),
  validate(claimIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const claim = await claimService.getClaim(req.params.id);
      ApiResponseHelper.success(res, claim);
    } catch (error) {
      handleError(res, error, 'Failed to fetch claim');
    }
  }
);

// POST /claims/:id/documents - Attach a document to a claim
router.post(
  '/:id/documents',
  authenticate,
  validate(addDocumentSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const document = await claimService.addDocument(req.params.id, req.body);
      ApiResponseHelper.created(res, document, 'Document uploaded');
    } catch (error) {
      handleError(res, error, 'Failed to upload document');
    }
  }
);

// PUT /claims/:id/review - Approve or reject a claim
router.put(
  '/:id/review',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR', 'COMPLIANCE_OFFICER'),
  validate(reviewClaimSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, decisionNote } = req.body;
      const claim = await claimService.reviewClaim(req.params.id, status, decisionNote, req.user!.userId);
      ApiResponseHelper.success(res, claim, `Claim ${status.toLowerCase()}`);
    } catch (error) {
      handleError(res, error, 'Failed to review claim');
    }
  }
);

// PUT /claims/:id/fulfill - Mark a claim as fulfilled
router.put(
  '/:id/fulfill',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR'),
  validate(claimIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const claim = await claimService.fulfillClaim(req.params.id, req.user!.userId);
      ApiResponseHelper.success(res, claim, 'Claim fulfilled');
    } catch (error) {
      handleError(res, error, 'Failed to fulfill claim');
    }
  }
);

// PUT /documents/:id/verify - Verify or reject a document
router.put(
  '/documents/:id/verify',
  authenticate,
  authorize('SUPER_ADMIN', 'PRIZE_COORDINATOR', 'COMPLIANCE_OFFICER'),
  validate(verifyDocumentSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { status, notes } = req.body;
      const document = await claimService.verifyDocument(req.params.id, status, notes);
      ApiResponseHelper.success(res, document, 'Document verified');
    } catch (error) {
      handleError(res, error, 'Failed to verify document');
    }
  }
);

export default router;