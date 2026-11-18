
import { sendSms } from "./africasTalking.js";

export async function sendFarmerSms({
  phone,
  message,
  requestId,
}) {
  try {
    const response = await sendSms({
      to: phone,
      message,
    });

    const recipients =
      response?.SMSMessageData?.Recipients ?? [];

    // We send to one recipient per request.
    const recipient = recipients[0];

    const statusCode = Number(recipient?.statusCode);

    const success = [100, 101, 102].includes(statusCode);

    return {
      success,
      messageId: recipient?.messageId ?? null,
      status: recipient?.status ?? "Unknown",
      statusCode: recipient?.statusCode ?? null,
      providerResponse: response?.SMSMessageData?.Message ?? null,
      requestId: requestId ?? null,
    };

  } catch (error) {
  console.error("[AgriMama SMS] PROVIDER EXCEPTION:", {
    message: error.message,
    code: error.code,
    status: error.response?.status,
    response: error.response?.data,
    stack: error.stack,
  });

  return {
    success: false,
    error: error.message,
    errorCode: error.code ?? null,
    providerStatus: error.response?.status ?? null,
    providerError: error.response?.data?.SMSMessageData?.Message
      ?? error.response?.data?.message
      ?? null,
    requestId: requestId ?? null,
  };
}
}
