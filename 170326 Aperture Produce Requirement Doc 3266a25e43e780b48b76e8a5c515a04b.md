# 170326 Aperture Produce Requirement Doc

Favorite: No
Archived: No
Area/Resource: GLOW (https://www.notion.so/GLOW-df798e74e30241d99c9abea31c1e7ac8?pvs=21)

# 1. What is this?

Aperture is a personal dashboard designed specifically to work with Waverley’s brain. It is built around pre-existing systems that help Waverley navigate multiple work and personal streams, and designed to make sure she stays not just productive, but focussed on work that drives real impact. This dashboard helps arrange and captures inputs of what she needs to do, provides tracking and health signals for important parts of her life like finance and calorie tracking, It also helps summarise immediate information relevant to her interests and needs, and provides an easy place to surface topline work metrics. 

Aperture is a Next.js web application that runs locally and displays as a single-page dashboard 

# 2. What does the Minimum Lovable Product look like?

The MLP looks like a slickly designed dashboard of key metrics and summaries that genuinely help Waverley process her day. The design can be minimal but should look polished to give a sense of satisfaction and engagement with the product.

## What you see when you open it:

You see a To-Do List populated with the relevant tasks from the tasks assigned to today in the Sprint Database in Notion. Next to it, a Timebox component where Waverley can timebox her day, aggregating to-dos, anything that may come up throughout the day, and admin tasks front of mind. You also see a monthly finance component tracking actuals against targets broken down by categories. Next to it, a component tracking calories for the day. Under that a summary of today’s activities, if there are any, highlighting any non to-dos, like lunches or hang outs. 

## What it does NOT include yet:

- WAVES DIGSEST
- Fitness component (To be determined)
- Work Digest
- BLOK Metrics

These components don’t need to be in V1 but the prelim sketch includes these to give Claude a sense of overall scope and formatting. 

## User Flows

Morning Flow:

1. Turn on computer and open up Aperture as priority
2. Scan topline view of available components, note any flags like overspending or key activities happening today
3. Assess To-do list and start timeboxing day
4. (Post MLP) Click on Waves Digest and read summaries whilst having breakfast/coffee
5. (Post MLP) Read Work digest and add in any flags into the to-do list
6. (Post MLP) Assess BLOK metrics and add any actions off metric performance assessment

[Data Sources](Data%20Sources%203266a25e43e78087856deb4e6edb548b.csv)

# Features by Phase

### Phase 1 - Build This Now

- Skeleton build of core components with placeholder data.
- To-Do List - placeholder data
- Timebox
    - This is the only component that should be ready to use from the get go. This is the main component of the dashboard and where I will do the most interaction. It should be a checkboxed list where I can add times and what I intend to do. This component should be extendable so as I add to it and the list grows, it grows vertically.
    - Waverley should be able to:
        - Add new lines by typing. This is a free text field.
        - Delete lines
        - Reorder lines
    - This component gets wiped with the refresh every morning
- Monthly Finances - placeholder data
- Calorie Tracker- placeholder data
- Today’s Activities- placeholder data
- Waves Digest Button- placeholder data
- Fitness - placeholder data
- Work Digest- placeholder data
- BLOK Metrics- placeholder data
- Scribble box - empty

### Phase 2 - Core Integrations and basic Usability

- To-Do List should pull in relevant tasks from today’s date as a checkboxed list I should be able to tick off, and later delete off the list if I want to. I should also be able to add new to-dos as a new line. If more tasks are added past what the box can contain, it should be scrollable vertically.
- Timebox should be able to have tasks draggable from the To-Do list into timebox, in the position in the list I drag tasks into.
- Scribblebox should be a text-entry field, accessible by pressing a circular button with a thinking cloud illustrtaion. When clicking the button, this should open a small window overlay where I can jot down random thoughts. This box should be able to be draggable so I can see different parts of Aperture if needed. The data in the box should be persistent and not clear, unless I press a specific X button. When the entry field is empty, show a rotating placeholder prompt like 'What're you thinking?', 'Note to self...', 'Quick thought...' — pick a different one each day. 
- Monthly Finance Tracker should be tracking how much I’m spending against monthly targets with a horizontal bar for each category. Colour-coded finance bars to signal strength. Visibility toggle for privacy.
    - Groceries
    - Treat Spend
    - Travel
    - Going Out
    - Self Care spend
- Calorie Tracker should be connected up to Google Sheets and up to date on how many calories I’ve eaten against target for the day. Numbers is fine here
- Today’s Activities should be a bullet pointed list of any calendered events from my personal Google calendar, and any meetings from my work google calendar
- All components should be refreshable to pull new data in from each relevant data source by tapping the title of the component
- Every component should refresh at 9am each day.
- Placeholder doodle graphic (see doodle.jpg) underneath timebox when it is not extended. This static can dissapear when the component is extended.
- Refresh button in top right corner to refresh all components at once.
- Time of day header gradients
- Deploy to Vercel with password protection, adjust any local MCP integrations and refactor for deployment

### Phase 3 - Future Development

- Waves Digest button should provide a summary of what’s happened in my personal emails, any important communication, summaries of interesting newsletters or alerts. This can be served as a pop-up.
- Work Digest should be on screen and provide a summary of my Slack messages and work emails of the day previous and the morning up to the moment of refresh.
- BLOK Metrics will report on sales performance of BLOK, and ad performance metrics of Meta and Google. Privacy toggle for privacy.
- A hero image that refreshes daily to keep the visual interest high is valuable to Waverley as stimulus. Unsure what connection is needed here. Unsplash?
- Components should be draggable to re-order as desired
- Design should be responsive to screen and window size
- Ticking off tasks in the To-Do list also ticks them off in the Notion DB Ah
- Scribble Box — Notion Push: Add a button to the Scribble Box that saves 
  the current note as a new page in a designated Notion database. Each pushed 
  note should include the date and the full text content. This allows Waverley 
  to build a running log of general thoughts over time. Requires Notion MCP 
  integration (same connection as To-Do List).
  - Optional push-to-Notion for manually created timebox items — small button per item that creates a new task in the sprint database. Only appears on items not already linked to a Notion task.
  - Turo Database integration to ensure sync of different states and to log persistent memory reference and cross-device state
  - Daygate Review that occurs on open of desktop, allowing review of previous day and option to check off any tasks that didn't get ticked off before the end of day, move them to this current day, or delete. 
  - Arrow buttons to move tasks between To-do and Timebox
  - PWA and mobile optimisation with mobile responsive layout and swipeable actions between Timebox and Todos. 
  - Monzo MCP integration for refined tracking instead of just Google Sheets (will remain for target reference)
  - Create new tasks in Notion DB from To-Do list with category selection
  - Defer tasks to different dates from dashboard
  - Click-through to Gmail client from Digest emails
  - Weight tracked on graph to show visual indicator of progress
  
### Phase 4 - Agent and AI Layer

- Morning greeting - contextual one liner reading all inputs
- AI financial summary against all relevant metrics, including mortgage and savings
- MSN-style chat assistant with full dashboard context, and developed ability to identify and action tasks it is capable of, i.e. executing through Slack or Calendar. Providing pro-active nudges, contextual research and identifying prevalent patterns from the DayGate review

### Phase 5 - Design and Optimisation
- Pass through whimsy and UX/UI agent to refine experience
- Animate loading screen with little guy running around
- Daily hero image refresh
- Scribble click animations
- Animated strikethrough tasks on complettion




# Design and Feel

Refer to sketch.png for layout and description below 
2
## Layout: 4-column grid

### Column 1 (narrow, fixed)

- To-Do List (top, scrolls internally)
- Waves Digest Button
- Fitness Component (TBD — reserve space)

### Column 2 (medium)

- Timebox (full height of column, extends vertically
and pushes page content down as entries are added)

### Columns 3–4 (right side, stacked vertically)

Row A:

| Col 3 | Col 4 |
| --- | --- |
| Monthly Finance | Calorie Tracker |
| (full height) | (half height) |
|  | -------------------- |
|  | Today's Activities |
|  | (half height) |

Row B (spans cols 3–4):

- Work Digest (full width)

Row C (spans cols 3–4):

- BLOK Metrics (full width)

Design should feel minimal but elevated. Pull away from AI design tropes where possible. Prioritse design that feels clean, easy to digest, and delightful. Design for light mode, not dark mode. 

Must work on laptop screen. 

Introduction of colour and gentle gradients acceptable but work within a colour scheme that inspires delight. 

Attached are screenshots of the Open Breathwork and Meditation App to showcase UI and use of colour I love. 

reference images are for layout feel and typography only — build in light mode using the specified hex palette

HEX CODES TO REFER TO:

/* CSS HEX */
--beige: #e6eed6ff; ← trial this for backgrounds/primary colour
--deep-forest: #0e402dff; ← trial this for secondary, things like outlining components
--cerulean: #007ea7ff; ← trial this for highlights
--black: #000000ff; ← trial this for text

![image.png](image.png)

![image.png](image%201.png)

![image.png](image%202.png)

![image.png](image%203.png)

# Tech Decisions

Next.js

Hosting: TBC, possibly Vercel

Database: TBC what requirements are

Auth: Not neeed, personal tool