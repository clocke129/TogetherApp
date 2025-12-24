# Process Notes: Together App Development

## Session History & Context

This document captures the development process, decisions, and implementation details across multiple work sessions.

---

## Previous Session: Last Prayed For Algorithm Implementation

### Initial Request
User asked to plan and implement a "last prayed for" algorithm to replace sequential rotation in the prayer app, ensuring people who haven't been prayed for recently are prioritized.

### Requirements
- Choose days of the week and people per day for each group
- Generate a stable daily prayer list that doesn't refresh on page reload
- Sort by lastPrayedFor timestamp (oldest first)
- People never prayed for should appear first
- Handle the "Everyone" system group (people with no group assignment)
- Clean up legacy "uncategorized" references
- Cache should invalidate only when settings change or date changes

### Implementation Completed
1. **Core Algorithm** (`lib/utils.ts`)
   - Added `sortByLastPrayedFor()` function - sorts by timestamp, null = epoch (0)
   - Replaced sequential rotation with timestamp sorting
   - Removed nextIndex batch updates (now stateless)

2. **Everyone Group Validation Fix**
   - Fetches all people to calculate Everyone group size correctly
   - Handles empty personIds array for system groups
   - Creates proper settings snapshot for cache validation

3. **UI Filtering** (`app/prayer/page.tsx`)
   - Fixed groupsWithProgress to filter by todaysPrayerList IDs
   - Shows only selected people (not all group members)

4. **Cleanup**
   - Replaced "uncategorized" strings with Everyone group lookup
   - Added deprecation comments for strategy/nextIndex fields

### Known Issue & Resolution
**Problem**: Today's cached list had empty snapshot `{}` from before validation fix
**Resolution**: Auto-resolves at midnight when new date generates fresh cache with correct format `{ numPerDay: 1 }`

---

## Current Session: Security Updates & Mobile UX Fixes

### Part 1: Next.js Security Updates

#### Issue: CVE-2025-66478 (React2Shell Vulnerability)
**Alert Source**: Vercel deployment warnings
**Initial Version**: Next.js 15.2.4 (vulnerable)

**Attempts**:
1. Upgraded to 15.2.6 - still showed warnings
2. Upgraded to 16.0.7 - still showed warnings
3. Used Vercel's automated fix tool: `npx fix-react2shell-next --fix`

**Final Solution**:
- Updated to Next.js 16.0.10 using Vercel's tool
- Fixed 4 CVEs:
  - CVE-2025-66478 (critical): Remote code execution via crafted RSC payload
  - CVE-2025-55184 (high): DoS via malicious HTTP request
  - CVE-2025-55183 (medium): Server Action source code exposure
  - CVE-2025-67779 (high): Incomplete DoS fix

**Turbopack Configuration Issue**:
- Next.js 16 defaults to Turbopack
- PWA plugin uses webpack config
- Added `turbopack: {}` to `next.config.mjs` to acknowledge mixed bundler usage

**Commits**:
- `9231e99`: Fix React2Shell vulnerability (CVE-2025-66478)
- `39734c8`: Fix Turbopack webpack config warning

---

### Part 2: Mobile UX Improvements (First Attempt)

#### User Feedback on Mobile Issues
1. Drag-and-drop too complicated on small screens
2. Pray button too cramped in focus mode
3. Animation switching between cards too fast

#### Initial Implementation
**Changes Made**:
1. **Group Switcher**: Replaced drag with Sheet (bottom sheet modal)
2. **Pray Button**: Moved from top-right to footer above counter
3. **Animation Speed**: Slowed carousel from 25ms → 40ms

**Problem Discovered**: Sheet component (Dialog-based) nested inside parent Dialog caused conflicts

**Attempted Fix**: Replaced Sheet with custom dropdown
- Added click-outside handler
- Positioned with absolute positioning
- **Issue**: Still clipped by Dialog overflow constraints

**Commits**:
- `56348e4`: Improve mobile UX for focused prayer mode
- `82bc923`: Add scroll functionality to prayer cards
- `70eb0ca`: Fix scroll by removing overflow-hidden wrapper
- `1e5787d`: Fix group switcher by replacing Sheet with dropdown

---

### Part 3: Mobile UX Fixes (Final Implementation)

#### User Reported Issues (Not Working)
1. **Group switcher**: Still not working on mobile
2. **Scroll**: Not working on mobile
3. **Past requests count**: Inconsistent (shows "40 more" but only displays 3)

#### Additional Requirements
- Group switcher should be **mobile-only**
- Keep original drag handles on **desktop**
- Consider separate modal for past requests on mobile due to limited space

#### Investigation Process

**Phase 1: Exploration** (3 parallel agents)
1. **Agent 1**: Investigated group switcher and scroll issues
   - Found dropdown clipped by Dialog overflow
   - Multiple `overflow:hidden` ancestors blocking scroll

2. **Agent 2**: Found responsive design patterns in codebase
   - `useMobile()` hook (window.innerWidth < 768)
   - Tailwind classes (hidden md:flex, md:hidden)
   - Examples: navbar, mobile-fab, assignments page

3. **Agent 3**: Investigated past requests inconsistency
   - `slice(1, 4)` shows only 3 items
   - Label shows total count (could be 40+)
   - Mismatch between label and displayed content

**Phase 2: User Questions**
Asked user for preferences:
- **Past requests**: Chose "Separate modal with 3-5 requests" (mobile)
- **Group switcher**: Chose "Bottom sheet (native mobile feel)"

**Phase 3: Planning**
Created detailed implementation plan covering:
- Group switcher: Drawer for mobile (portal rendering), dropdown for desktop
- Scroll fix: Restructure overflow hierarchy + touchAction
- Past requests: Dialog modal (mobile), Accordion (desktop)

#### Final Implementation

**1. Group Switcher Fix**
- **Mobile**: Drawer (vaul) component with drag handle
  - Uses portal rendering (avoids Dialog nesting)
  - Bottom sheet slides up from bottom
  - Native mobile feel

- **Desktop**: Keep custom dropdown
  - Click-outside handler (desktop only)
  - Positioned dropdown menu

- **Code**: `FocusedPrayerMode.tsx`
  ```typescript
  const isMobile = useMobile()
  // Conditional rendering: isMobile ? <Drawer> : <CustomDropdown>
  ```

**2. Scroll Functionality Fix**
- **Problem**: Multiple `overflow:hidden` ancestors blocked touch scroll

- **Solution**:
  - Restructured carousel hierarchy
  - Added `touchAction: 'pan-y'` to enable vertical scroll
  - Changed `h-full` to `flex-1` for proper height calculation

- **Code Changes**:
  - `FocusedPrayerMode.tsx`: Wrapped PersonPrayerCard in overflow container
  - `PersonPrayerCard.tsx`: Added touchAction, changed to flex-1

**3. Past Requests Consistency Fix**
- **Mobile**: "See Past Requests" button → Dialog modal
  - Shows 3-5 items (slice(1, 6))
  - Better reading space
  - Dedicated modal for content

- **Desktop**: Accordion (unchanged pattern)
  - Shows same 3-5 items
  - Consistent with mobile count

- **Label Update**: Changed from "N more" to "N recent"

**Final Commit**: `386560e` - Fix mobile UX issues in focused prayer mode

---

## Technical Patterns & Decisions

### Responsive Design Strategy

**Use `useMobile()` Hook When**:
- Different components needed (Drawer vs Dropdown)
- Different event handlers required
- Component structure differs significantly

**Use Tailwind Classes When**:
- Only styling changes (hide/show)
- Same component, different layout
- Simple adjustments (padding, spacing)

### Dialog/Modal Nesting Solution
**Problem**: Nested dialogs (Sheet inside Dialog) cause conflicts
**Solution**: Use components with portal rendering (Drawer, custom Dialog)
**Key**: Drawer renders outside parent Dialog via portal

### Carousel Overflow Management
**Challenge**: Allow vertical scroll while maintaining horizontal carousel
**Solution**: Layer overflow containers
- Outer: `overflow-hidden` for carousel boundary
- Inner: `overflow-y-auto` for vertical scroll
- CSS: `touchAction: 'pan-y'` for mobile

---

## Key Files Modified

### Core Algorithm (Previous Session)
1. `/lib/utils.ts` - lastPrayedFor sorting, cache validation
2. `/lib/types.ts` - Deprecation documentation
3. `/app/prayer/page.tsx` - UI filtering
4. `/app/followups/page.tsx` - Uncategorized cleanup

### Security Updates (Current Session)
1. `package.json` - Next.js version updates
2. `package-lock.json` - Dependency lockfile
3. `next.config.mjs` - Turbopack configuration

### Mobile UX (Current Session)
1. `/app/prayer/FocusedPrayerMode.tsx`
   - Group switcher (Drawer/dropdown)
   - Carousel structure
   - Dialog container

2. `/app/prayer/PersonPrayerCard.tsx`
   - Scroll container with touchAction
   - Past requests modal/accordion
   - useMobile() hook integration

3. `/app/globals.css`
   - Custom scrollbar styles (prayer-card-scroll)

### Documentation
1. `/docs/last-prayed-for-algorithm.md` - Algorithm documentation
2. `/docs/process-notes.md` - This file

---

## Testing Checklist

### Mobile Tests
- [ ] Group switcher opens as bottom sheet with drag handle
- [ ] Groups can be switched successfully
- [ ] Prayer card content scrolls vertically with touch
- [ ] Carousel still swipes horizontally
- [ ] "See Past Requests" button opens modal
- [ ] Modal shows 3-5 past requests with scroll
- [ ] All modals close properly

### Desktop Tests
- [ ] Group switcher dropdown appears (not clipped)
- [ ] Prayer card scrolls with mouse wheel
- [ ] Past requests accordion expands/collapses
- [ ] Shows same 3-5 items as mobile
- [ ] No drag handle shown on dropdown

### Cross-Platform
- [ ] Window resize triggers responsive changes
- [ ] No hydration errors
- [ ] No nested Dialog warnings
- [ ] Smooth performance (no jank)

---

## Lessons Learned

### 1. Dialog Nesting Conflicts
**Issue**: UI components using Dialog primitives can't be nested
**Solution**: Use portal-based components or alternative patterns
**Example**: Drawer (portal) works inside Dialog; Sheet (Dialog-based) doesn't

### 2. Mobile Scroll Challenges
**Issue**: Touch scroll blocked by overflow:hidden ancestors
**Solution**: Explicit `touchAction: 'pan-y'` + proper container hierarchy
**Key**: Layer containers carefully - carousel vs scroll boundaries

### 3. Responsive Component Strategy
**Pattern**: Use JavaScript detection (`useMobile()`) for structural differences
**Why**: Tailwind classes work for styling; complex UI needs different components
**Example**: Drawer vs Dropdown requires different component trees

### 4. Security Update Process
**Tool**: Vercel's `npx fix-react2shell-next --fix`
**Benefit**: Automatically detects and fixes vulnerable versions
**Learning**: npm warnings can be cached; tool provides accurate fixes

### 5. Cache Validation Complexity
**Challenge**: Settings changes need to trigger recalculation
**Solution**: Store settings snapshot, compare on each load
**Gotcha**: Existing caches from before fix have wrong format - resolve naturally

---

## Open Questions / Future Improvements

### 1. Group Switcher Clarification
**User Feedback**: "Still showing drag handles"
**Clarification Needed**: User viewing Groups page (management), not Today page (prayer mode)
**Test Steps**:
1. Go to "Today" tab
2. Tap "Pray" on a group
3. Tap group name in modal
4. Should see bottom sheet (mobile) or dropdown (desktop)

### 2. Potential Enhancements
- Smart scheduling: Weight recent prayer frequency
- Prayer request urgency: Factor in urgent requests
- User preferences: Manual pinning to daily list
- Analytics: Track prayer patterns, suggest optimal numPerDay
- Reminders: Notify when someone hasn't been prayed for in X days

### 3. Technical Debt
- Consider removing deprecated nextIndex/strategy fields in future major version
- Investigate server-side API route for calculation (reduce client bundle)
- Evaluate Turbopack migration path for PWA plugin

---

## Commit History (Chronological)

Previous Session:
- `984570c`: Implement last prayed for algorithm
- `e87b5bc`: Add comprehensive documentation for last prayed for algorithm

Current Session:
- `9231e99`: Fix React2Shell vulnerability (CVE-2025-66478)
- `39734c8`: Fix Turbopack webpack config warning in Next.js 16
- `56348e4`: Improve mobile UX for focused prayer mode (initial)
- `82bc923`: Add scroll functionality to prayer cards on mobile
- `70eb0ca`: Fix scroll functionality by removing overflow-hidden wrapper
- `1e5787d`: Fix group switcher by replacing Sheet with custom dropdown
- `386560e`: Fix mobile UX issues in focused prayer mode (final)

---

## Development Environment

- **Platform**: macOS (Darwin 24.5.0)
- **Repository**: Together App (Git)
- **Branch**: pr-2-navigation-restructure
- **Main Branch**: main
- **Node/Package Manager**: npm
- **Framework**: Next.js 16.0.10 (Turbopack)
- **UI Library**: React 19, Radix UI, Tailwind CSS
- **Database**: Firebase/Firestore
- **Deployment**: Vercel

---

## Communication Patterns

### Effective Patterns Observed
1. **Clear Issue Reporting**: User provided screenshots, specific symptoms
2. **Iterative Testing**: Deploy → test → report → fix cycle
3. **Question-Driven Planning**: Asked for preferences before implementation
4. **Documentation Requests**: Proactive request to preserve context

### Process Improvements
1. **Plan Mode Usage**: Investigated before coding, validated approach
2. **Parallel Exploration**: Used 3 agents simultaneously for comprehensive research
3. **User Validation**: Asked questions about mobile UX preferences upfront
4. **Commit Granularity**: Small, focused commits with detailed messages

---

## Notes for Future Sessions

### Context Preservation
- Previous work fully documented in `/docs/last-prayed-for-algorithm.md`
- Process and decisions captured in this file
- Plan files available in `/Users/chrislocke/.claude/plans/`

### Current State
- Next.js updated to 16.0.10 (secure)
- Mobile UX fixes deployed
- Group switcher needs user testing clarification
- All three mobile issues addressed

### Next Steps
1. Verify group switcher works in focused prayer mode (not Groups page)
2. Test on real mobile device for touch scroll
3. Monitor for any hydration errors or performance issues
4. Consider future enhancements listed above

---

**Last Updated**: December 23, 2024
**Session**: Context continuation after auto-compact
**Branch**: pr-2-navigation-restructure
**Latest Commit**: 386560e
