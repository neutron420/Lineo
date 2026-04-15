# Lineo — Feature Specification & Technical Architecture

This document provides a detailed breakdown of every feature implemented in the Lineo SaaS platform, including internal logic, data flows, and technical implementation.

---

## 1. Multi-Tenant Architecture
**Description:** A single instance of Lineo supports thousands of independent organizations (Hospitals, Banks, Clinics).
*   **How it Works:** 
    *   Every data entity (Queue, User, Appointment, Audit) is tagged with an `organization_id`.
    *   Staff and Admins are restricted to their organization using GORM `Where` clauses and JWT middleware.
*   **Technical Detail:** Uses PostgreSQL for relational data and Redis for scoped real-time state.

## 2. Real-Time Token Synchronization
**Description:** Users see their live position in line without refreshing the page.
*   **How it Works:**
    1.  When a staff member clicks **"Call Next"**, a `QueueEvent` is published to **RabbitMQ**.
    2.  A background worker consumes the event and recalculates the queue state in **Redis**.
    3.  The worker then publishes the new state to a **Redis Pub/Sub** channel.
    4.  The API's WebSocket Hub listens to Redis and pushes the update to all connected frontend clients in that organization.
*   **Benefit:** Zero-latency updates and massive scalability compared to polling.

## 3. Geospatial Discovery & Geofencing
**Description:** Find nearby services and prevent "remote joining" to reduce no-shows.
*   **How it Works:**
    *   **Nearby Search:** Uses Google Maps API to search for locations within a specific radius of the user's GPS coordinates.
    *   **Geofencing:** During the `Enqueue` request, the backend calculates the Haversine distance between the User and the Org. If the distance > 1000m (configurable), the request is rejected.
*   **Technical Detail:** Uses `utils.CalculateDistance` logic before persisting the ticket.

## 4.Driven Commute Triggers
**Description:** Notifies users via SMS exactly when they need to leave home based on live traffic.
*   **How it Works:**
    1.  A **Cron Job** runs every 5 minutes and identifies active appointments.
    2.  It sends a job to **RabbitMQ** for each user.
    3.  The Commute Worker fetches the user's location and the Org's location.
    4.  It queries the **Google Maps Distance Matrix API** to get real-time travel duration.
    5.  If `CurrentTime + TravelTime + Buffer` >= `AppointmentTime`, it triggers an SMS to the user.

## 5. Priority & VIP Queue Logic
**Description:** Allows "Emergency" or "Premium" tickets to skip the wait.
*   **How it Works:**
    *   Uses **Redis Sorted Sets (ZSET)** for queue storage.
    *   Normal tickets are scored based on `Timestamp`.
    *   Priority tickets are scored as `Timestamp - 24 Hours`, effectively pushing them to the top of the Sorted Set instantly.
    *   The `DequeueMin` operation always picks the lowest score first.

## 6. Automated Post-Service Feedback
**Description:** Collects customer satisfaction data immediately after service.
*   **How it Works:**
    1.  When a ticket is marked as **"Completed"**, a background routine generates a unique rating URL.
    2.  An SMS is enqueued to RabbitMQ: *"How was your visit? Rate here: lineo.ai/rate/TK-101"*.
    3.  The Feedback Handler stores the 1-5 star rating and text comment in the `feedbacks` table.
*   **Impact:** Build trust and allows organizations to monitor staff performance.

## 7. Intelligent Analytics & Peak Hours
**Description:** Helps organizations manage staff levels by predicting busy periods.
*   **How it Works:**
    *   Aggregates `queue_histories` by `joined_at` hour.
    *   Calculates **Average Service Time** by comparing `served_at` and `completed_at` timestamps.
    *   Displays which counters (booths) are the most efficient through the Staff Dashboard.

## 8. Secure Payment Processing (Razorpay)
**Description:** Monetize the queue by charging for specific services or priority joins.
*   **How it Works:**
    1.  **Order Creation:** Backend generates a Razorpay Order ID and returns it to the UI.
    2.  **Signature Verification:** Upon payment, the backend performs an **HMAC-SHA256** check using the Razorpay Secret to ensure the payment wasn't tampered with.
    3.  **Webhook:** Listens for `payment.captured` events to update ticket status even if the user closes their browser.

## 9. Ticket State Machine
**Description:** Ensures data integrity and prevents invalid actions (e.g., you can't "Cancel" a ticket that is already "Served").
*   **State Flow:** `Pending` -> `Waiting` -> `Called` -> `Serving` -> `Completed`.
*   **Error Handling:** The `ValidateTransition` logic in `internal/ticket/state.go` blocks any illegal movement in the lifecycle.

## 10. Audit Log & Compliance
**Description:** Every single action is tracked for security.
*   **How it Works:** 
    *   Asynchronous auditing via RabbitMQ.
    *   Captures `Who` (ActorID), `What` (Action), `Where` (OrgID), and `Metadata` (Original JSON payload).
    *   Immutable record for organizations to resolve user disputes.

---
*Lineo Technical Specs - Version 2.1*
