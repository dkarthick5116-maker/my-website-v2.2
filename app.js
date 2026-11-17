// ==========================================
// MY WEBSITE V2.2 - CORE APPLICATION SCRIPT
// Firebase Auth, Firestore & Storage Logic
// ==========================================

// Global state variables
let currentTeacherData = null;
let cachedSchoolStudents = [];

// --- Helper Functions ---
function showMessage(text, isError = false) {
  const box = document.getElementById("alert-box");
  if (!box) return;
  box.textContent = text;
  box.style.display = "block";
  box.style.backgroundColor = isError ? "#ffebee" : "#e8f5e9";
  box.style.color = isError ? "#c62828" : "#2e7d32";
  box.style.borderColor = isError ? "#ef9a9a" : "#a5d6a7";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearMessage() {
  const box = document.getElementById("alert-box");
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

// Convert school name and roll number into deterministic internal Firebase ID
function generateStudentInternalEmail(school, rollNumber) {
  const cleanSchool = school.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanRoll = rollNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return `stu_${cleanSchool}_${cleanRoll}@v22portal.local`;
}

// --- Bilingual Language Switcher ---
function setLanguage(lang) {
  document.querySelectorAll(".text-en").forEach(el => {
    el.style.display = lang === "en" ? "inline" : "none";
  });
  document.querySelectorAll(".text-ta").forEach(el => {
    el.style.display = lang === "ta" ? "inline" : "none";
  });

  const btnEn = document.getElementById("lang-en");
  const btnTa = document.getElementById("lang-ta");
  if (btnEn && btnTa) {
    btnEn.classList.toggle("active-lang", lang === "en");
    btnTa.classList.toggle("active-lang", lang === "ta");
  }
}

// --- Role Switcher (Student / Teacher) ---
function switchRole(role) {
  clearMessage();
  const studentSection = document.getElementById("student-section");
  const teacherSection = document.getElementById("teacher-section");
  const tabStudent = document.getElementById("tab-student");
  const tabTeacher = document.getElementById("tab-teacher");

  if (role === "student") {
    studentSection.style.display = "block";
    teacherSection.style.display = "none";
    tabStudent.classList.add("active");
    tabTeacher.classList.remove("active");
    toggleStudentMode("login");
  } else {
    studentSection.style.display = "none";
    teacherSection.style.display = "block";
    tabTeacher.classList.add("active");
    tabStudent.classList.remove("active");
    toggleTeacherMode("login");
  }
}

// --- Student View Toggles ---
function toggleStudentMode(mode) {
  clearMessage();
  document.getElementById("student-login-box").style.display = mode === "login" ? "block" : "none";
  document.getElementById("student-register-box").style.display = mode === "register" ? "block" : "none";
  document.getElementById("student-recovery-box").style.display = "none";
}

function showStudentForgot() {
  clearMessage();
  document.getElementById("student-login-box").style.display = "none";
  document.getElementById("student-register-box").style.display = "none";
  document.getElementById("student-recovery-box").style.display = "block";
}

// --- Teacher View Toggles ---
function toggleTeacherMode(mode) {
  clearMessage();
  document.getElementById("teacher-login-box").style.display = mode === "login" ? "block" : "none";
  document.getElementById("teacher-register-box").style.display = mode === "register" ? "block" : "none";
  document.getElementById("teacher-forgot-box").style.display = "none";
}

function showTeacherForgot() {
  clearMessage();
  document.getElementById("teacher-login-box").style.display = "none";
  document.getElementById("teacher-register-box").style.display = "none";
  document.getElementById("teacher-forgot-box").style.display = "block";
}

// ==========================================
// AUTHENTICATION STATE OBSERVER
// ==========================================
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // Check if user is a teacher
    try {
      const teacherDoc = await db.collection("teachers").doc(user.uid).get();
      if (teacherDoc.exists) {
        currentTeacherData = teacherDoc.data();
        initTeacherDashboard(currentTeacherData);
      }
    } catch (err) {
      console.error("Error fetching teacher profile:", err);
    }
  } else {
    // Reset view to logged-out state
    currentTeacherData = null;
    document.getElementById("teacher-dashboard").style.display = "none";
    document.getElementById("role-selector-bar").style.display = "flex";
    switchRole("student");
  }
});

// Logout
async function logoutUser() {
  clearMessage();
  await auth.signOut();
  showMessage("You have been logged out successfully.");
}

// ==========================================
// TEACHER DASHBOARD LOGIC
// ==========================================
function initTeacherDashboard(teacher) {
  clearMessage();
  // Hide Auth Panels
  document.getElementById("role-selector-bar").style.display = "none";
  document.getElementById("student-section").style.display = "none";
  document.getElementById("teacher-section").style.display = "none";

  // Show Teacher Dashboard
  const dashboard = document.getElementById("teacher-dashboard");
  dashboard.style.display = "block";

  // Set Profile Information
  document.getElementById("t-display-name").textContent = teacher.name || "Teacher";
  document.getElementById("t-display-school").textContent = teacher.school || "School";

  // Set today's date as default in attendance
  const dateInput = document.getElementById("att-date");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  // Load Data
  loadTeacherStudentsRoster(teacher.school);
  loadTeacherHomework(teacher.school);
  loadTeacherMaterials(teacher.school);
  loadTeacherNotices(teacher.school);
}

// Teacher Workspace Tab Switcher
function switchTeacherPanel(panelName) {
  const panels = ["students", "attendance", "homework", "materials", "notices"];
  panels.forEach(p => {
    const el = document.getElementById(`panel-${p}`);
    if (el) el.style.display = (p === panelName) ? "block" : "none";
  });

  const buttons = document.querySelectorAll(".t-nav-btn");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(panelName));
  });
}

// --- Panel 1: Student Roster Management ---
async function loadTeacherStudentsRoster(schoolName) {
  const tableBody = document.getElementById("roster-table-body");
  tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">Loading students...</td></tr>`;

  try {
    const snapshot = await db.collection("students")
      .where("school", "==", schoolName)
      .get();

    cachedSchoolStudents = [];
    snapshot.forEach(doc => {
      cachedSchoolStudents.push(doc.data());
    });

    // Update Stats Card
    document.getElementById("stat-total-students").textContent = cachedSchoolStudents.length;

    renderRosterTable(cachedSchoolStudents);
  } catch (err) {
    console.error("Error loading roster:", err);
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Failed to load students.</td></tr>`;
  }
}

function renderRosterTable(students) {
  const tableBody = document.getElementById("roster-table-body");
  if (students.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No students found for this selection.</td></tr>`;
    return;
  }

  let html = "";
  students.forEach(s => {
    html += `
      <tr>
        <td><strong>${s.rollNumber || "-"}</strong></td>
        <td>${s.name || "-"}</td>
        <td>Class ${s.classLevel || "-"}</td>
        <td>${s.board || "State Board"}</td>
      </tr>
    `;
  });
  tableBody.innerHTML = html;
}

function filterRosterTable() {
  const searchText = document.getElementById("roster-search").value.toLowerCase().trim();
  const selectedClass = document.getElementById("roster-class-filter").value;

  const filtered = cachedSchoolStudents.filter(s => {
    const matchesSearch = (s.name && s.name.toLowerCase().includes(searchText)) ||
                          (s.rollNumber && s.rollNumber.toLowerCase().includes(searchText));
    const matchesClass = (selectedClass === "all" || s.classLevel === selectedClass);
    return matchesSearch && matchesClass;
  });

  renderRosterTable(filtered);
}

// --- Panel 2: Daily Attendance System ---
function loadAttendanceStudentList() {
  const selectedClass = document.getElementById("att-class-select").value;
  const listContainer = document.getElementById("att-student-list");
  const saveBtn = document.getElementById("save-attendance-btn");

  if (!selectedClass) {
    listContainer.innerHTML = `<p class="placeholder-text">Please select a class to mark attendance.</p>`;
    saveBtn.style.display = "none";
    return;
  }

  const classStudents = cachedSchoolStudents.filter(s => s.classLevel === selectedClass);

  if (classStudents.length === 0) {
    listContainer.innerHTML = `<p class="placeholder-text">No students registered in Class ${selectedClass}.</p>`;
    saveBtn.style.display = "none";
    return;
  }

  let html = "";
  classStudents.forEach(s => {
    html += `
      <div class="attendance-row" data-uid="${s.uid}" data-roll="${s.rollNumber}" data-name="${s.name}">
        <div>
          <strong>${s.rollNumber}</strong> - ${s.name}
        </div>
        <div class="attendance-options">
          <label class="att-radio-label">
            <input type="radio" name="att_${s.uid}" value="Present" checked> P
          </label>
          <label class="att-radio-label">
            <input type="radio" name="att_${s.uid}" value="Absent"> A
          </label>
          <label class="att-radio-label">
            <input type="radio" name="att_${s.uid}" value="Leave"> L
          </label>
        </div>
      </div>
    `;
  });

  listContainer.innerHTML = html;
  saveBtn.style.display = "block";
}

async function saveDailyAttendance() {
  const date = document.getElementById("att-date").value;
  const selectedClass = document.getElementById("att-class-select").value;
  const saveBtn = document.getElementById("save-attendance-btn");

  if (!date || !selectedClass) {
    alert("Please select both a date and a class.");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  const attendanceRecords = [];
  const rows = document.querySelectorAll(".attendance-row");
  rows.forEach(row => {
    const uid = row.getAttribute("data-uid");
    const roll = row.getAttribute("data-roll");
    const name = row.getAttribute("data-name");
    const status = row.querySelector(`input[name="att_${uid}"]:checked`).value;

    attendanceRecords.push({ uid, roll, name, status });
  });

  // Unique document ID prevents duplicate attendance for the same school, class, and date
  const docId = `${currentTeacherData.school}_Class${selectedClass}_${date}`.replace(/\s+/g, "_");

  try {
    await db.collection("attendance").doc(docId).set({
      school: currentTeacherData.school,
      classLevel: selectedClass,
      date: date,
      teacherId: currentTeacherData.uid,
      teacherName: currentTeacherData.name,
      records: attendanceRecords,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Attendance recorded successfully!");
  } catch (err) {
    console.error("Error saving attendance:", err);
    alert("Failed to save attendance: " + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Attendance";
  }
}

// --- Panel 3: Homework Upload & Review ---
const homeworkForm = document.getElementById("teacher-homework-form");
if (homeworkForm) {
  homeworkForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentTeacherData) return;

    const title = document.getElementById("hw-title").value.trim();
    const subject = document.getElementById("hw-subject").value.trim();
    const classLevel = document.getElementById("hw-class").value;
    const deadline = document.getElementById("hw-deadline").value;
    const instructions = document.getElementById("hw-instructions").value.trim();
    const fileInput = document.getElementById("hw-file");
    const submitBtn = document.getElementById("hw-submit-btn");

    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing...";

    let downloadUrl = "";

    try {
      // Upload file to Firebase Storage if selected
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const storageRef = firebase.storage().ref(`homework/${Date.now()}_${file.name}`);
        const uploadSnapshot = await storageRef.put(file);
        downloadUrl = await uploadSnapshot.ref.getDownloadURL();
      }

      // Save Homework Record in Firestore
      await db.collection("homework").add({
        title,
        subject,
        classLevel,
        deadline,
        instructions,
        fileUrl: downloadUrl,
        school: currentTeacherData.school,
        teacherId: currentTeacherData.uid,
        teacherName: currentTeacherData.name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("Homework published successfully!");
      homeworkForm.reset();
      loadTeacherHomework(currentTeacherData.school);
    } catch (err) {
      console.error("Error publishing homework:", err);
      alert("Failed to publish homework: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publish Homework";
    }
  });
}

async function loadTeacherHomework(schoolName) {
  const container = document.getElementById("teacher-hw-list");
  try {
    const snapshot = await db.collection("homework")
      .where("school", "==", schoolName)
      .get();

    document.getElementById("stat-total-homework").textContent = snapshot.size;

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No active homework posted yet.</p>`;
      return;
    }

    let html = "";
    snapshot.forEach(doc => {
      const hw = doc.data();
      html += `
        <div class="item-card">
          <h5>${hw.title} (${hw.subject})</h5>
          <div class="item-meta">Class: ${hw.classLevel} | Deadline: ${hw.deadline}</div>
          <p style="margin: 6px 0; font-size: 0.9rem;">${hw.instructions}</p>
          ${hw.fileUrl ? `<a href="${hw.fileUrl}" target="_blank" style="color: #1a237e; font-size: 0.85rem; font-weight: 600;">📎 View Attached File</a>` : ""}
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error fetching homework:", err);
    container.innerHTML = `<p class="placeholder-text">Error loading homework.</p>`;
  }
}

// --- Panel 4: Study Materials ---
const materialForm = document.getElementById("teacher-material-form");
if (materialForm) {
  materialForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentTeacherData) return;

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
        school: currentTeacherData.school,
        teacherId: currentTeacherData.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("Study material published!");
      materialForm.reset();
      loadTeacherMaterials(currentTeacherData.school);
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}

async function loadTeacherMaterials(schoolName) {
  const container = document.getElementById("teacher-mat-list");
  try {
    const snapshot = await db.collection("materials")
      .where("school", "==", schoolName)
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No materials uploaded yet.</p>`;
      return;
    }

    let html = "";
    snapshot.forEach(doc => {
      const mat = doc.data();
      html += `
        <div class="item-card">
          <h5>${mat.title} - ${mat.subject} (Class ${mat.classLevel})</h5>
          <a href="${mat.link}" target="_blank" style="color: #1a237e; font-size: 0.85rem; font-weight: 600;">🔗 Open Drive Link</a>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="placeholder-text">Error loading materials.</p>`;
  }
}

// --- Panel 5: Notices ---
const noticeForm = document.getElementById("teacher-notice-form");
if (noticeForm) {
  noticeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentTeacherData) return;

    const title = document.getElementById("not-title").value.trim();
    const content = document.getElementById("not-content").value.trim();

    try {
      await db.collection("notices").add({
        title,
        content,
        school: currentTeacherData.school,
        teacherId: currentTeacherData.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("Notice broadcasted!");
      noticeForm.reset();
      loadTeacherNotices(currentTeacherData.school);
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
}

async function loadTeacherNotices(schoolName) {
  const container = document.getElementById("teacher-not-list");
  try {
    const snapshot = await db.collection("notices")
      .where("school", "==", schoolName)
      .get();

    document.getElementById("stat-total-notices").textContent = snapshot.size;

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No notices posted yet.</p>`;
      return;
    }

    let html = "";
    snapshot.forEach(doc => {
      const not = doc.data();
      html += `
        <div class="item-card">
          <h5>${not.title}</h5>
          <p style="margin: 4px 0 0 0; font-size: 0.9rem;">${not.content}</p>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="placeholder-text">Error loading notices.</p>`;
  }
}

// ==========================================
// FORM SUBMISSIONS & FIREBASE AUTH INTEGRATION
// ==========================================

// 1. Student Registration
const studentRegisterForm = document.getElementById("student-register-form");
if (studentRegisterForm) {
  studentRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const name = document.getElementById("stu-reg-name").value.trim();
    const school = document.getElementById("stu-reg-school").value.trim();
    const board = document.getElementById("stu-reg-board").value;
    const classLevel = document.getElementById("stu-reg-class").value;
    const roll = document.getElementById("stu-reg-roll").value.trim();
    const password = document.getElementById("stu-reg-password").value;

    const syntheticEmail = generateStudentInternalEmail(school, roll);

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(syntheticEmail, password);
      const user = userCredential.user;

      await db.collection("students").doc(user.uid).set({
        uid: user.uid,
        name: name,
        school: school,
        board: board,
        classLevel: classLevel,
        rollNumber: roll,
        role: "student",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showMessage("Registration successful! You can now log in with your School Name, Roll Number, and Password.");
      studentRegisterForm.reset();
      toggleStudentMode("login");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        showMessage("This RollNumber is already registered for this school.", true);
      } else {
        showMessage(err.message, true);
      }
    }
  });
}

// 2. Student Login
const studentLoginForm = document.getElementById("student-login-form");
if (studentLoginForm) {
  studentLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const school = document.getElementById("stu-login-school").value.trim();
    const roll = document.getElementById("stu-login-roll").value.trim();
    const password = document.getElementById("stu-login-password").value;

    const syntheticEmail = generateStudentInternalEmail(school, roll);

    try {
      await auth.signInWithEmailAndPassword(syntheticEmail, password);
      showMessage("Welcome " + school + " student! Login successful.");
    } catch (err) {
      showMessage("Invalid School Name, Roll Number, or Password.", true);
    }
  });
}

// 3. Student Password Recovery
const studentRecoveryForm = document.getElementById("student-recovery-form");
if (studentRecoveryForm) {
  studentRecoveryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();
    showMessage("Password reset request submitted. Contact your school administrator or teacher to complete recovery.", false);
  });
}

// 4. Teacher Registration
const teacherRegisterForm = document.getElementById("teacher-register-form");
if (teacherRegisterForm) {
  teacherRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const name = document.getElementById("teach-reg-name").value.trim();
    const school = document.getElementById("teach-reg-school").value.trim();
    const email = document.getElementById("teach-reg-email").value.trim();
    const password = document.getElementById("teach-reg-password").value;

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      await db.collection("teachers").doc(user.uid).set({
        uid: user.uid,
        name: name,
        school: school,
        email: email,
        role: "teacher",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showMessage("Teacher account registered successfully! You can now log in.");
      teacherRegisterForm.reset();
      toggleTeacherMode("login");
    } catch (err) {
      showMessage(err.message, true);
    }
  });
}

// 5. Teacher Login
const teacherLoginForm = document.getElementById("teacher-login-form");
if (teacherLoginForm) {
  teacherLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const email = document.getElementById("teach-login-email").value.trim();
    const password = document.getElementById("teach-login-password").value;

    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      showMessage(err.message, true);
    }
  });
}

// 6. Teacher Password Reset
const teacherForgotForm = document.getElementById("teacher-forgot-form");
if (teacherForgotForm) {
  teacherForgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const email = document.getElementById("teach-forgot-email").value.trim();

    try {
      await auth.sendPasswordResetEmail(email);
      showMessage("Password reset email sent! Check your inbox for the link.");
      teacherForgotForm.reset();
    } catch (err) {
      showMessage(err.message, true);
    }
  });
  }
