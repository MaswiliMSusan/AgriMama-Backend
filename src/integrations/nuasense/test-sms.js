
import "dotenv/config";
import { sendSms } from "../../services/sms/africasTalking.js";

async function main() {
  if (process.env.AT_ENVIRONMENT !== "sandbox") {
    throw new Error(
      "Safety check failed: AT_ENVIRONMENT must be sandbox."
    );
  }

  const recipient = process.env.AT_TEST_PHONE;

  if (!recipient) {
    throw new Error(
      "Missing AT_TEST_PHONE in .env. Use a test recipient in international format."
    );
  }

  console.log("Sending sandbox SMS...");
  console.log(`Recipient: ${recipient}`);
  console.log("Message: AgriMama SMS integration test.");

  const response = await sendSms({
    to: recipient,
    message: "AgriMama SMS integration test. No action is required.",
  });

  console.log("\nAfrica's Talking response:");
  console.dir(response, { depth: 5 });
}

main().catch((error) => {
  console.error("Sandbox SMS test failed:");
  console.error(error.message);
  process.exitCode = 1;
});
