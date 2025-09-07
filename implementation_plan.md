
Here’s the **updated implementation plan** with **NW\.js packaging** included:

---

## 1. Project Setup

* **Tech stack**:

  * UI:  React 
  * Runtime: **NW\.js** (runs Chromium + Node.js together).
  * Database: **SQLite** (local `.sqlite` file).
  * Encryption: Node `crypto` (AES for drafts, bcrypt for passwords).
  * PDF generation: jsPDF or pdf-lib (client-side).

---

## 2. Features & Implementation

### A. Authentication & Admin

* **Login Page**:

  * Admin account seeded in DB on first run.
  * Users stored in `users` table (username, hashed password).
* **Admin Panel**:

  * Create/delete accounts.
  * Confirmation modal before deletion.

---

### B. PCR Form

* **Form Entries**:

  * Linked to `user_id`.
* **Autosave Draft**:

  * Every few seconds → encrypted draft saved in `drafts` table.
  * Drafts expire automatically after 24h (checked on load).
* **Session Timeout**:

  * Auto logout after 15 minutes inactivity.
  * Warning at 14 min (`You will be logged out soon`).

---

### C. Logs

* **Logs Table**:

  * Store user, action (`draft saved`, `submitted`, `failure`), timestamp.
* **Logs Page**:

  * Admin can view activity with filters.

---

### D. Submission & PDF

* **Submit Flow**:

  * Generate PDF (not saved to DB).
  * Show in print preview window.
  * “Confirm Printed” button closes the preview.
* **Clear Form**:

  * Confirmation modal before clearing inputs.

---

## 3. Security (Local-Only)

* Passwords hashed with bcrypt.
* Drafts encrypted with AES key.
* No need for HTTPS since app runs locally.
* SQLite DB file stored in app’s data folder.

---

## 4. Database Schema (SQLite)

**users**

* `id` (PK, int)
* `username` (text, unique)
* `password_hash` (text)
* `role` (text: admin/user)

**drafts**

* `id` (PK, int)
* `user_id` (FK → users.id)
* `data_encrypted` (blob/text)
* `created_at` (datetime)
* `expires_at` (datetime)

**submissions**

* `id` (PK, int)
* `user_id` (FK → users.id)
* `data` (json/text)
* `submitted_at` (datetime)

**logs**

* `id` (PK, int)
* `user_id` (FK → users.id)
* `action` (text: draft\_saved, submitted, failure, login, logout, cleared)
* `timestamp` (datetime)

---

## 5. NW\.js Integration

* **Project Structure**:

  ```
  pcr-app/
  ├── package.json   (NW.js config)
  ├── index.html     (login page)
  ├── admin.html     (admin UI)
  ├── form.html      (PCR form)
  ├── logs.html      (logs page)
  ├── js/            (frontend logic)
  ├── backend/       (db + encryption code)
  └── db.sqlite      (local DB file)
  ```
* **NW\.js Config (`package.json`)**:

  ```json
  {
    "name": "pcr-app",
    "main": "index.html",
    "window": {
      "title": "PCR System",
      "width": 1200,
      "height": 800,
      "position": "center"
    }
  }
  ```
* **Packaging**:

  * Run app with:

    ```bash
    nw .
    ```
  * Bundle into `.exe` or `.app` with `nw-builder`.

---

## 6. Deployment

* Runs **entirely offline** on one PC.
* Installable as a desktop app (no browser needed).
* SQLite DB file can be backed up manually.

---

Do you want me to also give you a **ready-to-use NW\.js `package.json`** (with build scripts using `nw-builder`) so you can directly compile it into `.exe` or `.app`?
