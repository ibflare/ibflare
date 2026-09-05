-- Seed videos for development. NOT FLARE CONTENT. DELETE BEFORE LAUNCH.
--
-- Data, not schema, which is why this lives in supabase/seeds/ rather than in
-- supabase/migrations/. Run it in the SQL editor after 20260904000000.
--
-- CLAUDE.md section 10 asks for roughly fifteen videos across all five levels
-- so /library looks real in development, marked clearly so they can be removed.
-- There are fifteen here, covering every level and every topic.
--
-- WHAT THESE ARE. Each row points at a real, public, embeddable third-party
-- YouTube video, found through the Data API with videoEmbeddable=true and
-- safeSearch=strict, then confirmed public and embeddable by a second call. So
-- the library renders with working players and real durations rather than dead
-- links. They are NOT videos anyone at FLARE made, and every title is prefixed
-- and every description says so, because otherwise they sit under a FLARE
-- member's byline and imply otherwise.
--
-- TO REMOVE THEM, before launch:
--
--     delete from public.videos where title like '[SEED] %';
--
-- A hard delete, deliberately, and the one place it is right. Section 3 says
-- deletes are soft because real contributions must stay recoverable and
-- audited. These were never contributions.
--
-- The owner is resolved by username rather than hardcoded, so this file does
-- not carry a uuid that is only valid in one project.

insert into public.videos (
  title, description, youtube_id, thumbnail_url, duration_s,
  difficulty, topic, owner_id, status, release_ok, published_at
)
select
  v.title, v.description, v.youtube_id, v.thumbnail_url, v.duration_s,
  v.difficulty, v.topic,
  (select id from public.profiles where username = 'ibflare'),
  'published', true, now()
from (values
  ('[SEED] Understanding Your Paycheck', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by College & Career Ready Labs │ Paxton Patterson. It exists so the library has something to render in development and is not FLARE content.', 'XQ0f87stf_o', 'https://img.youtube.com/vi/XQ0f87stf_o/hqdefault.jpg', 120, 1, 'career'),
  ('[SEED] Banking Explained – Money and Credit', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Kurzgesagt – In a Nutshell. It exists so the library has something to render in development and is not FLARE content.', 'fTTGALaRZoc', 'https://img.youtube.com/vi/fTTGALaRZoc/hqdefault.jpg', 370, 1, 'banking'),
  ('[SEED] What is a Credit Score? Kal Penn Explains | Mashable', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Mashable. It exists so the library has something to render in development and is not FLARE content.', 'f2ortkJfTKw', 'https://img.youtube.com/vi/f2ortkJfTKw/hqdefault.jpg', 181, 1, 'credit'),
  ('[SEED] How to Read a Pay Stub | Your Paycheck | Money Instructor', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Money Instructor. It exists so the library has something to render in development and is not FLARE content.', '9_sVeFmaVmw', 'https://img.youtube.com/vi/9_sVeFmaVmw/hqdefault.jpg', 257, 2, 'career'),
  ('[SEED] How to File Taxes For the First Time: Beginners Guide from a CPA', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by ClearValue Tax. It exists so the library has something to render in development and is not FLARE content.', '71vwVX67KNM', 'https://img.youtube.com/vi/71vwVX67KNM/hqdefault.jpg', 578, 2, 'taxes'),
  ('[SEED] How Does a Credit Card Work?', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Motley Fool Money. It exists so the library has something to render in development and is not FLARE content.', 'vhaA2rAoBLU', 'https://img.youtube.com/vi/vhaA2rAoBLU/hqdefault.jpg', 345, 2, 'credit'),
  ('[SEED] Checking vs. Savings Account', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Gohar Khan. It exists so the library has something to render in development and is not FLARE content.', 'Gll6fsBupK0', 'https://img.youtube.com/vi/Gll6fsBupK0/hqdefault.jpg', 30, 2, 'banking'),
  ('[SEED] Index Funds for Beginners: A Step-by-Step Guide to Passive Investing', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Austin Williams. It exists so the library has something to render in development and is not FLARE content.', 'mrKKW3riVIA', 'https://img.youtube.com/vi/mrKKW3riVIA/hqdefault.jpg', 865, 3, 'investing'),
  ('[SEED] ACCOUNTANT EXPLAINS Why 1099 Income Is Better Than W-2 For Taxes', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Sherman - My CPA Coach. It exists so the library has something to render in development and is not FLARE content.', 'EW-lnxIZ6qg', 'https://img.youtube.com/vi/EW-lnxIZ6qg/hqdefault.jpg', 646, 3, 'taxes'),
  ('[SEED] Everything You Need To Know About Student Loans', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by The Financial Diet. It exists so the library has something to render in development and is not FLARE content.', 'FyLRxU5mJPM', 'https://img.youtube.com/vi/FyLRxU5mJPM/hqdefault.jpg', 505, 3, 'career'),
  ('[SEED] A Level Economics - Supply & Demand Graphs', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by A Level Revision. It exists so the library has something to render in development and is not FLARE content.', 'ayx3uEwXJ7M', 'https://img.youtube.com/vi/ayx3uEwXJ7M/hqdefault.jpg', 284, 3, 'micro'),
  ('[SEED] How Interest Rates Are Set: The Fed''s New Tools Explained', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by The Wall Street Journal. It exists so the library has something to render in development and is not FLARE content.', 'Oz5hNemSdWc', 'https://img.youtube.com/vi/Oz5hNemSdWc/hqdefault.jpg', 215, 4, 'macro'),
  ('[SEED] How to Read an Annual Report - 10k for Beginners', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Learn to Invest - Investors Grow. It exists so the library has something to render in development and is not FLARE content.', '7OjsEF04V8o', 'https://img.youtube.com/vi/7OjsEF04V8o/hqdefault.jpg', 796, 4, 'corporate'),
  ('[SEED] Warren Buffett Brilliantly Explains Discounted Cash Flow Analysis + Example! (How to Value a Stock!)', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by Dividendology. It exists so the library has something to render in development and is not FLARE content.', 'GhApasUpb0U', 'https://img.youtube.com/vi/GhApasUpb0U/hqdefault.jpg', 484, 5, 'corporate'),
  ('[SEED] Monetary Policy Transmission Mechanism', 'SEED DATA, delete before launch. This row points at a third-party YouTube video by EconplusDal. It exists so the library has something to render in development and is not FLARE content.', 'rNJNsV_ZaaM', 'https://img.youtube.com/vi/rNJNsV_ZaaM/hqdefault.jpg', 377, 5, 'macro')
) as v(title, description, youtube_id, thumbnail_url, duration_s, difficulty, topic)
where exists (select 1 from public.profiles where username = 'ibflare');
