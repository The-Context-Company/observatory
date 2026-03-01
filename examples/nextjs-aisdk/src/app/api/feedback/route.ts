import { submitFeedback } from "@contextcompany/otel";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, score, comment } = body;

    if (!runId || typeof runId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid runId" },
        { status: 400 }
      );
    }

    if (score && !["thumbs_up", "thumbs_down"].includes(score)) {
      return NextResponse.json(
        { error: "Invalid score. Must be 'thumbs_up' or 'thumbs_down'" },
        { status: 400 }
      );
    }

    // TCC: Submit feedback to link user rating/comment to this AI response
    await submitFeedback({
      runId, // Links feedback to the specific AI call
      score: score || undefined,
      text: comment || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}
