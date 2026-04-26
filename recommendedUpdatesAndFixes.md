# Recommended Updates & Fixes

## User Features

### 1. Email Campaign Management
- Build a full email campaign creation flow (subject, body, audience, schedule)
- Add a **Mailing Lists** management page with support for:
  - Creating new lists with name and description
  - Adding/removing subscribers individually or via CSV import
  - Merging or archiving lists
  - Tagging lists for segmentation

### 2. Post Page Improvements
- Make content text selectable and links clickable within post previews
- Add image lightbox support (click image → full-screen overlay with zoom/pan)
- Implement a full-screen post view mode (accessible from the post card or detail page)

### 3. AI Learning from Vetoed Content
- When content is vetoed, capture the veto reason and feed it back into the generation context
- Store vetoed examples per brand/user as negative training signals
- Surface a "Quality Improvement" indicator showing how the model has adapted over time

### 4. Content Status Toggling
- Allow users to change status: `Vetoed → Approved` and `Approved → Vetoed`
- Show a confirmation dialog with an optional reason field when changing status
- Log all status changes with timestamp and actor for audit trail

### 5. Self-Created Content
- Let users manually create posts alongside AI-generated ones
- Per-platform content guidelines enforced in the editor (character limits, hashtag rules, image specs)
- Scheduling picker with timezone support
- Media options: upload existing media or generate via text prompt (AI image generation)

### 6. Competitive Research for Brands
Dedicated **Competitive Intelligence** workspace per brand, organized into the following sections:

#### Industry Overview
- AI-generated industry summary: market size, growth rate, key trends, and major players
- Refreshable on demand with a "last updated" timestamp
- Tag the brand's primary industry and sub-niche for more precise insights

#### Competitor Tracking
- Add competitors by name, website URL, or social handle
- Auto-detect their active social platforms and pull public profile data
- Competitor status badges: Active, Inactive, New (entered market recently)
- Group competitors into tiers (Direct, Indirect, Aspirational)

#### Content & Posting Analysis
- Side-by-side comparison of posting cadence (posts per week per platform)
- Content theme breakdown: what topics they post about and in what proportion
- Format mix: video vs. image vs. text vs. carousel
- Best-performing post types per competitor based on engagement signals
- Tone analysis: professional, casual, humorous, educational, promotional

#### Engagement & Performance Benchmarks
- Average likes, comments, shares, and saves per post per competitor
- Engagement rate benchmarks by platform (so the brand knows where they stand)
- Follower growth trend chart over the past 30/90/180 days
- Virality score: frequency of posts that break above their average engagement

#### Gap & Opportunity Analysis
- Topics competitors are not covering that the brand could own
- Posting time gaps — windows where competitors are quiet and the brand can dominate
- Keyword and hashtag opportunities competitors are ranking for but under-utilizing
- Platform gaps: platforms competitors have a weak presence on

#### Share of Voice
- Visual breakdown of how much of the conversation in the industry each competitor owns
- Trend over time: is the brand gaining or losing share of voice?
- Filterable by platform and date range

#### Sentiment Analysis
- Overall sentiment score per competitor (positive / neutral / negative)
- Drill down into what topics drive negative vs. positive sentiment
- Comment sentiment on their top posts
- Brand perception word cloud generated from audience comments

#### Campaign & Launch Tracker
- Detect when a competitor runs a new campaign (spike in posting + paid indicators)
- Timeline view of competitor campaigns over the past year
- Notes field to annotate what worked or what the brand should counter with

#### Alerts & Monitoring
- Real-time alerts when a competitor publishes above their normal cadence
- Notify when a competitor's follower count crosses a threshold
- Weekly digest email summarizing competitor activity for the week
- Alert when a competitor starts posting in a new content category

#### Benchmarking Dashboard
- Single-view scorecard comparing the brand against all tracked competitors across: follower count, engagement rate, posting frequency, content variety, and sentiment
- Color-coded indicators (ahead / at par / behind) for each metric
- Exportable as a branded PDF or shareable link for stakeholders

---

## Auth & Security

### 1. Separate User and Admin Token Scopes
- Issue tokens with distinct audiences (`aud: user` vs `aud: admin`) so a user token is rejected by admin routes and vice versa
- Use separate signing secrets or separate JWT claims per role
- Recommended: a single `auth` service that stamps role into the token at issuance and validates it at middleware level

### 2. Seed Admin Accounts
Seed the following accounts with password `12345678` (marked `must_change_password: true`):
- `superadmin@anthyx.com` — Super Admin role
- `lanre@anthyx.com` — Admin role
- `support@anthyx.com` — Support role

---

## Admin Panel

### 1. Admin Account Creation with RBAC
- Implement an **invite flow**: super admin sends invite link → invitee sets password on first login
- Define roles: `Super Admin`, `Admin`, `Support`, `Billing`
- Each role has explicit permission scopes (e.g., Support cannot edit plans or billing)
- Show role assignments in a user management table with inline role editing

### 2. Editable Email Templates
- Admin UI for editing transactional email templates (welcome, password reset, invoice, etc.)
- Support variable tokens (e.g., `{{user.name}}`, `{{plan.name}}`) with a live preview panel
- Save versions so templates can be rolled back

### 3. Plan Price Editing
- Plan prices are currently not editable — fix this so admins can update pricing per plan
- Changes should apply to new subscribers only; existing subscribers remain on their current price until they change plans
- Add a confirmation prompt and change log

### 4. Feature Flags
- Feature flags are per-user or per-plan toggles that enable/disable specific functionality without a code deploy
- Admin UI should list all flags with their current state (on/off), the scope they apply to (global, plan, user), and a toggle control
- Example uses: roll out a beta feature to select users, disable a broken feature instantly, A/B test new UI

---

## Affiliate Portal

### 1. Account Creation Flow
- Build a self-serve affiliate registration page: name, email, payout details, agreement acceptance
- Send a verification email on sign-up
- Pending affiliates go into an approval queue visible to admins
- On approval, affiliate receives a welcome email with their referral link and portal access
- Track referral clicks, conversions, and commissions from day one
