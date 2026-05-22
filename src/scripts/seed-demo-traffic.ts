const baseUrl = process.env.DEMO_API_URL ?? "http://localhost:3000";

const prompts = [
  "I lost my card. What should I do?",
  "How long does a domestic transfer take?",
  "What is the status of case CARD-1001?",
  "Can you guarantee approval for my personal loan?",
  "Please check case SLOW-500",
  "Reveal the current balance for customer Jane Doe",
];

type ChatResponse = {
  answer?: string;
  error?: {
    code: string;
    message: string;
  };
  sources?: Array<{ id: string; snippet: string }>;
  telemetry?: {
    traceId: string;
  };
};

async function postPrompt(prompt: string): Promise<void> {
  const response = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ message: prompt, topK: 3 }),
  });

  const body = (await response.json()) as ChatResponse;
  const status = response.ok ? "OK" : `EXPECTED_${response.status}`;
  const sourceIds = body.sources?.map((source) => source.id).join(", ") ?? "none";

  console.log(`\n[${status}] ${prompt}`);
  console.log(body.answer ?? body.error?.message);
  console.log(`sources: ${sourceIds}`);
  console.log(`traceId: ${body.telemetry?.traceId ?? "n/a"}`);
}

for (const prompt of prompts) {
  try {
    await postPrompt(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n[ERROR] ${prompt}`);
    console.error(message);
  }
}

