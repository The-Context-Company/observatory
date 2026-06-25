"use client";

import { useState } from "react";

const exampleApiToken = process.env.NEXT_PUBLIC_TCC_EXAMPLE_API_TOKEN;

type FeedbackButtonsProps = {
  runId: string; // TCC: Unique ID linking feedback to specific AI response
};

export function FeedbackButtons({ runId }: FeedbackButtonsProps) {
  const [selectedScore, setSelectedScore] = useState<
    "thumbs_up" | "thumbs_down" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [comment, setComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const handleFeedback = async (score: "thumbs_up" | "thumbs_down") => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSelectedScore(score);

    try {
      // TCC: Submit feedback via API to link it to this AI response
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(exampleApiToken
            ? { "x-tcc-example-token": exampleApiToken }
            : {}),
        },
        body: JSON.stringify({ runId, score }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setSelectedScore(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!comment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);

    try {
      // TCC: Submit comment feedback via API
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(exampleApiToken
            ? { "x-tcc-example-token": exampleApiToken }
            : {}),
        },
        body: JSON.stringify({
          runId, // TCC: Links comment to specific AI response
          score: selectedScore || undefined,
          comment: comment.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit comment");
      }

      setShowCommentModal(false);
      setComment("");
    } catch (error) {
      console.error("Error submitting comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => handleFeedback("thumbs_up")}
          disabled={isSubmitting}
          className={`rounded-md p-1.5 transition-colors ${
            selectedScore === "thumbs_up"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label="Thumbs up"
          title="Good response"
        >
          👍
        </button>
        <button
          onClick={() => handleFeedback("thumbs_down")}
          disabled={isSubmitting}
          className={`rounded-md p-1.5 transition-colors ${
            selectedScore === "thumbs_down"
              ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label="Thumbs down"
          title="Bad response"
        >
          👎
        </button>
        <button
          onClick={() => setShowCommentModal(true)}
          className="rounded-md p-1.5 px-3 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          title="Add comment"
        >
          💬 Comment
        </button>
      </div>

      {showCommentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Add Feedback Comment
            </h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about this response..."
              className="w-full rounded-md border border-zinc-300 bg-white p-3 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              rows={4}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCommentSubmit}
                disabled={!comment.trim() || isSubmittingComment}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingComment ? "Submitting..." : "Submit"}
              </button>
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setComment("");
                }}
                className="flex-1 rounded-md bg-zinc-200 px-4 py-2 text-zinc-900 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
