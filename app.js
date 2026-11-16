(() => {
  const $ = id => document.getElementById(id);
  const state = { role: "student", mode: "login", lang: "en" };
  const translations = {
    en:{eyebrow:"LEARN • PRACTISE • GROW",welcome:"Your learning space starts here.",intro:"A shared learning portal for students and teachers.",student:"Student",teacher:"Teacher",portal:"PORTAL ACCESS",login:"Login",signup:"Create account",fullName:"Full name",school:"School name",roll:"Student roll number",class:"Class",board:"Curriculum",password:"Password",continue:"Continue",forEveryone:"One portal. Two roles.",studentInfo:"Students can access learning resources and practice activities.",teacherInfo:"Teachers can organise learning materials and prepare practice activities."},
    ta:{eyebrow:"கற்க • பயிற்சி செய்ய • வளர",welcome:"உங்கள் கற்றல் பயணம் இங்கே தொடங்குகிறது.",intro:"மாணவர்கள் மற்றும் ஆசிரியர்களுக்கான கற்றல் தளம்.",student:"மாணவர்",teacher:"ஆசிரியர்",portal:"உள்நுழைவு",login:"உள்நுழைவு",signup:"கணக்கு உருவாக்கு",fullName:"முழுப் பெயர்",school:"பள்ளியின் பெயர்",roll:"மாணவர் வரிசை எண்",class:"வகுப்பு",board:"பாடத்திட்டம்",password:"கடவுச்சொல்",continue:"தொடரவும்",forEveryone:"ஒரே தளம். இரண்டு வகை பயனர்கள்.",studentInfo:"மாணவர்கள் கற்றல் வளங்களையும் பயிற்சிகளையும் அணுகலாம்.",teacherInfo:"ஆசிரியர்கள் கற்றல் பொருட்களை ஒழுங்குபடுத்தலாம்."}
  };
  const supabaseReady = () => window.APP_CONFIG &&
    /^https:\/\//.test(window.APP_CONFIG.SUPABASE_URL) &&
    !window.APP_CONFIG.SUPABASE_URL.includes("PASTE_") &&
    window.APP_CONFIG.SUPABASE_ANON_KEY &&
    !window.APP_CONFIG.SUPABASE_ANON_KEY.includes("PASTE_") &&
    window.supabase;
  let client = null;
  if (supabaseReady()) client = window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY);

  function message(text, error=false) { $("formMessage").textContent=text; $("formMessage").style.color=error?"#b42318":"#24536c"; }
  function render() {
    document.querySelectorAll(".role-tab").forEach(b=>b.classList.toggle("active",b.dataset.role===state.role));
    document.querySelectorAll(".mode-tab").forEach(b=>b.classList.toggle("active",b.dataset.mode===state.mode));
    const student=state.role==="student", signup=state.mode==="signup";
    $("formTitle").textContent=(student?"Student":"Teacher")+" "+(signup?"signup":"login");
    $("nameWrap").classList.toggle("hidden",!signup);
    $("emailWrap").classList.toggle("hidden",student);
    $("rollWrap").classList.toggle("hidden",!student);
    $("classWrap").classList.toggle("hidden",!student||!signup);
    $("boardWrap").classList.toggle("hidden",!signup);
    $("guardianWrap").classList.toggle("hidden",!student||!signup);
    $("forgotStudent").classList.toggle("hidden",!student||signup);
    $("forgotTeacher").classList.toggle("hidden",student||signup);
    $("studentRecovery").classList.add("hidden"); $("teacherRecovery").classList.add("hidden");
    $("submitBtn").textContent=signup?"Create account":"Login";
    $("password").autocomplete=signup?"new-password":"current-password";
    message("");
  }
  document.querySelectorAll(".role-tab").forEach(b=>b.addEventListener("click",()=>{state.role=b.dataset.role;render();}));
  document.querySelectorAll(".mode-tab").forEach(b=>b.addEventListener("click",()=>{state.mode=b.dataset.mode;render();}));
  $("languageSelect").addEventListener("change",e=>{state.lang=e.target.value;document.querySelectorAll("[data-i18n]").forEach(el=>{const k=el.dataset.i18n;if(translations[state.lang][k])el.textContent=translations[state.lang][k];});render();});
  $("forgotStudent").addEventListener("click",()=>{$("studentRecovery").classList.toggle("hidden");});
  $("forgotTeacher").addEventListener("click",()=>{$("teacherRecovery").classList.toggle("hidden");});
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!client){message("Supabase is not configured yet. Add your V2.2 project URL and public key in config.js first.",true);return;}
    const school=$("school").value.trim(), password=$("password").value;
    if(password.length<8){message("Use a password with at least 8 characters.",true);return;}
    $("submitBtn").disabled=true;
    try{
      if(state.role==="teacher"){
        const email=$("email").value.trim();
        if(state.mode==="signup"){
          const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin, data:{role:"teacher",full_name:$("fullName").value.trim(),school_name:school,curriculum:$("board").value}}});
          if(error)throw error; message("Account request submitted. Check your email for verification before logging in.");
        }else{
          const {data,error}=await client.auth.signInWithPassword({email,password}); if(error)throw error;
          const profile=data.user.user_metadata||{};
          if(profile.role!=="teacher"||String(profile.school_name||"").trim().toLowerCase()!==school.toLowerCase()){await client.auth.signOut();throw new Error("The account role or school name does not match.");}
          message("Signed in. Dashboard features will be enabled after the V2.2 database setup is completed.");
        }
      }else{
        const fn=state.mode==="signup"?"student-signup":"student-login";
        const body=state.mode==="signup"?{full_name:$("fullName").value.trim(),school_name:school,roll_number:$("roll").value.trim(),class_name:$("className").value,curriculum:$("board").value,password,guardian_email:$("guardianEmail").value.trim()||null}:{school_name:school,roll_number:$("roll").value.trim(),password};
        const {data,error}=await client.functions.invoke(fn,{body}); if(error)throw error;
        if(data?.error)throw new Error(data.error);
        if(data?.access_token&&data?.refresh_token){await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});}
        message(state.mode==="signup"?"Student account created. You can now log in.":"Student login successful.");
      }
    }catch(err){message(err.message||"Something went wrong. Please try again.",true);}
    finally{$("submitBtn").disabled=false;}
  });
  $("teacherRecovery").addEventListener("submit",async e=>{
    e.preventDefault(); if(!client){$("recoveryMessage").textContent="Configure Supabase first.";return;}
    const email=$("recoveryEmail").value.trim();
    const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+"/reset-password.html"});
    $("recoveryMessage").textContent=error?error.message:"If this email belongs to a teacher account, a recovery link will be sent.";
  });
  render();
})();