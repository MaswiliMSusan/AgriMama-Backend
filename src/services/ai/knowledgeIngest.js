
import "dotenv/config";

const BASE_URL = (
    process.env.AI_SANDBOX_BASE_URL ||
    "https://gateway.sandbox.codeforafrica.org"
).replace(/\/+$/, "");

const KNOWLEDGE_BASE_ID =
    process.env.AI_SANDBOX_KNOWLEDGE_BASE_ID;

const API_KEY = process.env.AI_SANDBOX_API_KEY;

export async function ingestAgriMamaDocument({
    filename,
    content,
    contentType = "text/plain",
}) {
    if (!API_KEY) {
        throw new Error("AI_SANDBOX_API_KEY is not configured.");
    }

    if (!KNOWLEDGE_BASE_ID) {
        throw new Error(
            "AI_SANDBOX_KNOWLEDGE_BASE_ID is not configured."
        );
    }

    if (!filename || !filename.trim()) {
        throw new Error("A document filename is required.");
    }

    if (!content || !content.length) {
        throw new Error("Document content is required.");
    }

    // The ingestion API expects base64-encoded file content.
    const base64Content = Buffer.from(content).toString("base64");

    const response = await fetch(`${BASE_URL}/v1/rag/ingest`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            file: {
                filename: filename.trim(),
                content: base64Content,
                content_type: contentType,
            },
            ingest_options: {

                vector_store: {
                    custom_llm_provider: "bedrock",
                    vector_store_id: KNOWLEDGE_BASE_ID,
                    aws_region_name: "eu-west-2",
                },

            },
        }),
    });

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Knowledge ingestion failed (${response.status}): ` +
            responseText.slice(0, 1500)
        );
    }

    let data;

    try {
        data = JSON.parse(responseText);
    } catch {
        throw new Error(
            "Knowledge ingestion returned invalid JSON."
        );
    }

    return data;
}
