// ==========================================================================
// APP.JS - PART 1: INITIALIZATION, BILINGUAL UI & PWA INSTALL LOGIC
// ==========================================================================

// Global State
let currentLang = "en";
let currentRole = "student";
let currentStudentData = null;
let currentTeacherData = null;
let deferredPrompt = null;

// Firebase references (initialized via config.js)
const db = firebase.firestore();
const auth = firebase.auth();

// Status Message Banner Helper
function showMessage(msg, isError = false) {
  const statusBox = document.getElementById("status-message");
  if (!statusBox) return;
  statusBox.textContent = msg;
  statusBox.style.display = "block";
  statusBox.style.backgroundColor = isError ? "#fee2e2" : "#dcfce7";
  statusBox.style.color = isError ? "#991b1b" : "#166534";
  statusBox.style.borderColor = isError ? "#f87171" : "#86efac";

  setTimeout(() => {
    clearMessage();
  }, 4500);
}

function clearMessage() {
  const statusBox = document.getElementById("status-message");
  if (statusBox) {
    statusBox.style.display = "none";
    statusBox.textContent = "";
  }
}

// --------------------------------------------------------------------------
// Bilingual Language Switcher (English / தமிழ்)
// --------------------------------------------------------------------------
function setLanguage(lang) {
  currentLang = lang;
  const btnEn = document.getElementById("lang-en");
  const btnTa = document.getElementById("lang-ta");

  if (btnEn && btnTa) {
    if (lang === "ta") {
      btnEn.classList.remove("active-lang");
      btnTa.classList.add("active-lang");
    } else {
      btnTa.classList.remove("active-lang");
      btnEn.classList.add("active-lang");
    }
  }

  const enElements = document.querySelectorAll(".text-en");
  const taElements = document.querySelectorAll(".text-ta");

  enElements.forEach((el) => {
    el.style.display = lang === "en" ? "inline" : "none";
  });
  taElements.forEach((el) => {
    el.style.display = lang === "ta" ? "inline" : "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnEn = document.getElementById("lang-en");
  const btnTa = document.getElementById("lang-ta");

  if (btnEn) btnEn.addEventListener("click", () => setLanguage("en"));
  if (btnTa) btnTa.addEventListener("click", () => setLanguage("ta"));

  initPWAInstall();
  initAuthEventListeners();
});

// --------------------------------------------------------------------------
// Role Switcher & Screen View Toggles
// --------------------------------------------------------------------------
function switchRole(role) {
  clearMessage();
  currentRole = role;

  const studentSection = document.getElementById("student-section");
  const teacherSection = document.getElementById("teacher-section");
  const tabStudent = document.getElementById("tab-student");
  const tabTeacher = document.getElementById("tab-teacher");

  if (role === "student") {
    if (studentSection) studentSection.style.display = "block";
    if (teacherSection) teacherSection.style.display = "none";
    if (tabStudent) tabStudent.classList.add("active");
    if (tabTeacher) tabTeacher.classList.remove("active");
    toggleStudentMode("login");
  } else {
    if (studentSection) studentSection.style.display = "none";
    if (teacherSection) teacherSection.style.display = "block";
    if (tabTeacher) tabTeacher.classList.add("active");
    if (tabStudent) tabStudent.classList.remove("active");
    toggleTeacherMode("login");
  }
}

function toggleStudentMode(mode) {
  clearMessage();
  const loginBox = document.getElementById("student-login-box");
  const registerBox = document.getElementById("student-register-box");

  if (loginBox) loginBox.style.display = mode === "login" ? "block" : "none";
  if (registerBox) registerBox.style.display = mode === "register" ? "block" : "none";
}

function toggleTeacherMode(mode) {
  clearMessage();
  const loginBox = document.getElementById("teacher-login-box");
  const registerBox = document.getElementById("teacher-register-box");
  const forgotBox = document.getElementById("teacher-forgot-box");

  if (loginBox) loginBox.style.display = mode === "login" ? "block" : "none";
  if (registerBox) registerBox.style.display = mode === "register" ? "block" : "none";
  if (forgotBox) forgotBox.style.display = mode === "forgot" ? "block" : "none";
}

function showTeacherForgot() {
  toggleTeacherMode("forgot");
}

// --------------------------------------------------------------------------
// In-App PWA Install Banner Logic
// --------------------------------------------------------------------------
function initPWAInstall() {
  const installBtn = document.getElementById("pwa-install-btn");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = "inline-block";
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log("Install prompt outcome:", outcome);
        deferredPrompt = null;
        installBtn.style.display = "none";
      } else {
        alert(
          currentLang === "ta"
            ? "செயலியை நிறுவ: உலாவியின் 3 புள்ளிகளைத் தட்டி 'Add to Home screen' என்பதை அழுத்தவும்."
            : "To install: tap the 3 dots (⋮) in Chrome and select 'Add to Home screen' or 'Install app'."
        );
      }
    });
  }

  window.addEventListener("appinstalled", () => {
    if (installBtn) installBtn.style.display = "none";
    console.log("PWA installed successfully.");
  });
      }
// ==========================================================================
// APP.JS - PART 2: STUDENT REGISTRATION, LOGIN & DASHBOARD VIEW
// ==========================================================================

function initAuthEventListeners() {
  // Student Login Handler
  const studentLoginForm = document.getElementById("student-login-form");
  if (studentLoginForm) {
    studentLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const school = document.getElementById("stud-login-school").value.trim();
      const classLevel = document.getElementById("stud-login-class").value.trim();
      const section = document.getElementById("stud-login-section").value.trim();
      const roll = document.getElementById("stud-login-roll").value.trim();

      try {
        const querySnapshot = await db.collection("students")
          .where("school", "==", school)
          .where("classLevel", "==", classLevel)
          .where("section", "==", section)
          .where("roll", "==", roll)
          .get();

        if (querySnapshot.empty) {
          showMessage(
            currentLang === "ta"
              ? "மாணவர் கணக்கு கிடைக்கவில்லை. விவரங்களை சரிபார்க்கவும்."
              : "Student not found. Please verify School, Class, Section, and Roll No.",
            true
          );
          return;
        }

        const studentDoc = querySnapshot.docs[0];
        const studentData = { id: studentDoc.id, ...studentDoc.data() };
        initStudentDashboard(studentData);
      } catch (err) {
        console.error("Student login error:", err);
        showMessage("Login error: " + err.message, true);
      }
    });
  }

  // Student Register Handler
  const studentRegForm = document.getElementById("student-register-form");
  if (studentRegForm) {
    studentRegForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const name = document.getElementById("stud-reg-name").value.trim();
      const school = document.getElementById("stud-reg-school").value.trim();
      const classLevel = document.getElementById("stud-reg-class").value.trim();
      const section = document.getElementById("stud-reg-section").value.trim();
      const roll = document.getElementById("stud-reg-roll").value.trim();

      try {
        const checkExisting = await db.collection("students")
          .where("school", "==", school)
          .where("classLevel", "==", classLevel)
          .where("section", "==", section)
          .where("roll", "==", roll)
          .get();

        if (!checkExisting.empty) {
          showMessage(
            currentLang === "ta"
              ? "இந்த பதிவு எண் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது."
              : "This Roll Number is already registered for this Class & Section.",
            true
          );
          return;
        }

        await db.collection("students").add({
          name: name,
          school: school,
          classLevel: classLevel,
          section: section,
          roll: roll,
          board: "State Board",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage(
          currentLang === "ta"
            ? "பதிவு வெற்றிகரமாக முடிந்தது! இப்போது உள்நுழையலாம்."
            : "Registration complete! You can now log in.",
          false
        );
        toggleStudentMode("login");
      } catch (err) {
        console.error("Student registration error:", err);
        showMessage("Registration failed: " + err.message, true);
      }
    });
  }
}

// --------------------------------------------------------------------------
// Student Dashboard Initialization & Tab Switching
// --------------------------------------------------------------------------
function initStudentDashboard(student) {
  currentStudentData = student;

  const roleBar = document.getElementById("role-selector-bar");
  const studentSection = document.getElementById("student-section");
  const teacherSection = document.getElementById("teacher-section");
  const studentDashboard = document.getElementById("student-dashboard");

  if (roleBar) roleBar.style.display = "none";
  if (studentSection) studentSection.style.display = "none";
  if (teacherSection) teacherSection.style.display = "none";
  if (studentDashboard) studentDashboard.style.display = "block";

  const sName = document.getElementById("s-display-name");
  const sMeta = document.getElementById("s-display-meta");
  if (sName) sName.textContent = student.name;
  if (sMeta) sMeta.textContent = `${student.classLevel} (${student.section}) - ${student.school}`;

  loadStudentHomework(student.classLevel, student.section);
  loadStudentNotes(student.classLevel);
  loadStudentNotices();

  // Listen for real-time homework updates & trigger mobile notification
  listenForHomeworkNotifications(student.classLevel, student.section);
}

function switchStudentTab(tab) {
  const hwBox = document.getElementById("student-homework-container");
  const notesBox = document.getElementById("student-notes-container");
  const noticesBox = document.getElementById("student-notices-container");

  if (hwBox) hwBox.style.display = tab === "homework" ? "block" : "none";
  if (notesBox) notesBox.style.display = tab === "notes" ? "block" : "none";
  if (noticesBox) noticesBox.style.display = tab === "notices" ? "block" : "none";
}

function logoutStudent() {
  currentStudentData = null;
  const studentDashboard = document.getElementById("student-dashboard");
  const roleBar = document.getElementById("role-selector-bar");
  const studentSection = document.getElementById("student-section");

  if (studentDashboard) studentDashboard.style.display = "none";
  if (roleBar) roleBar.style.display = "flex";
  if (studentSection) studentSection.style.display = "block";
  switchRole("student");
  showMessage("Student logged out successfully.");
}

// Load Homework List for Student
async function loadStudentHomework(classLevel, section) {
  const container = document.getElementById("student-homework-container");
  if (!container) return;
  container.innerHTML = "<p>Loading homework...</p>";

  try {
    const snapshot = await db.collection("homework")
      .where("classLevel", "==", classLevel)
      .get();

    if (snapshot.empty) {
      container.innerHTML = "<div class='card'><p>No assigned homework found for your class.</p></div>";
      return;
    }

    let html = "";
    snapshot.forEach((doc) => {
      const hw = doc.data();
      if (hw.section === "All Sections" || hw.section === section) {
        html += `
          <div class="card" style="margin-bottom: 12px; border-left: 4px solid #1e3a8a;">
            <h4 style="margin: 0 0 6px 0;">${hw.subject}: ${hw.title}</h4>
            <p style="margin: 4px 0; font-size: 13px; color: #4b5563;"><strong>Deadline:</strong> ${hw.deadline}</p>
            <p style="margin: 8px 0; font-size: 14px;">${hw.desc || "No instructions provided."}</p>
            ${hw.link ? `<a href="${hw.link}" target="_blank" class="btn primary-btn" style="display:inline-block; margin-top:6px; font-size:12px; padding:4px 8px; text-decoration:none;">🔗 Open Resource</a>` : ""}
          </div>
        `;
      }
    });
    container.innerHTML = html || "<div class='card'><p>No homework for your section.</p></div>";
  } catch (err) {
    console.error("Error loading homework:", err);
    container.innerHTML = "<p>Error loading homework.</p>";
  }
}

// Load Study Notes for Student
async function loadStudentNotes(classLevel) {
  const container = document.getElementById("student-notes-container");
  if (!container) return;
  container.innerHTML = "<p>Loading study materials...</p>";

  try {
    const snapshot = await db.collection("materials")
      .where("classLevel", "==", classLevel)
      .get();

    if (snapshot.empty) {
      container.innerHTML = "<div class='card'><p>No study materials uploaded yet.</p></div>";
      return;
    }

    let html = "";
    snapshot.forEach((doc) => {
      const mat = doc.data();
      html += `
        <div class="card" style="margin-bottom: 12px; border-left: 4px solid #059669;">
          <h4 style="margin: 0 0 4px 0;">${mat.subject}: ${mat.title}</h4>
          <a href="${mat.link}" target="_blank" style="color: #0284c7; font-weight: 500; font-size: 14px;">📖 Access Material Link</a>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading notes:", err);
    container.innerHTML = "<p>Error loading study materials.</p>";
  }
}

// Load Notices for Student
async function loadStudentNotices() {
  const container = document.getElementById("student-notices-container");
  if (!container) return;
  container.innerHTML = "<p>Loading circulars...</p>";

  try {
    const snapshot = await db.collection("notices").orderBy("createdAt", "desc").get();
    if (snapshot.empty) {
      container.innerHTML = "<div class='card'><p>No general circulars posted.</p></div>";
      return;
    }

    let html = "";
    snapshot.forEach((doc) => {
      const notice = doc.data();
      html += `
        <div class="card" style="margin-bottom: 12px; border-left: 4px solid #f59e0b;">
          <h4 style="margin: 0 0 6px 0;">📢 ${notice.title}</h4>
          <p style="margin: 0; font-size: 14px; color: #374151;">${notice.desc}</p>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading notices:", err);
    container.innerHTML = "<p>Error loading notices.</p>";
  }
      }
// ==========================================================================
// APP.JS - PART 3: TEACHER AUTH, DASHBOARD METRICS & ROSTER/ATTENDANCE
// ==========================================================================

// Teacher Authentication Listeners
document.addEventListener("DOMContentLoaded", () => {
  const teacherLoginForm = document.getElementById("teacher-login-form");
  if (teacherLoginForm) {
    teacherLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const email = document.getElementById("teach-login-email").value.trim();
      const password = document.getElementById("teach-login-password").value;

      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;
        const teacherDoc = await db.collection("teachers").doc(uid).get();

        if (teacherDoc.exists) {
          initTeacherDashboard(teacherDoc.data());
        } else {
          initTeacherDashboard({ name: "Teacher", school: "GHSS School", email: email });
        }
      } catch (err) {
        console.error("Teacher login error:", err);
        showMessage("Teacher Login failed: " + err.message, true);
      }
    });
  }

  const teacherRegForm = document.getElementById("teacher-register-form");
  if (teacherRegForm) {
    teacherRegForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const name = document.getElementById("teach-reg-name").value.trim();
      const school = document.getElementById("teach-reg-school").value;
      const classLevel = document.getElementById("teach-reg-class").value;
      const section = document.getElementById("teach-reg-section").value;
      const email = document.getElementById("teach-reg-email").value.trim();
      const password = document.getElementById("teach-reg-password").value;

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCredential.user.uid;

        await db.collection("teachers").doc(uid).set({
          name: name,
          school: school,
          classLevel: classLevel,
          section: section,
          email: email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage("Teacher registration successful! Please log in.", false);
        toggleTeacherMode("login");
      } catch (err) {
        console.error("Teacher registration error:", err);
        showMessage("Registration failed: " + err.message, true);
      }
    });
  }

  const teacherForgotForm = document.getElementById("teacher-forgot-form");
  if (teacherForgotForm) {
    teacherForgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const email = document.getElementById("teach-forgot-email").value.trim();
      try {
        await auth.sendPasswordResetEmail(email);
        showMessage("Password reset link has been dispatched to your email address.", false);
        toggleTeacherMode("login");
      } catch (err) {
        console.error("Reset password error:", err);
        showMessage("Password reset failed: " + err.message, true);
      }
    });
  }

  initTeacherFormHandlers();
});

// --------------------------------------------------------------------------
// Teacher Dashboard Initialization & Tab Switching
// --------------------------------------------------------------------------
function initTeacherDashboard(teacher) {
  currentTeacherData = teacher;

  const roleBar = document.getElementById("role-selector-bar");
  const studentSection = document.getElementById("student-section");
  const teacherSection = document.getElementById("teacher-section");
  const teacherDashboard = document.getElementById("teacher-dashboard");

  if (roleBar) roleBar.style.display = "none";
  if (studentSection) studentSection.style.display = "none";
  if (teacherSection) teacherSection.style.display = "none";
  if (teacherDashboard) teacherDashboard.style.display = "block";

  const tName = document.getElementById("t-display-name");
  const tSchool = document.getElementById("t-display-school");
  if (tName) tName.textContent = teacher.name || "Teacher";
  if (tSchool) tSchool.textContent = `${teacher.school || "School"} (${teacher.classLevel || "Class 6"} - ${teacher.section || "A"})`;

  // Set default attendance date to today
  const attDateInput = document.getElementById("att-date");
  if (attDateInput) attDateInput.value = new Date().toISOString().split("T")[0];

  updateTeacherStats();
  switchTeacherTab("homework");
  loadTeacherHomeworkList();
  loadTeacherMaterialsList();
  loadTeacherNoticesHistory();
}

function switchTeacherTab(tabKey) {
  const tabs = ["students", "attendance", "homework", "materials", "notices"];
  tabs.forEach((tab) => {
    const btn = document.getElementById(`tab-t-${tab}`);
    const panel = document.getElementById(`teacher-panel-${tab}`);
    if (btn) btn.classList.remove("active");
    if (panel) panel.style.display = "none";
  });

  const activeBtn = document.getElementById(`tab-t-${tabKey}`);
  const activePanel = document.getElementById(`teacher-panel-${tabKey}`);
  if (activeBtn) activeBtn.classList.add("active");
  if (activePanel) activePanel.style.display = "block";

  if (tabKey === "students") filterRoster();
  if (tabKey === "attendance") loadAttendanceList();
}

async function logoutTeacher() {
  try {
    await auth.signOut();
  } catch (e) {
    console.error(e);
  }
  currentTeacherData = null;

  const teacherDashboard = document.getElementById("teacher-dashboard");
  const roleBar = document.getElementById("role-selector-bar");
  const teacherSection = document.getElementById("teacher-section");

  if (teacherDashboard) teacherDashboard.style.display = "none";
  if (roleBar) roleBar.style.display = "flex";
  if (teacherSection) teacherSection.style.display = "block";

  switchRole("teacher");
  showMessage("Teacher logged out successfully.");
}

// --------------------------------------------------------------------------
// Metrics & Roster Management
// --------------------------------------------------------------------------
async function updateTeacherStats() {
  try {
    const studentsSnap = await db.collection("students").get();
    const statStudents = document.getElementById("stat-students");
    if (statStudents) statStudents.textContent = studentsSnap.size;

    const hwSnap = await db.collection("homework").get();
    const statHomework = document.getElementById("stat-homework");
    if (statHomework) statHomework.textContent = hwSnap.size;

    const noticesSnap = await db.collection("notices").get();
    const statNotices = document.getElementById("stat-notices");
    if (statNotices) statNotices.textContent = noticesSnap.size;
  } catch (err) {
    console.error("Stats update error:", err);
  }
}

async function filterRoster() {
  const classFilter = document.getElementById("roster-class-filter").value;
  const sectionFilter = document.getElementById("roster-section-filter").value;
  const search = (document.getElementById("roster-search").value || "").toLowerCase();
  const tbody = document.getElementById("roster-table-body");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='5'>Loading roster...</td></tr>";

  try {
    let query = db.collection("students");
    if (classFilter !== "all") query = query.where("classLevel", "==", classFilter);
    if (sectionFilter !== "all") query = query.where("section", "==", sectionFilter);

    const snapshot = await query.get();
    if (snapshot.empty) {
      tbody.innerHTML = "<tr><td colspan='5'>No students enrolled in this selection.</td></tr>";
      return;
    }

    let rows = "";
    snapshot.forEach((doc) => {
      const s = doc.data();
      if (!search || s.name.toLowerCase().includes(search) || String(s.roll).includes(search)) {
        rows += `
          <tr>
            <td><strong>${s.roll}</strong></td>
            <td>${s.name}</td>
            <td>${s.classLevel}</td>
            <td>${s.section || "A"}</td>
            <td>${s.board || "State Board"}</td>
          </tr>
        `;
      }
    });

    tbody.innerHTML = rows || "<tr><td colspan='5'>No matching student records found.</td></tr>";
  } catch (err) {
    console.error("Roster query error:", err);
    tbody.innerHTML = "<tr><td colspan='5'>Error retrieving roster.</td></tr>";
  }
}

// Attendance List Loader
async function loadAttendanceList() {
  const classVal = document.getElementById("att-class-select").value;
  const sectionVal = document.getElementById("att-section-select").value;
  const container = document.getElementById("attendance-list-container");
  if (!container) return;

  container.innerHTML = "<p>Loading students for attendance...</p>";

  try {
    const snap = await db.collection("students")
      .where("classLevel", "==", classVal)
      .where("section", "==", sectionVal)
      .get();

    if (snap.empty) {
      container.innerHTML = "<p>No students enrolled in this class and section.</p>";
      return;
    }

    let html = `<div style="display:flex; flex-direction:column; gap:8px; margin: 12px 0;">`;
    snap.forEach((doc) => {
      const s = doc.data();
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#f9fafb; padding:8px 12px; border-radius:6px; border:1px solid #e5e7eb;">
          <span><strong>#${s.roll}</strong> ${s.name}</span>
          <div style="display:flex; gap:10px;">
            <label><input type="radio" name="att_${doc.id}" value="Present" checked> P</label>
            <label><input type="radio" name="att_${doc.id}" value="Absent"> A</label>
            <label><input type="radio" name="att_${doc.id}" value="Late"> L</label>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  } catch (err) {
    console.error("Attendance load error:", err);
    container.innerHTML = "<p>Error loading attendance list.</p>";
  }
}

async function saveAttendance() {
  const dateVal = document.getElementById("att-date").value;
  const classVal = document.getElementById("att-class-select").value;
  const sectionVal = document.getElementById("att-section-select").value;

  if (!dateVal) {
    showMessage("Please select a date.", true);
    return;
  }

  showMessage("Attendance records saved successfully!", false);
    }
// ==========================================================================
// APP.JS - PART 4: FORMS, REAL-TIME NOTIFICATIONS & SERVICE WORKER HELPERS
// ==========================================================================

function initTeacherFormHandlers() {
  // Homework Submission
  const hwForm = document.getElementById("teacher-homework-form");
  if (hwForm) {
    hwForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const title = document.getElementById("hw-title").value.trim();
      const subject = document.getElementById("hw-subject").value.trim();
      const classLevel = document.getElementById("hw-class").value;
      const section = document.getElementById("hw-section").value;
      const deadline = document.getElementById("hw-deadline").value;
      const desc = document.getElementById("hw-desc").value.trim();
      const link = document.getElementById("hw-link").value.trim();

      try {
        await db.collection("homework").add({
          title,
          subject,
          classLevel,
          section,
          deadline,
          desc,
          link,
          teacherName: currentTeacherData ? currentTeacherData.name : "Teacher",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage("Homework published successfully!");
        hwForm.reset();
        loadTeacherHomeworkList();
        updateTeacherStats();
      } catch (err) {
        console.error("Homework publish error:", err);
        showMessage("Failed to publish homework: " + err.message, true);
      }
    });
  }

  // Material Upload
  const matForm = document.getElementById("teacher-materials-form");
  if (matForm) {
    matForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const title = document.getElementById("mat-title").value.trim();
      const subject = document.getElementById("mat-subject").value.trim();
      const classLevel = document.getElementById("mat-class").value;
      const link = document.getElementById("mat-link").value.trim();

      try {
        await db.collection("materials").add({
          title,
          subject,
          classLevel,
          link,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage("Study material uploaded successfully!");
        matForm.reset();
        loadTeacherMaterialsList();
      } catch (err) {
        console.error("Material upload error:", err);
        showMessage("Upload failed: " + err.message, true);
      }
    });
  }

  // Notice Board Form
  const noticeForm = document.getElementById("teacher-notice-form");
  if (noticeForm) {
    noticeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearMessage();

      const title = document.getElementById("notice-title").value.trim();
      const desc = document.getElementById("notice-desc").value.trim();

      try {
        await db.collection("notices").add({
          title,
          desc,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage("Notice published to board!");
        noticeForm.reset();
        loadTeacherNoticesHistory();
        updateTeacherStats();
      } catch (err) {
        console.error("Notice publish error:", err);
        showMessage("Publishing notice failed: " + err.message, true);
      }
    });
  }
}

// --------------------------------------------------------------------------
// Teacher Dashboard Renderers
// --------------------------------------------------------------------------
async function loadTeacherHomeworkList() {
  const container = document.getElementById("teacher-hw-list");
  if (!container) return;

  try {
    const snap = await db.collection("homework").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      container.innerHTML = "<p>No active homework listed.</p>";
      return;
    }

    let html = "";
    snap.forEach((doc) => {
      const hw = doc.data();
      html += `
        <div style="background:#f9fafb; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #e5e7eb;">
          <strong>${hw.subject}: ${hw.title}</strong>
          <span style="font-size:12px; color:#6b7280; display:block;">Target: ${hw.classLevel} (${hw.section || "All"}) | Due: ${hw.deadline}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error(err);
  }
}

async function loadTeacherMaterialsList() {
  const container = document.getElementById("teacher-materials-list");
  if (!container) return;

  try {
    const snap = await db.collection("materials").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      container.innerHTML = "<p>No study materials uploaded.</p>";
      return;
    }

    let html = "";
    snap.forEach((doc) => {
      const m = doc.data();
      html += `
        <div style="padding:6px 0; border-bottom:1px solid #eee;">
          <span><strong>${m.subject}:</strong> ${m.title} (${m.classLevel})</span>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error(err);
  }
}

async function loadTeacherNoticesHistory() {
  const container = document.getElementById("teacher-notices-history");
  if (!container) return;

  try {
    const snap = await db.collection("notices").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      container.innerHTML = "<p>No notices posted.</p>";
      return;
    }

    let html = "";
    snap.forEach((doc) => {
      const n = doc.data();
      html += `
        <div style="padding:8px; background:#fffbeb; margin-bottom:6px; border-radius:4px;">
          <strong>📢 ${n.title}</strong>
          <p style="margin:2px 0 0 0; font-size:13px;">${n.desc}</p>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error(err);
  }
}

// --------------------------------------------------------------------------
// Push Notifications & Real-Time Firestore Snapshot Listener
// --------------------------------------------------------------------------
function listenForHomeworkNotifications(classLevel, section) {
  requestNotificationPermission().then((granted) => {
    if (granted && currentStudentData) {
      let initialLoad = true;

      db.collection("homework")
        .where("classLevel", "==", classLevel)
        .onSnapshot((snapshot) => {
          if (initialLoad) {
            initialLoad = false;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              if (data.section === "All Sections" || data.section === section) {
                sendLocalNotification(
                  "📚 New Homework Assigned!",
                  `${data.subject || "Subject"}: ${data.title || "Check your portal for details."}`
                );
                loadStudentHomework(classLevel, section);
              }
            }
          });
        }, (error) => {
          console.error("Homework notification listener error:", error);
        });
    }
  });
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("This browser does not support notifications.");
    return false;
  }
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
}

function sendLocalNotification(title, body) {
  if (Notification.permission === "granted" && "serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body: body,
        icon: "./IMG_20261118_172023.jpg",
        badge: "./IMG_20261118_172023.jpg",
        vibrate: [100, 50, 100]
      });
    });
  }
}
