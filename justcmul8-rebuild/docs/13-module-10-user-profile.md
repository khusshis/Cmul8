# Module 10: User Profile & Settings

## Overview
The User Profile & Settings module provides a centralized interface for users to manage their account details, subscription status, and application-wide preferences. It ensures users have full control over their identity and workspace settings within the platform.

## Proposed Architecture

### 1. Account Management
- **Profile Data**: Users can update their display name, avatar, and contact email.
- **Security**: Password reset and two-factor authentication (2FA) settings, handled natively through Supabase Auth.
- **Session Management**: Ability to view and revoke active sessions across different devices.

### 2. Workspace Preferences
- **Default SimType**: Users can choose which simulation engine (e.g., Human Queue, Vehicle) loads by default when creating a new project.

### 3. Subscription Tier
- Display current active plan (e.g., Free vs. Pro).
- Usage metrics (e.g., "3 of 5 active projects used").
- Integration with Stripe for payment processing and plan upgrades.

## Design Integration (Professional Light Theme)
- **Layout**: The settings page will utilize the clean, light background (`var(--color-bg)`) to maintain consistency with the rest of the application.
- **Form Elements**: 
  - Text inputs will use standard, clean borders (`var(--color-border)`) and white backgrounds (`var(--color-surface)`), transitioning to the primary accent color (`var(--color-accent)`) on focus.
  - Toggle switches will use semantic status colors (e.g., `var(--color-success)`) when active, and dim grey when inactive.
- **Data Visualization**: Usage metrics (like project quotas) will be displayed using clean progress bars.
