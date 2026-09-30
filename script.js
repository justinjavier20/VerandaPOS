const DEFAULT_USERS = [
    {
        username: "adminpoako",
        password: "admin123",
        role: "Admin"
    },
    {
        username: "staffpoako",
        password: "staff123",
        role: "Staff"
    }
];

const USERS_STORAGE_KEY = "verandaCustomUsers";
const PENDING_USERS_STORAGE_KEY = "verandaPendingUsers";
let USERS = [...DEFAULT_USERS];
let pendingStaffAccounts = [];

function loadSavedUsers() {
    try {
        const savedUsers = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || "[]");
        USERS = [];

        for (let i = 0; i < DEFAULT_USERS.length; i++) {
            USERS[USERS.length] = DEFAULT_USERS[i];
        }

        if (Array.isArray(savedUsers)) {
            for (let i = 0; i < savedUsers.length; i++) {
                const user = savedUsers[i];

                if (!user || !user.username || !user.password) {
                    continue;
                }

                const savedUser = {
                    username: user.username,
                    password: user.password,
                    role: user.role || "Staff"
                };
                let existingIndex = -1;

                for (let j = 0; j < USERS.length; j++) {
                    if (USERS[j].username.toLowerCase() === user.username.toLowerCase()) {
                        existingIndex = j;
                        break;
                    }
                }

                if (existingIndex === -1) {
                    USERS[USERS.length] = savedUser;
                } else {
                    USERS[existingIndex] = savedUser;
                }
            }
        }
    } catch (error) {
        USERS = [];

        for (let i = 0; i < DEFAULT_USERS.length; i++) {
            USERS[USERS.length] = DEFAULT_USERS[i];
        }
    }
}

function loadPendingAccounts() {
    try {
        const saved = JSON.parse(localStorage.getItem(PENDING_USERS_STORAGE_KEY) || "[]");
        pendingStaffAccounts = Array.isArray(saved) ? saved : [];
    } catch (error) {
        pendingStaffAccounts = [];
    }
}

function saveUsers() {
    const customUsers = [];

    for (let i = 0; i < USERS.length; i++) {
        let isDefaultUser = false;

        for (let j = 0; j < DEFAULT_USERS.length; j++) {
            if (DEFAULT_USERS[j].username.toLowerCase() === USERS[i].username.toLowerCase()) {
                isDefaultUser = true;
                break;
            }
        }

        if (!isDefaultUser) {
            customUsers[customUsers.length] = USERS[i];
        }
    }

    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(customUsers));
}

function savePendingAccounts() {
    localStorage.setItem(PENDING_USERS_STORAGE_KEY, JSON.stringify(pendingStaffAccounts));
}

loadSavedUsers();
loadPendingAccounts();

const STAFF_ALLOWED = [
    "reservations",
    "findReservation",
    "sortReservations",
    "diningMonitor",
    "tableAvailability",
    "assignTable",
    "waitlist",
    "checkIn",
    "billSummary",
    "discounts",
    "payment"
];

const packages = [
    {
        type: "Adult",
        price: 369
    },
    {
        type: "Kid",
        price: 269
    },
    {
        type: "Senior",
        price: 295
    }
];

const tables = [
    { number: 1, seats: 4, status: "available" },
    { number: 2, seats: 4, status: "available" },
    { number: 3, seats: 4, status: "available" },
    { number: 4, seats: 4, status: "available" },
    { number: 5, seats: 4, status: "available" },
    { number: 6, seats: 6, status: "available" },
    { number: 7, seats: 6, status: "available" },
    { number: 8, seats: 6, status: "available" },
    { number: 9, seats: 6, status: "available" },
    { number: 10, seats: 6, status: "available" },
    { number: 11, seats: 8, status: "available" },
    { number: 12, seats: 8, status: "available" },
    { number: 13, seats: 8, status: "available" },
    { number: 14, seats: 8, status: "available" },
    { number: 15, seats: 8, status: "available" },
    { number: 16, seats: 10, status: "available" },
    { number: 17, seats: 10, status: "available" },
    { number: 18, seats: 10, status: "available" },
    { number: 19, seats: 10, status: "available" },
    { number: 20, seats: 20, status: "available" }
];

const RESERVATION_STORAGE_KEY = "verandaReservations";
const STAFF_NOTICE_STORAGE_KEY = "verandaStaffNotice";
const DINING_DURATION_MS = 90 * 60 * 1000;
const DINING_WARNING_MS = 15 * 60 * 1000;

let reservations = [];
let waitlist = [];
let activeWalkIns = [];
let transactions = [];

let currentUser = null;
let customerView = "home";
let customerConfirmation = null;
let customerLookupReservationId = null;
let customerLookupMessage = "";
let activeSection = "reservations";
let flashMsg = null;
let sortedView = null;
let lastReceipt = null;

let nextReservationId = 1;
let nextWaitlistId = 1;
let nextTransactionId = 1;

let currentOrder = {
    reservationName: "",
    adult: 0,
    kid: 0,
    senior: 0,
    isPWD: false,
    subtotal: 0,
    discount: 0,
    total: 0,
    sourceType: null,
    sourceId: null,
    tableNumber: null
};

function reservationReference(reservation) {
    return reservation.publicId ||
        `VR-${String(reservation.id).padStart(5, "0")}`;
}

function diningTimerData(reservation, now = Date.now()) {
    const checkInTimestamp = Number(reservation.checkInTimestamp);

    if (!Number.isFinite(checkInTimestamp) || checkInTimestamp <= 0) {
        return null;
    }

    const endTimestamp = checkInTimestamp + DINING_DURATION_MS;
    const remainingMs = Math.max(0, endTimestamp - now);

    return {
        checkInTimestamp: checkInTimestamp,
        endTimestamp: endTimestamp,
        remainingMs: remainingMs,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        status: remainingMs === 0
            ? "Time Ended"
            : remainingMs <= DINING_WARNING_MS
                ? "Time Warning"
                : "Dining"
    };
}

function formatDiningTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatDiningCountdown(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return (
        String(hours).padStart(2, "0") + ":" +
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0")
    );
}

function loadSharedReservations() {
    let saved = null;

    try {
        saved = JSON.parse(
            localStorage.getItem(RESERVATION_STORAGE_KEY) || "[]"
        );
    } catch (error) {
        saved = [];
    }

    if (!Array.isArray(saved)) {
        saved = [];
    }

    reservations = saved;
    nextReservationId = 1;

    for (let i = 0; i < reservations.length; i++) {
        const candidate = Number(reservations[i].id) + 1;

        if (candidate > nextReservationId) {
            nextReservationId = candidate;
        }
    }
}

function saveSharedReservations() {
    try {
        localStorage.setItem(
            RESERVATION_STORAGE_KEY,
            JSON.stringify(reservations)
        );
    } catch (error) {
        console.error("Could not save reservations in this browser.", error);
    }
}

function storeStaffNotice(text) {
    try {
        localStorage.setItem(
            STAFF_NOTICE_STORAGE_KEY,
            JSON.stringify({
                text: text,
                createdAt: Date.now()
            })
        );
    } catch (error) {
        console.error("Could not save staff notification.", error);
    }
}

function readStaffNotice() {
    try {
        const raw = localStorage.getItem(STAFF_NOTICE_STORAGE_KEY);

        if (!raw) {
            return null;
        }

        const notice = JSON.parse(raw);

        if (!notice || typeof notice.text !== "string") {
            return null;
        }

        return notice;
    } catch (error) {
        return null;
    }
}

function consumeStaffNotice() {
    const notice = readStaffNotice();

    if (!notice) {
        return null;
    }

    try {
        localStorage.removeItem(STAFF_NOTICE_STORAGE_KEY);
    } catch (error) {
        console.error("Could not clear staff notification.", error);
    }

    return notice;
}

function showCustomerHome() {
    currentUser = null;
    document.body.classList.add("logged-out");
    document.body.classList.remove("staff-login-mode");
    document.getElementById("loginOverlay").style.display = "none";
    document.getElementById("customerApp").hidden = false;
    customerView = "home";
    renderCustomer();
}

function showStaffLogin() {
    document.body.classList.add("logged-out", "staff-login-mode");
    document.getElementById("customerApp").hidden = true;
    document.getElementById("loginOverlay").style.display = "flex";
    hideCreateAccountForm();
    document.getElementById("loginError").textContent = "";
}

function showCreateAccountForm() {
    const panel = document.getElementById("createAccountPanel");
    const error = document.getElementById("createAccountError");

    panel.hidden = false;
    document.querySelector(".login-card").classList.add("creating-account");
    error.textContent = "";
    error.style.color = "#b42318";
    document.getElementById("createUsername").value = "";
    document.getElementById("createPassword").value = "";
    document.getElementById("createPasswordConfirm").value = "";
}

function hideCreateAccountForm() {
    const panel = document.getElementById("createAccountPanel");
    const error = document.getElementById("createAccountError");

    panel.hidden = true;
    document.querySelector(".login-card").classList.remove("creating-account");
    error.textContent = "";
    error.style.color = "#b42318";
    document.getElementById("createUsername").value = "";
    document.getElementById("createPassword").value = "";
    document.getElementById("createPasswordConfirm").value = "";
    document.getElementById("createPassword").type = "password";
    document.getElementById("createPasswordConfirm").type = "password";
    document.querySelectorAll(".password-toggle").forEach(button => {
        button.textContent = "Show";
    });
}

function togglePasswordVisibility(id) {
    const input = document.getElementById(id);
    const button = input.parentElement.querySelector(".password-toggle");

    if (!input || !button) {
        return;
    }

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.textContent = isPassword ? "Hide" : "Show";
}

function confirmCreateAccount() {
    const username = document.getElementById("createUsername").value.trim();
    const password = document.getElementById("createPassword").value;
    const confirmPassword = document.getElementById("createPasswordConfirm").value;
    const error = document.getElementById("createAccountError");

    if (!username || !password || !confirmPassword) {
        error.textContent = "Complete all account fields before continuing.";
        error.style.color = "#b42318";
        return;
    }

    let usernameInUse = false;

    for (let i = 0; i < USERS.length; i++) {
        if (USERS[i].username.toLowerCase() === username.toLowerCase()) {
            usernameInUse = true;
            break;
        }
    }

    for (let i = 0; !usernameInUse && i < pendingStaffAccounts.length; i++) {
        if (pendingStaffAccounts[i].username.toLowerCase() === username.toLowerCase()) {
            usernameInUse = true;
        }
    }

    if (usernameInUse) {
        error.textContent = "That username is already in use.";
        error.style.color = "#b42318";
        return;
    }

    if (password.length < 6) {
        error.textContent = "Password must be at least 6 characters long.";
        error.style.color = "#b42318";
        return;
    }

    if (password !== confirmPassword) {
        error.textContent = "Passwords do not match.";
        error.style.color = "#b42318";
        return;
    }

    pendingStaffAccounts[pendingStaffAccounts.length] = {
        id: Date.now() + Math.random(),
        username: username,
        password: password,
        requestedAt: new Date().toISOString()
    };
    savePendingAccounts();

    document.getElementById("createUsername").value = "";
    document.getElementById("createPassword").value = "";
    document.getElementById("createPasswordConfirm").value = "";

    document.getElementById("loginError").textContent = "Account request submitted. Please wait for admin approval.";
    document.getElementById("loginError").style.color = "#0a7f38";
    hideCreateAccountForm();
    error.textContent = "";
    error.style.color = "#b42318";
}

function renderCustomer() {
    const app = document.getElementById("customerApp");

    if (!app || currentUser) {
        return;
    }

    app.hidden = false;

    if (customerView === "form") {
        app.innerHTML = renderCustomerForm();
    } else if (customerView === "lookup") {
        app.innerHTML = renderCustomerLookup(
            findReservationById(customerLookupReservationId),
            customerLookupMessage
        );
    } else if (customerView === "confirmation") {
        app.innerHTML = renderCustomerConfirmation(customerConfirmation);
    } else {
        app.innerHTML = renderCustomerHome();
    }

    const date = document.getElementById("customer-date");

    if (date) {
        date.min = today();
    }
}

function customerHeader() {
    return `
        <header class="customer-header">
            <div class="customer-brand">
                <img
                    class="customer-brand-logo"
                    src="295049ea-2cf1-42f9-9b67-5a65c67ebc73-removebg-preview.png"
                    alt=""
                >
                <span>Veranda Resto Garden</span>
            </div>
            ${customerView !== "home" ? `
                <nav class="customer-header-actions" aria-label="Customer menu">
                    <button class="customer-link" onclick="showCustomerHome()">Home</button>
                </nav>
            ` : ""}
        </header>
    `;
}

function customerFooter() {
    return `
        <footer class="customer-admin-access customer-site-footer">
            <address class="customer-location">Veranda Resto Garden, 232 MacArthur Highway Calumpit Central Luzon</address>
            <div class="customer-site-team">
                Restaurant team? <button onclick="showStaffLogin()">Staff / Admin Login</button>
            </div>
        </footer>
    `;
}

function renderCustomerHome() {
    return `
        ${customerHeader()}
        <section class="customer-hero">
            <div>
                <h1>Welcome to Veranda Resto Garden!</h1>
                <p>A unique dining experience where delicious flavors meet a tranquil garden setting. Enjoy a menu crafted from locally sourced ingredients.</p>
                <p>Join us for good food, great company, and unforgettable moments!</p>
                <div class="customer-actions">
                    <button class="customer-primary" onclick="showCustomerForm()">Make a Reservation</button>
                    <button class="customer-secondary" onclick="showCustomerLookup()">View My Reservation</button>
                </div>
            </div>
        </section>
        ${customerFooter()}
    `;
}

function renderCustomerForm() {
    return `
        ${customerHeader()}
        <section class="customer-panel">
            <h1>Make a Reservation</h1>
            <p>Send a booking request to Veranda Resto Garden. Reservations are pending until confirmed by our team.</p>
            <form onsubmit="submitCustomerReservation(event)">
                <div class="customer-form-grid">
                    <div class="customer-field">
                        <label for="customer-name">Customer Name</label>
                        <input id="customer-name" name="name" autocomplete="name" required>
                    </div>
                    <div class="customer-field">
                        <label for="customer-contact">Contact Number</label>
                        <input id="customer-contact" name="contact" type="tel" autocomplete="tel" required>
                    </div>
                    <div class="customer-field">
                        <label for="customer-date">Reservation Date</label>
                        <input id="customer-date" name="date" type="date" min="${today()}" required>
                    </div>
                    <div class="customer-field">
                        <label for="customer-time">Reservation Time</label>
                        <input id="customer-time" name="time" type="time" required>
                    </div>
                    <div class="customer-field">
                        <label for="customer-adults">Number of Adults</label>
                        <input id="customer-adults" name="adult" type="number" min="0" value="0" required>
                    </div>
                    <div class="customer-field">
                        <label for="customer-kids">Number of Kids</label>
                        <input id="customer-kids" name="kid" type="number" min="0" value="0" required>
                    </div>
                    <div class="customer-field">
                        <label for="customer-seniors">Number of Seniors</label>
                        <input id="customer-seniors" name="senior" type="number" min="0" value="0" required>
                    </div>
                    <div class="customer-field full">
                        <label for="customer-request">Special Request (optional)</label>
                        <textarea id="customer-request" name="specialRequest" maxlength="500"></textarea>
                    </div>
                </div>
                <div id="customer-form-error" class="customer-error" role="alert"></div>
                <div class="customer-form-actions">
                    <button class="customer-primary" type="submit">Submit Reservation</button>
                    <button class="customer-secondary" type="button" onclick="showCustomerHome()">Back</button>
                </div>
            </form>
        </section>
        ${customerFooter()}
    `;
}

function showCustomerForm() {
    customerView = "form";
    customerConfirmation = null;
    renderCustomer();
}

function showCustomerLookup() {
    customerView = "lookup";
    customerConfirmation = null;
    customerLookupReservationId = null;
    customerLookupMessage = "";
    renderCustomer();
}

function findReservationById(id) {
    if (id === null || id === undefined) {
        return null;
    }

    for (let i = 0; i < reservations.length; i++) {
        if (reservations[i].id === id) {
            return reservations[i];
        }
    }

    return null;
}

function submitCustomerReservation(event) {
    event.preventDefault();

    loadSharedReservations();

    const name = document.getElementById("customer-name").value.trim();
    const contact = document.getElementById("customer-contact").value.trim();
    const date = document.getElementById("customer-date").value;
    const time = document.getElementById("customer-time").value;
    const adult = Math.max(0, Number(document.getElementById("customer-adults").value) || 0);
    const kid = Math.max(0, Number(document.getElementById("customer-kids").value) || 0);
    const senior = Math.max(0, Number(document.getElementById("customer-seniors").value) || 0);
    const guests = adult + kid + senior;
    const error = document.getElementById("customer-form-error");

    if (!name || !contact || !date || !time) {
        error.textContent = "Complete the required fields to continue.";
        return;
    }

    if (!validReservationDate(date, time)) {
        error.textContent = "Choose a date and time that has not passed.";
        return;
    }

    if (guests < 1) {
        error.textContent = "Enter at least one guest.";
        return;
    }

    const reservation = {
        id: nextReservationId++,
        publicId: "",
        name: name,
        contact: contact,
        date: date,
        time: time,
        guests: guests,
        adult: adult,
        kid: kid,
        senior: senior,
        specialRequest: document.getElementById("customer-request").value.trim(),
        tableNumber: null,
        status: "pending",
        checkInTime: null
    };

    reservation.publicId = reservationReference(reservation);
    reservations[reservations.length] = reservation;
    saveSharedReservations();
    storeStaffNotice(
        `New reservation received: ${reservationReference(reservation)} for ${reservation.name} (${reservation.guests} guests) on ${reservation.date} at ${reservation.time}.`
    );

    customerConfirmation = reservation;
    customerView = "confirmation";
    renderCustomer();
}

function renderCustomerLookup(result = null, message = "") {
    let resultMarkup = "";

    if (message) {
        resultMarkup = `<p class="customer-error" role="alert">${message}</p>`;
    } else if (result) {
        resultMarkup = customerReservationSummary(result);
    }

    return `
        ${customerHeader()}
        <section class="customer-panel">
            <h1>View My Reservation</h1>
            <p>Enter your reservation ID, name, and contact number to view its current status.</p>
            <form onsubmit="lookupCustomerReservation(event)">
                <div class="customer-form-grid">
                    <div class="customer-field">
                        <label for="lookup-reference">Reservation ID</label>
                        <input id="lookup-reference" required placeholder="VR-00000">
                    </div>
                    <div class="customer-field">
                        <label for="lookup-name">Customer Name</label>
                        <input id="lookup-name" autocomplete="name" required>
                    </div>
                    <div class="customer-field">
                        <label for="lookup-contact">Contact Number</label>
                        <input id="lookup-contact" type="tel" autocomplete="tel" required>
                    </div>
                </div>
                <div class="customer-form-actions">
                    <button class="customer-primary" type="submit">View Reservation</button>
                    <button class="customer-secondary" type="button" onclick="showCustomerHome()">Back</button>
                </div>
            </form>
            ${resultMarkup}
        </section>
        ${customerFooter()}
    `;
}

function customerReservationSummary(reservation) {
    const timer = diningTimerData(reservation);
    const statusLabels = {
        pending: "Pending Approval",
        confirmed: "Confirmed",
        arrived: "Checked In",
        cancelled: "Cancelled"
    };
    const reservationStatus = statusLabels[reservation.status] || reservation.status;
    const diningClass = timer && timer.status === "Time Ended"
        ? "ended"
        : timer && timer.status === "Time Warning"
            ? "warning"
            : "";
    const reservationDate = new Date(`${reservation.date}T00:00:00`);
    const formattedDate = Number.isNaN(reservationDate.getTime())
        ? reservation.date
        : reservationDate.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });
    const reservationTime = new Date(`1970-01-01T${reservation.time}`);
    const formattedTime = Number.isNaN(reservationTime.getTime())
        ? reservation.time
        : reservationTime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit"
        });

    return `
        <div class="reservation-confirmation">
            <h2>Reservation Details</h2>
            <dl class="reservation-detail-list">
                <div><dt>Reservation ID</dt><dd>${escapeHtml(reservationReference(reservation))}</dd></div>
                <div><dt>Name</dt><dd>${escapeHtml(reservation.name)}</dd></div>
                <div><dt>Contact</dt><dd>${escapeHtml(reservation.contact || "")}</dd></div>
                <div><dt>Date</dt><dd>${escapeHtml(formattedDate)}</dd></div>
                <div><dt>Time</dt><dd>${escapeHtml(formattedTime)}</dd></div>
                <div><dt>Adults</dt><dd>${Number(reservation.adult) || 0}</dd></div>
                <div><dt>Kids</dt><dd>${Number(reservation.kid) || 0}</dd></div>
                <div><dt>Seniors</dt><dd>${Number(reservation.senior) || 0}</dd></div>
                <div><dt>Table</dt><dd>${reservation.tableNumber ? `Table ${escapeHtml(reservation.tableNumber)}` : "Pending"}</dd></div>
                <div><dt>Status</dt><dd>${escapeHtml(reservationStatus)}</dd></div>
            </dl>
            ${timer ? `
                <p><b>Dining Status:</b> <span class="customer-dining-status ${diningClass}" data-customer-dining-status="${reservation.id}">${timer.status}</span></p>
                <p><b>Checked In:</b> ${escapeHtml(formatDiningTime(timer.checkInTimestamp))}</p>
                <p><b>End Time:</b> ${escapeHtml(formatDiningTime(timer.endTimestamp))}</p>
                <p><b>Time Remaining:</b> <span data-customer-dining-time="${reservation.id}">${formatDiningCountdown(timer.remainingSeconds)}</span></p>
            ` : ""}
            ${reservation.status !== "cancelled" ? `
                <div class="customer-form-actions">
                    <button class="customer-primary customer-cancel-reservation" onclick="cancelCustomerReservation(${Number(reservation.id)})">Cancel Reservation</button>
                </div>
            ` : ""}
        </div>
    `;
}

function renderCustomerConfirmation(reservation) {
    return `
        ${customerHeader()}
        <section class="customer-panel">
            <h1>Reservation Request Received</h1>
            <p>Please keep your Reservation ID. Your request is pending until the restaurant confirms it.</p>
            ${customerReservationSummary(reservation)}
            <div class="customer-form-actions">
                <button class="customer-primary" onclick="showCustomerLookup()">View My Reservation</button>
                <button class="customer-secondary" onclick="showCustomerHome()">Return Home</button>
            </div>
        </section>
        ${customerFooter()}
    `;
}

function lookupCustomerReservation(event) {
    event.preventDefault();
    const reference = document.getElementById("lookup-reference").value.trim().toUpperCase();
    const name = document.getElementById("lookup-name").value.trim().toLowerCase();
    const contact = document.getElementById("lookup-contact").value.trim();
    let found = null;
    loadSharedReservations();

    for (let i = 0; i < reservations.length; i++) {
        if (
            reservationReference(reservations[i]).toUpperCase() === reference &&
            String(reservations[i].name || "").trim().toLowerCase() === name &&
            String(reservations[i].contact || "").trim() === contact
        ) {
            found = reservations[i];
            break;
        }
    }

    customerView = "lookup";
    customerLookupReservationId = found ? found.id : null;
    customerLookupMessage = found
        ? ""
        : "We could not find a reservation matching those details.";
    renderCustomer();
}

function cancelCustomerReservation(id) {
    loadSharedReservations();
    const reservation = findReservationById(id);

    if (!reservation || reservation.status === "cancelled") {
        return;
    }

    if (!confirm(`Cancel the reservation for ${reservation.name}?`)) {
        return;
    }

    if (reservation.tableNumber) {
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].number === reservation.tableNumber) {
                tables[i].status = "available";
            }
        }
    }

    reservation.status = "cancelled";
    saveSharedReservations();
    customerLookupReservationId = reservation.id;
    customerLookupMessage = "";
    renderCustomer();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

const NAV = [
    {
        group: "Reservations",
        items: [
            ["reservations", "Reservations"],
            ["findReservation", "Find a Reservation"],
            ["sortReservations", "Sort Reservations"]
        ]
    },
    {
        group: "Floor & Queue",
        items: [
            ["tableAvailability", "Table Availability"],
            ["assignTable", "Assign a Table"],
            ["waitlist", "Walk-in Waiting List"],
            ["checkIn", "Check-In"],
            ["diningMonitor", "Dining Monitor"]
        ]
    },
    {
        group: "Orders & Billing",
        items: [
            ["billSummary", "Bill Summary"],
            ["discounts", "Discounts"],
            ["payment", "Payment"]
        ]
    },
    {
        group: "Reports",
        items: [
            ["dailyReport", "Daily Report"]
        ]
    },
    {
        group: "Admin",
        items: [
            ["accountApprovals", "Account Approvals"]
        ]
    }
];



function login() {
    const username =
        document.getElementById("loginUsername").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const error =
        document.getElementById("loginError");

    if (!username) {
        error.textContent =
            "Please enter your username.";
        return;
    }

    if (!password) {
        error.textContent =
            "Please enter your password.";
        return;
    }

    let user = null;

    for (let i = 0; i < USERS.length; i++) {
        if (
            USERS[i].username.toLowerCase() === username.toLowerCase() &&
            USERS[i].password === password
        ) {
            user = USERS[i];
            break;
        }
    }

    if (!user) {
        error.textContent = "Incorrect password.";
        return;
    }

    currentUser = user;
    activeSection = "reservations";

    const pendingNotice = consumeStaffNotice();

    if (pendingNotice) {
        setFlash(pendingNotice.text);
    }

    document.getElementById("customerApp").hidden = true;
    document.body.classList.remove("staff-login-mode");

    document.body.classList.remove("logged-out");

    document.getElementById("loginOverlay")
        .style.display = "none";

    document.getElementById("loggedUser")
        .textContent =
        user.username;

    render();
}

function logout() {
    currentUser = null;

    document.body.classList.add("logged-out", "staff-login-mode");
    document.getElementById("customerApp").hidden = true;

    document.getElementById("loginOverlay")
        .style.display = "flex";

    document.getElementById("loginUsername")
        .value = "";

    document.getElementById("loginPassword")
        .value = "";

    document.getElementById("loginError")
        .textContent = "";

    hideCreateAccountForm();
}



function go(id) {
    if (
        currentUser.role === "Staff" &&
        !staffHasAccess(id)
    ) {
        return;
    }

    activeSection = id;
    render();
}

function staffHasAccess(sectionId) {
    for (let i = 0; i < STAFF_ALLOWED.length; i++) {
        if (STAFF_ALLOWED[i] === sectionId) {
            return true;
        }
    }

    return false;
}

function getVisibleNavItems() {
    let items = [];

    for (let g = 0; g < NAV.length; g++) {
        const groupItems = NAV[g].items;

        for (let i = 0; i < groupItems.length; i++) {
            const id = groupItems[i][0];

            if (
                currentUser &&
                currentUser.role === "Staff" &&
                !staffHasAccess(id)
            ) {
                continue;
            }

            items[items.length] = id;
        }
    }

    return items;
}

function moveSectionByKey(direction) {
    const items = getVisibleNavItems();

    if (!items.length) {
        return;
    }

    let index = -1;

    for (let i = 0; i < items.length; i++) {
        if (items[i] === activeSection) {
            index = i;
            break;
        }
    }

    if (index === -1) {
        index = direction === "down" ? 0 : items.length - 1;
    } else {
        index =
            direction === "down"
                ? index + 1
                : index - 1;

        if (index < 0) {
            index = items.length - 1;
        }

        if (index >= items.length) {
            index = 0;
        }
    }

    activeSection = items[index];
    render();
}

function handleSectionKeyboard(event) {
    if (!currentUser) {
        return;
    }

    const tag = document.activeElement && document.activeElement.tagName;

    if (
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA"
    ) {
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        moveSectionByKey("down");
    }

    if (event.key === "ArrowUp") {
        event.preventDefault();
        moveSectionByKey("up");
    }
}

function setFlash(text, type = "ok") {
    flashMsg = {
        text: text,
        type: type
    };
}

let flashTimer = null;

function flash() {
    if (!flashMsg) {
        return "";
    }

    const toastHost = document.getElementById("toastContainer");

    if (toastHost) {
        if (flashTimer) {
            clearTimeout(flashTimer);
        }

        toastHost.innerHTML = `
            <div class="toast ${flashMsg.type === "err" ? "err" : "ok"}">
                ${flashMsg.text}
            </div>
        `;

        flashTimer = setTimeout(() => {
            toastHost.innerHTML = "";
        }, 4000);
    }

    flashMsg = null;
    return "";
}

/* DATE */

function today() {
    const d = new Date();

    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}

function validReservationDate(date, time) {
    if (!date || !time) {
        return false;
    }

    const chosen = new Date(date + "T" + time);
    const now = new Date();

    return !isNaN(chosen) && chosen >= now;
}

function setDateLimits() {
    const date = document.getElementById("rm-date");

    if (date) {
        date.min = today();
    }
}

/* CLOCK */

function tick() {
    const d = new Date();

    document.getElementById("clockDate")
        .textContent =
        d.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric"
        });

    document.getElementById("clockTime")
        .textContent =
        d.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit"
        });
}

function findDiningRecord(type, id) {
    const records = type === "walkin"
        ? activeWalkIns
        : reservations;

    for (let i = 0; i < records.length; i++) {
        if (records[i].id === id) {
            return records[i];
        }
    }

    return null;
}

function renderDiningMonitorCard(record, type, now) {
    const isActive = type === "walkin"
        ? record.status === "seated"
        : record.status === "arrived";

    if (!isActive) {
        return "";
    }

    const timer = diningTimerData(record, now);

    if (!timer) {
        return "";
    }

    const stageClass = timer.status === "Time Ended"
        ? "ended"
        : timer.status === "Time Warning"
            ? "warning"
            : "normal";
    const key = `${type}-${record.id}`;

    return `
        <article class="dining-monitor-card ${stageClass}" data-dining-type="${type}" data-dining-id="${record.id}">
            <div class="dining-monitor-customer">
                <strong>${escapeHtml(record.name)}</strong>
                <span>Table ${escapeHtml(record.tableNumber)}</span>
            </div>
            <div class="dining-monitor-times">
                <span>Checked In: ${escapeHtml(formatDiningTime(timer.checkInTimestamp))}</span>
                <span>End Time: ${escapeHtml(formatDiningTime(timer.endTimestamp))}</span>
            </div>
            <p>Dining Status: <b data-dining-status="${key}">${timer.status}</b></p>
            <p>Time Remaining: <strong class="dining-countdown" data-dining-countdown="${key}">${formatDiningCountdown(timer.remainingSeconds)}</strong></p>
            <div class="dining-notice" data-dining-notice="${key}" aria-live="polite"></div>
        </article>
    `;
}

function renderDiningMonitor() {
    let cards = "";
    const now = Date.now();

    for (let i = 0; i < reservations.length; i++) {
        cards += renderDiningMonitorCard(reservations[i], "reservation", now);
    }

    for (let i = 0; i < activeWalkIns.length; i++) {
        cards += renderDiningMonitorCard(activeWalkIns[i], "walkin", now);
    }

    return `
        <section id="dining-monitor" class="dining-monitor" aria-label="Dining time monitor">
            <h2>Dining Monitor</h2>
            ${cards
                ? `<div class="dining-monitor-list">${cards}</div>`
                : "<p>No guests are currently checked in.</p>"}
        </section>
    `;
}

function updateDiningTimers() {
    const now = Date.now();
    const cards = currentUser
        ? document.querySelectorAll("[data-dining-id]")
        : [];

    for (let i = 0; i < cards.length; i++) {
        const id = Number(cards[i].getAttribute("data-dining-id"));
        const type = cards[i].getAttribute("data-dining-type");
        const record = findDiningRecord(type, id);

        if (!record) {
            continue;
        }

        const timer = diningTimerData(record, now);

        if (!timer) {
            continue;
        }

        const stageClass = timer.status === "Time Ended"
            ? "ended"
            : timer.status === "Time Warning"
                ? "warning"
                : "normal";
        cards[i].className = `dining-monitor-card ${stageClass}`;

        const key = `${type}-${id}`;
        const status = document.querySelector(`[data-dining-status="${key}"]`);
        const countdown = document.querySelector(`[data-dining-countdown="${key}"]`);
        const notice = document.querySelector(`[data-dining-notice="${key}"]`);

        if (status) {
            status.textContent = timer.status;
        }

        if (countdown) {
            countdown.textContent = formatDiningCountdown(timer.remainingSeconds);
        }

        if (notice) {
            const noticeText = timer.status === "Time Ended"
                ? `DINING TIME ENDED | Customer: ${record.name} | Table: ${record.tableNumber} | Check In: ${formatDiningTime(timer.checkInTimestamp)} | Dining Time: 1 hour 30 minutes`
                : timer.status === "Time Warning"
                    ? `DINING TIME WARNING | ${record.name} at Table ${record.tableNumber} has 15 minutes or less remaining.`
                    : "";
            notice.className = timer.status === "Time Ended"
                ? "dining-notice ended"
                : timer.status === "Time Warning"
                    ? "dining-notice warning"
                    : "dining-notice";

            if (notice.textContent !== noticeText) {
                notice.textContent = noticeText;
            }
        }
    }

    if (customerView === "lookup" && !currentUser) {
        const customerStatus = document.querySelectorAll("[data-customer-dining-status]");
        const customerCountdowns = document.querySelectorAll("[data-customer-dining-time]");

        for (let i = 0; i < customerStatus.length; i++) {
            const id = Number(customerStatus[i].getAttribute("data-customer-dining-status"));
            const reservation = findReservationById(id);
            const timer = reservation ? diningTimerData(reservation, now) : null;

            if (timer) {
                customerStatus[i].textContent = timer.status;
                customerStatus[i].className = timer.status === "Time Ended"
                    ? "customer-dining-status ended"
                    : timer.status === "Time Warning"
                        ? "customer-dining-status warning"
                        : "customer-dining-status";
            }
        }

        for (let i = 0; i < customerCountdowns.length; i++) {
            const id = Number(customerCountdowns[i].getAttribute("data-customer-dining-time"));
            const reservation = findReservationById(id);
            const timer = reservation ? diningTimerData(reservation, now) : null;

            if (timer) {
                customerCountdowns[i].textContent = formatDiningCountdown(timer.remainingSeconds);
            }
        }
    }
}

setInterval(tick, 30000);
setInterval(updateDiningTimers, 1000);

/* DASHBOARD STATS */

function renderStats() {
    let sales = 0;
    let guests = 0;
    const currentDate = today();

    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].date === currentDate) {
            sales += transactions[i].total;
            guests += transactions[i].guests;
        }
    }

    let booked = 0;

    for (let i = 0; i < reservations.length; i++) {
        if (
            reservations[i].date === currentDate &&
            reservations[i].status !== "cancelled"
        ) {
            booked += reservations[i].guests;
        }
    }

    document.getElementById("statstrip").innerHTML = `
        <div class="stat-chip">
            <b>${availableTableCount()}</b> tables free
        </div>

        <div class="stat-chip">
            <b>${waitlist.length}</b> waiting
        </div>

        <div class="stat-chip">
            <b>${booked}</b> guests booked today
        </div>

        <div class="stat-chip">
            <b>₱${sales.toLocaleString()}</b> today's sales
        </div>
    `;
}

function availableTableCount() {
    let count = 0;

    for (let i = 0; i < tables.length; i++) {
        if (tables[i].status === "available") {
            count++;
        }
    }

    return count;
}



function renderNav() {
    let html = "";

    for (let g = 0; g < NAV.length; g++) {
        const items = NAV[g].items;
        let groupItemsHtml = "";

        for (let i = 0; i < items.length; i++) {
            if (
                currentUser.role === "Staff" &&
                !staffHasAccess(items[i][0])
            ) {
                continue;
            }

            groupItemsHtml += `
                <button
                    class="navitem ${
                        activeSection === items[i][0]
                            ? "active"
                            : ""
                    }"
                    onclick="go('${items[i][0]}')"
                >
                    ${items[i][1]}
                </button>
            `;
        }

        if (groupItemsHtml) {
            html += `
                <div class="navgroup">
                    <h4>${NAV[g].group}</h4>
                    ${groupItemsHtml}
                </div>
            `;
        }
    }

    document.getElementById("rail").innerHTML = html;
}

function head(title, desc) {
    const showDesc =
        title === "Financial Analytics Dashboard" && desc;

    return `
        <div class="head">
            <h1>${title}</h1>
            ${showDesc ? `<p>${desc}</p>` : ""}
        </div>
    `;
}



function reservationsTable(list, actions = false) {
    if (!list.length) {
        return `
            <p class="empty">
                No reservations yet.
            </p>
        `;
    }

    let rows = "";

    for (let i = 0; i < list.length; i++) {
        const r = list[i];

        rows += `
            <tr>
                <td>
                    ${reservationReference(r)}
                </td>

                <td>${escapeHtml(r.name)}</td>

                <td>${escapeHtml(r.contact || "—")}</td>

                <td>${escapeHtml(r.date)}</td>

                <td>${escapeHtml(r.time)}</td>

                <td>${r.adult}</td>

                <td>${r.kid}</td>

                <td>${r.senior}</td>

                <td>
                    <b>${r.guests}</b>
                </td>

                <td>${escapeHtml(r.specialRequest || "—")}</td>

                <td>
                    ${r.tableNumber
                        ? "#" + r.tableNumber
                        : "—"}
                </td>

                <td>
                    <span class="pill ${r.status}">
                        ${escapeHtml(r.status)}
                    </span>

                    ${
                        r.checkInTime
                            ? `<div class="hint">
                                ${escapeHtml(r.checkInTime)}
                               </div>`
                            : ""
                    }
                </td>

                ${
                    actions
                        ? `<td>
                            ${r.status === "pending"
                                ? `<button class="btn confirm small" onclick="confirmReservation(${r.id})">Confirm</button>`
                                : ""}
                            ${r.status === "pending" || r.status === "confirmed"
                                ? `<button class="btn danger small" onclick="cancelReservationById(${r.id})">Cancel</button>`
                                : ""}
                            ${r.status !== "pending" && r.status !== "confirmed"
                                ? "—"
                                : ""}
                           </td>`
                        : ""
                }
            </tr>
        `;
    }

    return `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Guest</th>
                    <th>Contact</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Adult</th>
                    <th>Kid</th>
                    <th>Senior</th>
                    <th>Total</th>
                    <th>Special Request</th>
                    <th>Table</th>
                    <th>Status</th>
                    ${actions ? "<th>Action</th>" : ""}
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function renderReservations() {
    let options =
        '<option value="">No table selected (assign later)</option>';

    for (let i = 0; i < tables.length; i++) {
        options += `
            <option value="${tables[i].number}">
                Table ${tables[i].number}
                — ${tables[i].seats} seats
            </option>
        `;
    }

    return `
        <div class="card">
            ${head(
                "Reservations",
                "Create a booking with Adult, Kid, and Senior counts."
            )}

            ${flash()}

            <div class="row">
                <div>
                    <label>First name</label>
                    <input
                        id="rm-first-name"
                    >
                </div>

                <div>
                    <label>Last name (optional)</label>
                    <input
                        id="rm-last-name"
                    >
                </div>

                <div>
                    <label>Contact number</label>
                    <input
                        id="rm-contact"
                        placeholder="09xx-xxx-xxxx"
                    >
                </div>
            </div>

            <div class="row">
                <div>
                    <label>Date</label>
                    <input
                        id="rm-date"
                        type="date"
                        min="${today()}"
                    >
                </div>

                <div>
                    <label>Time</label>
                    <input
                        id="rm-time"
                        type="time"
                    >
                </div>
            </div>

            <div class="row">
                <div>
                    <label>Adult</label>
                    <input
                        id="rm-adult"
                        type="number"
                        min="0"
                        value="0"
                    >
                </div>

                <div>
                    <label>Kid</label>
                    <input
                        id="rm-kid"
                        type="number"
                        min="0"
                        value="0"
                    >
                </div>

                <div>
                    <label>Senior</label>
                    <input
                        id="rm-senior"
                        type="number"
                        min="0"
                        value="0"
                    >
                </div>
            </div>

            <button
                class="btn"
                onclick="addReservation()"
            >
                Save reservation
            </button>
        </div>
    `;
}

function confirmReservation(id) {
    loadSharedReservations();

    for (let i = 0; i < reservations.length; i++) {
        if (reservations[i].id === id) {
            if (reservations[i].status !== "pending") {
                setFlash("Only pending reservations can be confirmed.", "err");
                render();
                return;
            }

            reservations[i].status = "confirmed";
            reservations[i].confirmedAt = new Date().toLocaleString();
            saveSharedReservations();
            setFlash(`Reservation ${reservationReference(reservations[i])} confirmed.`);
            render();
            return;
        }
    }

    setFlash("Reservation was not found. Refresh and try again.", "err");
    render();
}

function updateReservationTotal() {
    return;
}

function conflict(tableNumber, date, time, ignore) {
    for (let i = 0; i < reservations.length; i++) {
        const r = reservations[i];

        if (
            r.id !== ignore &&
            r.status !== "cancelled" &&
            Number(r.tableNumber) === Number(tableNumber) &&
            r.date === date &&
            r.time === time
        ) {
            return true;
        }
    }

    return false;
}

function addReservation() {
    const firstName =
        document.getElementById("rm-first-name").value.trim();

    const lastName =
        document.getElementById("rm-last-name").value.trim();

    let name = firstName;

    if (lastName) {
        name = name ? name + " " + lastName : lastName;
    }

    const contact =
        document.getElementById("rm-contact").value.trim();

    const date =
        document.getElementById("rm-date").value;

    const time =
        document.getElementById("rm-time").value;

    const adult = Math.max(
        0,
        +document.getElementById("rm-adult").value || 0
    );

    const kid = Math.max(
        0,
        +document.getElementById("rm-kid").value || 0
    );

    const senior = Math.max(
        0,
        +document.getElementById("rm-senior").value || 0
    );

    const guests =
        adult + kid + senior;

    if (!firstName || !contact || !date || !time) {
        setFlash(
            "Please complete the required reservation fields.",
            "err"
        );

        render();
        return;
    }

    if (!validReservationDate(date, time)) {
        setFlash(
            "Reservation date and time must be today or a future schedule.",
            "err"
        );

        render();
        return;
    }

    if (guests < 1) {
        setFlash(
            "Enter at least 1 guest.",
            "err"
        );

        render();
        return;
    }

    reservations[reservations.length] = {
        id: nextReservationId++,
        publicId: null,
        name: name,
        contact: contact,
        date: date,
        time: time,
        guests: guests,
        adult: adult,
        kid: kid,
        senior: senior,
        tableNumber: null,
        status: "pending",
        checkInTime: null
    };

    reservations[reservations.length - 1].publicId =
        reservationReference(reservations[reservations.length - 1]);
    saveSharedReservations();

    setFlash(
        `Reservation saved for ${name}.`
    );

    render();
}

/* FIND RESERVATION */

let findQuery = "";

function textContains(text, query) {
    if (query.length > text.length) {
        return false;
    }

    for (let start = 0; start <= text.length - query.length; start++) {
        let matched = true;

        for (let offset = 0; offset < query.length; offset++) {
            if (text[start + offset] !== query[offset]) {
                matched = false;
                break;
            }
        }

        if (matched) {
            return true;
        }
    }

    return false;
}

function findMatches(query) {
    const q = String(query || "").trim().toLowerCase();

    if (!q) {
        return [];
    }

    let matches = [];

    for (let i = 0; i < reservations.length; i++) {
        const r = reservations[i];

        const id = String(r.id);
        const publicId = reservationReference(r).toLowerCase();
        const legacyId = "res-" + String(r.id).padStart(3, "0");

        if (
            id === q ||
            id.padStart(3, "0") === q ||
            textContains(publicId, q) ||
            legacyId === q ||
            textContains(String(r.name || "").toLowerCase(), q) ||
            textContains(String(r.contact || "").toLowerCase(), q)
        ) {
            matches[matches.length] = r;
        }
    }

    return matches;
}

function findResultHtml() {
    if (!findQuery.trim()) {
        return '<p class="empty">Type a name or reservation number first.</p>';
    }

    const matches = findMatches(findQuery);

    if (!matches.length) {
        return `<p class="empty">No reservation matched "${escapeHtml(findQuery.trim())}".</p>`;
    }

    return `
        <p class="hint">
            ${matches.length} reservation${matches.length === 1 ? "" : "s"} found.
            Use Confirm or Cancel in the Action column.
        </p>
        ${reservationsTable(matches, true)}
    `;
}

function renderFindReservation() {
    return `
        <div class="card">
            ${head(
                "Find a Reservation",
                "Search by reservation ID, guest name, or contact number. You can cancel a reservation right from the results."
            )}

            ${flash()}

            <div class="row">
                <div>
                    <label>
                        Name or reservation number
                    </label>

                    <input
                        id="rs-query"
                        value="${escapeHtml(findQuery)}"
                        onkeydown="if(event.key === 'Enter'){ searchReservation(); }"
                    >
                </div>

                <div
                    style="display:flex;align-items:flex-end"
                >
                    <button
                        class="btn"
                        onclick="searchReservation()"
                    >
                        Search
                    </button>
                </div>
            </div>

            <div id="rs-result">${findQuery.trim() ? findResultHtml() : ""}</div>
        </div>

        <div class="card">
            <b>All reservations</b>

            <p class="hint">
                ${reservations.length} on the books.
            </p>

            ${reservationsTable(reservations, true)}
        </div>
    `;
}

function searchReservation() {
    findQuery = document.getElementById("rs-query").value;

    document.getElementById("rs-result").innerHTML = findResultHtml();
}

function cancelReservationById(id) {
    loadSharedReservations();

    let index = -1;

    for (let i = 0; i < reservations.length; i++) {
        if (reservations[i].id === id) {
            index = i;
            break;
        }
    }

    if (index < 0) {
        return;
    }

    const r = reservations[index];

    if (!confirm(`Cancel reservation for ${r.name}?`)) {
        return;
    }

    if (r.tableNumber) {
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].number === r.tableNumber) {
                tables[i].status = "available";
            }
        }
    }

    r.status = "cancelled";
    saveSharedReservations();

    setFlash(
        `Reservation for ${r.name} was cancelled.`
    );

    render();
}



function quickCheckIn(id) {
    checkInGuest(id);
}

let sortMode = "";

function renderSortReservations() {
    return `
        <div class="card">
            ${head(
                "Sort Reservations",
                "Arrange reservations by time or customer name."
            )}

            ${flash()}

            <div class="row">
                <button
                    class="btn"
                    onclick="doSort('time')"
                >
                    Sort by time
                </button>

                <button
                    class="btn secondary"
                    onclick="doSort('name')"
                >
                    Sort by name
                </button>
            </div>

            ${
                sortedView
                    ? reservationsTable(sortedView)
                    : '<p class="empty">Choose a sort order.</p>'
            }
        </div>
    `;
}

/* BUBBLE SORT */

function bubbleSort(a) {
    let x = [...a];

    for (let i = 0; i < x.length - 1; i++) {
        for (
            let j = 0;
            j < x.length - 1 - i;
            j++
        ) {
            if (
                (x[j].time || "") >
                (x[j + 1].time || "")
            ) {
                let temp = x[j];

                x[j] = x[j + 1];
                x[j + 1] = temp;
            }
        }
    }

    return x;
}



function selectionSort(a) {
    let x = [...a];

    for (let i = 0; i < x.length - 1; i++) {
        let min = i;

        for (let j = i + 1; j < x.length; j++) {
            if (
                x[j].name.toLowerCase() <
                x[min].name.toLowerCase()
            ) {
                min = j;
            }
        }

        if (min !== i) {
            let temp = x[i];

            x[i] = x[min];
            x[min] = temp;
        }
    }

    return x;
}

function doSort(type) {
    if (type === "time") {
        sortedView = bubbleSort(reservations);
    } else {
        sortedView = selectionSort(reservations);
    }

    sortMode = type;
    render();
}



function renderTableAvailability() {
    let total = 0;
    let available = 0;
    let occupied = 0;
    let seats = 0;
    let reserved = 0;

    for (let i = 0; i < tables.length; i++) {
        const t = tables[i];

        total++;

        if (t.status === "occupied") {
            occupied++;
        } else if (t.status === "reserved") {
            reserved++;
        } else {
            available++;
            seats += t.seats;
        }
    }

    let rows = "";

    for (let i = 0; i < tables.length; i++) {
        const t = tables[i];
        let r = null;

        for (let j = 0; j < reservations.length; j++) {
            if (
                reservations[j].tableNumber ===
                    t.number &&
                reservations[j].status !==
                    "cancelled"
            ) {
                r = reservations[j];

                if (r.status === "arrived") {
                    break;
                }
            }
        }

        rows += `
            <tr>
                <td>Table ${t.number}</td>
                <td>${t.seats}</td>
                <td>${t.status}</td>
                <td>${r ? r.date : "—"}</td>
                <td>${r ? r.time : "—"}</td>
            </tr>
        `;
    }

    return `
        <div class="card">
            ${head(
                "Table Availability",
                "Count available and occupied tables using linear traversal."
            )}

            ${flash()}

            <div class="summary-grid">
                <div class="stat">
                    <span class="num">${total}</span>
                    <span class="lbl">Total tables</span>
                </div>

                <div class="stat">
                    <span class="num">${available}</span>
                    <span class="lbl">Available tables</span>
                </div>

                <div class="stat">
                    <span class="num">${occupied}</span>
                    <span class="lbl">Occupied tables</span>
                </div>

                <div class="stat">
                    <span class="num">${seats}</span>
                    <span class="lbl">Available seats</span>
                </div>
            </div>

            <p class="hint">
                Reserved tables: <b>${reserved}</b>
            </p>

            <table>
                <thead>
                    <tr>
                        <th>Table</th>
                        <th>Seats</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Time</th>
                    </tr>
                </thead>

                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}



function renderAssignTable() {
    let pending = [];

    for (let i = 0; i < reservations.length; i++) {
        if (
            (reservations[i].status === "pending" ||
                reservations[i].status === "confirmed") &&
            !reservations[i].tableNumber
        ) {
            pending[pending.length] = reservations[i];
        }
    }

    if (!pending.length) {
        return `
            <div class="card">
                ${head(
                    "Assign a Table",
                        "Assign the first available table that fits the party."
                )}

                ${flash()}

                <p class="empty">
                    No unassigned reservations right now.
                </p>
            </div>
        `;
    }

    let options = "";

    for (let i = 0; i < pending.length; i++) {
        options += `
            <option value="${pending[i].id}">
                ${pending[i].name}
                (${pending[i].guests} guests)
            </option>
        `;
    }

    return `
        <div class="card">
            ${head(
                "Assign a Table",
                "Find the first available table with enough seats."
            )}

            ${flash()}

            <div class="row">
                <div>
                    <label>Reservation</label>

                    <select id="ta-res">
                        ${options}
                    </select>
                </div>

                <div
                    style="display:flex;align-items:flex-end"
                >
                    <button
                        class="btn"
                        onclick="assignTable()"
                    >
                        Find &amp; assign table
                    </button>
                </div>
            </div>
        </div>
    `;
}

function assignTable() {
    const id =
        +document.getElementById("ta-res").value;

    let res = null;

    /* Linear Search */

    for (let i = 0; i < reservations.length; i++) {
        if (reservations[i].id === id) {
            res = reservations[i];
            break;
        }
    }

    if (!res) {
        return;
    }

    /* First Fit */

    for (let i = 0; i < tables.length; i++) {
        const t = tables[i];

        if (
            t.status === "available" &&
            t.seats >= res.guests
        ) {
            if (
                conflict(
                    t.number,
                    res.date,
                    res.time,
                    res.id
                )
            ) {
                continue;
            }

            t.status = "reserved";
            res.tableNumber = t.number;
            saveSharedReservations();

            setFlash(
                `Table ${t.number} assigned to ${res.name}.`
            );

            render();
            return;
        }
    }

    setFlash(
        "No open table can fit that party size right now.",
        "err"
    );

    render();
}

/* WAITLIST */

function renderWaitlist() {
    let rows = "";

    for (let i = 0; i < waitlist.length; i++) {
        const w = waitlist[i];

        rows += `
            <div class="ticket">
                <span class="pos">
                    ${i + 1}
                </span>

                <span class="name">
                    ${w.name}
                </span>

                <span class="size">
                    Adult ${w.adult}
                    • Kid ${w.kid}
                    • Senior ${w.senior}
                    • Total ${w.size}
                </span>

                ${
                    i === 0
                        ? `
                            <button
                                class="btn confirm small"
                                onclick="serveNextWalkIn()"
                            >
                                Check / Seat
                            </button>
                          `
                        : `
                            <button
                                class="btn secondary small"
                                disabled
                            >
                                Waiting
                            </button>
                          `
                }
            </div>
        `;
    }

    return `
        <div class="card">
            ${head(
                "Walk-in Waiting List",
                "Walk-ins are seated immediately when possible, otherwise FIFO waitlist is used."
            )}

            ${flash()}

            <div class="row">
                <div>
                    <label>Name</label>
                    <input
                        id="wl-name"
                        placeholder="Walk-in guest"
                    >
                </div>

                <div>
                    <label>Adult</label>
                    <input
                        id="wl-adult"
                        type="number"
                        min="0"
                        value="0"
                        oninput="updateWalkInTotal()"
                    >
                </div>

                <div>
                    <label>Kid</label>
                    <input
                        id="wl-kid"
                        type="number"
                        min="0"
                        value="0"
                        oninput="updateWalkInTotal()"
                    >
                </div>

                <div>
                    <label>Senior</label>
                    <input
                        id="wl-senior"
                        type="number"
                        min="0"
                        value="0"
                        oninput="updateWalkInTotal()"
                    >
                </div>

                <div>
                    <label>Total</label>
                    <input
                        id="wl-total"
                        value="0"
                        readonly
                    >
                </div>

                <div
                    style="display:flex;align-items:flex-end"
                >
                    <button
                        class="btn"
                        onclick="addWalkIn()"
                    >
                        Seat / Add Walk-In
                    </button>
                </div>
            </div>

            ${rows || `
                <p class="empty">
                    Nobody is waiting.
                </p>
            `}
        </div>
    `;
}

function updateWalkInTotal() {
    const adult =
        +document.getElementById("wl-adult").value || 0;

    const kid =
        +document.getElementById("wl-kid").value || 0;

    const senior =
        +document.getElementById("wl-senior").value || 0;

    document.getElementById("wl-total").value =
        adult + kid + senior;
}

function addWalkIn() {
    const name =
        document.getElementById("wl-name")
            .value
            .trim();

    const adult = Math.max(
        0,
        +document.getElementById("wl-adult").value || 0
    );

    const kid = Math.max(
        0,
        +document.getElementById("wl-kid").value || 0
    );

    const senior = Math.max(
        0,
        +document.getElementById("wl-senior").value || 0
    );

    const size =
        adult + kid + senior;

    if (!name || size < 1) {
        setFlash(
            "Enter a name and at least 1 guest.",
            "err"
        );

        render();
        return;
    }

    let chosen = null;

    for (let i = 0; i < tables.length; i++) {
        if (
            size <= tables[i].seats &&
            tables[i].status === "available"
        ) {
            chosen = tables[i];
            break;
        }
    }

    const w = {
        id: nextWaitlistId++,
        name: name,
        adult: adult,
        kid: kid,
        senior: senior,
        size: size,
        status: "waiting",
        tableNumber: null,
        checkInTime: null,
        checkInTimestamp: null
    };

    if (chosen) {
        chosen.status = "occupied";
        w.status = "seated";
        w.tableNumber = chosen.number;
        w.checkInTimestamp = Date.now();
        w.checkInTime = new Date(w.checkInTimestamp).toLocaleString();

        activeWalkIns[
            activeWalkIns.length
        ] = w;

        setFlash(
            `${name} is seated at Table ${chosen.number}.`
        );
    } else {
        waitlist[
            waitlist.length
        ] = w;

        setFlash(
            `${name} was added to the waitlist.`
        );
    }

    render();
}

function serveNextWalkIn() {
    if (!waitlist.length) {
        setFlash(
            "Nobody is waiting.",
            "err"
        );

        render();
        return;
    }

    const w = waitlist[0];
    let chosen = null;

    for (let i = 0; i < tables.length; i++) {
        if (
            w.size <= tables[i].seats &&
            tables[i].status === "available"
        ) {
            chosen = tables[i];
            break;
        }
    }

    if (!chosen) {
        setFlash(
            `No available table can fit ${w.name} yet.`,
            "err"
        );

        render();
        return;
    }

    for (
        let i = 0;
        i < waitlist.length - 1;
        i++
    ) {
        waitlist[i] = waitlist[i + 1];
    }

    waitlist.length--;

    chosen.status = "occupied";
    w.status = "seated";
    w.tableNumber = chosen.number;
    w.checkInTimestamp = Date.now();
    w.checkInTime = new Date(w.checkInTimestamp).toLocaleString();

    activeWalkIns[
        activeWalkIns.length
    ] = w;

    setFlash(
        `${w.name} is seated at Table ${chosen.number}.`
    );

    render();
}



function renderCheckIn() {
    let list = [];

    for (let i = 0; i < reservations.length; i++) {
        if (
            (reservations[i].status === "pending" ||
                reservations[i].status === "confirmed") &&
            reservations[i].tableNumber
        ) {
            list[list.length] = reservations[i];
        }
    }

    let options = "";

    for (let i = 0; i < list.length; i++) {
        options += `
            <option value="${list[i].id}">
                ${list[i].name}
                — Table ${list[i].tableNumber}
                — ${list[i].guests} guests
            </option>
        `;
    }

    return `
        <div class="card">
            ${head(
                "Check-In",
                "Record the arrival time of a reserved customer."
            )}

            ${flash()}

            ${
                options
                    ? `
                        <div class="row">
                            <div>
                                <label>Reservation</label>

                                <select id="ci-res">
                                    ${options}
                                </select>
                            </div>

                            <div
                                style="display:flex;align-items:flex-end"
                            >
                                <button
                                    class="btn confirm"
                                    onclick="checkInGuest()"
                                >
                                    Check In / Seat
                                </button>
                            </div>
                        </div>
                      `
                    : `
                        <p class="empty">
                            No reserved customers are waiting for check-in.
                        </p>
                      `
            }
        </div>
    `;
}

function checkInGuest(id) {
    id =
        id ||
        +document.getElementById("ci-res").value;

    let r = null;

    for (let i = 0; i < reservations.length; i++) {
        if (reservations[i].id === id) {
            r = reservations[i];
            break;
        }
    }

    if (!r) {
        return;
    }

    const now = new Date();
    const todayDate = today();
    const nowTime =
        now.toTimeString().slice(0, 5);

    if (r.date !== todayDate) {
        setFlash(
            r.date > todayDate
                ? "This reservation is not scheduled for today yet."
                : "This reservation date has already passed.",
            "err"
        );

        render();
        return;
    }

    if (r.time > nowTime) {
        setFlash(
            "The reservation time has not arrived yet.",
            "err"
        );

        render();
        return;
    }

    r.status = "arrived";

    r.checkInTime =
        now.toLocaleString();
    r.checkInTimestamp = now.getTime();
    saveSharedReservations();

    if (r.tableNumber) {
        for (let i = 0; i < tables.length; i++) {
            if (tables[i].number === r.tableNumber) {
                tables[i].status = "occupied";
            }
        }
    }

    setFlash(
        `${r.name} checked in and is seated at Table ${r.tableNumber}.`
    );

    render();
}

/* BILLING SESSIONS */

function sessions() {
    let list = [];

    for (let i = 0; i < reservations.length; i++) {
        const r = reservations[i];

        if (
            r.status === "arrived" &&
            r.tableNumber
        ) {
            list[list.length] = {
                type: "reservation",
                id: r.id,
                name: r.name,
                tableNumber: r.tableNumber,
                adult: r.adult,
                kid: r.kid,
                senior: r.senior,
                guests: r.guests
            };
        }
    }

    for (let i = 0; i < activeWalkIns.length; i++) {
        const w = activeWalkIns[i];

        if (w.status === "seated") {
            list[list.length] = {
                type: "walkin",
                id: w.id,
                name: w.name,
                tableNumber: w.tableNumber,
                adult: w.adult,
                kid: w.kid,
                senior: w.senior,
                guests: w.size
            };
        }
    }

    return list;
}

function sessionOptions() {
    const list = sessions();

    let options =
        '<option value="">Select customer / table to bill</option>';

    for (let i = 0; i < list.length; i++) {
        options += `
            <option value="${list[i].type}:${list[i].id}">
                ${list[i].name}
                — Table ${list[i].tableNumber}
                — ${list[i].guests} guests
            </option>
        `;
    }

    return options;
}

function loadBillingSession() {
    const value =
        document.getElementById(
            "billing-session"
        ).value;

    if (!value) {
        setFlash(
            "Select a customer or table first.",
            "err"
        );

        render();
        return;
    }

    const parts = value.split(":");
    const list = sessions();

    let selected = null;

    for (let i = 0; i < list.length; i++) {
        if (
            list[i].type === parts[0] &&
            list[i].id === +parts[1]
        ) {
            selected = list[i];
            break;
        }
    }

    if (!selected) {
        setFlash(
            "That dining session is no longer active.",
            "err"
        );

        render();
        return;
    }

    currentOrder = {
        ...currentOrder,
        reservationName: selected.name,
        adult: selected.adult,
        kid: selected.kid,
        senior: selected.senior,
        sourceType: selected.type,
        sourceId: selected.id,
        tableNumber: selected.tableNumber,
        discount: 0,
        total: 0
    };

    setFlash(
        `${selected.name} selected for billing.`
    );

    render();
}

/* BILLING */

function computeSubtotal() {
    let total = 0;

    for (let i = 0; i < packages.length; i++) {
        const p = packages[i];
        total +=
            (
                currentOrder[
                    p.type.toLowerCase()
                ] || 0
            ) * p.price;
            }

    return total;
}

function approvePendingAccount(id) {
    let account = null;

    for (let i = 0; i < pendingStaffAccounts.length; i++) {
        if (String(pendingStaffAccounts[i].id) === String(id)) {
            account = pendingStaffAccounts[i];
            break;
        }
    }

    if (!account) {
        return;
    }

    USERS[USERS.length] = {
        username: account.username,
        password: account.password,
        role: "Staff"
    };

    saveUsers();
    const remainingAccounts = [];

    for (let i = 0; i < pendingStaffAccounts.length; i++) {
        if (String(pendingStaffAccounts[i].id) !== String(id)) {
            remainingAccounts[remainingAccounts.length] = pendingStaffAccounts[i];
        }
    }

    pendingStaffAccounts = remainingAccounts;
    savePendingAccounts();
    setFlash(`${account.username} approved for staff access.`);
    render();
}

function rejectPendingAccount(id) {
    const remainingAccounts = [];

    for (let i = 0; i < pendingStaffAccounts.length; i++) {
        if (String(pendingStaffAccounts[i].id) !== String(id)) {
            remainingAccounts[remainingAccounts.length] = pendingStaffAccounts[i];
        }
    }

    pendingStaffAccounts = remainingAccounts;
    savePendingAccounts();
    setFlash("Account request rejected.");
    render();
}

function renderAccountApprovals() {
    let accountCards = "";

    for (let i = 0; i < pendingStaffAccounts.length; i++) {
        const account = pendingStaffAccounts[i];
        accountCards += `
            <div class="approval-item">
                <div>
                    <strong>${escapeHtml(account.username)}</strong>
                    <p>Requested on ${new Date(account.requestedAt || Date.now()).toLocaleString()}</p>
                </div>
                <div class="approval-actions">
                    <button class="btn btn-ok" onclick="approvePendingAccount(${String(account.id)})">Approve</button>
                    <button class="btn btn-cancel" onclick="rejectPendingAccount(${String(account.id)})">Reject</button>
                </div>
            </div>
        `;
    }

    return `
        <div class="card">
            ${head(
                "Account Approvals",
                "Review and approve staff account requests."
            )}

            ${flash()}

            ${!pendingStaffAccounts.length ? `
                <p class="empty">No pending staff account requests.</p>
            ` : `
                <div class="approval-list">
                    ${accountCards}
                </div>
            `}
        </div>
    `;
}

function renderBillSummary() {
    const sub = computeSubtotal();
    let packageRows = "";

    currentOrder.subtotal = sub;

    for (let i = 0; i < packages.length; i++) {
        const p = packages[i];
        const quantity = currentOrder[p.type.toLowerCase()] || 0;
        packageRows += `
            <tr>
                <td>${p.type}</td>
                <td>${quantity}</td>
                <td>₱${p.price}</td>
                <td>₱${quantity * p.price}</td>
            </tr>
        `;
    }

    return `
        <div class="card">
            ${head(
                "Bill Summary",
                "Select the customer and review the calculated bill."
            )}

            ${flash()}

            <div class="session">
                <label>Who will be billed?</label>

                <select id="billing-session">
                    ${sessionOptions()}
                </select>

                <button
                    class="btn"
                    style="margin-top:10px"
                    onclick="loadBillingSession()"
                >
                    Load Customer
                </button>
            </div>

            ${
                currentOrder.sourceId
                    ? `
                        <p>
                            <b>
                                ${currentOrder.reservationName}
                            </b>
                            —
                            Table ${currentOrder.tableNumber}
                            —
                            Adult ${currentOrder.adult},
                            Kid ${currentOrder.kid},
                            Senior ${currentOrder.senior}
                        </p>
                      `
                    : `
                        <p class="empty">
                            No customer selected.
                        </p>
                      `
            }

            <table>
                <thead>
                    <tr>
                        <th>Package</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
                </thead>

                <tbody>
                    ${packageRows}
                </tbody>
            </table>

            <div
                class="stat"
                style="margin-top:16px;max-width:260px"
            >
                <span class="num">
                    ₱${sub.toLocaleString()}
                </span>

                <span class="lbl">
                    Subtotal
                </span>
            </div>
        </div>
    `;
}



function renderDiscounts() {
    const sub = computeSubtotal();

    const seniorTotal =
        currentOrder.senior * 295;

    const pwd =
        currentOrder.isPWD
            ? sub * 0.2
            : 0;

    return `
        <div class="card">
            ${head(
                "Discounts",
                "Apply a senior citizen or PWD discount before payment."
            )}

            ${flash()}

            <div class="checkbox-line">
                <input
                    type="checkbox"
                    id="dc-pwd"
                    ${
                        currentOrder.isPWD
                            ? "checked"
                            : ""
                    }
                >

                <label for="dc-pwd">
                    Guest has a PWD ID
                    (extra 20% off subtotal)
                </label>
            </div>

            <button
                class="btn"
                onclick="applyDiscount()"
            >
                Recalculate discount
            </button>

            <table style="margin-top:18px">
                <tbody>
                    <tr>
                        <td>Subtotal</td>
                        <td class="mono">
                            ₱${sub.toLocaleString()}
                        </td>
                    </tr>

                    <tr>
                        <td>
                            Senior discount
                            (20% of senior packages)
                        </td>

                        <td class="mono">
                            −₱${(
                                seniorTotal * 0.2
                            ).toLocaleString()}
                        </td>
                    </tr>

                    <tr>
                        <td>
                            PWD discount
                            (20% of subtotal)
                        </td>

                        <td class="mono">
                            −₱${pwd.toLocaleString()}
                        </td>
                    </tr>

                    <tr>
                        <td>
                            <strong>
                                Total discount
                            </strong>
                        </td>

                        <td class="mono">
                            <strong>
                                −₱${currentOrder.discount.toLocaleString()}
                            </strong>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

function applyDiscount() {
    const sub = computeSubtotal();

    const seniorTotal =
        currentOrder.senior * 295;

    currentOrder.isPWD =
        document.getElementById(
            "dc-pwd"
        ).checked;

    currentOrder.discount =
        (currentOrder.senior
            ? seniorTotal * 0.2
            : 0) +
        (
            currentOrder.isPWD
                ? sub * 0.2
                : 0
        );

    currentOrder.total =
        Math.max(
            sub - currentOrder.discount,
            0
        );

    setFlash(
        "Discount recalculated."
    );

    render();
}



function receiptHtml(t) {
    return `
        <div class="receipt">
            <div class="receipt-head">
                <div class="rname">
                    Veranda Resto Garden
                </div>

                <div class="rsub">
                    Events Place
                </div>
            </div>

            <hr>

            <div class="receipt-line">
                <span>${t.name}</span>
                <span>${t.time}</span>
            </div>

            <div class="receipt-line">
                <span>Transaction</span>
                <span>${t.transactionId}</span>
            </div>

            <div class="receipt-line">
                <span>Table</span>
                <span>
                    ${
                        t.tableNumber
                            ? "Table " +
                              t.tableNumber
                            : "—"
                    }
                </span>
            </div>

            <div class="receipt-line">
                <span>Guests</span>
                <span>${t.guests}</span>
            </div>

            <hr>

            <div class="receipt-line">
                <span>
                    Adult x${t.adultQty}
                </span>

                <span>
                    ₱${(
                        t.adultQty * 369
                    ).toLocaleString()}
                </span>
            </div>

            <div class="receipt-line">
                <span>
                    Kid x${t.kidQty}
                </span>

                <span>
                    ₱${(
                        t.kidQty * 269
                    ).toLocaleString()}
                </span>
            </div>

            <div class="receipt-line">
                <span>
                    Senior x${t.seniorQty}
                </span>

                <span>
                    ₱${(
                        t.seniorQty * 295
                    ).toLocaleString()}
                </span>
            </div>

            <hr>

            <div class="receipt-line">
                <span>Subtotal</span>
                <span>
                    ₱${t.subtotal.toLocaleString()}
                </span>
            </div>

            <div class="receipt-line">
                <span>Discount</span>
                <span>
                    −₱${t.discount.toLocaleString()}
                </span>
            </div>

            <div class="receipt-line">
                <b>Total</b>
                <b>
                    ₱${t.total.toLocaleString()}
                </b>
            </div>

            <div class="receipt-line">
                <span>Tendered</span>
                <span>
                    ₱${t.tendered.toLocaleString()}
                </span>
            </div>

            <div class="receipt-line">
                <span>Change</span>
                <span>
                    ₱${t.change.toLocaleString()}
                </span>
            </div>

            <hr>

            <div class="receipt-foot">
                Paid • Salamat po sa pagbisita!
            </div>
        </div>
    `;
}



function renderPayment() {
    const total =
        currentOrder.total ||
        computeSubtotal();

    return `
        <div class="card">
            ${head(
                "Payment",
                "Take the amount tendered and settle the bill."
            )}

            ${flash()}

            ${
                currentOrder.sourceId
                    ? `
                        <div class="session">
                            <b>
                                ${currentOrder.reservationName}
                            </b>
                            —
                            Table ${currentOrder.tableNumber}
                            —
                            ${currentOrder.adult}
                            Adult,
                            ${currentOrder.kid}
                            Kid,
                            ${currentOrder.senior}
                            Senior
                        </div>
                      `
                    : `
                        <p class="empty">
                            Select and load a customer
                            from Bill Summary first.
                        </p>
                      `
            }

            <div
                class="stat"
                style="max-width:260px"
            >
                <span class="num">
                    ₱${total.toLocaleString()}
                </span>

                <span class="lbl">
                    Amount due
                </span>
            </div>

            <div class="row">
                <div>
                    <label>
                        Amount tendered
                    </label>

                    <input
                        id="pp-cash"
                        type="number"
                        min="0"
                        placeholder="0"
                    >
                </div>

                <div
                    style="display:flex;align-items:flex-end"
                >
                    <button
                        class="btn"
                        onclick="processPayment()"
                        ${
                            currentOrder.sourceId
                                ? ""
                                : "disabled"
                        }
                    >
                        Process payment
                    </button>
                </div>
            </div>

            ${lastReceipt ? `
                ${receiptHtml(lastReceipt)}
                <div style="text-align:center;margin-top:12px">
                    <button class="btn" onclick="printReceipt('${escapeHtml(lastReceipt.transactionId)}')">
                        Print Receipt
                    </button>
                </div>
            ` : ""}
        </div>
    `;
}

/* PAYMENT PROCESSING */

function processPayment() {
    if (!currentOrder.sourceId) {
        setFlash(
            "Select a customer/table before payment.",
            "err"
        );

        render();
        return;
    }

    const cash =
        +document.getElementById(
            "pp-cash"
        ).value || 0;

    const sub =
        computeSubtotal();

    const total =
        currentOrder.total ||
        Math.max(
            sub -
            (currentOrder.discount || 0),
            0
        );

    const change =
        cash - total;

    if (change < 0) {
        setFlash(
            `Insufficient payment. Short by ₱${Math.abs(change).toLocaleString()}.`,
            "err"
        );

        render();
        return;
    }

    const now = new Date();

    const record = {
        id: nextTransactionId++,

        transactionId:
            "TXN-" +
            String(
                nextTransactionId - 1
            ).padStart(3, "0"),

        reservationId:
            currentOrder.sourceType ===
            "reservation"
                ? currentOrder.sourceId
                : null,

        walkInId:
            currentOrder.sourceType ===
            "walkin"
                ? currentOrder.sourceId
                : null,

        name:
            currentOrder.reservationName,

        tableNumber:
            currentOrder.tableNumber,

        guests:
            currentOrder.adult +
            currentOrder.kid +
            currentOrder.senior,

        adultQty:
            currentOrder.adult,

        kidQty:
            currentOrder.kid,

        seniorQty:
            currentOrder.senior,

        subtotal: sub,

        discount:
            currentOrder.discount || 0,

        total: total,

        tendered: cash,

        change: change,

        paymentStatus: "Paid",

        date: today(),

        time:
            now.toLocaleTimeString(),

        completedAt:
            now.toLocaleString()
    };

    transactions[
        transactions.length
    ] = record;

    lastReceipt = record;

    if (
        currentOrder.sourceType ===
        "reservation"
    ) {
        for (
            let i = 0;
            i < reservations.length;
            i++
        ) {
            if (
                reservations[i].id ===
                currentOrder.sourceId
            ) {
                reservations[i].status =
                    "completed";
                break;
            }
        }
    } else {
        for (
            let i = 0;
            i < activeWalkIns.length;
            i++
        ) {
            if (
                activeWalkIns[i].id ===
                currentOrder.sourceId
            ) {
                activeWalkIns[i].status =
                    "completed";
                break;
            }
        }
    }

    if (currentOrder.tableNumber) {
        for (
            let i = 0;
            i < tables.length;
            i++
        ) {
            if (
                tables[i].number ===
                currentOrder.tableNumber
            ) {
                tables[i].status = "available";
            }
        }
    }

    saveSharedReservations();

    setFlash(
        `Payment completed for ${record.name}. Transaction ${record.transactionId} saved.`
    );

    currentOrder = {
        reservationName: "",
        adult: 0,
        kid: 0,
        senior: 0,
        isPWD: false,
        subtotal: 0,
        discount: 0,
        total: 0,
        sourceType: null,
        sourceId: null,
        tableNumber: null
    };

    render();
}



function transactionTable(list) {
    if (!list.length) {
        return `
            <p class="empty">
                No completed transactions found.
            </p>
        `;
    }

    let rows = "";

    for (let i = 0; i < list.length; i++) {
        const t = list[i];

        rows += `
            <tr>
                <td>${t.transactionId}</td>
                <td>${t.name}</td>

                <td>
                    ${
                        t.tableNumber
                            ? "Table " +
                              t.tableNumber
                            : "—"
                    }
                </td>

                <td>${t.guests}</td>

                <td>
                    ₱${t.total.toLocaleString()}
                </td>

                <td>${t.paymentStatus}</td>

                <td>${t.date}</td>

                <td>${t.time}</td>
            </tr>
        `;
    }

    return `
        <table>
            <thead>
                <tr>
                    <th>Transaction ID</th>
                    <th>Customer</th>
                    <th>Table</th>
                    <th>Guests</th>
                    <th>Total</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Time</th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function printReceipt(id) {
    let transaction = null;

    for (
        let i = 0;
        i < transactions.length;
        i++
    ) {
        if (
            transactions[i].transactionId === id
        ) {
            transaction = transactions[i];
            break;
        }
    }

    if (!transaction) {
        return;
    }

    const windowPrint =
        window.open(
            "",
            "_blank",
            "width=420,height=650"
        );

    if (!windowPrint) {
        setFlash(
            "Please allow pop-ups to print the receipt.",
            "err"
        );

        render();
        return;
    }

    windowPrint.document.write(`
        <!doctype html>

        <html>
        <head>
            <title>
                ${transaction.transactionId}
                Receipt
            </title>

            <style>
                body {
                    margin: 20px;
                    background: #fff;
                    color: #222;
                }

                .receipt {
                    max-width: 320px;
                    margin: auto;
                    padding: 18px;
                    border: 1px dashed #aaa;
                    font: 12px
                        "Courier New",
                        monospace;
                }

                .receipt-head {
                    text-align: center;
                }

                .rname {
                    font-size: 20px;
                    font-weight: 700;
                }

                .rsub {
                    font-size: 10px;
                    color: #666;
                }

                .receipt hr {
                    border: 0;
                    border-top: 1px dashed #aaa;
                    margin: 10px 0;
                }

                .receipt-line {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3px;
                }

                .receipt-foot {
                    text-align: center;
                    color: #666;
                    margin-top: 12px;
                }

                @media print {
                    body {
                        margin: 0;
                    }

                    .receipt {
                        border: 0;
                    }
                }
            </style>
        </head>

        <body>
            ${receiptHtml(transaction)}
        </body>
        </html>
    `);

    windowPrint.document.close();

    windowPrint.onload = function () {
        windowPrint.print();
    };
}



function renderDailyReport() {
    let revenue = 0;
    let guests = 0;
    let discount = 0;
    let count = 0;
    let list = [];

    for (let i = 0; i < transactions.length; i++) {
        if (
            transactions[i].paymentStatus ===
            "Paid"
        ) {
            const t = transactions[i];

            revenue += t.total;
            guests += t.guests;
            discount += t.discount;

            count++;

            list[list.length] = t;
        }
    }

    const average =
        guests
            ? revenue / guests
            : 0;

    return `
        <div class="card">
            ${head(
                "Financial Analytics Dashboard",
                "Revenue, guests served, average spending, and completed transactions."
            )}

            ${flash()}

            <div class="summary-grid">
                <div class="stat">
                    <span class="num">
                        ₱${revenue.toLocaleString()}
                    </span>

                    <span class="lbl">
                        Total revenue
                    </span>
                </div>

                <div class="stat">
                    <span class="num">
                        ${guests}
                    </span>

                    <span class="lbl">
                        Guests served
                    </span>
                </div>

                <div class="stat">
                    <span class="num">
                        ₱${average.toFixed(2)}
                    </span>

                    <span class="lbl">
                        Average / guest
                    </span>
                </div>

                <div class="stat">
                    <span class="num">
                        ${count}
                    </span>

                    <span class="lbl">
                        Transactions
                    </span>
                </div>
            </div>

            <p>
                Total discounts:
                <b>
                    ₱${discount.toLocaleString()}
                </b>
            </p>

            ${transactionTable(list)}
        </div>
    `;
}

/* PAGE ROUTER */

const RENDERERS = {
    reservations: renderReservations,
    findReservation: renderFindReservation,
    diningMonitor: renderDiningMonitor,
    sortReservations: renderSortReservations,
    tableAvailability: renderTableAvailability,
    assignTable: renderAssignTable,
    waitlist: renderWaitlist,
    checkIn: renderCheckIn,
    accountApprovals: renderAccountApprovals,
    billSummary: renderBillSummary,
    discounts: renderDiscounts,
    payment: renderPayment,
    dailyReport: renderDailyReport
};

function render() {
    if (
        currentUser &&
        currentUser.role === "Staff" &&
        !staffHasAccess(activeSection)
    ) {
        activeSection = "reservations";
    }

    renderNav();
    renderStats();

    document.getElementById(
        "content"
    ).innerHTML =
        RENDERERS[activeSection]();

    setDateLimits();
}

document.addEventListener("keydown", handleSectionKeyboard);

loadSharedReservations();

window.addEventListener("storage", function (event) {
    if (event.key === STAFF_NOTICE_STORAGE_KEY) {
        const notice = readStaffNotice();

        if (notice && currentUser) {
            setFlash(notice.text);
            render();
        }

        return;
    }

    if (event.key !== RESERVATION_STORAGE_KEY) {
        return;
    }

    loadSharedReservations();

    if (currentUser) {
        render();
    } else if (customerView === "confirmation" && customerConfirmation) {
        customerConfirmation = findReservationById(customerConfirmation.id);
        renderCustomer();
    } else if (customerView === "lookup") {
        renderCustomer();
    }
});

tick();
showCustomerHome();
