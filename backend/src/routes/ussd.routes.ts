import { Router, Request, Response } from 'express';
import { ApiResponseHelper } from '../utils/apiResponse';
import { timingSafeEqualStr } from '../utils/security';
import { config } from '../config';
import { ussdService } from '../services/ussd.service';

const router = Router();

// POST /ussd - Standard USSD callback from the telecom carrier
router.post('/', async (req: Request, res: Response) => {
  const gatewaySecret = req.headers['x-gateway-secret'];
  if (typeof gatewaySecret !== 'string' || !timingSafeEqualStr(gatewaySecret, config.ussdGatewaySecret)) {
    ApiResponseHelper.unauthorized(res, 'Invalid gateway credentials');
    return;
  }

  try {
    const { sessionId, phoneNumber, text, customerId } = req.body;

    if (!sessionId || !phoneNumber) {
      ApiResponseHelper.error(res, 'sessionId and phoneNumber are required', 400);
      return;
    }

    const result = await ussdService.handle({
      sessionId: String(sessionId),
      phoneNumber: String(phoneNumber),
      text: text || '',
      customerId: customerId ? String(customerId) : undefined,
    });

    // USSD gateways expect the raw "CON ..." / "END ..." string as the body
    res.status(200).send(result.response);
  } catch (error) {
    console.error('USSD route error:', error);
    ApiResponseHelper.error(res, 'USSD session error', 500);
  }
});

export default router;