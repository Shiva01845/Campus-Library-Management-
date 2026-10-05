import { KgrLogo } from './components/KgrLogo';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient, Session } from '@supabase/supabase-js';
import {
  Search, Bell, BookOpen, Users, LayoutDashboard, ArrowLeftRight,
  Bookmark, BarChart3, Tags, Settings, LogOut, Plus, ChevronRight,
  Menu, UserRound, CreditCard, AlertCircle, Library, Download, RefreshCw,
  Mail, ShieldCheck, CheckCircle2, XCircle
} from 'lucide-react';
import './styles.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

type Role = 'student' | 'faculty' | 'librarian' | 'admin';
type Profile = { id:string; email:string; full_name:string|null; college_id:string|null; role:Role; department_id:string|null; phone:string|null; year_of_study:number|null; is_active:boolean; };
type Department = { id:string; name:string|null; code:string|null };
type Category = { id:string; name:string; description:string|null };
type LibraryResource = { id:string; title:string; description:string|null; resource_type:string; url:string; created_at:string; created_by:string|null; is_active:boolean };
type Book = { id:string; accession_code:string; title:string; subtitle:string|null; isbn:string|null; description:string|null; publisher:string|null; publication_year:number|null; edition:string|null; language:string|null; category_id:string|null; cover_url:string|null; ebook_url:string|null; total_copies:number; available_copies:number; is_active:boolean };
type Loan = { id:string; copy_id:string; user_id:string; issued_by:string|null; issue_date:string; due_date:string; returned_date:string|null; returned_to:string|null; status:'active'|'returned'|'overdue'; renewal_count:number; notes:string|null; };
type Reservation = { id:string; book_id:string; user_id:string; reserved_at:string; ready_at:string|null; expires_at:string|null; fulfilled_at:string|null; status:'pending'|'ready'|'fulfilled'|'cancelled'|'expired'; queue_position:number|null };
type Fine = { id:string; loan_id:string | null; user_id:string; amount:number; reason:string; status:'pending'|'paid'|'waived'; issued_at:string; paid_at:string|null; waived_at:string|null; waived_by:string|null; notes?:string|null; accrual_date?:string|null; };
type Notification = { id:string; user_id:string; title:string; message:string; type:string|null; is_read:boolean; created_at:string };
type BookCopy = { id:string; book_id:string; accession_code?:string|null; copy_number:string; shelf_number:string|null; rack_number:string|null; status:string; condition:string|null; price?:number|string|null; acquired_date?:string|null; notes?:string|null; };

const domain = '@kgr.ac.in';
const DEFAULT_FINE_RATE = 5;
const DEPARTMENT_OPTIONS = ['CSE', 'CSD', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT'] as const;
const YEAR_OPTIONS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
  { value: 5, label: '5th Year' },
  { value: 6, label: '6th Year' },
] as const;

function getYearLabel(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '—';
  const year = Number(value);
  const map: Record<number, string> = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year', 6: '6th Year' };
  return map[year] || `${year}th Year`;
}

function getDepartmentName(value: string | null | undefined, departments: Department[] = []) {
  if (!value) return '—';
  const normalized = String(value).trim();
  const match = departments.find((department) => {
    const name = department.name || '';
    const code = department.code || '';
    return department.id === normalized || name === normalized || code === normalized || name.toLowerCase() === normalized.toLowerCase() || code.toLowerCase() === normalized.toLowerCase();
  });
  return match?.name || match?.code || normalized;
}

function App(){
  const [session,setSession] = useState<Session|null>(null);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [loading,setLoading] = useState(true);
  const [page,setPage] = useState('dashboard');
  const [mobileOpen,setMobileOpen] = useState(false);
  const [globalSearch,setGlobalSearch] = useState('');

  useEffect(()=>{
    if(!supabase){ setLoading(false); return; }
    supabase.auth.getSession().then(({data})=>setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,newSession)=>setSession(newSession));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      if(!supabase || !session?.user){ setProfile(null); setLoading(false); return; }
      setLoading(true);
      const {data,error} = await supabase.from('profiles').select('*').eq('id',session.user.id).single();
      if(!cancelled){
        if(error){ setProfile(null); }
        else setProfile(data as Profile);
        setLoading(false);
      }
    }
    load();
    return ()=>{cancelled=true};
  },[session]);

  const isPasswordResetRoute = window.location.pathname === '/reset-password';
  if(!supabase) return <ConfigMissing/>;
  if(loading) return <Splash/>;
  // A recovery session is intentionally kept outside the normal profile/role flow.
  if(isPasswordResetRoute) return <ResetPassword session={session}/>;
  if(!session) return <Login/>;
  if(!profile) return <ProfilePending email={session.user.email || ''} onLogout={()=>supabase.auth.signOut()}/>;
  if(!profile.is_active) return <ProfilePending email={profile.email} inactive onLogout={()=>supabase.auth.signOut()}/>;

  const isAdmin = profile.role==='librarian' || profile.role==='admin';
  const nav = isAdmin ? [
    ['dashboard','Dashboard',LayoutDashboard],['books','Books',BookOpen],['members','Members',Users],['circulation','Issue / Return',ArrowLeftRight],['reservations','Reservations',Bookmark],['fineledger','Fine Ledger',CreditCard],['resources','Library Resources',Library],['analytics','Reports & Analytics',BarChart3],['categories','Categories',Tags],['notifications','Notifications',Bell],['settings','Settings',Settings],['profile','Profile',UserRound]
  ] : [
    ['dashboard','Home',LayoutDashboard],['search','Search Books',Search],['mybooks','My Books',BookOpen],['reservations','Reservations',Bookmark],['fines','Fines & Payments',CreditCard],['notifications','Notifications',Bell],['resources','Library Resources',Library],['profile','Profile',UserRound]
  ];

  return <div className="app">
    {mobileOpen&&<button className="mobileBackdrop" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
    <aside className={'sidebar '+(mobileOpen?'open':'')}>
      <div className="brand" style={{padding: "16px 20px"}}><KgrLogo variant="full" light={true} /></div>
      <div className="rolePill">{isAdmin?'LIBRARIAN / ADMIN':profile.role.toUpperCase()}</div>
      <nav aria-label="Library navigation">{nav.map(([id,label,Icon]:any)=><button key={id} aria-current={page===id?'page':undefined} className={page===id?'active':''} onClick={()=>{setPage(id);setMobileOpen(false)}}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <div className="sidebarBottom"><button onClick={()=>supabase!.auth.signOut()}><LogOut size={18}/>Logout</button></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button className="mobileMenu" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(v=>!v)}><Menu/></button>
        <div className="searchTop"><Search size={17}/><input value={globalSearch} onChange={event=>setGlobalSearch(event.target.value)} placeholder="Search books, authors, ISBN..." onKeyDown={e=>{if(e.key==='Enter'){setPage('search')}}}/></div>
        <div className="topRight"><button className="iconBtn" aria-label="Open notifications" onClick={()=>setPage('notifications')}><Bell size={19}/></button><button className="avatar profileLink" aria-label="Open profile" onClick={()=>setPage('profile')}>{initials(profile.full_name || profile.email)}</button><div className="userText"><b>{profile.full_name || profile.email.split('@')[0]}</b><small>{profile.role}{profile.department_id?' · Department':''}</small></div></div>
      </header>
      <div className="content" key={page}><Page page={page} profile={profile} setPage={setPage} globalSearch={globalSearch}/></div>
    </main>
  </div>;
}

function initials(name:string){return name.split(/[ ._-]+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();}

function ConfigMissing(){return <div className="loginPage"><div className="loginPanel"><div className="loginCard"><div style={{marginBottom: "20px"}}><KgrLogo variant="compact" /></div><h2>Supabase configuration missing</h2><p>Create <b>.env.local</b> in the project root with:</p><pre>VITE_SUPABASE_URL=...{`\n`}VITE_SUPABASE_PUBLISHABLE_KEY=...</pre><p>Then restart <b>npm run dev</b>.</p></div></div></div>}
function Splash(){return <div className="loginPage"><div className="loginPanel"><div className="loginCard"><div style={{marginBottom: "20px"}}><KgrLogo variant="compact" /></div><h2>Connecting to library...</h2><p>Checking your secure session.</p></div></div></div>}
function ProfilePending({email,onLogout,inactive=false}:{email:string;onLogout:()=>void;inactive?:boolean}){return <div className="loginPage"><div className="loginPanel"><div className="loginCard"><div style={{marginBottom: "20px"}}><KgrLogo variant="compact" /></div><h2>{inactive?'Account inactive':'Profile not ready'}</h2><p>{inactive?'Your library account has been deactivated. Contact the librarian.':`Authentication succeeded for ${email}, but the profile could not be loaded.`}</p><button className="outline wide" onClick={onLogout}>Sign out</button></div></div></div>}

function ResetPassword({session}:{session:Session|null}){
  const [newPassword,setNewPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [complete,setComplete]=useState(false);

  const backToLogin=async()=>{
    await supabase!.auth.signOut();
    window.location.assign('/');
  };
  const updatePassword=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');
    if(!session){setError('This password recovery link is invalid or has expired. Request a new link from the login page.');return;}
    if(!newPassword){setError('Please enter a new password.');return;}
    if(newPassword.length<6){setError('Password must contain at least 6 characters.');return;}
    if(newPassword!==confirmPassword){setError('Passwords do not match.');return;}
    setBusy(true);
    const {error:updateError}=await supabase!.auth.updateUser({password:newPassword});
    if(updateError)setError(updateError.message||'We could not update your password.');
    else{setNewPassword('');setConfirmPassword('');setComplete(true);}
    setBusy(false);
  };
  return <div className="loginPage campusLogin"><section className="loginVisual" aria-label="Campus Library"><div className="loginBrand"><KgrLogo light/><p>KG Reddy College of Engineering &amp; Technology</p></div><div className="visualOverlay"><span className="eyebrow">THE CAMPUS LIBRARY</span><h1>A world of knowledge.<br/><em>Closer than ever.</em></h1><p>Your digital gateway to knowledge, resources and campus learning.</p></div><small className="loginVisualFooter">Campus Library | KG Reddy College</small></section><div className="loginPanel"><div className="loginFormWrap"><form className="loginCard" onSubmit={updatePassword} aria-busy={busy}><span className="formEyebrow">PASSWORD RECOVERY</span>{complete?<><h2>Password updated successfully.</h2><p>You can now sign in with your college email and new password.</p><button type="button" className="primary wide" onClick={()=>void backToLogin()}>Back to Login</button></>:<><h2>Set New Password</h2><p>Create a new password for your college library account.</p><label>New Password<input value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Enter a new password" autoComplete="new-password" type="password" required disabled={!session}/></label><label>Confirm New Password<input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm your new password" autoComplete="new-password" type="password" required disabled={!session}/></label>{!session&&<div className="authError" role="alert"><XCircle size={17}/>This password recovery link is invalid or has expired. Request a new link from the login page.</div>}{error&&<div className="authError" role="alert"><XCircle size={17}/>{error}</div>}<button className="primary wide" disabled={busy||!session}>{busy?<><span className="buttonSpinner" aria-hidden="true"/> Updating...</>:'Update Password'}</button>{!session&&<button type="button" className="linkBtn" onClick={()=>void backToLogin()}>Back to Login</button>}</>}<small className="securityNote"><ShieldCheck size={14}/> Your password is updated securely by Supabase.</small></form></div></div></div>;
}

function Login(){
  const [mode,setMode]=useState<'login'|'signup'|'recovery'>('login');
  const [step,setStep]=useState<'email'|'otp'>('email');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [name,setName]=useState('');
  const [collegeId,setCollegeId]=useState('');
  const [department,setDepartment]=useState('');
  const [year,setYear]=useState('');
  const [departments,setDepartments]=useState<Department[]>([]);
  const [otp,setOtp]=useState<string[]>(Array(8).fill(''));
  const otpInputs=useRef<Array<HTMLInputElement|null>>([]);
  const [resendSeconds,setResendSeconds]=useState(0);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [unverifiedEmail,setUnverifiedEmail]=useState(false);

  useEffect(() => {
    if (mode !== 'signup' || !supabase) return;
    const loadDepartments = async () => {
      try {
        const { data } = await supabase.from('departments').select('*').order('name');
        setDepartments((data || []) as Department[]);
      } catch {
        setDepartments([]);
      }
    };
    void loadDepartments();
  }, [mode]);

  useEffect(()=>{
    if(step!=='otp'||resendSeconds<=0)return;
    const timer=window.setInterval(()=>setResendSeconds(seconds=>Math.max(0,seconds-1)),1000);
    return ()=>window.clearInterval(timer);
  },[step,resendSeconds]);

  const friendlyOtpError=(raw:string,action:'send'|'verify')=>{
    const text=raw.toLowerCase();
    if(text.includes('rate limit')||text.includes('too many requests'))return 'Too many code requests. Please wait a moment before trying again.';
    if(text.includes('network')||text.includes('fetch')||text.includes('failed to fetch'))return 'We could not reach the sign-in service. Check your connection and try again.';
    if(action==='verify'&&(text.includes('expired')||text.includes('has expired')))return 'This verification code has expired. Request a new code and try again.';
    if(action==='verify')return 'That verification code is invalid. Please check the eight digits and try again.';
    if(text.includes('smtp')||text.includes('sender')||text.includes('email')||text.includes('mail'))return 'We could not send the verification email. Please try again shortly.';
    return 'We could not send a verification code. Please try again.';
  };

  const createAccount=async(e:React.FormEvent)=>{
    e?.preventDefault(); setError(''); setMessage('');
    const clean=email.trim().toLowerCase();
    const normalizedCollegeId = collegeId.trim().toUpperCase();
    if(!clean){setError('Please enter your college email address.');return;}
    if(!/^\S+@\S+\.\S+$/.test(clean)){setError('Please enter a valid email address.');return;}
    if(!clean.endsWith(domain)){setError(`Please use your official college email ending with ${domain}.`);return;}
    if(!name.trim()){setError('Please enter your full name.'); return;}
    if(!normalizedCollegeId){setError('Please enter your college ID.'); return;}
    if(!department.trim()){setError('Please select a department.'); return;}
    if(!year){setError('Please select a year of study.'); return;}
    if(password.length<6){setError('Password must contain at least 6 characters.');return;}
    if(password!==confirmPassword){setError('Passwords do not match.');return;}

    try {
      const { data: existingCollegeId } = await supabase!.from('profiles').select('id').eq('college_id', normalizedCollegeId).maybeSingle();
      if (existingCollegeId) {
        setError('This College ID is already registered.');
        return;
      }
    } catch {
      // Let the database enforce the unique constraint if the optional pre-check is unavailable.
    }
    setBusy(true);
    const {data:signupData,error:signupError}=await supabase!.auth.signUp({email:clean,password,options:{data:{full_name:name.trim()||clean.split('@')[0],college_id:normalizedCollegeId,role:'student',department_id:department,year_of_study:Number(year)}}});
    if(signupError){
      if(import.meta.env.DEV)console.error('Supabase signup failed.',{message:signupError.message,status:signupError.status,code:signupError.code});
      const details=(signupError.message||'').toLowerCase();
      if(details.includes('already registered')||details.includes('already exists')||details.includes('duplicate'))setError('An account with this email already exists. Please sign in instead.');
      else setError(friendlyOtpError(signupError.message||'', 'send'));
    }
    else{
      if(signupData.session)await supabase!.auth.signOut();
      setOtp(Array(8).fill(''));
      setStep('otp');
      setResendSeconds(60);
      setMessage('We sent a verification code to your email.');
      window.setTimeout(()=>otpInputs.current[0]?.focus(),0);
    }
    setBusy(false);
  };
  const login=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setMessage('');setUnverifiedEmail(false);
    const clean=email.trim().toLowerCase();
    if(!clean){setError('Please enter your college email address.');return;}
    if(!/^\S+@\S+\.\S+$/.test(clean)){setError('Please enter a valid email address.');return;}
    if(!clean.endsWith(domain)){setError(`Please use your official college email ending with ${domain}.`);return;}
    if(!password){setError('Please enter your password.');return;}
    setBusy(true);
    const {error:loginError}=await supabase!.auth.signInWithPassword({email:clean,password});
    if(loginError){
      const details=(loginError.message||'').toLowerCase();
      if(details.includes('not confirmed')||details.includes('not verified')){setError('Please verify your email before logging in.');setUnverifiedEmail(true);}
      else setError('Invalid email or password.');
    }
    setBusy(false);
  };
  const sendPasswordRecovery=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setMessage('');
    const clean=email.trim().toLowerCase();
    if(!clean){setError('Please enter your college email address.');return;}
    if(!/^\S+@\S+\.\S+$/.test(clean)){setError('Please enter a valid email address.');return;}
    if(!clean.endsWith(domain)){setError(`Please use your official college email ending with ${domain}.`);return;}
    setBusy(true);
    const {error:recoveryError}=await supabase!.auth.resetPasswordForEmail(clean,{redirectTo:`${window.location.origin}/reset-password`});
    if(recoveryError){
      const details=(recoveryError.message||'').toLowerCase();
      if(details.includes('network')||details.includes('fetch')||details.includes('failed to fetch'))setError('We could not reach the password recovery service. Check your connection and try again.');
      else setError(recoveryError.message||'We could not send the password recovery email.');
    }else setMessage('If this college email has an account, a password recovery link has been sent. Check your inbox and open the link to set a new password.');
    setBusy(false);
  };
  const resendVerification=async()=>{
    if(resendSeconds>0||busy)return;
    setBusy(true);setError('');setMessage('');
    const {error:resendError}=await supabase!.auth.resend({type:'signup',email:email.trim().toLowerCase()});
    if(resendError){
      if(import.meta.env.DEV)console.error('Supabase verification resend failed.',{message:resendError.message,status:resendError.status,code:resendError.code});
      setError(friendlyOtpError(resendError.message||'', 'send'));
    }else{setOtp(Array(8).fill(''));setResendSeconds(60);setMessage('A new verification code has been sent to your email.');window.setTimeout(()=>otpInputs.current[0]?.focus(),0);}
    setBusy(false);
  };
  const updateOtp=(index:number,value:string)=>{
    const digit=value.replace(/\D/g,'').slice(-1);
    const next=[...otp]; next[index]=digit; setOtp(next);
    if(digit&&index<7)otpInputs.current[index+1]?.focus();
  };
  const pasteOtp=(event:React.ClipboardEvent<HTMLInputElement>)=>{
    event.preventDefault();
    const digits=event.clipboardData.getData('text').replace(/\D/g,'').slice(0,8);
    if(!digits)return;
    const next=Array(8).fill(''); digits.split('').forEach((digit,index)=>next[index]=digit); setOtp(next);
    otpInputs.current[Math.min(digits.length,8)-1]?.focus();
  };
  const verifyOtp=async(e:React.FormEvent)=>{
    e.preventDefault(); setError(''); setMessage('');
    const token=otp.join('');
    if(token.length!==8){setError('Enter the complete eight-digit verification code.');return;}
    setBusy(true);
    const {data,error:verifyError}=await supabase!.auth.verifyOtp({email:email.trim().toLowerCase(),token,type:'email'});
    if(verifyError)setError(friendlyOtpError(verifyError.message||'', 'verify'));
    else if(!data.session)setError('We could not verify your email. Please request a new code and try again.');
    else{
      const {error:signOutError}=await supabase!.auth.signOut();
      if(signOutError){
        if(import.meta.env.DEV)console.error('Supabase sign-out after verification failed.',{message:signOutError.message,status:signOutError.status,code:signOutError.code});
        setError('Your email was verified, but we could not return to the login page. Please refresh and sign in.');
      }else{
        setMode('login');setStep('email');setPassword('');setConfirmPassword('');setOtp(Array(8).fill(''));setResendSeconds(0);setMessage('Email verified successfully. You can now log in with your email and password.');
      }
    }
    setBusy(false);
  };
  const changeEmail=()=>{setStep('email');setOtp(Array(8).fill(''));setResendSeconds(0);setError('');setMessage('');};
  const resetMode=()=>{setMode(mode==='login'?'signup':'login');setStep('email');setError('');setMessage('');setUnverifiedEmail(false);setPassword('');setConfirmPassword('');setName('');setCollegeId('');setDepartment('');setYear('');};
  const showRecovery=()=>{setMode('recovery');setStep('email');setError('');setMessage('');setUnverifiedEmail(false);setPassword('');setConfirmPassword('');};
  const returnToLogin=()=>{setMode('login');setStep('email');setError('');setMessage('');setPassword('');setConfirmPassword('');};
  const emailForm=<>
    <span className="formEyebrow">YOUR CAMPUS. YOUR LIBRARY.</span>
    <h2>{mode==='login'?'Welcome back':mode==='signup'?'Create your account':'Forgot Password?'}</h2>
    <p>{mode==='login'?'Sign in with your official college email.':mode==='signup'?'Create a library account using your official college email.':'Enter your college email and we will send you a password recovery link.'}</p>
    {mode==='signup'&&<><label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" required/></label><label>College ID<input value={collegeId} onChange={e=>setCollegeId(e.target.value)} placeholder="24QM1A6763" required/></label><label>Department<select value={department} onChange={e=>setDepartment(e.target.value)} required><option value="">Select department</option>{departments.length ? departments.map((dept) => <option key={dept.id} value={dept.id || dept.name || dept.code || ''}>{dept.name || dept.code || dept.id}</option>) : DEPARTMENT_OPTIONS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}</select></label><label>Year of study<select value={year} onChange={e=>setYear(e.target.value)} required><option value="">Select year</option>{YEAR_OPTIONS.map((item) => <option key={item.value} value={String(item.value)}>{item.label}</option>)}</select></label></>}
    <label>College email<div className="inputIcon"><Mail size={17}/><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@kgr.ac.in" autoComplete="email" type="email" required/></div></label>
    {mode!=='recovery'&&<label>Password<input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete={mode==='login'?'current-password':'new-password'} type="password" required/></label>}
    {mode==='signup'&&<label>Confirm Password<input value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Confirm your password" autoComplete="new-password" type="password" required/></label>}
    {error&&<div className="authError" role="alert"><XCircle size={17}/>{error}</div>}{message&&<div className="authSuccess" role="status"><CheckCircle2 size={17}/>{message}</div>}
    {unverifiedEmail&&<button type="button" className="linkBtn resendVerification" disabled={busy||resendSeconds>0} onClick={()=>void resendVerification()}>{resendSeconds>0?`Resend verification code in ${resendSeconds}s`:'Resend verification code'}</button>}
    {mode==='login'&&<button type="button" className="linkBtn forgotPassword" onClick={showRecovery}>Forgot Password?</button>}
    <button className="primary wide" disabled={busy}>{busy?<><span className="buttonSpinner" aria-hidden="true"/> Please wait...</>:<>{mode==='login'?'Sign in':mode==='signup'?'Create account & send code':'Send verification code'}<ChevronRight size={17}/></>}</button>
    {mode==='recovery'?<button type="button" className="linkBtn" onClick={returnToLogin}>Back to Sign in</button>:<button type="button" className="linkBtn" onClick={resetMode}>{mode==='login'?"Don't have an account? Create one":"Already have an account? Sign in"}</button>}
    <small className="securityNote"><ShieldCheck size={14}/> Only official <b>@kgr.ac.in</b> accounts are allowed.</small>
  </>;
  const otpForm=<>
    <span className="formEyebrow">YOUR CAMPUS. YOUR LIBRARY.</span>
    <h2>Check your email</h2>
    <p>Enter the eight-digit verification code sent to <b>{email.trim().toLowerCase()}</b>.</p>
    <div className="otpInputs" role="group" aria-label="Eight-digit verification code">{otp.map((digit,index)=><input key={index} ref={input=>{otpInputs.current[index]=input;}} value={digit} onChange={event=>updateOtp(index,event.target.value)} onPaste={pasteOtp} onKeyDown={event=>{if(event.key==='Backspace'&&!otp[index]&&index>0){event.preventDefault();const next=[...otp];next[index-1]='';setOtp(next);otpInputs.current[index-1]?.focus();}}} inputMode="numeric" autoComplete={index===0?'one-time-code':'off'} pattern="[0-9]*" maxLength={1} aria-label={`Digit ${index+1} of 8`} disabled={busy}/>)}</div>
    {error&&<div className="authError" role="alert"><XCircle size={17}/>{error}</div>}{message&&<div className="authSuccess" role="status"><CheckCircle2 size={17}/>{message}</div>}
    <button className="primary wide" disabled={busy||otp.join('').length!==8}>{busy?<><span className="buttonSpinner" aria-hidden="true"/> Verifying...</>:<>Verify code<ChevronRight size={17}/></>}</button>
    <div className="otpActions"><button type="button" className="linkBtn" onClick={changeEmail} disabled={busy}>Change email</button><button type="button" className="linkBtn" onClick={()=>void resendVerification()} disabled={busy||resendSeconds>0}>{resendSeconds>0?`Resend code in ${resendSeconds}s`:'Resend code'}</button></div>
    <small className="securityNote"><ShieldCheck size={14}/> Your verification code is handled securely by Supabase.</small>
  </>;
  return <div className="loginPage campusLogin"><section className="loginVisual" aria-label="Campus Library"><div className="loginBrand"><KgrLogo light/><p>KG Reddy College of Engineering &amp; Technology</p></div><div className="visualOverlay"><span className="eyebrow">THE CAMPUS LIBRARY</span><h1>A world of knowledge.<br/><em>Closer than ever.</em></h1><p>Your digital gateway to knowledge, resources and campus learning.</p><div className="academicVisual" aria-hidden="true"><div className="shelfBooks"><i/><i/><i/><i/><i/><i/></div><div className="shelfLine"/><span><BookOpen size={22}/> Learn. Explore. Discover.</span></div><div className="loginFeatures"><span><BookOpen size={17}/> Explore the collection</span><span><Bookmark size={17}/> Manage your borrowing</span><span><Library size={17}/> Access learning resources</span></div></div><small className="loginVisualFooter">Campus Library | KG Reddy College</small></section><div className="loginPanel"><div className="loginFormWrap"><form className="loginCard" onSubmit={step==='otp'?verifyOtp:(mode==='login'?login:mode==='signup'?createAccount:sendPasswordRecovery)} aria-busy={busy}>{step==='email'?emailForm:otpForm}</form><p className="loginSupport">Need help accessing your account? Contact the college library.</p></div></div></div>
}

function Page({page,profile,setPage,globalSearch}:{page:string;profile:Profile;setPage:(p:string)=>void;globalSearch:string}){
  const admin=profile.role==='librarian'||profile.role==='admin';
  if(page==='dashboard')return admin?<AdminDashboard profile={profile}/>:<UserDashboard profile={profile} setPage={setPage}/>;
  if(page==='search')return <SearchBooks profile={profile} initialQuery={globalSearch}/>;
  if(page==='books'&&admin)return <BooksAdmin/>;
  if(page==='members'&&admin)return <MembersAdmin/>;
  if(page==='circulation'&&admin)return <Circulation profile={profile}/>;
  if(page==='fineledger'&&admin)return <Circulation profile={profile} ledgerOnly/>;
  if(page==='reservations')return <Reservations profile={profile} admin={admin}/>;
  if(page==='mybooks'&&!admin)return <MyBooks profile={profile}/>;
  if(page==='fines'&&!admin)return <Fines profile={profile}/>;
  if(page==='notifications')return <Notifications profile={profile} admin={admin}/>;
  if(page==='resources')return <Resources profile={profile} admin={admin}/>;
  if(page==='profile')return <ProfilePage profile={profile}/>;
  if(page==='analytics'&&admin)return <Analytics/>;
  if(page==='categories'&&admin)return <Categories/>;
  if(page==='settings'&&admin)return <SettingsPage/>;
  return admin?<AdminDashboard profile={profile}/>:<UserDashboard profile={profile} setPage={setPage}/>;
}

function DialogBackdrop({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
   const previous=document.activeElement as HTMLElement|null;
   const overflow=document.body.style.overflow;
   document.body.style.overflow='hidden';
   const dialog=ref.current;
   dialog?.setAttribute('aria-label',dialog.querySelector('h2')?.textContent||'Library dialog');
   dialog?.querySelector<HTMLElement>('button, input, select, textarea, a[href]')?.focus();
   return ()=>{document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 const keyboard=(event:React.KeyboardEvent)=>{
   if(event.key==='Escape'){event.stopPropagation();onClose();}
   if(event.key==='Tab'){
     const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(item=>item.getClientRects().length);
     const first=items[0],last=items[items.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
 };
 return <div ref={ref} className="modalBack" role="dialog" aria-modal="true" onKeyDown={keyboard} onClick={onClose}>{children}</div>;
}
function FriendlyError({message}:{message:string}){
 const technical=/column .*does not exist|relation .*does not exist|row.level security|violates .*constraint|invalid input syntax|permission denied|PGRST|SQLSTATE|schema cache/i.test(message);
 return <span>{technical?'This information could not be loaded or saved. Please try again or contact the library.':message}</span>;
}

function LoadingSkeleton(){return <div className="loadingSkeleton" role="status" aria-label="Loading library information">{[0,1,2].map(i=><div key={i}><span/><span/><span/></div>)}</div>}
function EmptyState({title,description}:{title:string;description:string}){return <div className="emptyState"><BookOpen size={30}/><h3>{title}</h3><p>{description}</p></div>}

function Header({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}){return <div className="pageHeader"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
function Stat({label,value,icon,kind}:{label:string;value:string|number;icon:React.ReactNode;kind?:string}){return <div className="statCard"><div className={'statIcon '+(kind||'')}>{icon}</div><div><small>{label}</small><b>{value}</b></div></div>}

function UserDashboard({profile,setPage}:{profile:Profile;setPage:(p:string)=>void}){
 const [books,setBooks]=useState<Book[]>([]);const [availableCount,setAvailableCount]=useState(0);const [loans,setLoans]=useState<Loan[]>([]);const [fines,setFines]=useState<Fine[]>([]);const [reservations,setReservations]=useState<Reservation[]>([]);const [unread,setUnread]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=async()=>{
   setLoading(true);setError('');
   try{await accrueOverdueFines()}catch(accrualError:any){setError(accrualError?.message||'Overdue data could not be refreshed.');}
   const [bookRes,availableRes,loanRes,fineRes,reservationRes,notificationRes]=await Promise.all([
     supabase!.from('books').select('*').eq('is_active',true).order('title').limit(6),
     supabase!.from('books').select('available_copies').eq('is_active',true),
     supabase!.from('loans').select('*').eq('user_id',profile.id).order('issue_date',{ascending:false}),
     supabase!.from('fines').select('*').eq('user_id',profile.id).eq('status','pending'),
     supabase!.from('reservations').select('*').eq('user_id',profile.id).in('status',['pending','ready']),
     supabase!.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',profile.id).eq('is_read',false),
   ]);
  const queryError=bookRes.error||availableRes.error||loanRes.error||fineRes.error||reservationRes.error||notificationRes.error;
   if(queryError)setError(queryError.message);
  setBooks((bookRes.data||[]) as Book[]);setAvailableCount((availableRes.data||[]).reduce((sum,book)=>sum+Number(book.available_copies||0),0));setLoans((loanRes.data||[]) as Loan[]);setFines((fineRes.data||[]) as Fine[]);setReservations((reservationRes.data||[]) as Reservation[]);setUnread(notificationRes.count||0);setLoading(false);
 };
 useEffect(()=>{void load();},[profile.id]);
 const activeLoans=loans.filter(loan=>getDisplayLoanStatus(loan)!=='returned');
 const overdueLoans=activeLoans.filter(loan=>getDisplayLoanStatus(loan)==='overdue');
 const dueSoon=activeLoans.filter(loan=>getDisplayLoanStatus(loan)==='active'&&loan.due_date>=today()&&loan.due_date<=addDays(today(),3));
 return <><Header title={`Hello, ${profile.full_name?.split(' ')[0]||'there'} 👋`} subtitle="Your real-time library overview." action={<button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>}/>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}<section className="studentWelcome"><div><span className="eyebrow">YOUR CAMPUS LIBRARY</span><h2>Make room for your next discovery.</h2><p>Explore the collection, keep track of your books and continue learning.</p><button className="primary" onClick={()=>setPage('search')}><Search size={16}/> Explore books</button></div><div className="borrowingPriority"><span className="priorityLabel">BORROWING CHECK-IN</span>{loading?<p>Checking your borrowing...</p>:activeLoans.length?<><strong>{overdueLoans.length?`${overdueLoans.length} ${overdueLoans.length===1?'book needs':'books need'} your attention`:'Your next due date'}</strong><p>{formatDate([...activeLoans].sort((a,b)=>a.due_date.localeCompare(b.due_date))[0].due_date)}</p><button className="outline" onClick={()=>setPage('mybooks')}>Review my books <ChevronRight size={15}/></button></>:<><strong>Your next chapter starts here.</strong><p>Browse books and discover something new.</p><button className="outline" onClick={()=>setPage('reservations')}>View reservations <ChevronRight size={15}/></button></>}</div></section><div className="statsGrid"><Stat label="Available books" value={availableCount} icon={<BookOpen/>} kind="green"/><Stat label="Currently borrowed" value={activeLoans.length} icon={<ArrowLeftRight/>} kind="blue"/><Stat label="Due soon" value={dueSoon.length} icon={<AlertCircle/>} kind="orange"/><Stat label="Overdue books" value={overdueLoans.length} icon={<AlertCircle/>} kind="red"/><Stat label="Pending fines" value={formatMoney(fines.reduce((a,f)=>a+Number(f.amount),0))} icon={<CreditCard/>} kind="red"/><Stat label="Active reservations" value={reservations.length} icon={<Bookmark/>} kind="blue"/><Stat label="Unread notifications" value={unread} icon={<Bell/>} kind="purple"/></div><div className="grid2"><div className="panel"><div className="panelHead"><h3>Quick actions</h3></div><div className="quickGrid"><button onClick={()=>setPage('search')}><Search/><b>Search Books</b><small>Find available books</small></button><button onClick={()=>setPage('mybooks')}><BookOpen/><b>My Books</b><small>View issued books</small></button><button onClick={()=>setPage('reservations')}><Bookmark/><b>Reservations</b><small>Track waiting list</small></button><button onClick={()=>setPage('fines')}><CreditCard/><b>Fines</b><small>Check pending fines</small></button></div></div><div className="panel"><div className="panelHead"><h3>Explore the collection</h3><button className="ghost" onClick={()=>setPage('search')}>View all <ChevronRight size={15}/></button></div>{loading?<LoadingSkeleton/>:books.slice(0,4).map(b=><div className="bookRow" key={b.id}><div className="bookCoverMini">{b.cover_url?<img src={b.cover_url} alt=""/>:b.title.slice(0,1)}</div><div><b>{b.title}</b><small>{b.publisher||'Publisher not set'}</small></div><span className={b.available_copies?'available':'unavailable'}>{b.available_copies} available</span></div>)}</div></div></>
}

function SearchBooks({profile,initialQuery}:{profile:Profile;initialQuery:string}){
 const [books,setBooks]=useState<Book[]>([]);
 const [authors,setAuthors]=useState<Record<string,string[]>>({});
 const [copyCodes,setCopyCodes]=useState<Record<string,string[]>>({});
 const [categories,setCategories]=useState<Category[]>([]);
 const [query,setQuery]=useState(initialQuery);
 const [categoryFilter,setCategoryFilter]=useState('all');
 const [availabilityFilter,setAvailabilityFilter]=useState<'all'|'available'|'unavailable'>('all');
 const [page,setPage]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [selected,setSelected]=useState<Book|null>(null);
 const [copies,setCopies]=useState<BookCopy[]>([]);
 const [detailsLoading,setDetailsLoading]=useState(false);
 const [message,setMessage]=useState('');
 const pageSize=12;

 const load=async()=>{
   setLoading(true);setError('');
   const [bookRes,categoryRes,authorRes,copyRes]=await Promise.all([
     supabase!.from('books').select('*').eq('is_active',true).order('title').limit(1000),
     supabase!.from('categories').select('*').order('name'),
     supabase!.from('book_authors').select('book_id,authors(name)'),
     supabase!.from('book_copies').select('book_id,accession_code,copy_number').limit(5000),
   ]);
   const loadError=bookRes.error||categoryRes.error||authorRes.error||copyRes.error;
   setError(loadError?.message||'');
   setBooks((bookRes.data||[]) as Book[]);
   setCategories(((categoryRes.data||[]) as Category[]).filter(category=>(category as Category & {is_active?:boolean}).is_active!==false));
   const map:Record<string,string[]>={};
   for(const link of (authorRes.data||[]) as any[]){
     const relation=Array.isArray(link.authors)?link.authors[0]:link.authors;
     if(link.book_id&&relation?.name)map[link.book_id]=[...(map[link.book_id]||[]),relation.name];
   }
  const codeMap:Record<string,string[]>={};
  for(const copy of (copyRes.data||[]) as Array<{book_id:string;accession_code:string|null;copy_number:string}>){codeMap[copy.book_id]=[...(codeMap[copy.book_id]||[]),copy.accession_code||'',copy.copy_number].filter(Boolean);}
  setCopyCodes(codeMap);
   setAuthors(map);setLoading(false);
 };
 useEffect(()=>{void load();},[]);
 useEffect(()=>{setQuery(initialQuery);setPage(0);},[initialQuery]);

 const filtered=books.filter(book=>{
   const authorNames=(authors[book.id]||[]).join(' ');
   const categoryName=categories.find(category=>category.id===book.category_id)?.name||'';
  const searchable=`${book.title} ${book.isbn||''} ${authorNames} ${categoryName} ${book.accession_code} ${(copyCodes[book.id]||[]).join(' ')}`.toLowerCase();
   return searchable.includes(query.trim().toLowerCase())
     &&(categoryFilter==='all'||book.category_id===categoryFilter)
     &&(availabilityFilter==='all'||(availabilityFilter==='available'?book.available_copies>0:book.available_copies===0));
 });
 const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
 const visible=filtered.slice(page*pageSize,(page+1)*pageSize);

 const openDetails=async(book:Book)=>{
   setSelected(book);setDetailsLoading(true);setCopies([]);
   const {data,error:copyError}=await supabase!.from('book_copies').select('*').eq('book_id',book.id).order('copy_number');
   if(copyError)setError(copyError.message);
   setCopies((data||[]) as BookCopy[]);setDetailsLoading(false);
 };
 const reserve=async(book:Book)=>{
   setMessage('');
   const {error:reserveError}=await supabase!.rpc('create_reservation',{p_book_id:book.id});
   if(reserveError){
     const detail=(reserveError.message||'').toLowerCase();
     setError(detail.includes('duplicate')||detail.includes('active reservation')?'You already have an active reservation for this book.':reserveError.message||'Unable to create the reservation.');
     return;
   }
   setMessage('Reservation created successfully.');
 };

 return <><Header title="Search Books" subtitle="Search the live library catalogue." action={<button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>}/>
   <div className="searchPanel"><Search size={18}/><input value={query} onChange={event=>{setQuery(event.target.value);setPage(0)}} onKeyDown={event=>event.key==='Enter'&&setPage(0)} placeholder="Title, author, ISBN or accession code..."/><select value={categoryFilter} onChange={event=>{setCategoryFilter(event.target.value);setPage(0)}}><option value="all">All categories</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={availabilityFilter} onChange={event=>{setAvailabilityFilter(event.target.value as typeof availabilityFilter);setPage(0)}}><option value="all">Any availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select></div>
   {error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}
   <div className="catalogGrid">{loading?<p>Loading catalogue...</p>:visible.map(book=><div className="catalogCard" key={book.id}><div className="catalogCover">{book.cover_url?<img src={book.cover_url} alt={book.title}/>:<BookOpen size={36}/>}</div><div className="catalogBody"><span className="tag">{categories.find(category=>category.id===book.category_id)?.name||'General'}</span><h3>{book.title}</h3><p>{(authors[book.id]||[]).join(', ')||'Author not listed'} · {book.publisher||'Publisher not set'}{book.publication_year?` · ${book.publication_year}`:''}</p><b className={book.available_copies?'available':'unavailable'}>{book.available_copies} available / {book.total_copies} copies</b><div className="cardActions"><button className="outline" onClick={()=>void openDetails(book)}>Details</button>{book.available_copies===0&&<button className="primary" onClick={()=>void reserve(book)}>Reserve</button>}</div></div></div>)}</div>
   {!loading&&filtered.length===0&&<div className="panel">No books match your search.</div>}
   {!loading&&filtered.length>pageSize&&<div className="inlineActions"><button className="outline" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Previous</button><span>Page {page+1} of {pageCount}</span><button className="outline" disabled={page+1>=pageCount} onClick={()=>setPage(value=>value+1)}>Next</button></div>}
   {selected&&<DialogBackdrop onClose={()=>setSelected(null)}><div className="modal largeModal" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}>×</button><div className="bookDetailHeading">{selected.cover_url&&<img src={selected.cover_url} alt={selected.title}/>}<div><span className="formEyebrow">THE LIBRARY COLLECTION</span><h2>{selected.title}</h2></div></div>{selected.subtitle&&<p>{selected.subtitle}</p>}<p>{selected.description||'No description available.'}</p><div className="detailGrid"><Metric label="Author" value={(authors[selected.id]||[]).join(', ')||'—'}/><Metric label="ISBN" value={selected.isbn||'—'}/><Metric label="Publisher" value={selected.publisher||'—'}/><Metric label="Edition" value={selected.edition||'—'}/><Metric label="Publication year" value={selected.publication_year||'—'}/><Metric label="Language" value={selected.language||'—'}/><Metric label="Category" value={categories.find(category=>category.id===selected.category_id)?.name||'—'}/><Metric label="Total copies" value={selected.total_copies}/><Metric label="Available copies" value={selected.available_copies}/><Metric label="Availability" value={selected.available_copies>0?'Available':'Unavailable'}/></div>{selected.cover_url&&<p><a href={selected.cover_url} target="_blank" rel="noreferrer">Open cover</a></p>}{selected.ebook_url&&<p><a href={selected.ebook_url} target="_blank" rel="noreferrer">Open e-book / resource</a></p>}<h3>Physical copies</h3><div className="tablePanel"><table><thead><tr><th>Copy</th><th>Accession</th><th>Shelf</th><th>Rack</th><th>Status</th></tr></thead><tbody>{detailsLoading?<tr><td colSpan={5}>Loading copies...</td></tr>:copies.length?copies.map(copy=><tr key={copy.id}><td>{copy.copy_number}</td><td>{copy.accession_code||copy.copy_number}</td><td>{copy.shelf_number||'—'}</td><td>{copy.rack_number||'—'}</td><td>{copy.status}</td></tr>):<tr><td colSpan={5}>No physical-copy records found.</td></tr>}</tbody></table></div></div></DialogBackdrop>}
 </>;
}

function BooksAdmin(){
 const [books,setBooks]=useState<Book[]>([]);
 const [cats,setCats]=useState<Category[]>([]);
 const [authorsByBook,setAuthorsByBook]=useState<Record<string,string[]>>({});
 const [show,setShow]=useState(false);
 const [editing,setEditing]=useState<Book|null>(null);
 const [details,setDetails]=useState<Book|null>(null);
 const [q,setQ]=useState('');
 const [categoryFilter,setCategoryFilter]=useState('all');
 const [availabilityFilter,setAvailabilityFilter]=useState<'all'|'available'|'unavailable'>('all');
 const [statusFilter,setStatusFilter]=useState<'all'|'active'|'inactive'>('all');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');

 const load=async()=>{
   setLoading(true);
   setError('');
   const [b,c,links]=await Promise.all([
     supabase!.from('books').select('*').order('title'),
     supabase!.from('categories').select('*').order('name'),
     supabase!.from('book_authors').select('book_id,authors(name)')
   ]);
  if(b.error||c.error||links.error) setError((b.error||c.error||links.error)?.message||'Unable to load the book catalogue.');
   setBooks((b.data||[]) as Book[]);
   setCats((c.data||[]) as Category[]);
   const authorMap:Record<string,string[]>={};
   for(const link of (links.data||[]) as any[]){
     const related=Array.isArray(link.authors)?link.authors[0]:link.authors;
     if(link.book_id && related?.name) authorMap[link.book_id]=[...(authorMap[link.book_id]||[]),related.name];
   }
   setAuthorsByBook(authorMap);
   setLoading(false);
 };
 useEffect(()=>{load()},[]);

 const filtered=books.filter(book=>{
   const categoryName=cats.find(category=>category.id===book.category_id)?.name||'';
   const searchable=`${book.title} ${book.isbn||''} ${book.accession_code} ${(authorsByBook[book.id]||[]).join(' ')} ${categoryName}`.toLowerCase();
   const matchesSearch=searchable.includes(q.trim().toLowerCase());
   const matchesCategory=categoryFilter==='all'||book.category_id===categoryFilter;
   const matchesAvailability=availabilityFilter==='all'||(availabilityFilter==='available'?book.available_copies>0:book.available_copies===0);
   const matchesStatus=statusFilter==='all'||(statusFilter==='active'?book.is_active:!book.is_active);
   return matchesSearch&&matchesCategory&&matchesAvailability&&matchesStatus;
 });

 const archive=async(book:Book)=>{
   const {error:archiveError}=await supabase!.from('books').update({is_active:!book.is_active}).eq('id',book.id);
   if(archiveError){setError(archiveError.message);return;}
   await load();
 };

 return <><Header title="Books Management" subtitle="Manage the live library catalogue and physical copies."
   action={<button className="primary" onClick={()=>{setEditing(null);setShow(true)}}><Plus size={16}/> Add Book</button>}/>
  <div className="booksToolbar"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search title, ISBN, accession, author or category..."/>
     <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="all">All categories</option>{cats.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select>
     <select value={availabilityFilter} onChange={e=>setAvailabilityFilter(e.target.value as typeof availabilityFilter)}><option value="all">Any availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select>
     <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
     <button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>
   </div>
   {error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}
   <div className="tablePanel"><table><thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Accession</th><th>ISBN</th><th>Copies</th><th>Available</th><th>Status</th><th>Actions</th></tr></thead>
   <tbody>{loading?<tr><td colSpan={9}>Loading catalogue...</td></tr>:filtered.length?filtered.map(book=><tr key={book.id}>
     <td><b>{book.title}</b><small>{book.publisher||'—'}</small></td>
     <td>{(authorsByBook[book.id]||[]).join(', ')||'—'}</td><td>{cats.find(category=>category.id===book.category_id)?.name||'—'}</td>
     <td>{book.accession_code}</td><td>{book.isbn||'—'}</td><td>{book.total_copies}</td><td>{book.available_copies}</td>
     <td><span className={'status '+(book.is_active?'active':'cancelled')}>{book.is_active?'Active':'Inactive'}</span></td>
     <td><div className="inlineActions"><button className="outline smallBtn" onClick={()=>setDetails(book)}>Details</button><button className="outline smallBtn" onClick={()=>{setEditing(book);setShow(true)}}>Edit</button><button className="ghost smallBtn" onClick={()=>void archive(book)}>{book.is_active?'Archive':'Reactivate'}</button></div></td>
   </tr>):<tr><td colSpan={9}>No books match these filters.</td></tr>}</tbody></table></div>
   {show&&<BookForm book={editing} categories={cats} onClose={()=>setShow(false)} onSaved={()=>{setShow(false);load()}}/>}
   {details&&<BookDetailsModal book={details} category={cats.find(category=>category.id===details.category_id)?.name||'—'} authors={(authorsByBook[details.id]||[]).join(', ')||'—'} onClose={()=>setDetails(null)}/>}
 </>;
}

function BookDetailsModal({book,category,authors,onClose}:{book:Book;category:string;authors:string;onClose:()=>void}){
 const [copies,setCopies]=useState<BookCopy[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
   let active=true;
   void supabase!.from('book_copies').select('*').eq('book_id',book.id).order('copy_number').then(({data,error:copyError})=>{
     if(!active)return;
     if(copyError)setError(copyError.message);
     setCopies((data||[]) as BookCopy[]);
     setLoading(false);
   });
   return ()=>{active=false};
 },[book.id]);
 return <DialogBackdrop onClose={onClose}><div className="modal largeModal" onClick={e=>e.stopPropagation()}>
   <button className="close" onClick={onClose}>×</button><h2>{book.title}</h2>
   <div className="detailGrid"><Metric label="Subtitle" value={book.subtitle||'—'}/><Metric label="ISBN" value={book.isbn||'—'}/><Metric label="Author" value={authors}/><Metric label="Category" value={category}/><Metric label="Publisher" value={book.publisher||'—'}/><Metric label="Publication year" value={book.publication_year||'—'}/><Metric label="Edition" value={book.edition||'—'}/><Metric label="Language" value={book.language||'—'}/><Metric label="Total copies" value={book.total_copies}/><Metric label="Available copies" value={book.available_copies}/></div>
   <p>{book.description||'No description available.'}</p>
   {book.cover_url&&<p><a href={book.cover_url} target="_blank" rel="noreferrer">Cover image</a></p>}
   {book.ebook_url&&<p><a href={book.ebook_url} target="_blank" rel="noreferrer">Open e-book</a></p>}
   <h3>Physical copies</h3>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}
   <div className="tablePanel"><table><thead><tr><th>Accession code</th><th>Copy number</th><th>Shelf</th><th>Rack</th><th>Status</th><th>Condition</th><th>Price</th><th>Acquired</th><th>Notes</th></tr></thead><tbody>{loading?<tr><td colSpan={9}>Loading copies...</td></tr>:copies.length?copies.map(copy=><tr key={copy.id}><td>{copy.accession_code||copy.copy_number}</td><td>{copy.copy_number}</td><td>{copy.shelf_number||'—'}</td><td>{copy.rack_number||'—'}</td><td>{copy.status}</td><td>{copy.condition||'—'}</td><td>{copy.price==null?'—':formatMoney(Number(copy.price))}</td><td>{copy.acquired_date?formatDate(copy.acquired_date):'—'}</td><td>{copy.notes||'—'}</td></tr>):<tr><td colSpan={9}>No physical copies found.</td></tr>}</tbody></table></div>
 </div></DialogBackdrop>;
}

type BookCopyDraft={accession_code:string;copy_number:string;shelf_number:string;rack_number:string;condition:string;price:string;acquired_date:string;notes:string};

function createBookCopyDraft(accession:string,sequence:number):BookCopyDraft{
 const code=accession.trim()?`${accession.trim()}-C${String(sequence).padStart(3,'0')}`:'';
 return {accession_code:code,copy_number:code,shelf_number:'',rack_number:'',condition:'Good',price:'',acquired_date:today(),notes:''};
}

function BookForm({book,categories,onClose,onSaved}:{book:Book|null;categories:Category[];onClose:()=>void;onSaved:()=>void}){
 const [accession,setAccession]=useState(book?.accession_code||'');
 const [title,setTitle]=useState(book?.title||'');
 const [subtitle,setSubtitle]=useState(book?.subtitle||'');
 const [isbn,setIsbn]=useState(book?.isbn||'');
 const [author,setAuthor]=useState('');
 const [publisher,setPublisher]=useState(book?.publisher||'');
 const [year,setYear]=useState(book?.publication_year?.toString()||'');
 const [edition,setEdition]=useState(book?.edition||'');
 const [language,setLanguage]=useState(book?.language||'English');
 const [category,setCategory]=useState(book?.category_id||'');
 const [copyDrafts,setCopyDrafts]=useState<BookCopyDraft[]>(()=>book?[]:[createBookCopyDraft('',1)]);
 const [coverUrl,setCoverUrl]=useState(book?.cover_url||'');
 const [ebookUrl,setEbookUrl]=useState(book?.ebook_url||'');
 const [description,setDescription]=useState(book?.description||'');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');

 const updateAccession=(value:string)=>{
   const previous=accession.trim();
   setAccession(value);
   setCopyDrafts(current=>current.map((copy,index)=>{
     const sequence=(book?.total_copies||0)+index+1;
     const previousCode=previous?`${previous}-C${String(sequence).padStart(3,'0')}`:'';
     const nextCode=value.trim()?`${value.trim()}-C${String(sequence).padStart(3,'0')}`:'';
     return {
       ...copy,
       accession_code:!copy.accession_code||copy.accession_code===previousCode?nextCode:copy.accession_code,
       copy_number:!copy.copy_number||copy.copy_number===previousCode?nextCode:copy.copy_number,
     };
   }));
 };
 const updateCopy=(index:number,key:keyof BookCopyDraft,value:string)=>setCopyDrafts(current=>current.map((copy,i)=>i===index?{...copy,[key]:value}:copy));
 const addCopy=()=>setCopyDrafts(current=>[...current,createBookCopyDraft(accession,(book?.total_copies||0)+current.length+1)]);

 useEffect(()=>{
   let active=true;
   if(!book) return;
   (async()=>{
    const {data}=await supabase!.from('book_authors').select('author_id, authors(name)').eq('book_id',book.id);
    if(active && data) setAuthor((data as any[]).map(link=>Array.isArray(link.authors)?link.authors[0]?.name:link.authors?.name).filter(Boolean).join(', '));
   })();
   return ()=>{active=false};
 },[book?.id]);

 const save=async()=>{
   setBusy(true); setError(''); setSuccess('');
   const cleanTitle=title.trim();
   const cleanAccession=accession.trim();
   const cleanIsbn=isbn.trim();
   const newCopies=copyDrafts.map((copy,index)=>{
     const generated=`${cleanAccession}-C${String((book?.total_copies||0)+index+1).padStart(3,'0')}`;
     return {...copy,accession_code:copy.accession_code.trim()||generated,copy_number:copy.copy_number.trim()||generated};
   });
   const authorNames=[...new Set(author.split(',').map(name=>name.trim()).filter(Boolean))];
   if(!cleanTitle){setError('Book title is required.');setBusy(false);return;}
   if(!cleanAccession){setError('Accession code is required.');setBusy(false);return;}
   if(!book&&!newCopies.length){setError('Add at least one physical copy.');setBusy(false);return;}
   if(year&&(!/^\d{4}$/.test(year)||Number(year)<0)){setError('Enter a valid four-digit publication year.');setBusy(false);return;}
   if(newCopies.some(copy=>copy.price&&(!Number.isFinite(Number(copy.price))||Number(copy.price)<0))){setError('Copy prices must be valid non-negative amounts.');setBusy(false);return;}
   const copyAccessions=newCopies.map(copy=>copy.accession_code.toLowerCase());
   const copyNumbers=newCopies.map(copy=>copy.copy_number.toLowerCase());
   if(new Set(copyAccessions).size!==copyAccessions.length||new Set(copyNumbers).size!==copyNumbers.length){setError('Each physical copy must have a unique accession code and copy number.');setBusy(false);return;}

   try{
     let bookId=book?.id;
     let existingCopies:{status:string}[]=[];
     if(book){
       if(cleanAccession!==book.accession_code){
         const {data:duplicate,error:duplicateError}=await supabase!.from('books').select('id').eq('accession_code',cleanAccession).neq('id',book.id).limit(1).maybeSingle();
         if(duplicateError) throw duplicateError;
         if(duplicate) throw new Error('That book accession code is already in use.');
       }
       if(cleanIsbn){
         const {data:duplicate,error:duplicateError}=await supabase!.from('books').select('id').eq('isbn',cleanIsbn).neq('id',book.id).limit(1).maybeSingle();
         if(duplicateError) throw duplicateError;
         if(duplicate) throw new Error('That ISBN is already assigned to another book.');
       }
       const {data:rows,error:copyReadError}=await supabase!.from('book_copies').select('status').eq('book_id',book.id);
       if(copyReadError) throw copyReadError;
       existingCopies=(rows||[]) as {status:string}[];
     }else{
       const {data:duplicateCode,error:codeError}=await supabase!.from('books').select('id').eq('accession_code',cleanAccession).limit(1).maybeSingle();
       if(codeError) throw codeError;
       if(duplicateCode) throw new Error('That book accession code already exists. Use a unique code.');
       if(cleanIsbn){
         const {data:duplicateIsbn,error:isbnError}=await supabase!.from('books').select('id').eq('isbn',cleanIsbn).limit(1).maybeSingle();
         if(isbnError) throw isbnError;
         if(duplicateIsbn) throw new Error('That ISBN is already assigned to another book.');
       }
     }

     if(newCopies.length){
       const accessions=newCopies.map(copy=>copy.accession_code);
       const numbers=newCopies.map(copy=>copy.copy_number);
       const [{data:duplicateAccessions,error:accessionError},{data:duplicateNumbers,error:numberError}]=await Promise.all([
         supabase!.from('book_copies').select('id').in('accession_code',accessions),
         supabase!.from('book_copies').select('id').in('copy_number',numbers),
       ]);
       if(accessionError) throw accessionError;
       if(numberError) throw numberError;
       if(duplicateAccessions?.length) throw new Error('A physical copy accession code is already in use.');
       if(duplicateNumbers?.length) throw new Error('A physical copy number is already in use.');
     }

     const metadata={
       accession_code:cleanAccession,title:cleanTitle,subtitle:subtitle.trim()||null,isbn:cleanIsbn||null,
       publisher:publisher.trim()||null,publication_year:year?Number(year):null,edition:edition.trim()||null,
       language:language.trim()||'English',category_id:category||null,cover_url:coverUrl.trim()||null,
       ebook_url:ebookUrl.trim()||null,description:description.trim()||null,
     };
     if(book){
       const {error:bookUpdateError}=await supabase!.from('books').update(metadata).eq('id',book.id);
       if(bookUpdateError) throw bookUpdateError;
       bookId=book.id;
     }else{
       const {data:newBook,error:bookInsertError}=await supabase!.from('books').insert({...metadata,total_copies:0,available_copies:0,is_active:true}).select('id').single();
       if(bookInsertError) throw bookInsertError;
       bookId=newBook.id;
     }

     if(newCopies.length&&bookId){
       const copyRows=newCopies.map(copy=>({
         book_id:bookId,accession_code:copy.accession_code,copy_number:copy.copy_number,
         shelf_number:copy.shelf_number.trim()||null,rack_number:copy.rack_number.trim()||null,
         condition:copy.condition.trim()||null,price:copy.price?Number(copy.price):null,
         acquired_date:copy.acquired_date||null,notes:copy.notes.trim()||null,status:'available',
       }));
       const {error:copyInsertError}=await supabase!.from('book_copies').insert(copyRows);
       if(copyInsertError) throw copyInsertError;
     }

     if(bookId){
       const authorIds:string[]=[];
       for(const name of authorNames){
         const {data:existingAuthor,error:authorFindError}=await supabase!.from('authors').select('id').ilike('name',name).limit(1).maybeSingle();
         if(authorFindError) throw authorFindError;
         if(existingAuthor){authorIds.push(existingAuthor.id);continue;}
         const {data:newAuthor,error:newAuthorError}=await supabase!.from('authors').insert({name}).select('id').single();
         if(newAuthorError) throw newAuthorError;
         authorIds.push(newAuthor.id);
       }
       const {error:unlinkError}=await supabase!.from('book_authors').delete().eq('book_id',bookId);
       if(unlinkError) throw unlinkError;
       if(authorIds.length){
         const {error:linkError}=await supabase!.from('book_authors').insert(authorIds.map(author_id=>({book_id:bookId,author_id})));
         if(linkError) throw linkError;
       }
       const {data:allCopies,error:countError}=await supabase!.from('book_copies').select('status').eq('book_id',bookId);
       if(countError) throw countError;
       const totalCopies=allCopies?.length||0;
       const availableCopies=(allCopies||[]).filter(copy=>copy.status==='available').length;
       const {error:countUpdateError}=await supabase!.from('books').update({total_copies:totalCopies,available_copies:availableCopies}).eq('id',bookId);
       if(countUpdateError) throw countUpdateError;
     }

     setSuccess(book?'Book updated successfully.':'Book and physical copies added successfully.');
     setTimeout(onSaved,500);
   }catch(e:any){
     if(e?.code==='23505'||/unique constraint|duplicate key/i.test(e?.message||'')) setError('Duplicate ISBN, book accession code, or physical copy code. Use unique values.');
    else if(e?.code==='42703'||e?.code==='PGRST204'||/column .* does not exist|could not find the .* column/i.test(e?.message||'')) setError('The physical-copy fields are not installed in Supabase. Run supabase-books-management.sql in the Supabase SQL Editor.');
     else setError(e?.message||'Unable to save the book.');
   }finally{
     setBusy(false);
   }
 };

 return <DialogBackdrop onClose={onClose}><div className="modal formModal" onClick={e=>e.stopPropagation()}>
   <button className="close" onClick={onClose}>×</button>
   <h2>{book?'Edit book':'Add book'}</h2>
   <p className="formHint">{book?'Update catalogue metadata and add copies without removing circulation history.':'Add the catalogue record and configure each physical copy.'}</p>
   <div className="formGrid">
     <label>Book accession code *<input value={accession} onChange={e=>updateAccession(e.target.value)} placeholder="e.g. CSE-DS-001"/></label>
     <label>Title *<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Book title"/></label>
     <label>Subtitle<input value={subtitle} onChange={e=>setSubtitle(e.target.value)} placeholder="Optional subtitle"/></label>
     <label>Author(s)<input value={author} onChange={e=>setAuthor(e.target.value)} placeholder="Separate multiple authors with commas"/></label>
     <label>ISBN<input value={isbn} onChange={e=>setIsbn(e.target.value)} placeholder="ISBN"/></label>
     <label>Publisher<input value={publisher} onChange={e=>setPublisher(e.target.value)}/></label>
     <label>Publication year<input value={year} onChange={e=>setYear(e.target.value)} type="number" min="0"/></label>
     <label>Edition<input value={edition} onChange={e=>setEdition(e.target.value)} placeholder="e.g. 3rd Edition"/></label>
     <label>Language<input value={language} onChange={e=>setLanguage(e.target.value)} placeholder="English"/></label>
     <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Select category</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
     <label>Cover image URL<input value={coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="Optional"/></label>
     <label>eBook URL<input value={ebookUrl} onChange={e=>setEbookUrl(e.target.value)} placeholder="Optional"/></label>
     <label className="full">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Short description"/></label>
   </div>
   <div className="copyDraftSection"><div className="panelHead"><h3>Physical copies</h3><button type="button" className="outline smallBtn" onClick={addCopy}><Plus size={15}/> Add copy</button></div>
     {book&&<p className="formHint">Existing copies: {book.total_copies}. Copies are never removed here; adding copies updates totals from Supabase.</p>}
     {copyDrafts.map((copy,index)=><fieldset className="copyFields" key={index}><legend>New copy {index+1}</legend><div className="formGrid">
       <label>Unique copy/accession code *<input value={copy.accession_code} onChange={e=>updateCopy(index,'accession_code',e.target.value)} placeholder="Unique accession code" required/></label>
       <label>Copy number *<input value={copy.copy_number} onChange={e=>updateCopy(index,'copy_number',e.target.value)} placeholder="Unique copy number" required/></label>
       <label>Shelf number<input value={copy.shelf_number} onChange={e=>updateCopy(index,'shelf_number',e.target.value)} placeholder="e.g. S-03"/></label>
       <label>Rack number<input value={copy.rack_number} onChange={e=>updateCopy(index,'rack_number',e.target.value)} placeholder="e.g. R-02"/></label>
       <label>Condition<input value={copy.condition} onChange={e=>updateCopy(index,'condition',e.target.value)} placeholder="Good"/></label>
       <label>Price<input type="number" min="0" step="0.01" value={copy.price} onChange={e=>updateCopy(index,'price',e.target.value)}/></label>
       <label>Acquired date<input type="date" value={copy.acquired_date} onChange={e=>updateCopy(index,'acquired_date',e.target.value)}/></label>
       <label className="full">Copy notes<textarea value={copy.notes} onChange={e=>updateCopy(index,'notes',e.target.value)} placeholder="Optional copy notes"/></label>
     </div>{!book&&copyDrafts.length>1&&<button type="button" className="ghost smallBtn" onClick={()=>setCopyDrafts(current=>current.filter((_,copyIndex)=>copyIndex!==index))}>Remove copy</button>}</fieldset>)}
   </div>
   {error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}
   {success&&<div className="authSuccess">{success}</div>}
   <button className="primary wide" disabled={busy||!title.trim()||!accession.trim()||(!book&&!copyDrafts.length)} onClick={save}>{busy?'Saving...':book?'Update book':'Save book'}</button>
 </div></DialogBackdrop>;
}

function AdminDashboard({profile}:{profile:Profile}){
  const [stats,setStats]=useState({books:0,totalCopies:0,availableCopies:0,members:0,loans:0,overdue:0,reservations:0,pendingFines:0,collectedFines:0,waivedFines:0,todayIssues:0,todayReturns:0,todayReservations:0});
  const [activity,setActivity]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{
    setLoading(true);setError('');
    try{await accrueOverdueFines();}catch(accrualError:any){setError(accrualError?.message||'Overdue fine data could not refresh.');}
    const dayStart=`${today()}T00:00:00.000Z`;
    const dayEnd=`${addDays(today(),1)}T00:00:00.000Z`;
    const [booksRes,copiesRes,membersRes,loansRes,overdueRes,reservationsRes,pendingFinesRes,collectedFinesRes,waivedFinesRes,issuesTodayRes,returnsTodayRes,reservationsTodayRes,activityRes]=await Promise.all([
      supabase!.from('books').select('id',{count:'exact',head:true}),
      supabase!.from('book_copies').select('id',{count:'exact',head:true}),
      supabase!.from('profiles').select('id',{count:'exact',head:true}),
      supabase!.from('loans').select('id',{count:'exact',head:true}).in('status',['active','overdue']),
      supabase!.from('loans').select('id',{count:'exact',head:true}).is('returned_date',null).lt('due_date',today()),
      supabase!.from('reservations').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase!.from('fines').select('amount').eq('status','pending'),
      supabase!.from('fines').select('amount').eq('status','paid'),
      supabase!.from('fines').select('amount').eq('status','waived'),
      supabase!.from('loans').select('id',{count:'exact',head:true}).gte('issue_date',today()).lt('issue_date',addDays(today(),1)),
      supabase!.from('loans').select('id',{count:'exact',head:true}).gte('returned_date',dayStart).lt('returned_date',dayEnd),
      supabase!.from('reservations').select('id',{count:'exact',head:true}).gte('reserved_at',dayStart).lt('reserved_at',dayEnd),
      supabase!.from('activity_logs').select('*').order('created_at',{ascending:false}).limit(8),
    ]);
    const allBooks=await supabase!.from('books').select('available_copies');
    if(booksRes.error||copiesRes.error||membersRes.error||loansRes.error||overdueRes.error)setError(booksRes.error?.message||copiesRes.error?.message||membersRes.error?.message||loansRes.error?.message||overdueRes.error?.message||'Unable to load dashboard statistics.');
    const availableCopies=((allBooks.data||[]) as Array<{available_copies:number}>).reduce((total,book)=>total+Number(book.available_copies||0),0);
    const total=(rows:any[]|null)=> (rows||[]).reduce((sum,row)=>sum+Number(row.amount||0),0);
    setStats({books:booksRes.count||0,totalCopies:copiesRes.count||0,availableCopies,members:membersRes.count||0,loans:loansRes.count||0,overdue:overdueRes.count||0,reservations:reservationsRes.count||0,pendingFines:total(pendingFinesRes.data),collectedFines:total(collectedFinesRes.data),waivedFines:total(waivedFinesRes.data),todayIssues:issuesTodayRes.count||0,todayReturns:returnsTodayRes.count||0,todayReservations:reservationsTodayRes.count||0});
    setActivity((activityRes.data||[]) as any[]);setLoading(false);
  };
  useEffect(()=>{void load();},[]);
  return <><Header title="Librarian Dashboard" subtitle={`Live library data · signed in as ${profile.full_name||profile.email}`} action={<button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>}/>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}<div className="statsGrid"><Stat label="Total book titles" value={stats.books} icon={<BookOpen/>} kind="green"/><Stat label="Total physical copies" value={stats.totalCopies} icon={<BookOpen/>} kind="blue"/><Stat label="Available copies" value={stats.availableCopies} icon={<CheckCircle2/>} kind="green"/><Stat label="Total members" value={stats.members} icon={<Users/>} kind="purple"/><Stat label="Current loans" value={stats.loans} icon={<ArrowLeftRight/>} kind="orange"/><Stat label="Overdue loans" value={stats.overdue} icon={<AlertCircle/>} kind="red"/><Stat label="Pending reservations" value={stats.reservations} icon={<Bookmark/>} kind="blue"/><Stat label="Pending fines" value={formatMoney(stats.pendingFines)} icon={<CreditCard/>} kind="red"/><Stat label="Collected fines" value={formatMoney(stats.collectedFines)} icon={<CreditCard/>} kind="green"/><Stat label="Waived fines" value={formatMoney(stats.waivedFines)} icon={<CreditCard/>} kind="blue"/><Stat label="Today's issues" value={stats.todayIssues} icon={<ArrowLeftRight/>} kind="orange"/><Stat label="Today's returns" value={stats.todayReturns} icon={<CheckCircle2/>} kind="green"/><Stat label="Today's reservations" value={stats.todayReservations} icon={<Bookmark/>} kind="blue"/></div><div className="panel"><div className="panelHead"><h3>Recent library activity</h3>{loading&&<span>Loading...</span>}</div>{activity.length?activity.map(row=><div className="bookRow" key={row.id}><div className="bookCoverMini"><ActivityIcon action={row.action}/></div><div><b>{row.description||row.action}</b><small>{formatDate(row.created_at)}</small></div><span>{row.entity_type||'Activity'}</span></div>):<p>No recent activity recorded.</p>}</div><div className="panel"><div className="panelHead"><h3>Database status</h3></div><div className="metricGrid"><Metric label="Authentication" value="Supabase Auth"/><Metric label="Database" value="PostgreSQL"/><Metric label="Security" value="RLS enabled"/><Metric label="College domain" value="@kgr.ac.in"/></div></div></>;
}

function ActivityIcon({action}:{action:string}){return action?.includes('return')?<CheckCircle2 size={18}/>:action?.includes('reservation')?<Bookmark size={18}/>:action?.includes('issue')?<ArrowLeftRight size={18}/>:<Bell size={18}/>;}

function MembersAdmin(){
  const [members,setMembers]=useState<Profile[]>([]);
  const [departments,setDepartments]=useState<Department[]>([]);
  const [books,setBooks]=useState<Book[]>([]);
  const [copies,setCopies]=useState<BookCopy[]>([]);
  const [query,setQuery]=useState('');
  const [roleFilter,setRoleFilter]=useState('all');
  const [departmentFilter,setDepartmentFilter]=useState('all');
  const [yearFilter,setYearFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('all');
  const [detail,setDetail]=useState<any>(null);

  const load = async () => {
    const [profilesRes, departmentsRes, booksRes, copiesRes] = await Promise.all([
      supabase!.from('profiles').select('*').order('full_name'),
      supabase!.from('departments').select('*').order('name'),
      supabase!.from('books').select('*'),
      supabase!.from('book_copies').select('*'),
    ]);
    setMembers((profilesRes.data || []) as Profile[]);
    setDepartments((departmentsRes.data || []) as Department[]);
    setBooks((booksRes.data||[]) as Book[]);
    setCopies((copiesRes.data||[]) as BookCopy[]);
  };

  useEffect(()=>{void load();},[]);

  const departmentOptions = useMemo(() => {
    const names = new Set<string>();
    departments.forEach((dept) => {
      const label = dept.name || dept.code || dept.id;
      if (label) names.add(label);
    });
    return Array.from(names).sort();
  }, [departments]);

  const filtered = members.filter(m => {
    const text = `${m.full_name || ''} ${m.email || ''} ${m.college_id || ''} ${getDepartmentName(m.department_id, departments)} ${getYearLabel(m.year_of_study)}`.toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesRole = roleFilter === 'all' || m.role === roleFilter;
    const matchesDept = departmentFilter === 'all' || getDepartmentName(m.department_id, departments) === departmentFilter || m.department_id === departmentFilter;
    const matchesYear = yearFilter === 'all' || String(m.year_of_study) === yearFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? m.is_active : !m.is_active);
    return matchesQuery && matchesRole && matchesDept && matchesYear && matchesStatus;
  });

  const openMember = async (member:Profile) => {
    const [currRes,pastRes,fineRes,resRes,notificationRes] = await Promise.all([
      supabase!.from('loans').select('*').eq('user_id', member.id).in('status',['active','overdue']),
      supabase!.from('loans').select('*').eq('user_id', member.id).eq('status','returned'),
      supabase!.from('fines').select('*').eq('user_id', member.id).order('issued_at',{ascending:false}),
      supabase!.from('reservations').select('*').eq('user_id', member.id).order('reserved_at',{ascending:false}),
      supabase!.from('notifications').select('*').eq('user_id',member.id).order('created_at',{ascending:false}).limit(10)
    ]);
    setDetail({member, current:(currRes.data||[]), past:(pastRes.data||[]), fines:(fineRes.data||[]), reservations:(resRes.data||[]), notifications:(notificationRes.data||[]), books:Object.fromEntries(books.map(book=>[book.id,book])), copies:Object.fromEntries(copies.map(copy=>[copy.id,copy]))})
  };

  return <><Header title="Members" subtitle="Student and faculty profiles registered with the library." action={<button className="ghost" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button>} />
    <div className="panel"><div className="filtersRow"><input placeholder="Search by name, college ID or email" value={query} onChange={e=>setQuery(e.target.value)} /><select value={departmentFilter} onChange={e=>setDepartmentFilter(e.target.value)}><option value="all">All departments</option>{departmentOptions.map(d=><option key={d} value={d}>{d}</option>)}</select><select value={yearFilter} onChange={e=>setYearFilter(e.target.value)}><option value="all">All years</option>{YEAR_OPTIONS.map(item => <option key={item.value} value={String(item.value)}>{item.label}</option>)}</select><select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">All roles</option><option value="student">Student</option><option value="faculty">Faculty</option><option value="librarian">Librarian</option></select><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All status</option><option value="active">Active only</option><option value="inactive">Inactive only</option></select></div></div>
    <div className="tablePanel"><table><thead><tr><th>Name</th><th>College ID</th><th>Email</th><th>Department</th><th>Year</th><th>Role</th><th>Status</th></tr></thead><tbody>{filtered.map(m=><tr key={m.id} onClick={()=>openMember(m)} className="clickRow"><td><b>{m.full_name||'—'}</b></td><td>{m.college_id||'—'}</td><td>{m.email}</td><td>{getDepartmentName(m.department_id, departments)}</td><td>{getYearLabel(m.year_of_study)}</td><td>{m.role}</td><td><span className={'status '+(m.is_active?'active':'cancelled')}>{m.is_active?'Active':'Inactive'}</span></td></tr>)}</tbody></table></div>
    {detail && <DialogBackdrop onClose={()=>setDetail(null)}><div className="modal largeModal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setDetail(null)}>×</button><h2>{detail.member.full_name || detail.member.email}</h2><div className="detailGrid"><Metric label="Email" value={detail.member.email}/><Metric label="College ID" value={detail.member.college_id||'—'}/><Metric label="Role" value={detail.member.role}/><Metric label="Department" value={getDepartmentName(detail.member.department_id, departments)}/><Metric label="Phone" value={detail.member.phone||'—'}/><Metric label="Year" value={getYearLabel(detail.member.year_of_study)}/><Metric label="Account status" value={detail.member.is_active?'Active':'Inactive'}/></div><div className="miniSections"><div className="miniBox"><h3>Current borrowed books</h3>{detail.current.length?detail.current.map((loan:any)=>{const copy=detail.copies[loan.copy_id];const book=copy?detail.books[copy.book_id]:null;return <p key={loan.id}>{book?.title||loan.id.slice(0,8)} · {copy?.copy_number||'copy'} · due {formatDate(loan.due_date)} · {getDisplayLoanStatus(loan)}</p>}):<p>No active books.</p>}</div><div className="miniBox"><h3>Past borrowed books</h3>{detail.past.length?detail.past.map((loan:any)=>{const copy=detail.copies[loan.copy_id];const book=copy?detail.books[copy.book_id]:null;return <p key={loan.id}>{book?.title||loan.id.slice(0,8)} · {copy?.copy_number||'copy'} · issued {formatDate(loan.issue_date)} · returned {formatDate(loan.returned_date)}</p>}):<p>No return history.</p>}</div><div className="miniBox"><h3>Fine history</h3>{detail.fines.length?detail.fines.map((fine:Fine)=><p key={fine.id}>{formatMoney(Number(fine.amount))} · {fine.reason} · {fine.status} · {formatDate(fine.accrual_date||fine.issued_at)}{fine.notes?` · ${fine.notes}`:''}</p>):<p>No fines.</p>}</div><div className="miniBox"><h3>Reservation history</h3>{detail.reservations.length?detail.reservations.map((res:Reservation)=><p key={res.id}>{detail.books[res.book_id]?.title||res.book_id} · {res.status} · queue {res.queue_position??'—'} · {formatDate(res.reserved_at)}</p>):<p>No reservations.</p>}</div><div className="miniBox"><h3>Recent notifications</h3>{detail.notifications.length?detail.notifications.map((notification:Notification)=><p key={notification.id}>{notification.title} · {formatDate(notification.created_at)} · {notification.is_read?'Read':'Unread'}</p>):<p>No notification history.</p>}</div></div></div></DialogBackdrop>}
  </>;
}

function Circulation({profile,ledgerOnly=false}:{profile:Profile;ledgerOnly?:boolean}){
  const [members,setMembers]=useState<Profile[]>([]);
  const [books,setBooks]=useState<Book[]>([]);
  const [copies,setCopies]=useState<BookCopy[]>([]);
  const [loans,setLoans]=useState<any[]>([]);
  const [fines,setFines]=useState<any[]>([]);
  const [memberId,setMemberId]=useState('');
  const [bookId,setBookId]=useState('');
  const [copyId,setCopyId]=useState('');
  const [issueDate,setIssueDate]=useState(today());
  const [dueDate,setDueDate]=useState(addDays(today(),14));
  const [loanDuration,setLoanDuration]=useState(14);
  const [dueDateTouched,setDueDateTouched]=useState(false);
  const [notes,setNotes]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [filter,setFilter]=useState<'all'|'active'|'due_today'|'overdue'|'returned'>('all');
  const [search,setSearch]=useState('');
  const [memberSearch,setMemberSearch]=useState('');
  const [memberDepartmentFilter,setMemberDepartmentFilter]=useState('all');
  const [memberYearFilter,setMemberYearFilter]=useState('all');
  const [bookSearch,setBookSearch]=useState('');
  const [departments,setDepartments]=useState<Department[]>([]);
  const [returningLoan,setReturningLoan]=useState<any|null>(null);
  const [returnCondition,setReturnCondition]=useState('');
  const [returnNotes,setReturnNotes]=useState('');
  const [busy,setBusy]=useState(false);
  const [fineSearch,setFineSearch]=useState('');
  const [fineStatusFilter,setFineStatusFilter]=useState<'all'|'pending'|'paid'|'waived'>('all');
  const [fineRate,setFineRate]=useState(DEFAULT_FINE_RATE);

  const loadData = async () => {
    try { await accrueOverdueFines(); } catch (accrualError) { console.warn('Overdue fine accrual unavailable:',accrualError); }
    setFineRate(await getDailyFineRate());
    const [profilesRes, booksRes, copiesRes, loansRes, finesRes, departmentsRes] = await Promise.all([
      supabase!.from('profiles').select('*').in('role',['student','faculty']).order('full_name'),
      supabase!.from('books').select('*').order('title'),
      supabase!.from('book_copies').select('*').order('copy_number'),
      supabase!.from('loans').select('*').order('issue_date',{ascending:false}),
      supabase!.from('fines').select('*').order('issued_at',{ascending:false}),
      supabase!.from('departments').select('*').order('name')
    ]);
    setMembers((profilesRes.data || []) as Profile[]);
    setBooks((booksRes.data || []) as Book[]);
    setCopies((copiesRes.data || []) as BookCopy[]);
    setLoans((loansRes.data || []) as any[]);
    setFines((finesRes.data || []) as any[]);
    setDepartments((departmentsRes.data || []) as Department[]);
  };

  useEffect(()=>{void loadData();},[]);
  useEffect(()=>{void supabase!.from('library_settings').select('value').eq('key','default_loan_duration_days').maybeSingle().then(({data})=>{
    const duration=Number(String(data?.value??14).replace(/^"|"$/g,''));
    if(Number.isInteger(duration)&&duration>0){setLoanDuration(duration);if(!dueDateTouched)setDueDate(addDays(today(),duration));}
  });},[dueDateTouched]);

  const memberMap = useMemo(() => Object.fromEntries((members || []).map(m => [m.id, m])), [members]);
  const bookMap = useMemo(() => Object.fromEntries((books || []).map(b => [b.id, b])), [books]);
  const selectedBook = books.find(b => b.id === bookId) || null;
  const selectedMember = members.find(m => m.id === memberId) || null;
  const availableCopies = useMemo(() => copies.filter(c => c.book_id === bookId && c.status === 'available'), [copies, bookId]);
  const selectedAvailableCopy = availableCopies.find(copy => copy.id === copyId) || null;
  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesText = !memberSearch || `${member.full_name || ''} ${member.college_id || ''} ${member.email || ''}`.toLowerCase().includes(memberSearch.toLowerCase());
    const matchesDepartment = memberDepartmentFilter === 'all' || getDepartmentName(member.department_id, departments) === memberDepartmentFilter || member.department_id === memberDepartmentFilter;
    const matchesYear = memberYearFilter === 'all' || String(member.year_of_study) === memberYearFilter;
    return matchesText && matchesDepartment && matchesYear;
  }), [members, memberSearch, memberDepartmentFilter, memberYearFilter, departments]);
  const filteredBookList = useMemo(() => books.filter((book) => book.is_active).filter((book) => {
    const haystack = `${book.title} ${book.isbn || ''} ${book.accession_code} ${book.publisher || ''}`.toLowerCase();
    return !bookSearch || haystack.includes(bookSearch.toLowerCase());
  }), [books, bookSearch]);
  const selectedMemberLoans = useMemo(() => loans.filter((loan) => loan.user_id === memberId && loan.status === 'active'), [loans, memberId]);
  const selectedMemberPendingFines = useMemo(() => fines.filter((fine) => fine.user_id === memberId && fine.status === 'pending'), [fines, memberId]);
  const canIssue = Boolean(
    selectedMember?.is_active && selectedBook && selectedAvailableCopy &&
    isValidDateInput(issueDate) && isValidDateInput(dueDate) && dueDate >= issueDate
  );

  useEffect(()=>{
    if (!bookId) { setCopyId(''); return; }
    const next = availableCopies[0]?.id || '';
    setCopyId(current => current && availableCopies.some(c => c.id === current) ? current : next);
  }, [bookId, availableCopies]);

  const loanEntries = useMemo(() => loans.map(loan => {
    const copy = copies.find(c => c.id === loan.copy_id) || null;
    const book = copy ? bookMap[copy.book_id] : null;
    const member = memberMap[loan.user_id];
    const status = getDisplayLoanStatus(loan);
    return { ...loan, copy, book, member, status };
  }), [loans, copies, memberMap, bookMap]);

  const filteredLoans = loanEntries.filter(loan => {
    const searchText = `${loan.member?.full_name || ''} ${loan.member?.email || ''} ${loan.member?.college_id || ''} ${loan.book?.title || ''} ${loan.book?.accession_code || ''} ${loan.copy?.copy_number || ''}`.toLowerCase();
    const matchesSearch = !search || searchText.includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || loan.status === filter;
    return matchesSearch && matchesFilter;
  });
  const activeLoans = filteredLoans.filter(loan => loan.status !== 'returned');
  const returnedLoans = filteredLoans.filter(loan => loan.status === 'returned');
  const filteredFines=fines.filter(fine=>{
    const member=memberMap[fine.user_id];
    const loan=loans.find(item=>item.id===fine.loan_id);
    const copy=loan?copies.find(item=>item.id===loan.copy_id):null;
    const book=copy?bookMap[copy.book_id]:null;
    const searchText=`${member?.full_name||''} ${member?.college_id||''} ${member?.email||''} ${book?.title||''} ${book?.isbn||''}`.toLowerCase();
    return (fineStatusFilter==='all'||fine.status===fineStatusFilter)&&searchText.includes(fineSearch.trim().toLowerCase());
  });

  const handleIssue = async () => {
    setError(''); setMessage('');
    if (!memberId) { setError('Please select a member.'); return; }
    if (!bookId) { setError('Please select a book.'); return; }
    if (!copyId) { setError('Please select a physical copy.'); return; }
    if (!isValidDateInput(issueDate)) { setError('Please choose a valid issue date.'); return; }
    if (!isValidDateInput(dueDate)) { setError('Please choose a valid due date.'); return; }
    if (dueDate < issueDate) { setError('Due date cannot be before issue date.'); return; }

    const member = members.find(m => m.id === memberId);
    if (!member || !member.is_active) { setError('Member account is inactive.'); return; }
    const book = books.find(b => b.id === bookId);
    if (!book) { setError('Please select a valid book.'); return; }
    const chosenCopy = copies.find(c => c.id === copyId);
    if (!chosenCopy || chosenCopy.book_id !== bookId || chosenCopy.status !== 'available') { setError('This copy is no longer available. Please select another copy.'); return; }

    try {
      setBusy(true);
      const { data: loanId, error: rpcError } = await supabase!.rpc('issue_book', {
        p_copy_id: copyId,
        p_user_id: memberId,
        p_issued_by: profile.id,
        p_issue_date: issueDate,
        p_due_date: dueDate,
        p_notes: notes.trim() || null,
      });
      if (rpcError) {
        if (/does not exist|function .* not found|404/i.test(rpcError.message || '')) {
          throw new Error('The public.issue_book database function is not available. Apply the circulation SQL migration, then try again.');
        }
        throw rpcError;
      }

      await safeLogActivity({
        action: 'book_issued',
        entity_type: 'loan',
        entity_id: typeof loanId === 'string' ? loanId : 'n/a',
        description: `Book issued: ${member.full_name || member.email} issued ${book.title} (${chosenCopy.copy_number})`,
        user_id: profile.id,
      });

      setMessage('Book issued successfully');
      setMemberId(''); setBookId(''); setCopyId(''); setDueDate(addDays(today(),loanDuration)); setDueDateTouched(false); setNotes('');
      await loadData();
    } catch (error: any) {
      console.error('Issue book failed:', error);
      setError(error?.message || 'Unable to issue this book. The copy may already have been issued.');
    } finally {
      setBusy(false);
    }
  };

  const handleReturn = async () => {
    if (!returningLoan) return;
    setError(''); setMessage('');
    try {
      setBusy(true);
      const { data: loanRow, error: loanLookupError } = await supabase!.from('loans').select('*').eq('id', returningLoan.id).single();
      if (loanLookupError || !loanRow) throw new Error('Unable to find the loan record.');

      const rate = await getDailyFineRate();
      const overdueDays = calculateOverdueDays(loanRow.due_date, new Date().toISOString().slice(0,10));
      const fineValue = overdueDays > 0 ? overdueDays * rate : 0;
      try { await accrueOverdueFines(); } catch (accrualError:any) { console.error('Overdue fine accrual failed during return:',accrualError); setError(`Book return will continue, but fine accrual failed: ${accrualError?.message||'apply the overdue-fines SQL migration.'}`); }

      const { error: returnError } = await supabase!.from('loans').update({
        returned_date: new Date().toISOString(),
        returned_to: profile.id,
        status: 'returned',
        notes: (loanRow.notes || '').trim() || returnNotes || null,
      }).eq('id', returningLoan.id);
      if (returnError) throw returnError;

      const { error: copyError } = await supabase!.from('book_copies').update({ status: 'available', condition: returnCondition || null }).eq('id', returningLoan.copy_id);
      if (copyError) throw copyError;

      const { data: bookRecord, error: bookReadError } = await supabase!.from('books').select('available_copies,total_copies').eq('id', returningLoan.book.id).single();
      if (bookReadError || !bookRecord) throw new Error('Unable to update the book availability count.');
      const nextAvailable = Math.min(Number(bookRecord.total_copies || 0), Number(bookRecord.available_copies || 0) + 1);
      const { error: bookUpdateError } = await supabase!.from('books').update({ available_copies: nextAvailable }).eq('id', returningLoan.book.id);
      if (bookUpdateError) throw bookUpdateError;

      await supabase!.from('notifications').insert({
        user_id: returningLoan.user_id,
        title: 'Book Returned',
        message: `${returningLoan.book.title} (Copy ${returningLoan.copy.copy_number}) was returned. ${fineValue > 0 ? `Overdue fine: ${formatMoney(fineValue)}.` : 'Thank you for returning it on time.'}`,
        type: 'book_returned',
        is_read: false,
      });
      await safeLogActivity({
        action: 'book_returned',
        entity_type: 'loan',
        entity_id: returningLoan.id,
        description: `Book returned: ${returningLoan.member?.full_name || returningLoan.user_id} returned ${returningLoan.book.title} (${returningLoan.copy.copy_number})`,
        user_id: profile.id,
      });

      setMessage('Book returned successfully');
      setReturningLoan(null); setReturnCondition(''); setReturnNotes('');
      await loadData();
    } catch (error: any) {
      console.error('Return book failed:', error);
      setError(error?.message || 'Unable to return this book.');
    } finally {
      setBusy(false);
    }
  };

  const handleFineState = async (fineId:string, action:'paid'|'waived') => {
    setError('');setMessage('');
    const update = action === 'paid' ? { status: 'paid', paid_at: new Date().toISOString() } : { status: 'waived', waived_at: new Date().toISOString(), waived_by: profile.id };
    const { data, error } = await supabase!.from('fines').update(update).eq('id', fineId).eq('status','pending').select('id').maybeSingle();
    if (error) { setError(error.message); return; }
    if(!data){setError('This fine is no longer pending. Refresh the ledger and try again.');await loadData();return;}
    const fine = fines.find(f => f.id === fineId);
    if (fine) {
      await supabase!.from('notifications').insert({
        user_id: fine.user_id,
        title: action === 'paid' ? 'Fine Paid' : 'Fine Waived',
        message: action === 'paid' ? `Fine of ${formatMoney(fine.amount)} has been paid.` : `Fine of ${formatMoney(fine.amount)} has been waived.`,
        type: action === 'paid' ? 'fine_paid' : 'fine_waived',
        is_read: false,
      });
      await safeLogActivity({
        action: action === 'paid' ? 'fine_paid' : 'fine_waived',
        entity_type: 'fine',
        entity_id: fineId,
        description: action === 'paid' ? `Fine paid for loan ${fine.loan_id}` : `Fine waived for loan ${fine.loan_id}`,
        user_id: profile.id,
      });
    }
    setMessage(action==='paid'?'Fine marked paid.':'Fine waived.');
    await loadData();
  };

  return <>
    <Header title={ledgerOnly?'Fine Ledger':'Issue / Return'} subtitle={ledgerOnly?'Review pending, paid and waived fines.':'Librarian circulation records and physical copy tracking.'} />
    {ledgerOnly&&<>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess" role="status">{message}</div>}<div className="statsGrid"><Stat label="Pending" value={formatMoney(fines.filter(f=>f.status==='pending').reduce((sum,f)=>sum+Number(f.amount),0))} icon={<CreditCard/>} kind="orange"/><Stat label="Paid" value={formatMoney(fines.filter(f=>f.status==='paid').reduce((sum,f)=>sum+Number(f.amount),0))} icon={<CheckCircle2/>} kind="green"/><Stat label="Waived" value={formatMoney(fines.filter(f=>f.status==='waived').reduce((sum,f)=>sum+Number(f.amount),0))} icon={<ShieldCheck/>} kind="purple"/></div></>}
    <div hidden={ledgerOnly}>
    <div className="circulationShell">
      <div className="panel formPanel">
        <h3>Issue Book</h3>
        <div className="formGrid">
          <label>Search student<input value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Name / College ID / Email" /></label>
          <label>Department<select value={memberDepartmentFilter} onChange={e=>setMemberDepartmentFilter(e.target.value)}><option value="all">All departments</option>{Array.from(new Set(departments.map((dept) => dept.name || dept.code || dept.id))).sort().map((dept) => <option key={dept} value={dept}>{dept}</option>)}</select></label>
          <label>Year<select value={memberYearFilter} onChange={e=>setMemberYearFilter(e.target.value)}><option value="all">All years</option>{YEAR_OPTIONS.map((item) => <option key={item.value} value={String(item.value)}>{item.label}</option>)}</select></label>
          <label>Member<select value={memberId} onChange={e=>setMemberId(e.target.value)}><option value="">Select member</option>{filteredMembers.map(m => <option key={m.id} value={m.id}>{m.full_name || m.email} · {m.college_id || m.email} · {getDepartmentName(m.department_id, departments)} · {getYearLabel(m.year_of_study)}</option>)}</select></label>
          <label>Search book<input value={bookSearch} onChange={e=>setBookSearch(e.target.value)} placeholder="Title / ISBN / Accession / Author" /></label>
          <label>Book<select value={bookId} onChange={e=>setBookId(e.target.value)}><option value="">Select book</option>{filteredBookList.map(b => <option key={b.id} value={b.id}>{b.title} · {b.accession_code} · {b.isbn || 'No ISBN'}</option>)}</select></label>
          <label>Physical Copy<select value={copyId} onChange={e=>setCopyId(e.target.value)}><option value="">Select available copy</option>{availableCopies.map(c => <option key={c.id} value={c.id}>{c.copy_number} · Shelf: {c.shelf_number || 'N/A'} · Rack: {c.rack_number || 'N/A'} · Status: Available</option>)}</select></label>
          <label>Issue Date<input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></label>
          <label>Due Date<input type="date" value={dueDate} onChange={e=>{setDueDate(e.target.value);setDueDateTouched(true);}} /></label>
          <label className="full">Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional issue notes" /></label>
        </div>
        {selectedMember && <div className="issueSummary"><strong>Student:</strong> {selectedMember.full_name || selectedMember.email}<br /><strong>College ID:</strong> {selectedMember.college_id || '—'}<br /><strong>Department:</strong> {getDepartmentName(selectedMember.department_id, departments)}<br /><strong>Year:</strong> {getYearLabel(selectedMember.year_of_study)}<br /><strong>Active loans:</strong> {selectedMemberLoans.length}<br /><strong>Pending fines:</strong> {selectedMemberPendingFines.length}<br /><strong>Account status:</strong> {selectedMember.is_active ? 'Active' : 'Inactive'}</div>}
        {selectedMember && selectedBook && <div className="issueSummary"><strong>Book:</strong> {selectedBook.title} ({selectedBook.accession_code})<br /><strong>Available copies:</strong> {selectedBook.available_copies}</div>}
        <button className="primary wide" onClick={handleIssue} disabled={!canIssue || busy}>{busy ? 'Issuing...' : 'Issue Book'}</button>
        {error && <div className="authError" role="alert"><FriendlyError message={error}/></div>}
        {message && <div className="authSuccess">{message}</div>}
      </div>

      <div className="panel">
        <div className="panelHead"><h3>Active Loans</h3><div className="inlineControls"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search loans..." /><select value={filter} onChange={e=>setFilter(e.target.value as any)}><option value="all">All</option><option value="active">Active</option><option value="due_today">Due Today</option><option value="overdue">Overdue</option><option value="returned">Returned</option></select></div></div>
        {filter !== 'returned' && <div className="tablePanel compactTable"><table><thead><tr><th>Member</th><th>Book</th><th>Copy</th><th>Issue Date</th><th>Due Date</th><th>Days Remaining</th><th>Status</th><th>Action</th></tr></thead><tbody>{activeLoans.length ? activeLoans.map(loan => <tr key={loan.id}><td>{loan.member?.full_name || loan.member?.email || '—'}</td><td>{loan.book?.title || '—'}</td><td>{loan.copy?.copy_number || '—'}</td><td>{formatDate(loan.issue_date)}</td><td>{formatDate(loan.due_date)}</td><td>{getLoanDaysText(loan)}</td><td><span className={'status '+loan.status}>{loan.status === 'overdue' ? 'Overdue' : loan.status === 'due_today' ? 'Due Today' : 'Active'}</span></td><td><div className="inlineActions"><button className="outline smallBtn" onClick={() => setReturningLoan(loan)}>Return</button></div></td></tr>) : <tr><td colSpan={8}>No active loans match this filter.</td></tr>}</tbody></table></div>}
      </div>
    </div>

    {(filter === 'all' || filter === 'returned') && <div className="panel panelTopGap">
      <div className="panelHead"><h3>Loan History</h3>{filter === 'all' && <span>{returnedLoans.length} returned</span>}</div>
      <div className="tablePanel compactTable"><table><thead><tr><th>Member</th><th>Book</th><th>Copy</th><th>Issue Date</th><th>Due Date</th><th>Returned Date</th><th>Status</th></tr></thead><tbody>{returnedLoans.length ? returnedLoans.map(loan => <tr key={loan.id}><td>{loan.member?.full_name || loan.member?.email || '—'}</td><td>{loan.book?.title || '—'}</td><td>{loan.copy?.copy_number || '—'}</td><td>{formatDate(loan.issue_date)}</td><td>{formatDate(loan.due_date)}</td><td>{formatDate(loan.returned_date)}</td><td><span className="status returned">Returned</span></td></tr>) : <tr><td colSpan={7}>No returned loans match this filter.</td></tr>}</tbody></table></div>
    </div>}

    </div>
    <div className="panel panelTopGap">
      <div className="panelHead"><h3>Fine Ledger</h3><div className="inlineControls"><input value={fineSearch} onChange={event=>setFineSearch(event.target.value)} placeholder="Search student, College ID or book..."/><select value={fineStatusFilter} onChange={event=>setFineStatusFilter(event.target.value as typeof fineStatusFilter)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option></select></div></div>
      <div className="tablePanel compactTable"><table><thead><tr><th>Student</th><th>College ID</th><th>Department</th><th>Year</th><th>Book</th><th>Amount</th><th>Reason</th><th>Issued Date</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredFines.map(fine => { const loan=loans.find(item=>item.id===fine.loan_id); const member=memberMap[fine.user_id]; const copy=loan?copies.find(item=>item.id===loan.copy_id):null; const book=copy?bookMap[copy.book_id]:null; return <tr key={fine.id}><td>{member?.full_name||member?.email||'—'}</td><td>{member?.college_id||'—'}</td><td>{getDepartmentName(member?.department_id,departments)}</td><td>{getYearLabel(member?.year_of_study)}</td><td>{book?.title||'—'}</td><td>{formatMoney(Number(fine.amount))}</td><td>{fine.reason}</td><td>{formatDate(fine.accrual_date||fine.issued_at)}</td><td><span className={'status '+(fine.status==='pending'?'waiting':fine.status==='paid'?'active':'cancelled')}>{fine.status}</span></td><td><div className="inlineActions">{fine.status==='pending'&&<button className="outline smallBtn" onClick={()=>handleFineState(fine.id,'paid')}>Mark as Paid</button>}{fine.status==='pending'&&<button className="ghost smallBtn" onClick={()=>handleFineState(fine.id,'waived')}>Waive Fine</button>}</div></td></tr>; })}</tbody></table></div>
    </div>

    {returningLoan && <DialogBackdrop onClose={()=>setReturningLoan(null)}><div className="modal formModal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setReturningLoan(null)}>×</button><h2>Return this book?</h2><p><strong>Member:</strong> {returningLoan.member?.full_name || returningLoan.member?.email}<br /><strong>Book:</strong> {returningLoan.book?.title || '—'}<br /><strong>Copy:</strong> {returningLoan.copy?.copy_number || '—'}<br /><strong>Due date:</strong> {formatDate(returningLoan.due_date)}</p>
      {(() => { const overdueDays = calculateOverdueDays(returningLoan.due_date, new Date().toISOString().slice(0,10)); const fine = overdueDays > 0 ? overdueDays * fineRate : 0; return overdueDays > 0 ? <div className="issueSummary"><strong>Overdue:</strong> {overdueDays} days<br /><strong>Fine:</strong> {formatMoney(fine)}</div> : null; })()}
      <div className="formGrid"><label>Return condition<input value={returnCondition} onChange={e=>setReturnCondition(e.target.value)} placeholder="Good / Minor wear / Damaged" /></label><label className="full">Return notes<textarea value={returnNotes} onChange={e=>setReturnNotes(e.target.value)} placeholder="Optional return notes" /></label></div>
      <button className="primary wide" onClick={handleReturn} disabled={busy}>Confirm Return</button>
    </div></DialogBackdrop>}
  </>;
}

function Reservations({profile,admin}:{profile:Profile;admin:boolean}){
  const [rows,setRows]=useState<Reservation[]>([]);
  const [books,setBooks]=useState<Book[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const [departments,setDepartments]=useState<Department[]>([]);
  const [filter,setFilter]=useState<'all'|'pending'|'ready'|'fulfilled'|'cancelled'|'expired'>('all');
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState('');
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');

  const load=async()=>{
    setLoading(true);
    const reservationQuery=supabase!.from('reservations').select('*').order('reserved_at',{ascending:true});
    if(!admin) reservationQuery.eq('user_id',profile.id);
    const [booksRes,membersRes,departmentsRes,reservationsRes]=await Promise.all([
      supabase!.from('books').select('*'),
      supabase!.from('profiles').select('*'),
      supabase!.from('departments').select('*'),
      reservationQuery,
    ]);
    const loadError=booksRes.error||membersRes.error||departmentsRes.error||reservationsRes.error;
    setError(loadError?.message||'');
    setBooks((booksRes.data||[]) as Book[]);
    setMembers((membersRes.data||[]) as Profile[]);
    setDepartments((departmentsRes.data||[]) as Department[]);
    setRows((reservationsRes.data||[]) as Reservation[]);
    setLoading(false);
  };

  useEffect(()=>{void load();},[profile.id,admin]);

  const memberMap=useMemo(()=>Object.fromEntries(members.map(member=>[member.id,member])),[members]);
  const bookMap=useMemo(()=>Object.fromEntries(books.map(book=>[book.id,book])),[books]);
  const filteredRows=rows.filter(reservation=>{
    const member=memberMap[reservation.user_id];
    const book=bookMap[reservation.book_id];
    const searchText=`${member?.full_name||''} ${member?.college_id||''} ${member?.email||''} ${book?.title||''} ${book?.isbn||''}`.toLowerCase();
    return (filter==='all'||reservation.status===filter)&&searchText.includes(query.trim().toLowerCase());
  });

  const updateStatus=async(reservation:Reservation,nextStatus:'ready'|'fulfilled'|'cancelled'|'expired')=>{
    setError('');setMessage('');setBusyId(reservation.id);
    const {error:transitionError}=await supabase!.rpc('transition_reservation',{
      p_reservation_id:reservation.id,
      p_status:nextStatus,
    });
    if(transitionError){setError(transitionError.message||'Unable to update reservation status.');setBusyId('');return;}
    setMessage(`Reservation marked ${nextStatus}.`);
    await load();
    setBusyId('');
  };

  const cancelOwnReservation=async(reservation:Reservation)=>{
    setError('');setMessage('');setBusyId(reservation.id);
    const {error:cancelError}=await supabase!.rpc('cancel_own_reservation',{p_reservation_id:reservation.id});
    if(cancelError){setError(cancelError.message||'Unable to cancel this reservation.');setBusyId('');return;}
    setMessage('Reservation cancelled.');
    await load();setBusyId('');
  };

  const canMarkReady=(reservation:Reservation)=>{
    const book=bookMap[reservation.book_id];
    if(reservation.status!=='pending'||!book)return false;
    const sameBookQueue=rows.filter(row=>row.book_id===reservation.book_id&&(row.status==='pending'||row.status==='ready'));
    const earlierPending=sameBookQueue.some(row=>row.status==='pending'&&row.queue_position!==null&&reservation.queue_position!==null&&row.queue_position<reservation.queue_position);
    const readyHolds=sameBookQueue.filter(row=>row.status==='ready'&&(!row.expires_at||new Date(row.expires_at).getTime()>Date.now())).length;
    return !earlierPending&&book.available_copies>readyHolds;
  };

  return <><Header title="Reservations" subtitle={admin?'Manage the live reservation queue.':'Track your live reservations.'} action={<button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>}/>
    {admin&&<div className="searchPanel"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search student, College ID, email, book or ISBN..."/><select value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="ready">Ready</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></div>}
    {error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}
    <div className="tablePanel"><table><thead><tr>{admin&&<><th>Student</th><th>College ID</th><th>Department</th><th>Year</th><th>Email</th></>}<th>Book</th>{admin&&<th>ISBN</th>}<th>Reserved</th><th>Queue</th><th>Status</th><th>Ready date</th><th>Expiry date</th><th>Actions</th></tr></thead><tbody>{loading?<tr><td colSpan={admin?13:7}>Loading reservations...</td></tr>:filteredRows.length?filteredRows.map(reservation=>{
      const book=bookMap[reservation.book_id];
      const member=memberMap[reservation.user_id];
      return <tr key={reservation.id}>{admin&&<><td>{member?.full_name||'—'}</td><td>{member?.college_id||'—'}</td><td>{getDepartmentName(member?.department_id,departments)}</td><td>{getYearLabel(member?.year_of_study)}</td><td>{member?.email||'—'}</td></>}<td>{book?.title||reservation.book_id}</td>{admin&&<td>{book?.isbn||'—'}</td>}<td>{formatDate(reservation.reserved_at)}</td><td>{reservation.queue_position??'—'}</td><td><span className={'status '+reservation.status}>{reservation.status}</span></td><td>{formatDate(reservation.ready_at)}</td><td>{formatDate(reservation.expires_at)}</td><td><div className="inlineActions">{admin&&reservation.status==='pending'&&<button className="smallBtn outline" disabled={!canMarkReady(reservation)||busyId===reservation.id} onClick={()=>void updateStatus(reservation,'ready')}>Mark Ready</button>}{admin&&reservation.status==='ready'&&<button className="smallBtn outline" disabled={busyId===reservation.id} onClick={()=>void updateStatus(reservation,'fulfilled')}>Fulfill</button>}{admin&&(reservation.status==='pending'||reservation.status==='ready')&&<button className="smallBtn outline" disabled={busyId===reservation.id} onClick={()=>void updateStatus(reservation,'cancelled')}>Cancel</button>}{admin&&reservation.status==='ready'&&reservation.expires_at&&new Date(reservation.expires_at).getTime()<=Date.now()&&<button className="smallBtn ghost" disabled={busyId===reservation.id} onClick={()=>void updateStatus(reservation,'expired')}>Expire</button>}{!admin&&reservation.status==='pending'&&<button className="smallBtn outline" disabled={busyId===reservation.id} onClick={()=>void cancelOwnReservation(reservation)}>Cancel</button>}</div></td></tr>;
    }):<tr><td colSpan={admin?13:7}>No reservations match this view.</td></tr>}</tbody></table></div>
  </>;
}

function MyBooks({profile}:{profile:Profile}){
  const [rows,setRows]=useState<any[]>([]);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busyId,setBusyId]=useState('');
  const [loading,setLoading]=useState(true);
  const load=async()=>{
    setLoading(true);setError('');
    const {data,error:loanError}=await supabase!.from('loans').select('*').eq('user_id',profile.id).order('issue_date',{ascending:false});
    if(loanError){setError(loanError.message);setLoading(false);return;}
    const loanRows=(data||[]) as Loan[];
    const enriched=await Promise.all(loanRows.map(async loan=>{
      const {data:copyData}=await supabase!.from('book_copies').select('*').eq('id',loan.copy_id).maybeSingle();
      const copy=copyData as BookCopy|null;
      const {data:bookData}=copy?await supabase!.from('books').select('*').eq('id',copy.book_id).maybeSingle():{data:null};
      return {...loan,copy,book:bookData as Book|null};
    }));
    setRows(enriched);setLoading(false);
  };
  useEffect(()=>{
    void load();
  }, [profile.id]);
  const renew=async(loanId:string)=>{
    setBusyId(loanId);setError('');setMessage('');
    const {data,error:renewError}=await supabase!.rpc('renew_loan',{p_loan_id:loanId});
    if(renewError)setError(renewError.message||'Unable to renew this loan.');
    else setMessage(`Loan renewed until ${formatDate(data)}.`);
    await load();setBusyId('');
  };
  return <><Header title="My Books" subtitle="Your live borrowing history and due dates." action={<button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>}/>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}<div className="tablePanel"><table><thead><tr><th>Book</th><th>Copy</th><th>Issued</th><th>Due</th><th>Status</th><th>Days</th><th>Action</th></tr></thead><tbody>{loading?<tr><td colSpan={7}>Loading loans...</td></tr>:rows.length?rows.map((loan:any)=>{const status=getDisplayLoanStatus(loan);return <tr key={loan.id}><td>{loan.book?.title||'—'}</td><td>{loan.copy?.copy_number||'—'}</td><td>{formatDate(loan.issue_date)}</td><td>{formatDate(loan.due_date)}</td><td><span className={'status '+status}>{status==='due_today'?'Due today':status}</span></td><td>{getLoanDaysText(loan)}</td><td>{status==='active'&&<button className="outline smallBtn" disabled={busyId===loan.id} onClick={()=>void renew(loan.id)}>{busyId===loan.id?'Renewing...':'Renew'}</button>}</td></tr>}):<tr><td colSpan={7}>No loans recorded.</td></tr>}</tbody></table></div></>;
}
function Fines({profile}:{profile:Profile}){
 const [rows,setRows]=useState<Fine[]>([]);
 const [loans,setLoans]=useState<Loan[]>([]);
 const [copies,setCopies]=useState<BookCopy[]>([]);
 const [books,setBooks]=useState<Book[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
   const load=async()=>{
     try{await accrueOverdueFines()}catch(accrualError:any){setError(accrualError?.message||'Unable to refresh overdue fines.');}
     const [fineRes,loanRes,copyRes,bookRes]=await Promise.all([
       supabase!.from('fines').select('*').eq('user_id',profile.id).order('issued_at',{ascending:false}),
       supabase!.from('loans').select('*').eq('user_id',profile.id).order('issue_date',{ascending:false}),
       supabase!.from('book_copies').select('*').order('copy_number'),
       supabase!.from('books').select('*'),
     ]);
     if(fineRes.error||loanRes.error||copyRes.error||bookRes.error)setError(fineRes.error?.message||loanRes.error?.message||copyRes.error?.message||bookRes.error?.message||'Unable to load fines.');
     setRows((fineRes.data||[]) as Fine[]);
     setLoans((loanRes.data||[]) as Loan[]);
     setCopies((copyRes.data||[]) as BookCopy[]);
     setBooks((bookRes.data||[]) as Book[]);
     setLoading(false);
   };
   void load();
 },[profile.id]);
 const copyMap=Object.fromEntries(copies.map(copy=>[copy.id,copy]));
 const bookMap=Object.fromEntries(books.map(book=>[book.id,book]));
 const loanMap=Object.fromEntries(loans.map(loan=>[loan.id,loan]));
 return <><Header title="Fines & Payments" subtitle="Your current fines and payment history."/>
   <div className="fineTotal"><div><small>Total pending fine</small><h2>{formatMoney(rows.filter(fine=>fine.status==='pending').reduce((sum,fine)=>sum+Number(fine.amount),0))}</h2></div><CreditCard size={42}/></div>
   {error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}
  <div className="tablePanel"><table><thead><tr><th>Book</th><th>Amount</th><th>Reason</th><th>Status</th><th>Date</th><th>Notes</th></tr></thead><tbody>{loading?<tr><td colSpan={6}>Loading fines...</td></tr>:rows.length?rows.map(fine=>{const loan=fine.loan_id?loanMap[fine.loan_id]:null;const copy=loan?copyMap[loan.copy_id]:null;const book=copy?bookMap[copy.book_id]:null;return <tr key={fine.id}><td>{book?.title||'—'}</td><td>{formatMoney(Number(fine.amount))}</td><td>{fine.reason}</td><td><span className={'status '+(fine.status==='pending'?'waiting':fine.status==='paid'?'active':'cancelled')}>{fine.status}</span></td><td>{formatDate(fine.accrual_date||fine.issued_at)}</td><td>{fine.notes||'—'}</td></tr>}):<tr><td colSpan={6}>No fines recorded.</td></tr>}</tbody></table></div>
 </>;
}
function Notifications({profile,admin}:{profile:Profile;admin:boolean}){
 const [rows,setRows]=useState<Notification[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [unreadOnly,setUnreadOnly]=useState(false);
 const [title,setTitle]=useState('');
 const [body,setBody]=useState('');
 const [target,setTarget]=useState('all');
 const [busy,setBusy]=useState(false);
 const load=async()=>{
   setLoading(true);setError('');
   let request=supabase!.from('notifications').select('*').order('created_at',{ascending:false}).limit(500);
   if(!admin)request=request.eq('user_id',profile.id);
   if(unreadOnly)request=request.eq('is_read',false);
   const {data,error:loadError}=await request;
   if(loadError)setError(loadError.message);
   setRows((data||[]) as Notification[]);setLoading(false);
 };
 useEffect(()=>{void load();},[profile.id,admin,unreadOnly]);
 const markRead=async(id:string)=>{
   const {error:readError}=await supabase!.from('notifications').update({is_read:true}).eq('id',id);
   if(readError)setError(readError.message);else await load();
 };
 const markAllRead=async()=>{
   let request=supabase!.from('notifications').update({is_read:true}).eq('is_read',false);
   if(!admin)request=request.eq('user_id',profile.id);
   const {error:readError}=await request;
   if(readError)setError(readError.message);else await load();
 };
 const sendAnnouncement=async()=>{
   setError('');setMessage('');setBusy(true);
   const {data,error:sendError}=await supabase!.rpc('send_library_announcement',{p_title:title,p_message:body,p_target_role:target});
   if(sendError)setError(sendError.message);else{setMessage(`Announcement sent to ${Number(data||0)} users.`);setTitle('');setBody('');}
   setBusy(false);
 };
 return <><Header title="Notifications" subtitle={admin?'Library notifications and announcements.':'Your library updates.'} action={<div className="inlineControls"><label><input type="checkbox" checked={unreadOnly} onChange={event=>setUnreadOnly(event.target.checked)}/> Unread only</label><button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button><button className="outline" onClick={()=>void markAllRead()}>Mark all read</button></div>}/>
   {admin&&<div className="panel"><div className="panelHead"><h3>Send announcement</h3></div><div className="formGrid"><label>Audience<select value={target} onChange={event=>setTarget(event.target.value)}><option value="all">Students and faculty</option><option value="student">Students</option><option value="faculty">Faculty</option></select></label><label>Title<input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Announcement title"/></label><label className="full">Message<textarea value={body} onChange={event=>setBody(event.target.value)} placeholder="Write the library announcement..."/></label></div><button className="primary" disabled={busy||!title.trim()||!body.trim()} onClick={()=>void sendAnnouncement()}>{busy?'Sending...':'Send announcement'}</button></div>}
   {error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}
   <div className="noticeList">{loading?<p>Loading notifications...</p>:rows.length?rows.map(notification=><div className={'noticeRow '+(!notification.is_read?'unread':'')} key={notification.id}><div className="noticeIcon info"><Bell/></div><div><b>{notification.title}</b><p>{notification.message}</p><small>{new Date(notification.created_at).toLocaleString()}</small></div>{!notification.is_read&&<button className="outline smallBtn" onClick={()=>void markRead(notification.id)}>Mark read</button>}</div>):<div className="panel">No notifications to show.</div>}</div>
 </>;
}
function Resources({profile,admin}:{profile:Profile;admin:boolean}){
 const [rows,setRows]=useState<LibraryResource[]>([]);
 const [query,setQuery]=useState('');
 const [typeFilter,setTypeFilter]=useState('all');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [showForm,setShowForm]=useState(false);
 const [editing,setEditing]=useState<LibraryResource|null>(null);
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [resourceType,setResourceType]=useState('link');
 const [url,setUrl]=useState('');
 const [busy,setBusy]=useState(false);
 const load=async()=>{
   setLoading(true);setError('');
   let request=supabase!.from('library_resources').select('*').order('created_at',{ascending:false});
   if(!admin)request=request.eq('is_active',true);
   const {data,error:loadError}=await request;
   if(loadError)setError(loadError.message);
   setRows((data||[]) as LibraryResource[]);setLoading(false);
 };
 useEffect(()=>{void load();},[admin]);
 const beginAdd=()=>{setEditing(null);setTitle('');setDescription('');setResourceType('link');setUrl('');setError('');setShowForm(true);};
 const beginEdit=(resource:LibraryResource)=>{setEditing(resource);setTitle(resource.title);setDescription(resource.description||'');setResourceType(resource.resource_type);setUrl(resource.url);setError('');setShowForm(true);};
 const save=async()=>{
   if(!title.trim()||!url.trim()){setError('Title and URL are required.');return;}
   setBusy(true);setError('');setMessage('');
   const payload={title:title.trim(),description:description.trim()||null,resource_type:resourceType,url:url.trim()};
   const result=editing
     ?await supabase!.from('library_resources').update(payload).eq('id',editing.id)
     :await supabase!.from('library_resources').insert({...payload,created_by:profile.id,is_active:true});
   if(result.error)setError(result.error.message);
   else{setShowForm(false);setMessage(editing?'Resource updated.':'Resource added.');await load();}
   setBusy(false);
 };
 const toggleArchive=async(resource:LibraryResource)=>{
   const {error:saveError}=await supabase!.from('library_resources').update({is_active:!resource.is_active}).eq('id',resource.id);
   if(saveError)setError(saveError.message);else await load();
 };
 const filtered=rows.filter(resource=>{
   const matches=`${resource.title} ${resource.description||''} ${resource.resource_type}`.toLowerCase().includes(query.trim().toLowerCase());
   return matches&&(typeFilter==='all'||resource.resource_type===typeFilter);
 });
 const types=Array.from(new Set(rows.map(resource=>resource.resource_type))).sort();
 return <><Header title="Library Resources" subtitle={admin?'Manage live library links and digital resources.':'Browse library links and digital resources.'} action={<div className="inlineActions"><button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>{admin&&<button className="primary" onClick={beginAdd}><Plus size={16}/> Add resource</button>}</div>}/>
   <div className="searchPanel"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search resources..."/><select value={typeFilter} onChange={event=>setTypeFilter(event.target.value)}><option value="all">All types</option>{types.map(type=><option value={type} key={type}>{type}</option>)}</select></div>
   {error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}
   {loading?<LoadingSkeleton/>:filtered.length?<div className="academicResourceGrid">{filtered.map(resource=><article className="academicResource" key={resource.id}><div className="resourceHeading"><span className="resourceGlyph"><Library size={22}/></span><span className="tag">{resource.resource_type}</span><span className={'status '+(resource.is_active?'active':'cancelled')}>{resource.is_active?'Active':'Archived'}</span></div><h3>{resource.title}</h3><p>{resource.description||'Open this resource to explore the material.'}</p><small>Added {formatDate(resource.created_at)}</small><div className="resourceActions"><a className="outline" href={resource.url} target="_blank" rel="noreferrer"><Download size={15}/> Open / Download</a>{admin&&<div className="inlineActions"><button className="ghost smallBtn" onClick={()=>beginEdit(resource)}>Edit</button><button className="ghost smallBtn" onClick={()=>void toggleArchive(resource)}>{resource.is_active?'Archive':'Reactivate'}</button></div>}</div></article>)}</div>:<EmptyState title="No resources found" description="Try another search or resource type."/>}
   {showForm&&<DialogBackdrop onClose={()=>setShowForm(false)}><div className="modal formModal" onClick={event=>event.stopPropagation()}><button className="close" onClick={()=>setShowForm(false)}>×</button><h2>{editing?'Edit resource':'Add resource'}</h2><div className="formGrid"><label>Title<input value={title} onChange={event=>setTitle(event.target.value)} required/></label><label>Type<select value={resourceType} onChange={event=>setResourceType(event.target.value)}><option value="link">Link</option><option value="ebook">E-book</option><option value="journal">Journal</option><option value="exam">Exam resource</option><option value="database">Database</option><option value="document">Document</option></select></label><label className="full">URL<input type="url" value={url} onChange={event=>setUrl(event.target.value)} placeholder="https://..." required/></label><label className="full">Description<textarea value={description} onChange={event=>setDescription(event.target.value)}/></label></div>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}<button className="primary wide" disabled={busy||!title.trim()||!url.trim()} onClick={()=>void save()}>{busy?'Saving...':'Save resource'}</button></div></DialogBackdrop>}
 </>;
}
function ProfilePage({profile}:{profile:Profile}){
  const [departments,setDepartments]=useState<Department[]>([]);
  const [phone,setPhone]=useState(profile.phone||'');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  useEffect(() => {
    if (!supabase) return;
    const loadDepartments = async () => {
      try {
        const { data } = await supabase.from('departments').select('*').order('name');
        setDepartments((data || []) as Department[]);
      } catch {
        setDepartments([]);
      }
    };
    void loadDepartments();
  }, []);
  const savePhone=async()=>{
    setBusy(true);setError('');setMessage('');
    const {error:saveError}=await supabase!.rpc('update_my_contact',{p_phone:phone.trim()||null});
    if(saveError)setError(saveError.message);else setMessage('Contact information saved.');
    setBusy(false);
  };
  return <><Header title="Profile" subtitle="Your official college library account."/><div className="profileCard"><div className="profileAvatar">{initials(profile.full_name||profile.email)}</div><h2>{profile.full_name||'—'}</h2><p>{profile.email}</p><div className="profileDetails"><Metric label="Role" value={profile.role}/><Metric label="College ID" value={profile.college_id||'—'}/><Metric label="Department" value={getDepartmentName(profile.department_id, departments)}/><Metric label="Year of Study" value={getYearLabel(profile.year_of_study)}/><Metric label="Account" value={profile.is_active?'Active':'Inactive'}/></div><div className="inlineForm"><label>Phone<input value={phone} onChange={event=>setPhone(event.target.value)} placeholder="Optional contact number"/></label><button className="primary" disabled={busy} onClick={()=>void savePhone()}>{busy?'Saving...':'Save contact'}</button></div>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}</div></>;
}
function AnalyticsSummary(){const [stats,setStats]=useState({books:0,copies:0,members:0,loans:0,active:0,returned:0,overdue:0,fines:0});useEffect(()=>{(async()=>{
  const [booksRes,copiesRes,membersRes,loansRes,overdueRes,finesRes]=await Promise.all([
    supabase!.from('books').select('id',{count:'exact',head:true}),
    supabase!.from('book_copies').select('id',{count:'exact',head:true}),
    supabase!.from('profiles').select('id',{count:'exact',head:true}),
    supabase!.from('loans').select('*'),
    supabase!.from('loans').select('id',{count:'exact',head:true}).is('returned_date',null).lt('due_date',today()),
    supabase!.from('fines').select('id',{count:'exact',head:true}).eq('status','pending')
  ]);
  const loans=(loansRes.data||[]) as any[];
  setStats({books:booksRes.count||0,copies:copiesRes.count||0,members:membersRes.count||0,loans:loans.length,active:loans.filter(l=>l.status==='active').length,returned:loans.filter(l=>l.status==='returned').length,overdue:overdueRes.count||0,fines:finesRes.count||0});
})()},[]);return <><Header title="Reports & Analytics" subtitle="Live database metrics for library and ADSA analysis."/><div className="statsGrid"><Stat label="Total books" value={stats.books} icon={<BookOpen/>} kind="green"/><Stat label="Total copies" value={stats.copies} icon={<BookOpen/>} kind="blue"/><Stat label="Total members" value={stats.members} icon={<Users/>} kind="purple"/><Stat label="Total loans" value={stats.loans} icon={<ArrowLeftRight/>} kind="orange"/><Stat label="Active loans" value={stats.active} icon={<CheckCircle2/>} kind="green"/><Stat label="Returned loans" value={stats.returned} icon={<CheckCircle2/>} kind="blue"/><Stat label="Overdue loans" value={stats.overdue} icon={<AlertCircle/>} kind="red"/><Stat label="Pending fines" value={stats.fines} icon={<CreditCard/>} kind="red"/></div></>}

function Analytics(){return <><AnalyticsSummary/><AnalyticsADSA/></>;}

function AnalyticsADSA(){
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [data,setData]=useState({books:[] as Book[],copies:[] as BookCopy[],members:[] as Profile[],loans:[] as Loan[],reservations:[] as Reservation[],fines:[] as Fine[],categories:[] as Category[]});
 const load=async()=>{
   setLoading(true);setError('');
   try{await accrueOverdueFines();}catch(accrualError:any){setError(accrualError?.message||'Overdue data could not refresh.');}
   const [booksRes,copiesRes,membersRes,loansRes,reservationsRes,finesRes,categoriesRes]=await Promise.all([
     supabase!.from('books').select('*'),supabase!.from('book_copies').select('*'),
     supabase!.from('profiles').select('*'),supabase!.from('loans').select('*').order('issue_date',{ascending:false}),
     supabase!.from('reservations').select('*'),supabase!.from('fines').select('*'),supabase!.from('categories').select('*'),
   ]);
   const queryError=booksRes.error||copiesRes.error||membersRes.error||loansRes.error||reservationsRes.error||finesRes.error||categoriesRes.error;
   if(queryError)setError(queryError.message);
   setData({books:(booksRes.data||[]) as Book[],copies:(copiesRes.data||[]) as BookCopy[],members:(membersRes.data||[]) as Profile[],loans:(loansRes.data||[]) as Loan[],reservations:(reservationsRes.data||[]) as Reservation[],fines:(finesRes.data||[]) as Fine[],categories:(categoriesRes.data||[]) as Category[]});
   setLoading(false);
 };
 useEffect(()=>{void load();},[]);
 const copyMap=Object.fromEntries(data.copies.map(copy=>[copy.id,copy]));
 const bookMap=Object.fromEntries(data.books.map(book=>[book.id,book]));
 const memberMap=Object.fromEntries(data.members.map(member=>[member.id,member]));
 const overdueLoans=data.loans.filter(loan=>!loan.returned_date&&loan.due_date<today());
 const currentOverdueDays=overdueLoans.map(loan=>calculateOverdueDays(loan.due_date,today()));
 const returnedDurations=data.loans.filter(loan=>loan.returned_date).map(loan=>Math.max(0,Math.floor((new Date(loan.returned_date!).getTime()-new Date(`${loan.issue_date}T00:00:00`).getTime())/86400000)));
 const durationAverage=returnedDurations.length?returnedDurations.reduce((sum,days)=>sum+days,0)/returnedDurations.length:0;
 const fineTotal=(status:string)=>data.fines.filter(fine=>fine.status===status).reduce((sum,fine)=>sum+Number(fine.amount),0);
 const months=Array.from({length:12},(_,index)=>{const date=new Date();date.setDate(1);date.setMonth(date.getMonth()-(11-index));return {key:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`,label:date.toLocaleDateString('en-IN',{month:'short',year:'2-digit'})};});
 const monthly=months.map(month=>({...month,issued:data.loans.filter(loan=>loan.issue_date.slice(0,7)===month.key).length,returned:data.loans.filter(loan=>loan.returned_date?.slice(0,7)===month.key).length}));
 const weeks=Array.from({length:8},(_,index)=>{const monday=new Date();monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7)-(7-index)*7);const start=monday.toISOString().slice(0,10);const end=addDays(start,7);return {start,end,label:`${formatDate(start)} – ${formatDate(addDays(end,-1))}`,issued:data.loans.filter(loan=>loan.issue_date>=start&&loan.issue_date<end).length,returned:data.loans.filter(loan=>loan.returned_date && loan.returned_date.slice(0,10)>=start && loan.returned_date.slice(0,10)<end).length};});
 const bookLoanCounts:Record<string,number>={};
 for(const loan of data.loans){const copy=copyMap[loan.copy_id];if(copy)bookLoanCounts[copy.book_id]=(bookLoanCounts[copy.book_id]||0)+1;}
 const popularBooks=Object.entries(bookLoanCounts).map(([bookId,count])=>({book:bookMap[bookId],count})).filter((item): item is { book: Book; count: number } => Boolean(item.book)).sort((a,b)=>b.count-a.count).slice(0,10);
 const categoryStats=data.categories.map(category=>{const categoryBooks=data.books.filter(book=>book.category_id===category.id);const ids=new Set(categoryBooks.map(book=>book.id));const loans=data.loans.filter(loan=>{const copy=copyMap[loan.copy_id];return copy&&ids.has(copy.book_id);}).length;return {category:category.name,bookCount:categoryBooks.length,loans};}).sort((a,b)=>b.loans-a.loans);
 const departments:Record<string,{members:number;loans:number;reservations:number;fines:number}>={};
 for(const member of data.members){const key=getDepartmentName(member.department_id);if(key==='—')continue;departments[key]||={members:0,loans:0,reservations:0,fines:0};departments[key].members++;}
 for(const loan of data.loans){const key=getDepartmentName(memberMap[loan.user_id]?.department_id);if(departments[key])departments[key].loans++;}
 for(const reservation of data.reservations){const key=getDepartmentName(memberMap[reservation.user_id]?.department_id);if(departments[key])departments[key].reservations++;}
 for(const fine of data.fines){const key=getDepartmentName(memberMap[fine.user_id]?.department_id);if(departments[key])departments[key].fines+=Number(fine.amount);}
 const departmentRows=Object.entries(departments).sort((a,b)=>b[1].loans-a[1].loans);
 const reservationCounts={pending:data.reservations.filter(row=>row.status==='pending').length,ready:data.reservations.filter(row=>row.status==='ready').length,fulfilled:data.reservations.filter(row=>row.status==='fulfilled').length,cancelled:data.reservations.filter(row=>row.status==='cancelled').length,expired:data.reservations.filter(row=>row.status==='expired').length};
 const maxMonthly=Math.max(1,...monthly.map(month=>Math.max(month.issued,month.returned)));
 return <><Header title="ADSA Analytics" subtitle="Borrowing patterns, collection usage and library activity." action={<button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh reports</button>}/>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{loading&&<LoadingSkeleton/>}
   <div className="statsGrid"><Stat label="Issued copies" value={data.copies.filter(copy=>copy.status==='issued').length} icon={<ArrowLeftRight/>} kind="orange"/><Stat label="Overdue users" value={new Set(overdueLoans.map(loan=>loan.user_id)).size} icon={<Users/>} kind="red"/><Stat label="Average overdue days" value={currentOverdueDays.length?(currentOverdueDays.reduce((sum,days)=>sum+days,0)/currentOverdueDays.length).toFixed(1):'0'} icon={<AlertCircle/>} kind="red"/><Stat label="Average borrowing days" value={durationAverage.toFixed(1)} icon={<BookOpen/>} kind="blue"/><Stat label="Minimum borrowing days" value={returnedDurations.length?Math.min(...returnedDurations):0} icon={<CheckCircle2/>} kind="green"/><Stat label="Maximum borrowing days" value={returnedDurations.length?Math.max(...returnedDurations):0} icon={<CheckCircle2/>} kind="green"/><Stat label="Generated fines" value={formatMoney(data.fines.reduce((sum,fine)=>sum+Number(fine.amount),0))} icon={<CreditCard/>} kind="orange"/><Stat label="Pending fines" value={formatMoney(fineTotal('pending'))} icon={<CreditCard/>} kind="red"/><Stat label="Paid fines" value={formatMoney(fineTotal('paid'))} icon={<CreditCard/>} kind="green"/><Stat label="Waived fines" value={formatMoney(fineTotal('waived'))} icon={<CreditCard/>} kind="blue"/></div>
  <div className="panel trendPanel"><div className="panelHead"><h3>Monthly borrowing trend</h3><div className="chartLegend"><span>Issued</span><span>Returned</span></div></div>{monthly.map(month=><div className="bookRow" key={month.key}><div><b>{month.label}</b><small>Issued {month.issued} · Returned {month.returned}</small></div><div style={{flex:1}}><div style={{height:8,width:`${month.issued/maxMonthly*100}%`,background:'var(--primary)',borderRadius:4}}/><div style={{height:5,width:`${month.returned/maxMonthly*100}%`,background:'var(--green)',borderRadius:4,marginTop:3}}/></div></div>)}</div>
  <div className="tablePanel"><table><thead><tr><th>Recent week</th><th>Issues</th><th>Returns</th></tr></thead><tbody>{weeks.map(week=><tr key={week.start}><td>{week.label}</td><td>{week.issued}</td><td>{week.returned}</td></tr>)}</tbody></table></div>
   <div className="grid2"><div className="panel"><div className="panelHead"><h3>Popular books</h3></div><div className="tablePanel"><table><thead><tr><th>Book</th><th>Issues</th><th>Available</th></tr></thead><tbody>{popularBooks.length?popularBooks.map(item=><tr key={item.book!.id}><td>{item.book!.title}</td><td>{item.count}</td><td>{item.book!.available_copies}</td></tr>):<tr><td colSpan={3}>No loan history yet.</td></tr>}</tbody></table></div></div><div className="panel"><div className="panelHead"><h3>Popular categories</h3></div><div className="tablePanel"><table><thead><tr><th>Category</th><th>Books</th><th>Loans</th></tr></thead><tbody>{categoryStats.map(row=><tr key={row.category}><td>{row.category}</td><td>{row.bookCount}</td><td>{row.loans}</td></tr>)}</tbody></table></div></div></div>
   <div className="grid2"><div className="panel"><div className="panelHead"><h3>Reservation analysis</h3></div><div className="metricGrid"><Metric label="Total" value={data.reservations.length}/><Metric label="Pending" value={reservationCounts.pending}/><Metric label="Ready" value={reservationCounts.ready}/><Metric label="Fulfilled" value={reservationCounts.fulfilled}/><Metric label="Cancelled" value={reservationCounts.cancelled}/><Metric label="Expired" value={reservationCounts.expired}/></div></div><div className="panel"><div className="panelHead"><h3>Department usage</h3></div><div className="tablePanel"><table><thead><tr><th>Department</th><th>Members</th><th>Loans</th><th>Reservations</th><th>Fine amount</th></tr></thead><tbody>{departmentRows.length?departmentRows.map(([name,stats])=><tr key={name}><td>{name}</td><td>{stats.members}</td><td>{stats.loans}</td><td>{stats.reservations}</td><td>{formatMoney(stats.fines)}</td></tr>):<tr><td colSpan={5}>No department-linked activity.</td></tr>}</tbody></table></div></div></div>
 </>;
}
function Categories(){
  const [rows,setRows]=useState<Category[]>([]);
  const [name,setName]=useState('');
  const [query,setQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState<'all'|'active'|'inactive'>('all');
  const [books,setBooks]=useState<Book[]>([]);
  const [editing,setEditing]=useState<Category|null>(null);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(true);
  const load = async ()=>{
    setLoading(true);setError('');
    const [categoryRes,bookRes]=await Promise.all([supabase!.from('categories').select('*').order('name'),supabase!.from('books').select('id,category_id')]);
    if(categoryRes.error||bookRes.error)setError(categoryRes.error?.message||bookRes.error?.message||'Unable to load categories.');
    setRows((categoryRes.data||[]) as Category[]);setBooks((bookRes.data||[]) as Book[]);setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const save=async()=>{
    if(!name.trim()){setError('Category name is required.');return;}
    setError('');setMessage('');
    const result=editing?await supabase!.from('categories').update({name:name.trim()}).eq('id',editing.id):await supabase!.from('categories').insert({name:name.trim()});
    if(result.error)setError(result.error.message);else{setName('');setEditing(null);setMessage(editing?'Category updated.':'Category added.');await load();}
  };
  const toggle=async(category:Category)=>{
    const active=(category as Category&{is_active?:boolean}).is_active!==false;
    const {error:saveError}=await supabase!.from('categories').update({is_active:!active}).eq('id',category.id);
    if(saveError)setError(saveError.message);else await load();
  };
  const filtered=rows.filter(category=>{
    const active=(category as Category&{is_active?:boolean}).is_active!==false;
    return `${category.name} ${category.description||''}`.toLowerCase().includes(query.trim().toLowerCase())&&(statusFilter==='all'||(statusFilter==='active'?active:!active));
  });
  return <><Header title="Categories" subtitle="Manage active catalogue categories." action={<button className="ghost" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button>}/>
    <div className="searchPanel"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search categories..."/><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Archived</option></select></div>
    <div className="panel"><div className="inlineForm"><input value={name} onChange={event=>setName(event.target.value)} placeholder={editing?'Edit category name':'New category'}/><button className="primary" onClick={()=>void save()}>{editing?'Save category':<><Plus size={16}/> Add category</>}</button>{editing&&<button className="ghost" onClick={()=>{setEditing(null);setName('');}}>Cancel</button>}</div>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}</div>
    {loading?<LoadingSkeleton/>:filtered.length?<div className="tablePanel"><table><thead><tr><th>Category</th><th>Description</th><th>Books</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(category=>{const active=(category as Category&{is_active?:boolean}).is_active!==false;const count=books.filter(book=>book.category_id===category.id).length;return <tr key={category.id}><td>{category.name}</td><td>{category.description||'—'}</td><td>{count}</td><td>{active?'Active':'Archived'}</td><td><div className="inlineActions"><button className="outline smallBtn" onClick={()=>{setEditing(category);setName(category.name);setMessage('');}}>Edit</button><button className="ghost smallBtn" disabled={count>0&&active} onClick={()=>void toggle(category)}>{active?'Archive':'Reactivate'}</button></div></td></tr>})}</tbody></table></div>:<div className="panel">No categories match this view.</div>}
  </>;
}
function SettingsPage(){
 const [fineRate,setFineRate]=useState(String(DEFAULT_FINE_RATE));
 const [loanDuration,setLoanDuration]=useState('14');
 const [maxRenewals,setMaxRenewals]=useState('1');
 const [pickupWindow,setPickupWindow]=useState('3');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 useEffect(()=>{void supabase!.from('library_settings').select('key,value').in('key',['daily_fine_rate','default_loan_duration_days','maximum_renewal_count','reservation_pickup_window_days']).then(({data})=>{
   for(const setting of data||[]){const value=String(setting.value).replace(/^"|"$/g,'');if(setting.key==='daily_fine_rate')setFineRate(value);if(setting.key==='default_loan_duration_days')setLoanDuration(value);if(setting.key==='maximum_renewal_count')setMaxRenewals(value);if(setting.key==='reservation_pickup_window_days')setPickupWindow(value);}
 });},[]);
 const saveSettings=async()=>{
   setError('');setMessage('');
   const values=[['daily_fine_rate',Number(fineRate),0.01],['default_loan_duration_days',Number(loanDuration),1],['maximum_renewal_count',Number(maxRenewals),0],['reservation_pickup_window_days',Number(pickupWindow),1]] as const;
   if(values.some(([,value,min])=>!Number.isFinite(value)||value<min)){setError('Enter valid positive settings values; maximum renewals may be zero.');return;}
   setBusy(true);
   const {error:saveError}=await supabase!.from('library_settings').upsert(values.map(([key,value])=>({key,value:String(value)})),{onConflict:'key'});
   if(saveError)setError(saveError.message);else setMessage('Library settings saved.');
   setBusy(false);
 };
 return <><Header title="Settings" subtitle="Library access and circulation rules."/><div className="panel settings"><div className="formGrid"><label>Daily overdue fine (₹/day)<input type="number" min="0.01" step="0.01" value={fineRate} onChange={event=>setFineRate(event.target.value)}/></label><label>Default loan duration (days)<input type="number" min="1" step="1" value={loanDuration} onChange={event=>setLoanDuration(event.target.value)}/></label><label>Maximum renewals<input type="number" min="0" step="1" value={maxRenewals} onChange={event=>setMaxRenewals(event.target.value)}/></label><label>Reservation pickup window (days)<input type="number" min="1" step="1" value={pickupWindow} onChange={event=>setPickupWindow(event.target.value)}/></label></div><button className="primary" disabled={busy} onClick={()=>void saveSettings()}>{busy?'Saving...':'Save settings'}</button>{error&&<div className="authError" role="alert"><FriendlyError message={error}/></div>}{message&&<div className="authSuccess">{message}</div>}<div className="setting"><div><b>Authentication</b><small>Supabase Auth with @kgr.ac.in restriction.</small></div><ShieldCheck/></div><div className="setting"><div><b>Database security</b><small>Row Level Security is enabled on the library tables.</small></div><ShieldCheck/></div></div></>;
}
const Metric=({label,value}:{label:string;value:string|number})=><div className="metric"><small>{label}</small><b>{value}</b></div>;

function formatDate(value:string | null | undefined){
  if(!value) return '—';
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'});
}

function formatDisplayDate(value:string){
  return new Date(value).toLocaleDateString('en-IN',{day:'2-digit',month:'2-digit',year:'numeric'});
}

function formatMoney(value:number){
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(value);
}

function today(){ return new Date().toISOString().slice(0,10); }
function addDays(value:string, days:number){ const date = new Date(value); date.setDate(date.getDate() + days); return date.toISOString().slice(0,10); }
function isValidDateInput(value:string){
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
function calculateOverdueDays(dueDate:string, asOf:string){ const due = new Date(dueDate); const todayDate = new Date(asOf); const diff = Math.ceil((todayDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)); return diff > 0 ? diff : 0; }
function getDisplayLoanStatus(loan:any){ const todayStr = today(); if (loan.status === 'returned' || loan.returned_date) return 'returned'; const due = new Date(loan.due_date); const todayDate = new Date(todayStr); const diff = Math.ceil((due.getTime() - todayDate.getTime()) / (1000*60*60*24)); if (diff < 0) return 'overdue'; if (diff === 0) return 'due_today'; return 'active'; }
function getLoanDaysText(loan:any){ const due = new Date(loan.due_date); const todayDate = new Date(today()); const diff = Math.ceil((due.getTime() - todayDate.getTime()) / (1000*60*60*24)); if (diff < 0) return `${Math.abs(diff)} days overdue`; if (diff === 0) return 'Due today'; return `${diff} days left`; }

async function getDailyFineRate(){
  try {
    const { data, error } = await supabase!.from('library_settings').select('value').eq('key','daily_fine_rate').maybeSingle();
    if (!error && data && data.value !== undefined && data.value !== null) {
      const value=Number(String(data.value).replace(/^"|"$/g,''));
      if(Number.isFinite(value)&&value>0)return value;
    }
  } catch (e) { console.warn('Fine rate lookup failed; using configured default rate.', e); }
  return DEFAULT_FINE_RATE;
}

async function accrueOverdueFines(){
  const {data,error}=await supabase!.rpc('accrue_overdue_fines');
  if(error) throw error;
  const {error:notificationError}=await supabase!.rpc('sync_loan_due_notifications');
  if(notificationError)throw notificationError;
  return Number(data||0);
}

async function safeLogActivity({ action, entity_type, entity_id, description, user_id }:{action:string; entity_type:string; entity_id:string; description:string; user_id:string}) {
  try {
    await supabase!.from('activity_logs').insert({ action, entity_type, entity_id, description, user_id, created_at: new Date().toISOString() });
  } catch (error) {
    console.warn('Activity log insert skipped:', error);
  }
}

createRoot(document.getElementById('root')!).render(<App/>);
