# Design Guidelines: Sales Analytics Dashboard

## Design Approach
**Reference-Based Approach**: Geïnspireerd op The Sales Studios interface en moderne analytics platforms zoals Linear en Notion voor data-rijke interfaces. Focus op professionaliteit, helderheid en data-toegankelijkheid.

## Kleurenpallet

**Primary Colors (Dark Mode)**
- Background: 215 25% 12% (Donkerblauw-grijs)
- Surface/Cards: 215 22% 16%
- Surface Elevated: 215 20% 20%

**Accent Colors**
- Primary Blue: 212 92% 58% (Helder blauw voor CTAs en belangrijke elementen)
- Primary Blue Hover: 212 92% 52%
- Success Green: 142 76% 45%
- Warning Orange: 25 95% 58%
- Danger Red: 0 84% 60%

**Text Colors**
- Primary Text: 210 10% 95%
- Secondary Text: 215 15% 70%
- Muted Text: 215 12% 50%

**Data Visualization Colors**
- Dit Jaar: 212 92% 58% (Primary Blue)
- Vorig Jaar: 215 15% 60% (Grijs-blauw)
- Rolling Average: 142 76% 45% (Green accent)

## Typografie

**Font Families**
- Primary: 'Inter', sans-serif (from Google Fonts)
- Monospace: 'JetBrains Mono', monospace (voor metrics/cijfers)

**Hierarchy**
- Page Titles: text-2xl font-semibold (24px)
- Card Titles: text-lg font-medium (18px)
- Metric Values: text-3xl font-bold (30px, monospace)
- Body Text: text-sm (14px)
- Labels: text-xs font-medium uppercase tracking-wide (12px)

## Layout Systeem

**Spacing Primitives**: Gebruik Tailwind units van 2, 4, 6, 8 en 12 voor consistente spacing (p-4, m-6, gap-8, etc.)

**Grid Structure**
- Sidebar: Fixed width 240px (w-60)
- Main Content: flex-1 met max-w-7xl container
- Card Grid: grid gap-6 met responsive columns (grid-cols-1 lg:grid-cols-2 xl:grid-cols-3)

## Component Library

**Sidebar Navigation**
- Fixed left sidebar met logo bovenaan
- Menu items met icons (Heroicons) aan linkerzijde
- Active state: blauwe achtergrond (primary blue met 15% opacity) + border-l-4
- Hover state: subtiele opacity verhoging naar 80%
- Upload knop onderaan sidebar met gradient achtergrond

**Dashboard Cards**
- Elevated surface kleur met rounded-xl borders
- Padding: p-6
- Shadow: subtiele shadow-lg voor depth
- Header met titel + tijdperiode selector rechtsboven

**Metrics Display**
- Grote cijfers in monospace font
- Percentage change indicator met pijl icoon (↑↓) en kleurcodering
- Klein label onderin met "vs vorig jaar" context
- Sparkline micro-chart voor quick trend visualization

**Charts/Grafieken**
- Chart.js of Recharts voor interactieve visualisaties
- Lijn grafieken voor tijdlijn vergelijkingen met 3 lijnen:
  - Rolling timeline (dikke lijn, green)
  - Dit jaar (medium lijn, primary blue)  
  - Vorig jaar (dunne gestippelde lijn, grijs)
- Transparante fill onder lijnen met gradient
- Grid lines: subtiel, 10% opacity
- Tooltips: donkere achtergrond met witte tekst

**Upload Zone**
- Dashed border drag-and-drop area
- Icon centraal (document upload icon uit Heroicons)
- "Sleep transcripties hier of klik om te selecteren" tekst
- Geaccepteerde formaten weergave: .txt, .docx
- Upload progress bar met percentage

**Transcript List**
- Tabel layout met kolommen: Bestandsnaam, Datum, Status, Acties
- Status badges:
  - Processing: orange badge met pulserende animation
  - Analyzed: green badge
  - Error: red badge
- Elke rij heeft delete en view actions iconen

**Buttons**
- Primary: gradient van primary blue naar lichtere variant, rounded-lg, px-6 py-3
- Secondary: outline met primary blue border, hover gevuld
- Icon buttons: w-10 h-10, rounded-md, centered icon

**Time Period Selector**
- Segmented control met opties: 7D, 1M, 3M, 6M, 1Y, YTD
- Active segment: primary blue achtergrond
- Inactive: transparant met hover state

## Dashboard Secties

**Trends Dashboard**
- 4 key metric cards bovenaan (2x2 grid)
- Grote tijdlijn grafiek daaronder (full width)
- Breakdown tabel onderaan met top performing categorieën

**Klanttevredenheid Dashboard**  
- NPS score prominent bovenaan (groot cijfer met gauge visualization)
- Sentiment analysis breakdown (positief/neutraal/negatief percentages)
- Word cloud van meest genoemde termen
- Tijdlijn van satisfaction score over tijd

**Concurrentie Dashboard**
- Competitive mentions frequency chart
- Market position indicator
- Competitor comparison table met win/loss ratio's
- Share of voice visualization

**Propositie Dashboard**
- Product/feature mentions heatmap
- Value proposition resonance scores
- Objection handling effectiveness metrics
- Conversion funnel met AI-insights

## Interactie Patronen

**Animations**: Minimaal en subtiel
- Page transitions: fade-in met 200ms duration
- Card hover: subtiele lift (translateY -2px) met shadow vergroting
- Chart data points: fade in van onderen naar boven
- Loading states: skeleton screens in card kleur

**Responsive Behavior**
- Mobile: Sidebar wordt hamburger menu overlay
- Tablet: 2-column grid voor metrics
- Desktop: 3-column grid waar mogelijk

## Data States

**Loading**: Skeleton loaders in card shape met pulserende gradient
**Empty State**: Centered icon + "Geen data beschikbaar" + upload prompt
**Error State**: Red accent kleur met retry button en error bericht

Deze guidelines zorgen voor een consistent, professioneel analytics dashboard dat zowel functioneel als visueel aantrekkelijk is voor dagelijks gebruik door sales teams.