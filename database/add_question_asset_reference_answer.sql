alter table public.question_assets
  add column if not exists reference_answer text;
