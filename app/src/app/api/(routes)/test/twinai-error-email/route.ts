import { NextRequest, NextResponse } from "next/server";
import { mailService } from "../../../services/mailService";
import { withRetry } from "../../../utils/retryHelper";

/**
 * Test endpoint for TwinAI error email notifications
 * 
 * Usage:
 * POST /api/test/twinai-error-email
 * 
 * Body (optional):
 * {
 *   "testType": "direct" | "retry" | "both",
 *   "conversationId": "optional-conversation-id",
 *   "userId": "optional-user-id",
 *   "userName": "Test User",
 *   "filePath": "users/2025/11/audio-uploads/test/recording-123.mp4"
 * }
 */
// Test-only endpoint: never expose in production (it can trigger e-mails).
function blockedInProduction(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const blocked = blockedInProduction();
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const {
      testType = "both", // "direct", "retry", or "both"
      conversationId,
      userId,
      userName = "Test User",
      filePath,
    } = body;

    const results: any = {
      success: true,
      tests: [],
    };

    // Test 1: Direct email test
    if (testType === "direct" || testType === "both") {
      try {
        const testError = new Error("Test error: TwinAI workflow failed");
        testError.stack = "Error: Test error\n    at testEndpoint (test.ts:1:1)";

        await mailService.sendTwinAIErrorNotification({
          error: testError,
          operation: "TwinAI: Test Operation (Direct)",
          conversationId: conversationId || "test-conversation-id",
          userId: userId || "test-user-id",
          userName,
          filePath: filePath || "users/2025/11/audio-uploads/test/recording-test.mp4",
          attempts: 5,
          httpStatus: 500,
          errorResponse: JSON.stringify({ error: "Internal Server Error", details: "Test error response" }),
          errorStack: testError.stack,
        });

        results.tests.push({
          type: "direct",
          status: "success",
          message: "Direct email sent successfully",
        });
      } catch (error: any) {
        results.tests.push({
          type: "direct",
          status: "error",
          message: error.message,
        });
        results.success = false;
      }
    }

    // Test 2: Retry helper test (simulates actual retry failure)
    if (testType === "retry" || testType === "both") {
      try {
        // This will fail after retries and trigger the email
        await withRetry(
          async () => {
            // Simulate a failing API call
            const error: any = new Error("Test: TwinAI API returned 500 Internal Server Error");
            error.status = 500;
            error.response = { status: 500, data: { error: "Test failure" } };
            throw error;
          },
          {
            maxRetries: 2, // Small number for quick testing
            initialDelayMs: 500, // Short delay for quick testing
            timeoutMs: 5000,
            operation: "TwinAI: Test Operation (Retry)",
            conversationId: conversationId || "test-conversation-id",
            userId: userId || "test-user-id",
            userName,
            filePath: filePath || "users/2025/11/audio-uploads/test/recording-test.mp4",
            sendErrorEmail: true,
          }
        );

        // Should never reach here
        results.tests.push({
          type: "retry",
          status: "unexpected",
          message: "Retry should have failed but didn't",
        });
      } catch (error: any) {
        // Expected to fail - email should have been sent
        results.tests.push({
          type: "retry",
          status: "success",
          message: `Retry failed as expected. Error: ${error.message}. Email should have been sent.`,
        });
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: "Test endpoint failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to show usage instructions
 */
export async function GET() {
  const blocked = blockedInProduction();
  if (blocked) return blocked;
  return NextResponse.json(
    {
      message: "TwinAI Error Email Test Endpoint",
      usage: {
        method: "POST",
        url: "/api/test/twinai-error-email",
        body: {
          testType: "direct | retry | both (default: both)",
          conversationId: "optional",
          userId: "optional",
          userName: "optional (default: 'Test User')",
          filePath: "optional",
        },
        examples: [
          {
            description: "Test direct email only",
            body: { testType: "direct" },
          },
          {
            description: "Test retry helper (will fail and send email)",
            body: { testType: "retry" },
          },
          {
            description: "Test both (recommended)",
            body: {
              testType: "both",
              conversationId: "abc-123",
              userId: "user-456",
              userName: "John Doe",
              filePath: "users/2025/11/audio-uploads/test/recording.mp4",
            },
          },
        ],
      },
      note: "Check support@mytechpartner.nl inbox for test emails",
    },
    { status: 200 }
  );
}

