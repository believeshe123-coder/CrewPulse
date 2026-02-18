# CrewPulse

CrewPulse is a private internal workforce intelligence system designed to support dispatch decisions with structured, data-backed insights.

## Product Principles

- **Private internal tool**: worker profiles are visible to staff only.
- **Role-based visibility**:
  - Workers do **not** see their profiles.
  - Customers can rate assignments.
  - Customers do **not** see worker profiles.
  - Staff can see all workforce analytics.
- **Operational focus**: clear scoring, trend visibility, and risk flagging.
- **Calm and structured UX**: concise, color-coded, and non-emotional.

## Core Questions CrewPulse Must Answer

CrewPulse must clearly identify:

- Workers who are consistently late.
- Workers who frequently no-call-no-show (NCNS).
- Category-specific strengths and weaknesses (for example, warehouse vs cleanup).
- Recent downward performance trends.
- Workers requiring review or termination recommendation.

## Application Experience

### 1) Main Dashboard

When staff logs in, CrewPulse displays:

#### Top-row metrics

- Workforce Average Score
- Active Workers Count
- Needs Review Count
- Terminate Flag Count

#### Priority panels

- 🔥 Top Performers (by category)
- ⚠️ Needs Review (decline/low category score)
- 🚨 NCNS Risk (pattern detection)
- ⏰ Chronic Late List

#### Status color coding

- Green = Strong
- Yellow = Needs Review
- Orange = High Risk
- Red = Terminate Recommended

### 2) Worker Profile Page (Core Screen)

#### Summary header

- Name
- Status badge
  - Active (Green)
  - Needs Review (Yellow)
  - Hold (Orange)
  - Terminate (Red)
- Overall Score (numeric; e.g. `4.2 / 5.0`)
- Tier Label
  - Elite (`4.5–5.0`)
  - Strong (`4.0–4.49`)
  - Solid (`3.5–3.99`)
  - At Risk (`3.0–3.49`)
  - Critical (`<3.0`)
- Total Jobs Worked
- Last 30-Day Score

#### Category breakdown

For each category (Warehouse, Cleanup, Janitorial, Events, etc.):

- Average rating
- Job count in category
- Trend arrow (`up`, `flat`, `down`)

Visibility rule:

- Category metrics display only after **3+ jobs** in that category.

### 3) Reliability Breakdown (Critical)

Each worker includes a reliability panel with:

- Total Jobs
- Completed
- Late
- Sent Home
- No-Call-No-Show (NCNS)

Calculated metrics:

- **Late Rate** = `late jobs / total jobs`
- **NCNS Rate** = `NCNS / total jobs`

This enables differentiated reliability assessment:

- High late rate + low NCNS = usually shows up but punctuality issues.
- Low late rate + high NCNS = high reliability risk.

## Scoring Model

### Performance and reliability are separate

CrewPulse surfaces:

- **Performance Score** (quality of work)
- **Reliability Score** (attendance consistency)

### Reliability impact weighting (example)

- Completed = neutral
- Late = `-0.3`
- Sent Home = `-0.7`
- NCNS = `-1.5`

NCNS is intentionally weighted more heavily than late arrivals.

### Ratings structure per assignment

Each assignment includes:

- **Staff Rating** (`1–5`)
  - Structured tags
  - Internal notes
- **Customer Rating** (`1–5`)
  - Optional dimensions: punctuality, work ethic, attitude, quality, safety
  - Would rehire? (`yes/no`)

Final score composition:

- Customer rating: **65%**
- Staff rating: **35%**
- Recent jobs carry greater weight.

## Automated Flags

### Needs Review triggers

- Overall score below `3.5`
- NCNS rate above `15%`
- `3+` incidents in 30 days
- Downward trend across 5 jobs

### Terminate Recommended triggers

- NCNS rate above `25%`
- `2` NCNS in last 5 jobs
- Overall score below `3.0` after `10+` jobs
- Severe incident flag

These flags are decision support only and do not auto-delete records.

## Search and Filtering

Search:

- Name
- ID
- Phone

Filters:

- Top warehouse workers
- High reliability
- Needs Review
- Terminate flagged
- Low cleanup rating
- NCNS risk

## MVP Delivery Plan

### Phase 1

- Login + roles
- Worker profiles
- Assignment logging
- Staff ratings
- Reliability tracking (late, NCNS, etc.)
- Numeric + tier scoring
- Worker profile dashboard
- Automatic Needs Review flag

### Phase 2

- Customer rating portal
- Weighted reliability scoring
- Terminate flag automation
- Dashboard alerts

### Phase 3

- Trend graphs
- Performance over time charts
- Export reports
- Smart dispatch suggestions
