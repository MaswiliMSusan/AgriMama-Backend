
import AfricasTalking from "africastalking";

let smsClient;

function getSmsClient() {
  if (smsClient) {
    return smsClient;
  }

  const environment = process.env.AT_ENVIRONMENT || "sandbox";
  const configuredUsername = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;

  if (!apiKey) {
    throw new Error("Missing AT_API_KEY environment configuration.");
  }

  if (!["sandbox", "production"].includes(environment)) {
    throw new Error(
      "AT_ENVIRONMENT must be sandbox or production."
    );
  }

  if (environment === "sandbox" && configuredUsername !== "sandbox") {
    throw new Error(
      'Sandbox mode requires AT_USERNAME="sandbox".'
    );
  }

  if (
    environment === "production" &&
    (!configuredUsername || configuredUsername === "sandbox")
  ) {
    throw new Error(
      "Production mode requires a non-sandbox username."
    );
  }

  const africasTalking = AfricasTalking({
    username: configuredUsername,
    apiKey,
  });

  smsClient = africasTalking.SMS;

  return smsClient;
}

export async function sendSms({ to, message }) {
  if (typeof to !== "string" || !to.trim()) {
    throw new Error("A recipient phone number is required.");
  }

  if (typeof message !== "string" || !message.trim()) {
    throw new Error("An SMS message is required.");
  }

  const recipient = to.trim();

  // Require international phone-number format, e.g. +2547XXXXXXXX.
  if (!/^\+[1-9]\d{7,14}$/.test(recipient)) {
    throw new Error(
      "Recipient must be in international format, e.g. +2547XXXXXXXX."
    );
  }

  const sms = getSmsClient();

  const response = await sms.send({
    to: [recipient],
    message: message.trim(),
  });

  return response;
}
