export async function submitFeedback(params: {
  runId: string;
  score?: "thumbs_up" | "thumbs_down";
  text?: string;
}): Promise<Response | undefined> {
  if (!params.score && !params.text) {
    console.error(
      "[TCC] Cannot submit feedback: at least one of 'score' or 'text' must be provided"
    );
    return;
  }

  if (params.text && params.text.length > 2000) {
    console.error(
      `[TCC] Cannot submit feedback: text length (${params.text.length}) exceeds maximum of 2000 characters`
    );
    return;
  }

  const { getTCCApiKey, getTCCFeedbackUrl } = await import("./config");

  const feedbackUrl = getTCCFeedbackUrl();
  const apiKey = getTCCApiKey();

  if (!apiKey) {
    console.error(
      "[TCC] Cannot submit feedback: TCC_API_KEY environment variable is not set"
    );
    return;
  }

  try {
    const response = await fetch(feedbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        runId: params.runId,
        score: params.score,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[TCC] Failed to submit feedback: ${response.status} ${errorText}`
      );
    }

    return response;
  } catch (error) {
    console.error("[TCC] Error submitting feedback:", error);
    return undefined;
  }
}
