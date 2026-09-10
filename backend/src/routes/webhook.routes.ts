import { Router, Request, Response } from 'express';
import { config } from '../config';
import { ApiResponseHelper } from '../utils/apiResponse';
import { coreBankingService } from '../services/coreBanking.service';

const router = Router();

/**
 * Verify the webhook signature header. In production this should use a proper
 * HMAC signature verification against the shared secret.
 */
function verifyWebhookSecret(req: Request): boolean {
  const secret = req.headers['x-webhook-secret'];
  return !!secret && secret === config.coreBankingWebhookSecret;
}

function handleError(res: Response, error: unknown, fallback: string) {
  console.error('Webhook error:', error);
  ApiResponseHelper.error(res, (error as Error).message || fallback, 500);
}

// POST /webhooks/core-banking/transactions
router.post('/core-banking/transactions', async (req: Request, res: Response) => {
  if (!verifyWebhookSecret(req)) {
    ApiResponseHelper.unauthorized(res, 'Invalid webhook signature');
    return;
  }

  try {
    const event = req.body;
    if (!event?.customerId || !event?.transactionId || !event?.transactionType) {
      ApiResponseHelper.error(res, 'Invalid webhook payload', 400);
      return;
    }

    const results = await coreBankingService.processTransaction(event);
    ApiResponseHelper.success(res, {
      processed: results,
      totalCredited: results.filter((r) => r.created).length,
    }, 'Transaction processed');
  } catch (error) {
    handleError(res, error, 'Failed to process transaction webhook');
  }
});

// POST /webhooks/core-banking/account-opened
router.post('/core-banking/account-opened', async (req: Request, res: Response) => {
  if (!verifyWebhookSecret(req)) {
    ApiResponseHelper.unauthorized(res, 'Invalid webhook signature');
    return;
  }

  try {
    const event = req.body;
    if (!event?.customerId || !event?.accountId) {
      ApiResponseHelper.error(res, 'Invalid webhook payload', 400);
      return;
    }

    // Account opening is modelled the same as any qualifying action:
    // trigger = ACCOUNT_OPENED negotiation is inferred from transaction type
    const results = await coreBankingService.processTransaction({
      customerId: event.customerId,
      accountId: event.accountId,
      transactionId: event.transactionId || `ACC-OPEN-${event.accountId}-${Date.now()}`,
      transactionType: 'ACCOUNT_OPENED',
      amount: event.amount || 0,
      currency: event.currency,
      occurredAt: event.occurredAt,
    });

    ApiResponseHelper.success(res, {
      processed: results,
      totalCredited: results.filter((r) => r.created).length,
    }, 'Account opening processed');
  } catch (error) {
    handleError(res, error, 'Failed to process account opening webhook');
  }
});

export default router;