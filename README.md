# GeoFence Attendance System

React + Vite + Tailwind CSS v4 + Firebase Firestore attendance system.

## Fixed in this version

- Removed Firebase Storage completely.
- User profile photos now use free generated avatar URLs.
- Removed anonymous Firebase sign-in.
- Fixed continuous loading on user login.
- Added safe `try/catch/finally` loading states so the spinner stops even if Firestore rules are wrong.
- Removed Firestore `orderBy` from user/admin queries to avoid missing users and index issues.
- Added admin office location setup from Firestore `settings/officeLocation`.
- Added admin monthly attendance filter and browser PDF print.
- Fixed attendance date/month calculation to use local date instead of UTC, so India dates do not shift wrongly at night.
- Verified the project builds successfully with `npm run build` after a clean install.

## Run

```bash
npm install
npm run dev
```

## Environment

Create `.env` from `.env.example` and add your Firebase config.

## Firestore rules for this no-auth user-login demo

The user login system uses Firestore username + password, not Firebase Auth for normal users. Publish these rules while testing:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if true;
    }

    match /attendance/{attendanceId} {
      allow read, write: if true;
    }

    match /settings/{settingId} {
      allow read, write: if true;
    }
  }
}
```

For production, use Firebase Auth/custom claims or Cloud Functions before making the database private.

## Admin Office Location Setup

The admin dashboard now includes an **Office GeoFence Location** section.

Admin can set:
- Latitude
- Longitude
- Radius in meters
- Location name

The saved location is stored in Firestore:

```text
settings / officeLocation
```

The user Clock In / Clock Out feature automatically uses this saved location. If the admin has not saved a location yet, the app uses the fallback values from `.env`.

Firestore rules must allow the `settings` collection:

```js
match /settings/{settingId} {
  allow read, write: if true;
}
```

## Monthly User Attendance Filter + PDF Print

The admin dashboard now has a **Monthly Attendance Report** section.

Admin can:
- Select a month using the month filter.
- View users filtered by that month.
- See present days, completed days, missing clock-out count, and dates present.
- Click **Print Monthly PDF** to open the browser print dialog and save the monthly report as a PDF.

The report uses the existing `attendance` collection and filters records by the `date` field in `YYYY-MM-DD` format.


## Important clean install note

Do not copy old `node_modules` from another ZIP/computer. Run a clean install:

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

On Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run dev
```
