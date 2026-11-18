// ==========================================
// MY WEBSITE V2.2 - CORE APPLICATION SCRIPT
// Part 1: Helpers, Auth Routing & Student Dashboard
// ==========================================

let currentTeacherData = null;
let currentStudentData = null;
let cachedSchoolStudents = [];

// --- Notification Helpers ---
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
    try {
      // 1. Check if Teacher
      const teacherDoc = await db.collection("teachers").doc(user.uid).get();
      if (teacherDoc.exists) {
        currentTeacherData = teacherDoc.data();
        initTeacherDashboard(currentTeacherData);
        return;
      }

      // 2. Check if Student
      const studentDoc = await db.collection("students").doc(user.uid).get();
      if (studentDoc.exists) {
        currentStudentData = studentDoc.data();
        initStudentDashboard(currentStudentData);
        return;
      }
    } catch (err) {
      console.error("Auth routing error:", err);
    }
  } else {
    currentTeacherData = null;
    currentStudentData = null;
    document.getElementById("teacher-dashboard").style.display = "none";
    document.getElementById("student-dashboard").style.display = "none";
    document.getElementById("role-selector-bar").style.display = "flex";
    switchRole("student");
  }
});

async function logoutUser() {
  clearMessage();
  await auth.signOut();
  showMessage("Logged out successfully.");
}

// ==========================================
// STUDENT DASHBOARD LOGIC
// ==========================================
function initStudentDashboard(student) {
  clearMessage();
  document.getElementById("role-selector-bar").style.display = "none";
  document.getElementById("student-section").style.display = "none";
  document.getElementById("teacher-section").style.display = "none";

  const sDash = document.getElementById("student-dashboard");
  sDash.style.display = "block";

  document.getElementById("s-display-name").textContent = student.name || "Student";
  document.getElementById("s-display-meta").textContent = `Class ${student.classLevel} (${student.board}) - ${student.school}`;

  loadStudentHomework(student);
  loadStudentMaterials(student);
  loadStudentNotices(student.school);
}

function switchStudentPanel(panel) {
  ["hw", "mat", "notices"].forEach(p => {
    const el = document.getElementById(`spanel-${p}`);
    if (el) el.style.display = (p === panel) ? "block" : "none";
  });

  const btns = document.querySelectorAll(".s-nav-btn");
  btns.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(panel));
  });
}

async function loadStudentHomework(student) {
  const container = document.getElementById("student-hw-list");
  try {
    const snapshot = await db.collection("homework")
      .where("school", "==", student.school)
      .where("classLevel", "==", student.classLevel)
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No homework assigned for Class ${student.classLevel}.</p>`;
      return;
    }

    let html = "";
    for (const docSnap of snapshot.docs) {
      const hw = docSnap.data();
      const hwId = docSnap.id;
      const submissionId = `${hwId}_${student.uid}`;

      const subSnap = await db.collection("homeworkSubmissions").doc(submissionId).get();
      const isSubmitted = subSnap.exists;
      const subData = isSubmitted ? subSnap.data() : null;

      html += `
        <div class="item-card">
          <h5>${hw.title} - ${hw.subject}</h5>
          <div class="item-meta">Deadline: ${hw.deadline} | Teacher: ${hw.teacherName || "School Teacher"}</div>
          <p style="margin: 8px 0; font-size: 0.9rem;">${hw.instructions}</p>
          ${hw.link ? `<p><a href="${hw.link}" target="_blank" style="color: #1a237e; font-weight: 600;">🔗 View Assignment Material</a></p>` : ""}
          
          <div style="margin-top: 12px; background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${isSubmitted ? `
              <div style="font-size: 0.88rem; color: #166534; font-weight: 600;">
                ✓ Submitted: <span style="font-weight: 400; color: #333;">${subData.submissionContent}</span>
              </div>
              ${subData.marks ? `
                <div style="margin-top: 6px; font-size: 0.88rem; color: #1a237e; font-weight: 600;">
                  Marks: ${subData.marks} | Feedback: ${subData.feedback || "Good job!"}
                </div>
              ` : `
                <div style="margin-top: 4px; font-size: 0.8rem; color: #d97706;">
                  Status: Under Review by Teacher
                </div>
              `}
            ` : `
              <label style="font-size: 0.85rem; font-weight: 600; color: #1a237e;">Submit Answer / Google Drive Link:</label>
              <div style="display: flex; gap: 8px; margin-top: 6px;">
                <input type="text" id="ans-${hwId}" placeholder="Enter Drive link or written answer..." style="flex:1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;">
                <button type="button" class="btn primary-btn" style="padding: 8px 12px; font-size: 0.85rem; width: auto;" onclick="submitHomeworkAnswer('${hwId}', '${hw.title}')">Submit</button>
              </div>
            `}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading student homework:", err);
    container.innerHTML = `<p class="placeholder-text">Unable to load homework.</p>`;
  }
}

async function submitHomeworkAnswer(hwId, hwTitle) {
  const input = document.getElementById(`ans-${hwId}`);
  const answer = input ? input.value.trim() : "";

  if (!answer) {
    alert("Please enter your answer or Google Drive link before submitting.");
    return;
  }

  try {
    const submissionId = `${hwId}_${currentStudentData.uid}`;
    await db.collection("homeworkSubmissions").doc(submissionId).set({
      homeworkId: hwId,
      homeworkTitle: hwTitle,
      studentUid: currentStudentData.uid,
      studentName: currentStudentData.name,
      studentRoll: currentStudentData.rollNumber,
      school: currentStudentData.school,
      classLevel: currentStudentData.classLevel,
      submissionContent: answer,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: "Submitted",
      marks: "",
      feedback: ""
    });

    alert("Homework submitted successfully to your teacher!");
    loadStudentHomework(currentStudentData);
  } catch (err) {
    alert("Error submitting homework: " + err.message);
  }
}

async function loadStudentMaterials(student) {
  const container = document.getElementById("student-mat-list");
  try {
    const snapshot = await db.collection("materials")
      .where("school", "==", student.school)
      .where("classLevel", "==", student.classLevel)
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No notes published for Class ${student.classLevel} yet.</p>`;
      return;
    }

    let html = "";
    snapshot.forEach(doc => {
      const mat = doc.data();
      html += `
        <div class="item-card">
          <h5>${mat.title} (${mat.subject})</h5>
          <a href="${mat.link}" target="_blank" style="color: #1a237e; font-weight: 600; font-size: 0.85rem;">🔗 Open Study Material Link</a>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="placeholder-text">Unable to load materials.</p>`;
  }
}

async function loadStudentNotices(schoolName) {
  const container = document.getElementById("student-not-list");
  try {
    const snapshot = await db.collection("notices")
      .where("school", "==", schoolName)
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No announcements at this time.</p>`;
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
    container.innerHTML = `<p class="placeholder-text">Unable to load notices.</p>`;
   // Real-time Homework Notifications for Student
  requestNotificationPermission().then((granted) => {
    if (granted && currentStudentData) {
      let initialLoad = true;

      db.collection("homework")
        .where("classLevel", "==", currentStudentData.classLevel)
        .onSnapshot((snapshot) => {
          if (initialLoad) {
            initialLoad = false;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const data = change.doc.data();
              sendLocalNotification(
                "📚 New Homework Assigned!",
                `${data.subject || "Subject"}: ${data.title || "Check your portal for details."}`
              );
            }
          });
        }, (error) => {
          console.error("Homework notification listener error:", error);
        });
    }
  });
  }
    }
// ==========================================
// MY WEBSITE V2.2 - CORE APPLICATION SCRIPT
// Part 2: Teacher Dashboard & Auth Listeners
// ==========================================

function initTeacherDashboard(teacher) {
  clearMessage();
  document.getElementById("role-selector-bar").style.display = "none";
  document.getElementById("student-section").style.display = "none";
  document.getElementById("teacher-section").style.display = "none";

  const dashboard = document.getElementById("teacher-dashboard");
  dashboard.style.display = "block";

  document.getElementById("t-display-name").textContent = teacher.name || "Teacher";
  document.getElementById("t-display-school").textContent = teacher.school || "School";

  const dateInput = document.getElementById("att-date");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  loadTeacherStudentsRoster(teacher.school);
  loadTeacherHomework(teacher.school);
  loadTeacherMaterials(teacher.school);
  loadTeacherNotices(teacher.school);
}

function switchTeacherPanel(panelName) {
  ["students", "attendance", "homework", "materials", "notices"].forEach(p => {
    const el = document.getElementById(`panel-${p}`);
    if (el) el.style.display = (p === panelName) ? "block" : "none";
  });

  const buttons = document.querySelectorAll(".t-nav-btn");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(panelName));
  });
}

// --- Roster ---
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
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No students found.</td></tr>`;
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

// --- Attendance ---
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
          <label class="att-radio-label"><input type="radio" name="att_${s.uid}" value="Present" checked> P</label>
          <label class="att-radio-label"><input type="radio" name="att_${s.uid}" value="Absent"> A</label>
          <label class="att-radio-label"><input type="radio" name="att_${s.uid}" value="Leave"> L</label>
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
  document.querySelectorAll(".attendance-row").forEach(row => {
    const uid = row.getAttribute("data-uid");
    const roll = row.getAttribute("data-roll");
    const name = row.getAttribute("data-name");
    const status = row.querySelector(`input[name="att_${uid}"]:checked`).value;
    attendanceRecords.push({ uid, roll, name, status });
  });

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
    alert("Failed to save attendance: " + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Attendance";
  }
}

// --- Homework Creation & Review ---
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
    const link = document.getElementById("hw-link").value.trim();
    const submitBtn = document.getElementById("hw-submit-btn");

    submitBtn.disabled = true;
    submitBtn.textContent = "Publishing...";

    try {
      await db.collection("homework").add({
        title,
        subject,
        classLevel,
        deadline,
        instructions,
        link: link,
        school: currentTeacherData.school,
        teacherId: currentTeacherData.uid,
        teacherName: currentTeacherData.name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("Homework published successfully!");
      homeworkForm.reset();
      loadTeacherHomework(currentTeacherData.school);
    } catch (err) {
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
      const hwId = doc.id;
      html += `
        <div class="item-card">
          <h5>${hw.title} (${hw.subject})</h5>
          <div class="item-meta">Class: ${hw.classLevel} | Deadline: ${hw.deadline}</div>
          <p style="margin: 6px 0; font-size: 0.9rem;">${hw.instructions}</p>
          ${hw.link ? `<p><a href="${hw.link}" target="_blank" style="color: #1a237e; font-size: 0.85rem; font-weight: 600;">🔗 View Attached Link</a></p>` : ""}
          <div style="margin-top: 10px;">
            <button type="button" class="btn" style="width: auto; padding: 6px 14px; font-size: 0.85rem; background: #0284c7; color: #fff;" onclick="openReviewPanel('${hwId}', '${hw.title.replace(/'/g, "\\'")}')">
              📋 Review Submissions
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `<p class="placeholder-text">Error loading homework.</p>`;
  }
}

// Open and Review Submissions for a Specific Homework
async function openReviewPanel(hwId, hwTitle) {
  const reviewContainer = document.getElementById("hw-review-container");
  const reviewTitle = document.getElementById("hw-review-title");
  const reviewContent = document.getElementById("hw-review-content");

  reviewContainer.style.display = "block";
  reviewTitle.textContent = `Submissions: ${hwTitle}`;
  reviewContent.innerHTML = `<p class="placeholder-text">Loading student submissions...</p>`;
  reviewContainer.scrollIntoView({ behavior: "smooth" });

  try {
    const snapshot = await db.collection("homeworkSubmissions")
      .where("homeworkId", "==", hwId)
      .get();

    if (snapshot.empty) {
      reviewContent.innerHTML = `<p class="placeholder-text">No students have submitted this homework yet.</p>`;
      return;
    }

    let html = `
      <div class="table-container">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Roll</th>
              <th>Student Name</th>
              <th>Submission / Link</th>
              <th>Marks</th>
              <th>Feedback</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    snapshot.forEach(docSnap => {
      const sub = docSnap.data();
      const subId = docSnap.id;
      const isLink = sub.submissionContent.startsWith("http");

      html += `
        <tr>
          <td><strong>${sub.studentRoll}</strong></td>
          <td>${sub.studentName}</td>
          <td>
            ${isLink ? `<a href="${sub.submissionContent}" target="_blank" style="color:#0284c7; font-weight:600;">🔗 Open Answer</a>` : sub.submissionContent}
          </td>
          <td>
            <input type="text" id="grade-mark-${subId}" value="${sub.marks || ""}" placeholder="e.g. 10/10" style="width: 70px; padding: 4px; font-size: 0.85rem;">
          </td>
          <td>
            <input type="text" id="grade-feed-${subId}" value="${sub.feedback || ""}" placeholder="Comments..." style="width: 120px; padding: 4px; font-size: 0.85rem;">
          </td>
          <td>
            <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.8rem; background: #166534; color: #fff; width: auto;" onclick="saveHomeworkGrade('${subId}')">
              Save
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    reviewContent.innerHTML = html;
  } catch (err) {
    console.error("Error loading submissions:", err);
    reviewContent.innerHTML = `<p class="placeholder-text" style="color:red;">Error loading submissions: ${err.message}</p>`;
  }
}

async function saveHomeworkGrade(subId) {
  const marks = document.getElementById(`grade-mark-${subId}`).value.trim();
  const feedback = document.getElementById(`grade-feed-${subId}`).value.trim();

  try {
    await db.collection("homeworkSubmissions").doc(subId).update({
      marks: marks,
      feedback: feedback,
      status: "Reviewed",
      gradedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Grade and feedback saved!");
  } catch (err) {
    alert("Failed to save grade: " + err.message);
  }
}

function closeReviewPanel() {
  document.getElementById("hw-review-container").style.display = "none";
}

// --- Materials ---
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

// --- Notices ---
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
// AUTHENTICATION FORMS
// ==========================================

// Student Registration
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
        showMessage("This Roll Number is already registered for this school.", true);
      } else {
        showMessage(err.message, true);
      }
    }
  });
}

// Student Login
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
    } catch (err) {
      showMessage("Invalid School Name, Roll Number, or Password.", true);
    }
  });
}

// Student Password Recovery
const studentRecoveryForm = document.getElementById("student-recovery-form");
if (studentRecoveryForm) {
  studentRecoveryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();
    showMessage("Password reset request submitted. Contact your school teacher.", false);
  });
}

// Teacher Registration
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

      showMessage("Teacher account registered! You can now log in.");
      teacherRegisterForm.reset();
      toggleTeacherMode("login");
    } catch (err) {
      showMessage(err.message, true);
    }
  });
}

// Teacher Login
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

// Teacher Password Reset
const teacherForgotForm = document.getElementById("teacher-forgot-form");
if (teacherForgotForm) {
  teacherForgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    const email = document.getElementById("teach-forgot-email").value.trim();

    try {
      await auth.sendPasswordResetEmail(email);
      showMessage("Password reset email sent! Check your inbox.");
      teacherForgotForm.reset();
    } catch (err) {
      showMessage(err.message, true);
    }
  });
}
// ==========================================
// EXAMINATION & RESULTS MANAGEMENT MODULE
// ==========================================

// 1. Teacher Panel Switcher for Exams
const originalSwitchTeacherPanel = window.switchTeacherPanel;
window.switchTeacherPanel = function(panelName) {
  const panels = ["students", "attendance", "homework", "materials", "notices", "exams"];
  panels.forEach(p => {
    const el = document.getElementById(`panel-${p}`);
    if (el) el.style.display = (p === panelName) ? "block" : "none";
  });

  const buttons = document.querySelectorAll(".t-nav-btn");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(panelName));
  });

  if (panelName === "exams" && currentTeacherData) {
    loadTeacherExaminations(currentTeacherData.school);
  }
};

// 2. Exam Creation Listener
const examForm = document.getElementById("teacher-exam-form");
if (examForm) {
  examForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentTeacherData) return;

    const title = document.getElementById("exam-title").value.trim();
    const subject = document.getElementById("exam-subject").value.trim();
    const classLevel = document.getElementById("exam-class").value;
    const examDate = document.getElementById("exam-date").value;
    const maxMarks = parseInt(document.getElementById("exam-max-marks").value, 10);
    const submitBtn = document.getElementById("exam-submit-btn");

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Exam...";

    try {
      await db.collection("examinations").add({
        title,
        subject,
        classLevel,
        examDate,
        maxMarks,
        school: currentTeacherData.school,
        teacherId: currentTeacherData.uid,
        teacherName: currentTeacherData.name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      alert("Examination scheduled successfully!");
      examForm.reset();
      loadTeacherExaminations(currentTeacherData.school);
    } catch (err) {
      console.error("Error creating exam:", err);
      alert("Failed to schedule exam: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Exam";
    }
  });
}

// 3. Load Scheduled Exams
async function loadTeacherExaminations(schoolName) {
  const container = document.getElementById("teacher-exam-list");
  if (!container) return;

  try {
    const snapshot = await db.collection("examinations")
      .where("school", "==", schoolName)
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No examinations scheduled yet.</p>`;
      return;
    }

    let html = "";
    snapshot.forEach(docSnap => {
      const exam = docSnap.data();
      const examId = docSnap.id;
      const safeTitle = exam.title.replace(/'/g, "\\'");

      html += `
        <div class="item-card">
          <h5>${exam.title} - ${exam.subject}</h5>
          <div class="item-meta">Class: ${exam.classLevel} | Date: ${exam.examDate} | Max Marks: ${exam.maxMarks}</div>
          <div style="margin-top: 10px;">
            <button type="button" class="btn" style="width: auto; padding: 6px 14px; font-size: 0.85rem; background: #166534; color: #fff;" onclick="openExamMarksPanel('${examId}', '${safeTitle}', '${exam.classLevel}', ${exam.maxMarks})">
              📝 Enter / View Marks
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading exams:", err);
    container.innerHTML = `<p class="placeholder-text">Error loading exams.</p>`;
  }
}
// Updated: Open Marks Entry Panel with Performance Analytics
async function openExamMarksPanel(examId, examTitle, classLevel, maxMarks) {
  const marksContainer = document.getElementById("exam-marks-container");
  const marksTitle = document.getElementById("exam-marks-title");
  const marksContent = document.getElementById("exam-marks-content");

  marksContainer.style.display = "block";
  marksTitle.textContent = `${examTitle} (Class ${classLevel} - Max: ${maxMarks})`;
  marksContent.innerHTML = `<p class="placeholder-text">Loading student records and analytics...</p>`;
  marksContainer.scrollIntoView({ behavior: "smooth" });

  try {
    const classStudents = cachedSchoolStudents.filter(s => s.classLevel === classLevel);

    if (classStudents.length === 0) {
      marksContent.innerHTML = `<p class="placeholder-text">No students registered in Class ${classLevel}.</p>`;
      return;
    }

    const resultsSnapshot = await db.collection("examResults")
      .where("examId", "==", examId)
      .get();

    const existingResults = {};
    let totalMarksObtained = 0;
    let gradedCount = 0;
    let highestMark = -1;
    let lowestMark = 9999;
    let passCount = 0;
    let failCount = 0;

    resultsSnapshot.forEach(doc => {
      const data = doc.data();
      existingResults[data.studentUid] = data;

      const marks = parseFloat(data.marksObtained);
      if (!isNaN(marks)) {
        gradedCount++;
        totalMarksObtained += marks;
        if (marks > highestMark) highestMark = marks;
        if (marks < lowestMark) lowestMark = marks;

        // Passing condition: 35% or above
        const pct = (marks / maxMarks) * 100;
        if (pct >= 35) {
          passCount++;
        } else {
          failCount++;
        }
      }
    });

    // Compute summary stats
    const avgMarks = gradedCount > 0 ? (totalMarksObtained / gradedCount).toFixed(1) : "-";
    const avgPct = gradedCount > 0 ? Math.round((totalMarksObtained / (gradedCount * maxMarks)) * 100) : 0;
    const displayHighest = gradedCount > 0 ? `${highestMark} / ${maxMarks}` : "-";
    const displayLowest = gradedCount > 0 ? `${lowestMark} / ${maxMarks}` : "-";
    const passPercentage = gradedCount > 0 ? Math.round((passCount / gradedCount) * 100) : 0;

    // Analytics Header Block
    let html = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 20px;">
        <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">CLASS AVERAGE</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #1a237e; margin-top: 4px;">${avgMarks} <span style="font-size: 0.85rem;">(${avgPct}%)</span></div>
        </div>
        <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">HIGHEST SCORE</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #166534; margin-top: 4px;">${displayHighest}</div>
        </div>
        <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">LOWEST SCORE</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #dc2626; margin-top: 4px;">${displayLowest}</div>
        </div>
        <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
          <div style="font-size: 0.75rem; color: #64748b; font-weight: 600;">PASS RATE</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #0284c7; margin-top: 4px;">${passPercentage}% <span style="font-size: 0.75rem; color: #64748b;">(${passCount}P / ${failCount}F)</span></div>
        </div>
      </div>

      <div class="table-container">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Roll</th>
              <th>Student Name</th>
              <th>Marks (/${maxMarks})</th>
              <th>%</th>
              <th>Grade</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    classStudents.forEach(stu => {
      const res = existingResults[stu.uid] || null;
      const marksVal = res ? res.marksObtained : "";
      const pctVal = res ? `${res.percentage}%` : "-";
      const gradeVal = res ? res.grade : "-";
      const safeName = (stu.name || "").replace(/'/g, "\\'");

      html += `
        <tr>
          <td><strong>${stu.rollNumber || "-"}</strong></td>
          <td>${stu.name || "-"}</td>
          <td>
            <input type="number" id="mark-input-${stu.uid}" value="${marksVal}" min="0" max="${maxMarks}" placeholder="Marks" style="width: 80px; padding: 5px; font-size: 0.85rem;">
          </td>
          <td id="pct-${stu.uid}">${pctVal}</td>
          <td id="grade-${stu.uid}"><strong>${gradeVal}</strong></td>
          <td>
            <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.8rem; background: #1a237e; color: #fff; width: auto;" onclick="saveStudentExamMark('${examId}', '${stu.uid}', '${stu.rollNumber}', '${safeName}', ${maxMarks}, '${classLevel}')">
              Save
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table></div>`;
    marksContent.innerHTML = html;
  } catch (err) {
    console.error("Error loading marks panel:", err);
    marksContent.innerHTML = `<p class="placeholder-text" style="color:red;">Error loading students: ${err.message}</p>`;
  }
}
// 5. Calculate Percentage, Grade & Save Result
async function saveStudentExamMark(examId, studentUid, rollNumber, studentName, maxMarks, classLevel) {
  const markInput = document.getElementById(`mark-input-${studentUid}`);
  const markVal = parseFloat(markInput.value);

  if (isNaN(markVal) || markVal < 0 || markVal > maxMarks) {
    alert(`Please enter a valid mark between 0 and ${maxMarks}.`);
    return;
  }

  const percentage = Math.round((markVal / maxMarks) * 100);

  let grade = "F";
  if (percentage >= 90) grade = "A+";
  else if (percentage >= 80) grade = "A";
  else if (percentage >= 70) grade = "B";
  else if (percentage >= 60) grade = "C";
  else if (percentage >= 50) grade = "D";

  const resultDocId = `${examId}_${studentUid}`;

  try {
    await db.collection("examResults").doc(resultDocId).set({
      examId,
      studentUid,
      studentRoll: rollNumber,
      studentName,
      classLevel,
      school: currentTeacherData.school,
      marksObtained: markVal,
      maxMarks,
      percentage,
      grade,
      savedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    document.getElementById(`pct-${studentUid}`).textContent = `${percentage}%`;
    document.getElementById(`grade-${studentUid}`).innerHTML = `<strong>${grade}</strong>`;

    alert(`Marks recorded for ${studentName}: ${markVal}/${maxMarks} (${grade})`);
 openExamMarksPanel(examId, document.getElementById("exam-marks-title").textContent.split(" (")[0], classLevel, maxMarks);
      }  catch (err) {
    console.error("Error saving mark:", err);
    alert("Failed to save mark: " + err.message);
  }
}

function closeMarksPanel() {
  const container = document.getElementById("exam-marks-container");
  if (container) container.style.display = "none";
}

// 6. Student Report Card Loader
const originalSwitchStudentPanel = window.switchStudentPanel;
window.switchStudentPanel = function(panel) {
  ["hw", "mat", "notices", "exams"].forEach(p => {
    const el = document.getElementById(`spanel-${p}`);
    if (el) el.style.display = (p === panel) ? "block" : "none";
  });

  const btns = document.querySelectorAll(".s-nav-btn");
  btns.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(panel));
  });

  if (panel === "exams" && currentStudentData) {
    loadStudentReportCard(currentStudentData.uid);
  }
};

async function loadStudentReportCard(studentUid) {
  const container = document.getElementById("student-exam-list");
  if (!container) return;

  try {
    const snapshot = await db.collection("examResults")
      .where("studentUid", "==", studentUid)
      .get();

    if (snapshot.empty) {
      container.innerHTML = `<p class="placeholder-text">No published exam results found yet.</p>`;
      return;
    }

    let html = `
      <div class="table-container">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Exam Name</th>
              <th>Marks Scored</th>
              <th>Max Marks</th>
              <th>Percentage</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const docSnap of snapshot.docs) {
      const res = docSnap.data();
      const examDoc = await db.collection("examinations").doc(res.examId).get();
      const examTitle = examDoc.exists ? `${examDoc.data().title} (${examDoc.data().subject})` : "Examination";

      html += `
        <tr>
          <td><strong>${examTitle}</strong></td>
          <td>${res.marksObtained}</td>
          <td>${res.maxMarks}</td>
          <td>${res.percentage}%</td>
          <td><span style="font-weight:700; color: #166534;">${res.grade}</span></td>
        </tr>
      `;
    }

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading student report card:", err);
    container.innerHTML = `<p class="placeholder-text">Unable to load report card.</p>`;
  }
    }
// ==========================================
// STUDENT ATTENDANCE SUMMARY MODULE
// ==========================================

// Extend student panel switcher to handle 'attendance'
const priorSwitchStudentPanel = window.switchStudentPanel;
window.switchStudentPanel = function(panel) {
  const panels = ["hw", "mat", "notices", "exams", "attendance"];
  panels.forEach(p => {
    const el = document.getElementById(`spanel-${p}`);
    if (el) el.style.display = (p === panel) ? "block" : "none";
  });

  const btns = document.querySelectorAll(".s-nav-btn");
  btns.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick").includes(panel));
  });

  if (panel === "attendance" && currentStudentData) {
    loadStudentAttendanceSummary(currentStudentData);
  } else if (panel === "exams" && currentStudentData) {
    loadStudentReportCard(currentStudentData.uid);
  }
};

async function loadStudentAttendanceSummary(student) {
  const summaryBox = document.getElementById("student-att-summary");
  const historyBox = document.getElementById("student-att-history");
  if (!summaryBox || !historyBox) return;

  try {
    const snapshot = await db.collection("attendance")
      .where("school", "==", student.school)
      .where("classLevel", "==", student.classLevel)
      .get();

    if (snapshot.empty) {
      summaryBox.innerHTML = `<p class="placeholder-text">No attendance sessions recorded yet for Class ${student.classLevel}.</p>`;
      historyBox.innerHTML = "";
      return;
    }

    let totalSessions = 0;
    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    const historyRows = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const studentRecord = (data.records || []).find(r => r.uid === student.uid || r.roll === student.rollNumber);

      if (studentRecord) {
        totalSessions++;
        const status = studentRecord.status;
        if (status === "Present") presentCount++;
        else if (status === "Absent") absentCount++;
        else if (status === "Leave") leaveCount++;

        historyRows.push({
          date: data.date,
          status: status
        });
      }
    });

    if (totalSessions === 0) {
      summaryBox.innerHTML = `<p class="placeholder-text">No personal attendance records found for your roll number.</p>`;
      historyBox.innerHTML = "";
      return;
    }

    // Sort by date descending
    historyRows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const percentage = Math.round((presentCount / totalSessions) * 100);
    const color = percentage >= 75 ? "#166534" : (percentage >= 60 ? "#d97706" : "#dc2626");

    summaryBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <h4 style="margin:0; font-size: 1.1rem; color: #1a237e;">Overall Attendance</h4>
          <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #64748b;">
            Present: <strong>${presentCount}</strong> / ${totalSessions} Days | Absent: ${absentCount} | Leave: ${leaveCount}
          </p>
        </div>
        <div style="font-size: 1.6rem; font-weight: 800; color: ${color};">
          ${percentage}%
        </div>
      </div>
      <div style="margin-top: 12px; background: #e2e8f0; border-radius: 8px; height: 10px; overflow: hidden;">
        <div style="background: ${color}; width: ${percentage}%; height: 100%;"></div>
      </div>
    `;

    let tableHtml = `
      <div class="table-container">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    historyRows.forEach(item => {
      const badgeColor = item.status === "Present" ? "#166534" : (item.status === "Absent" ? "#dc2626" : "#d97706");
      tableHtml += `
        <tr>
          <td>${item.date}</td>
          <td><strong style="color: ${badgeColor};">${item.status}</strong></td>
        </tr>
      `;
    });

    tableHtml += `</tbody></table></div>`;
    historyBox.innerHTML = tableHtml;

  } catch (err) {
    console.error("Error loading attendance:", err);
    summaryBox.innerHTML = `<p class="placeholder-text" style="color:red;">Error loading attendance: ${err.message}</p>`;
  }
}
// ==========================================
// STUDENT REPORT CARD PRINT / PDF GENERATOR
// ==========================================

function printStudentReportCard() {
  if (!currentStudentData) {
    alert("Student session not found. Please log in again.");
    return;
  }

  const tableContainer = document.querySelector("#student-exam-list .styled-table");
  if (!tableContainer) {
    alert("No examination results available to print.");
    return;
  }

  const printWindow = window.open("", "_blank");
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Report Card - ${currentStudentData.name || "Student"}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 20mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 20px;
        }
        .report-header {
          text-align: center;
          border-bottom: 2px solid #1a237e;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .report-header h1 {
          margin: 0;
          font-size: 24px;
          color: #1a237e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .report-header h3 {
          margin: 6px 0 0;
          font-size: 16px;
          color: #475569;
          font-weight: 500;
        }
        .student-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 25px;
          background: #f8fafc;
          padding: 14px 18px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
          font-size: 14px;
        }
        .student-details div {
          line-height: 1.6;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
          font-size: 14px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 10px 12px;
          text-align: center;
        }
        th {
          background-color: #f1f5f9;
          color: #0f172a;
          font-weight: 600;
        }
        td:first-child {
          text-align: left;
        }
        .signature-section {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          padding: 0 20px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
        }
        .signature-box {
          border-top: 1px solid #64748b;
          width: 180px;
          text-align: center;
          padding-top: 6px;
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <h1>${currentStudentData.school || "School Educational Portal"}</h1>
        <h3>Official Student Progress Report Card</h3>
      </div>

      <div class="student-details">
        <div>
          <strong>Student Name:</strong> ${currentStudentData.name || "-"}<br>
          <strong>Roll Number:</strong> ${currentStudentData.rollNumber || "-"}
        </div>
        <div>
          <strong>Class:</strong> ${currentStudentData.classLevel || "-"} (${currentStudentData.curriculumBoard || "State Board"})<br>
          <strong>Issue Date:</strong> ${currentDate}
        </div>
      </div>

      ${tableContainer.outerHTML}

      <div class="signature-section">
        <div class="signature-box">Class Teacher</div>
        <div class="signature-box">Principal</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}
// ==========================================
// PUSH NOTIFICATION HELPERS
// ==========================================

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notifications.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

// Function to trigger a local alert notification
function sendLocalNotification(title, body) {
  if (Notification.permission === "granted" && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body: body,
        icon: "https://cdn-icons-png.flaticon.com/512/2997/2997295.png",
        badge: "https://cdn-icons-png.flaticon.com/512/2997/2997295.png",
        vibrate: [100, 50, 100]
      });
    });
  }
}


