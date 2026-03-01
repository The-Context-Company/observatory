"use client";

import { useState } from "react";

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
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => handleFeedback("thumbs_up")}
          disabled={isSubmitting}
          className={`p-1.5 rounded-md transition-colors ${
            selectedScore === "thumbs_up"
              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Thumbs up"
          title="Good response"
        >
          👍
        </button>
        <button
          onClick={() => handleFeedback("thumbs_down")}
          disabled={isSubmitting}
          className={`p-1.5 rounded-md transition-colors ${
            selectedScore === "thumbs_down"
              ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Thumbs down"
          title="Bad response"
        >
          👎
        </button>
        <button
          onClick={() => setShowCommentModal(true)}
          className="p-1.5 px-3 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm"
          title="Add comment"
        >
          💬 Comment
        </button>
      </div>

      {showCommentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
              Add Feedback Comment
            </h3>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about this response..."
              className="w-full p-3 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCommentSubmit}
                disabled={!comment.trim() || isSubmittingComment}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmittingComment ? "Submitting..." : "Submit"}
              </button>
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setComment("");
                }}
                className="flex-1 px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
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
