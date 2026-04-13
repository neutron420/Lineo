# QueueLess: Enterprise Multi-Tenant Queue & Appointment SaaS

**QueueLess** is a production-grade, high-performance Go backend designed to handle real-time queueing and appointment scheduling for hospitals, clinics, and banks.

---

## 🛠️ Tech Stack
*   **Language**: Go (Clean Architecture: Handler -> Service -> Repository)
*   **Database**: PostgreSQL (Neon Cloud) for persistent data/history.
*   **Caching**: Redis (ZSets for Priority Scaling) for real-time operations.
*   **Real-time**: WebSockets (Gorilla) for live updates.
*   **Auth**: JWT (JSON Web Tokens) with Role-Based Access (User, Admin, Agent).
*   **Security**: Cloudflare Turnstile (Captcha Ready), Haversine Geofencing.
*   **Infrastructure**: Docker, S3 (Documents), Twilio (SMS), Google Places API.

---

## 🚀 How to Run the Project

### 1. Prerequisites
- **Docker & Docker Compose** installed.
- **Go 1.21** (if running locally without docker).

### 2. Setup Environment
Rename `example.env` to `.env` and fill in your keys:
*   `DATABASE_URL` (Neon PostgreSQL)
*   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
*   `GOOGLE_API_KEY`

### 3. Start with Docker (Recommended)
This command starts the API, PostgreSQL, and Redis in one go:
```bash
docker-compose up --build
```
*The server will start at `http://localhost:8080`.*

---

## 🔥 Implemented Features

### 🏢 1. Multi-Tenant Business Architecture
*   Businesses (Clinics/Banks) register as **Organizations**.
*   Staff members are tied to their own Orgs (Isolation security).
*   Document verification system built-in (S3 links for PTax, Building Images, PDF Certs).

### 📅 2. Hybrid Scheduling System
*   **Live Queuing**: Users join the "Now" line instantly.
*   **Appointments**: Book future slots (e.g., Friday at 2 PM).
*   **Priority Auto-Promotion**: Scheduled appointments get **VIP Priority** over walk-in users when they Check-In.
*   **Lifecycle Sync**: When a staff member completes a service, both the Queue Ticket and the Appointment are marked "Completed" simultaneously.

### 🕒 3. Smart Commute & SMS Notifications (Twilio)
*   **Traffic Triggers**: Backend uses Google Distance Matrix to monitor traffic for scheduled users.
*   **"Leave Now" Alert**: Sends SMS text when a user needs to start driving to arrive on time.
*   **Queue Alerts**: Automatically notifies the user when they are 3rd in line.

### 🌍 4. Enterprise-Grade Security
*   **Haversine Geofencing**: Rejects users from joining a queue if they are >1km away from the clinic (Google GPS verification).
*   **Privacy Layer**: Users can *only* see their own data and queue status.
*   **Captcha Integration**: Turnstile placeholder ready for bot protection.
*   **Role-Based Access**: 
    *   **Admin**: Organization setup & Analytics.
    *   **Agent**: Front-desk/Counter handling.
    *   **User**: Booking & Live tracking.

### 📊 5. Analytics & Real-time
*   **Peak Hour Graphs**: SQL analytics to find the busiest times of day.
*   **WebSockets**: Real-time broadcast whenever the line moves.
*   **Kiosk Mode**: Public iPad mode for walk-in users without accounts.

---

## 🛣️ API Endpoints Preview
*   `POST /api/v1/auth/register` (Registration)
*   `POST /api/v1/auth/forgot-password` (Recovery)
*   `GET /api/v1/search/nearby` (Google Places Search)
*   `POST /api/v1/appointments/book` (Booking)
*   `POST /api/v1/admin/queue/:key/next` (Staff Calling Next)
