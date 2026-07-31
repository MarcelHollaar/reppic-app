import { NextRequest } from "next/server";
import { WebhookController } from "../../controllers/webhookController";

export async function POST(req: NextRequest) {
  return WebhookController.handleWebhook(req);
}
