// ==========================================
// MY WEBSITE V2.2 - CORE APPLICATION SCRIPT
// Firebase Authentication & Firestore Logic
// ==========================================

// --- Helper Functions ---
function showMessage(text, isError = false) {
  const box = document.getElementById("alert-box");
  box.textContent = text;
  box.style.display = "block";
  box.style.backgroundColor = isError ? "#ffebee" : "#e8f5e9";
  box.style.color = isError ? "#c62828" : "#2e7d32";
  box.style.borderColor = isError ? "#ef9a9a" : "#a5d6a7";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearMessage() {
  const box = document.getElementById("alert-box");
  box.textContent = "";
  box.style.display = "none";
}

// Convert school name and roll number into a deterministic internal Firebase ID
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
// FORM SUBMISSIONS & FIREBASE INTEGRATION
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
      // Create user in Firebase Authentication
      const userCredential = await auth.createUserWithEmailAndPassword(syntheticEmail, password);
      const user = userCredential.user;

      // Save Student Profile in Firestore
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
      const userCredential = await auth.signInWithEmailAndPassword(syntheticEmail, password);
      showMessage("Welcome " + school + " student! Login successful.");
      // Redirect or load dashboard here
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

      // Save Teacher Profile in Firestore
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
      showMessage("Welcome Teacher! Login successful.");
      // Redirect or load dashboard here
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
  
