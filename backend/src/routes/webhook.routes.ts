import { Router, Request, Response } from 'express';
import { config } from '../config';
import { ApiResponseHelper } from '../utils/apiResponse';
import { verifyHmacSignature, timingSafeEqualStr } from '../utils/security';
import { coreBankingService } from '../services/coreBanking.service';

const router = Router();

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Verify the webhook caller using a constant-time HMAC-SHA256 signature header
 * ("sha256=<hex>") computed over the exact raw request body. The legacy
 * X-Webhook-Secret header is still accepted with a constant-time compare for
 * backwards compatibility, but callers are expected to migrate to signatures.
 */
function verifyWebhookSignature(req: RawBodyRequest): boolean {
  const signature = req.headers['x-webhook-signature'];
  const rawBody = req.rawBody?.toString('utf8') ?? '';

  if (typeof signature === 'string' && verifyHmacSignature(signature, rawBody, config.coreBankingWebhookSecret)) {
    return true;
  }

  const secret = req.headers['x-webhook-secret'];
  if (typeof secret === 'string' && timingSafeEqualStr(secret, config.coreBankingWebhookSecret)) {
    return true;
  }

  return false;
}

function handleError(res: Response, error: unknown, fallback: string) {
  console.error('Webhook error:', error);
  ApiResponseHelper.error(res, fallback, 500);
}

// POST /webhooks/core-banking/transactions
router.post('/core-banking/transactions', async (req: RawBodyRequest, res: Response) => {
  if (!verifyWebhookSignature(req)) {
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
router.post('/core-banking/account-opened', async (req: RawBodyRequest, res: Response) => {
  if (!verifyWebhookSignature(req)) {
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