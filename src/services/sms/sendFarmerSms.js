
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

    const recipient = recipients.find(
      (item) => item.number === phone
    );

    return {
      success: Boolean(
        recipient &&
        [100, 101, 102].includes(Number(recipient.statusCode))
      ),
      messageId: recipient?.messageId ?? null,
      status: recipient?.status ?? "Unknown",
      statusCode: recipient?.statusCode ?? null,
      requestId: requestId ?? null,
    };
  } catch (error) {
    // Avoid logging API credentials or the full provider response.
    return {
      success: false,
      error: error.message,
      requestId: requestId ?? null,
    };
  }
}
