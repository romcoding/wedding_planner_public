# Current Version Assessment - Wedding Planner Public

## Verdict
The current version is a strong **MVP+** for planners and couples. It already covers invitations, RSVP/auth, website content, tasks/events/guests, venues, budgeting, seating, reminders, analytics, images/gallery, and moodboard.

It is not yet a complete all-in-one production platform for wedding businesses without a few focused additions.

## What Is Already Sufficient
- Multi-role back office with route-level permissions.
- Guest portal with invitation-token entry and authenticated guest experience.
- Public wedding website-style sections (information, contact, gallery, gift registry) driven by content.
- Core planning operations: guests, tasks, events, venues, seating, invitations, reminders, costs, analytics.
- Optional advanced helpers (venue offers/chat/documents and moodboard).

## High-Impact Additions Recommended
1. **Website customization builder**
   - Theme presets, font pairs, section layout blocks, drag/drop ordering.
   - Per-page SEO fields and social preview metadata.
2. **Vendor ecosystem completion**
   - Contract lifecycle, payment milestones, reminder automation.
3. **Timeline and run-of-show collaboration**
   - Day-of timeline with assignee view and real-time status updates.
4. **Automated communication workflows**
   - Drip reminders and templates (RSVP chase, accommodation, transport, thank-you flow).
5. **File and document hub**
   - Shared folder model with role permissions and approval history.
6. **Publishing controls**
   - Draft vs published versions, scheduled publishing, custom domains, password-protected sections.

## Cleanup Included In This Pass
- Removed unused legacy guest registration page no longer used by routing.
- Removed unused legacy admin dashboard component and stale imports.
- Fixed frontend Vite ESM config path resolution in both app and moodboard configs.
- Updated failing/stale frontend tests (clipboard mocking and guest contact tests).
- Refactored quick setup onboarding into reusable helper templates with centralized validation.

## Suggested Next Milestone
A focused **Website Builder + Publishing** milestone would most directly close the gap between current capabilities and true all-in-one market expectations.
