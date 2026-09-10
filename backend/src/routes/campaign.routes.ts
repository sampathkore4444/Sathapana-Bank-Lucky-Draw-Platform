import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignIdSchema,
  approvalDecisionSchema,
  campaignApprovalQuerySchema,
} from '../validations';
import { AuthRequest, CampaignQuery } from '../types';
import { ApiResponseHelper } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { campaignService } from '../services/campaign.service';

const router = Router();

const handleError = (res: Response, error: unknown, fallback: string) => {
  if (error instanceof AppError) {
    ApiResponseHelper.error(res, error.message, error.statusCode);
  } else {
    ApiResponseHelper.error(res, fallback, 500);
  }
};

// GET /campaigns - List all campaigns
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query as CampaignQuery;
    const { data, total, page, limit } = await campaignService.list(query);
    ApiResponseHelper.paginated(res, data, total, page, limit);
  } catch (error) {
    handleError(res, error, 'Failed to fetch campaigns');
  }
});

// GET /campaigns/approvals/list - List campaigns in the approval workflow
router.get(
  '/approvals/list',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'MARKETING_MANAGER', 'COMPLIANCE_OFFICER'),
  validate(campaignApprovalQuerySchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const query = req.query as CampaignQuery;
      const { data, total, page, limit } = await campaignService.listForApproval(query);
      ApiResponseHelper.paginated(res, data, total, page, limit);
    } catch (error) {
      handleError(res, error, 'Failed to fetch approval queue');
    }
  }
);

// GET /campaigns/:id - Get campaign by ID
router.get('/:id', authenticate, validate(campaignIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const campaign = await campaignService.getById(req.params.id);
    ApiResponseHelper.success(res, campaign);
  } catch (error) {
    handleError(res, error, 'Failed to fetch campaign');
  }
});

// POST /campaigns - Create new campaign
router.post(
  '/',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(createCampaignSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await campaignService.create(req.body, req.user!.userId);
      ApiResponseHelper.created(res, campaign, 'Campaign created successfully');
    } catch (error) {
      handleError(res, error, 'Failed to create campaign');
    }
  }
);

// PUT /campaigns/:id - Update campaign
router.put(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(updateCampaignSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await campaignService.update(req.params.id, req.body, req.user!.userId);
      ApiResponseHelper.success(res, campaign, 'Campaign updated successfully');
    } catch (error) {
      handleError(res, error, 'Failed to update campaign');
    }
  }
);

// DELETE /campaigns/:id - Delete campaign (only DRAFT)
router.delete(
  '/:id',
  authenticate,
  authorize('SUPER_ADMIN'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      await campaignService.delete(req.params.id);
      ApiResponseHelper.success(res, null, 'Campaign deleted successfully');
    } catch (error) {
      handleError(res, error, 'Failed to delete campaign');
    }
  }
);

// POST /campaigns/:id/activate - Activate campaign
router.post(
  '/:id/activate',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER', 'MARKETING_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await campaignService.activate(req.params.id, req.user!.userId);
      ApiResponseHelper.success(res, updated, 'Campaign activated successfully');
    } catch (error) {
      handleError(res, error, 'Failed to activate campaign');
    }
  }
);

// POST /campaigns/:id/pause - Pause campaign
router.post(
  '/:id/pause',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await campaignService.pause(req.params.id, req.user!.userId);
      ApiResponseHelper.success(res, updated, 'Campaign paused');
    } catch (error) {
      handleError(res, error, 'Failed to pause campaign');
    }
  }
);

// POST /campaigns/:id/close - Close campaign
router.post(
  '/:id/close',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await campaignService.close(req.params.id, req.user!.userId);
      ApiResponseHelper.success(res, updated, 'Campaign closed');
    } catch (error) {
      handleError(res, error, 'Failed to close campaign');
    }
  }
);

// GET /campaigns/:id/stats - Get campaign statistics
router.get('/:id/stats', authenticate, validate(campaignIdSchema), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await campaignService.getStats(req.params.id);
    ApiResponseHelper.success(res, stats);
  } catch (error) {
    handleError(res, error, 'Failed to fetch campaign stats');
  }
});

// POST /campaigns/:id/duplicate - Duplicate an existing campaign
router.post(
  '/:id/duplicate',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const campaign = await campaignService.duplicate(req.params.id, req.user!.userId);
      ApiResponseHelper.created(res, campaign, 'Campaign duplicated successfully');
    } catch (error) {
      handleError(res, error, 'Failed to duplicate campaign');
    }
  }
);

// POST /campaigns/:id/submit - Submit for multi-level approval
router.post(
  '/:id/submit',
  authenticate,
  authorize('SUPER_ADMIN', 'CAMPAIGN_MANAGER'),
  validate(campaignIdSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await campaignService.submitForApproval(req.params.id, req.user!.userId);
      ApiResponseHelper.success(res, updated, 'Campaign submitted for approval');
    } catch (error) {
      handleError(res, error, 'Failed to submit campaign for approval');
    }
  }
);

// POST /campaigns/:id/approval/:level/approve - Approve at a given level
router.post(
  '/:id/approval/:level/approve',
  authenticate,
  validate(approvalDecisionSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await campaignService.approveCampaign(
        req.params.id,
        Number(req.params.level),
        req.user!.userId,
        req.user!.role,
        req.body.comment
      );
      ApiResponseHelper.success(res, updated, 'Approval level approved');
    } catch (error) {
      handleError(res, error, 'Failed to approve campaign');
    }
  }
);

// POST /campaigns/:id/approval/:level/reject - Reject at a given level
router.post(
  '/:id/approval/:level/reject',
  authenticate,
  validate(approvalDecisionSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const updated = await campaignService.rejectCampaign(
        req.params.id,
        Number(req.params.level),
        req.user!.userId,
        req.user!.role,
        req.body.comment
      );
      ApiResponseHelper.success(res, updated, 'Approval level rejected');
    } catch (error) {
      handleError(res, error, 'Failed to reject campaign');
    }
  }
);

export default router;