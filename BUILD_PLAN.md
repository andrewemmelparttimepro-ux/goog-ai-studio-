# SP OMP — Full Build Plan
Prepared by: NDAI for SandPro LLC
Date: March 19, 2026

## Phase 1: Core Workflow & Dashboards (4-6 Weeks)
**Goal:** Establish the foundation of accountability and visibility.

* **Sprint 1: Foundation & Auth**
    * Setup Next.js, Prisma, and PostgreSQL.
    * Implement NextAuth with role-based permissions (Admin, Exec, Manager, Contributor).
    * SandPro UI Theme implementation (Orange/Gunmetal/Steel).
* **Sprint 2: Objective Management**
    * Objective CRUD (Create, Read, Update, Delete).
    * Assignment workflow (Leader -> Owner).
    * Basic Email Notifications (Assignment alert).
* **Sprint 3: The Dashboards**
    * Executive Home: KPI strip, overdue counts, workload by person.
    * Manager Home: Team queue, unacknowledged assignments.
    * My Work: Personal task list, due today/week.
* **Sprint 4: Mobile & Polish**
    * Full responsive audit (Mobile/Tablet/Desktop).
    * One-click status updates from list views.
    * Initial CSV export for Power BI.

---

## Phase 2: Execution Depth & Visibility (3-4 Weeks)
**Goal:** Add granularity to tracking and improve data quality.

* **Sprint 5: Subtasks & Roll-ups**
    * Parent-child objective relationships.
    * Automated progress roll-up (Subtask completion -> Parent %).
* **Sprint 6: Metric Tracking**
    * Baseline vs. Target setup for measured objectives.
    * Recurring check-in logging (dated entries).
    * Trend visualization on objective detail pages.
* **Sprint 7: Advanced Notifications**
    * "Due Soon" (24hr) and "Overdue" (Daily) reminder logic.
    * "Stale" alert (No update in 7 days).
    * Admin controls for notification cadence.

---

## Phase 3: Reporting & Enterprise Readiness (2-3 Weeks)
**Goal:** Full integration with SandPro's reporting ecosystem.

* **Sprint 8: Power BI Integration**
    * REST API endpoints for all core entities.
    * SQL-backed database views for direct Power BI consumption.
    * Full audit trail UI (Status/Owner/Date history).
* **Sprint 9: Team Scorecards & Cadence**
    * Team scorecard views for meeting reviews.
    * Meeting cadence tracking (Last review date).
    * Template objectives for recurring workflows.
* **Sprint 10: Final Polish & Handoff**
    * File attachment support for evidence/documentation.
    * Performance optimization for large dashboards.
    * Final acceptance testing and documentation.

---

## Success Criteria
1. Users can create, assign, update, and close objectives from any device.
2. Dashboards accurately show overdue items and workload distribution.
3. Data exports cleanly to Power BI with zero manual rework.
4. Email reminders are sent reliably based on due dates.
