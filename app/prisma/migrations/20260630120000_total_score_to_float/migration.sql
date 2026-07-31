-- Store the conversation total score with its decimal precision.
-- The column was INTEGER, which truncated/rounded the 0-10 score (e.g. 7.4 -> 7),
-- so the dashboard (which renders total_score.toFixed(1)) and the feedback email
-- (which rendered Math.round(total_score)) disagreed. DOUBLE PRECISION keeps the
-- single-decimal score the analysis produces. Existing integer values cast
-- losslessly (7 -> 7.0).
ALTER TABLE "conversation_summaries_x" ALTER COLUMN "total_score" SET DATA TYPE DOUBLE PRECISION;
