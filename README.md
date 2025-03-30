# Together App

A prayer management application for tracking prayer requests, organizing groups, and managing follow-ups.

## Overview

Together is a web application built with Next.js, TypeScript, and Tailwind CSS that helps users manage prayer requests, organize prayer groups, and track follow-ups. The app provides an intuitive note-taking experience with special syntax for creating prayer requests and follow-ups.

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: React Context with useState/useReducer
- **Backend**: (Future implementation) Firebase or similar service for authentication and data storage

## Core Data Models

### User
- `id`: string
- `email`: string
- `displayName`: string
- `createdAt`: timestamp
- `settings`: object

### Person
- `id`: string
- `name`: string
- `createdBy`: userId
- `groupIds`: string[]
- `prayerRequests`: PrayerRequest[]
- `followUps`: FollowUp[]
- `lastPrayedFor`: timestamp

### Group
- `id`: string
- `name`: string
- `createdBy`: userId
- `personIds`: string[]
- `prayerDays`: number[] (0-6 representing Sun-Sat)
- `prayerSettings`: object (random, recent, etc.)

### PrayerRequest
- `id`: string
- `personId`: string
- `content`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `prayedForDates`: timestamp[]

### FollowUp
- `id`: string
- `personId`: string
- `content`: string
- `dueDate`: timestamp
- `completed`: boolean
- `completedAt`: timestamp
- `isRecurring`: boolean
- `recurringPattern`: object

## Key Screens

### 1. Notetaking Screen

**Purpose**: Capture prayer requests during meetings with intuitive syntax.

**Essential UI Elements**:
- Text editor with syntax highlighting
- Auto-suggestion for existing people

**Key Functionality**:
- Parse special syntax:
  - `@PersonName` creates/references a person
  - Text following a person becomes prayer requests
  - `#MMDD` format sets follow-up date (e.g., `#0315` for March 15)
  - Text after date becomes follow-up items
- Support multiple people mentions (`@Person1 @Person2`)
- Auto-structure raw text into data objects

### 2. Prayer Screen

**Purpose**: Provide a daily prayer list and track prayer history.

**Essential UI Elements**:
- Date navigation (previous/next day)
- Prayer request cards
- Expandable details
- "Prayed" button

**Key Functionality**:
- Show prayer requests for the selected day
- Mark prayers as completed
- View prayer history and statistics
- Expand/collapse prayer details

### 3. Assignment Screen

**Purpose**: Manage prayer groups and day assignments.

**Essential UI Elements**:
- Tabs for "People & Groups" and "Groups & Days" views
- Group management interface
- Day selection interface

**Key Functionality**:
- Assign people to groups
- Set prayer days for groups
- Configure prayer selection method (all, random, least recent)
- Set number of people to pray for per day

### 4. Follow-ups Screen

**Purpose**: Track and manage follow-up items.

**Essential UI Elements**:
- Tabs for active and completed follow-ups
- Categorized sections (overdue, upcoming, no date)
- Checkboxes for completion

**Key Functionality**:
- View follow-ups by status
- Mark follow-ups as completed
- Set dates for follow-ups
- Filter by different categories

## Implementation Priorities

1. Core UI and navigation structure
2. Note-taking with syntax parsing
3. Prayer request management
4. Group and assignment management
5. Follow-up tracking
6. User authentication
7. Data persistence
8. Offline support

## State Management

The application uses React's built-in state management with useState and useReducer hooks. For more complex state management needs, a lightweight solution like Zustand could be implemented.

## UI Design Principles

- Clean, minimalist interface
- Clear visual hierarchy
- Consistent color scheme and typography
- Responsive design for all screen sizes
- Accessible UI elements
- Dark mode support

## Deployment

The application can be deployed to Vercel or similar platforms for web hosting.

