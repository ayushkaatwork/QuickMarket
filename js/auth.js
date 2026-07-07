import { supabase } from './supabase.js'

// --- TOAST HELPER ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer') || document.body
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  
  let icon = 'fa-info-circle'
  if (type === 'success') icon = 'fa-check-circle'
  if (type === 'danger') icon = 'fa-exclamation-circle'
  if (type === 'warning') icon = 'fa-triangle-exclamation'

  toast.innerHTML = `
    <i class="toast-icon fa-solid ${icon}"></i>
    <span class="toast-message">${message}</span>
  `
  container.appendChild(toast)
  
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

// --- CUSTOMER SIGNUP ---
async function signUpCustomer(email, password, fullName, mobileNumber, username) {
  console.log(`[Auth Profile] Starting customer registration for email: ${email}, username: ${username}`);
  try {
    // 1. Verify username uniqueness
    console.log(`[Auth Profile] Checking uniqueness for username: ${username}`);
    const { data: existingUser, error: queryError } = await supabase
      .from('customers')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (queryError) {
      console.error('[Auth Profile] Username verification failed:', queryError);
      throw queryError;
    }
    if (existingUser) {
      console.warn(`[Auth Profile] Username "${username}" is already taken.`);
      showToast('Username already taken. Please choose another.', 'warning')
      return { success: false }
    }

    // 2. Sign up via Supabase Auth
    const redirectUrl = window.location.origin + '/pages/customer-login.html';
    console.log(`[Auth Profile] Submitting signup to Supabase Auth. Redirect URL: ${redirectUrl}`);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          mobile_number: mobileNumber,
          username: username
        }
      }
    })

    if (error) {
      console.error('[Auth Profile] Supabase Auth signUp returned error:', error);
      throw error;
    }

    console.log('[Auth Profile] Supabase Auth signUp succeeded:', data);
    
    // Check confirmation status
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      console.warn('[Auth Profile] User signup warning: Email already registered or provider mismatch.');
    }
    
    if (data.session) {
      console.log('[Auth Profile] Session established immediately (autoconfirm enabled).');
    } else {
      console.log('[Auth Profile] Signup successful. Confirmation email pending verification.');
    }

    showToast('Registration successful! Please check your email for confirmation.', 'success')
    return { success: true, data }
  } catch (err) {
    console.error('[Auth Profile] Signup handler error catch:', err)
    showToast(err.message || 'Error occurred during registration.', 'danger')
    return { success: false }
  }
}

// --- CUSTOMER LOGIN (PASSWORD) ---
async function loginCustomer(email, password) {
  console.log(`[Auth Profile] Attempting password login for email: ${email}`);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('[Auth Profile] Supabase Auth signInWithPassword returned error:', error);
      throw error;
    }

    console.log('[Auth Profile] Supabase login succeeded for user:', data.user.id);
    showToast('Successfully logged in!', 'success')
    return { success: true, user: data.user }
  } catch (err) {
    console.error('[Auth Profile] Login handler error catch:', err)
    showToast(err.message || 'Invalid login details.', 'danger')
    return { success: false }
  }
}

// --- GOOGLE SIGN IN (OAUTH) ---
async function loginWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })

    if (error) throw error
    return { success: true }
  } catch (err) {
    console.error('Google login error:', err)
    showToast(err.message || 'Error occurred initiating Google login.', 'danger')
    return { success: false }
  }
}

// --- OTP AUTHENTICATION ---
async function sendOtp(emailOrPhone) {
  try {
    const isEmail = emailOrPhone.includes('@')
    if (isEmail) {
      const options = { email: emailOrPhone }
      const { error } = await supabase.auth.signInWithOtp(options)
      if (error) throw error
      showToast(`OTP successfully sent to ${emailOrPhone}!`, 'success')
      return { success: true }
    } else {
      // WhatsApp OTP via Node.js backend on localhost:5000
      const cleanPhone = emailOrPhone.replace(/^\+/, '')
      const response = await fetch('http://localhost:5000/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone })
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send OTP')
      }
      showToast('OTP successfully sent via WhatsApp!', 'success')
      return { success: true, otp: data.otp }
    }
  } catch (err) {
    console.error('OTP send error:', err)
    showToast(err.message || 'Failed to send OTP.', 'danger')
    return { success: false }
  }
}

async function verifyOtp(emailOrPhone, token, redirectTo) {
  console.log(`[Auth Profile] Starting OTP verification for: ${emailOrPhone}`);
  try {
    const isEmail = emailOrPhone.includes('@')
    if (isEmail) {
      const params = {
        token,
        type: 'email',
        email: emailOrPhone
      }
      console.log(`[Auth Profile] Verifying email OTP via Supabase Auth:`, params);
      const { data, error } = await supabase.auth.verifyOtp(params)
      if (error) {
        console.error('[Auth Profile] Supabase email verifyOtp returned error:', error);
        throw error;
      }
      console.log('[Auth Profile] Email OTP verified successfully. User:', data.user.id);
      showToast('OTP verified successfully!', 'success')
      return { success: true, user: data.user }
    } else {
      // WhatsApp OTP verification via Node.js backend on localhost:5000
      const cleanPhone = emailOrPhone.replace(/^\+/, '')
      console.log(`[Auth Profile] Sending WhatsApp OTP verification request to Node backend for phone: ${cleanPhone}`);
      const response = await fetch('http://localhost:5000/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, otp: token, redirectTo })
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        console.error('[Auth Profile] Backend WhatsApp OTP verification failed:', data);
        throw new Error(data.message || 'OTP verification failed')
      }
      
      console.log('[Auth Profile] Backend WhatsApp OTP verified. Response data:', data);

      if (data.hashed_token) {
        console.log('[Auth Profile] Verification returned hashed token. Logging in client-side using verifyOtp...');
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: 'email'
        })
        if (verifyError) {
          console.error('[Auth Profile] Supabase verifyOtp with hashed token failed:', verifyError);
          throw verifyError;
        }
        console.log('[Auth Profile] Hashed token verification success. User:', verifyData.user.id);
        showToast('OTP verified successfully!', 'success')
        return { success: true, user: verifyData.user }
      }
      
      console.log('[Auth Profile] Verification returned action link. Redirecting user to:', data.action_link);
      showToast('OTP verified successfully!', 'success')
      return { success: true, action_link: data.action_link }
    }
  } catch (err) {
    console.error('[Auth Profile] OTP verification handler error catch:', err)
    showToast(err.message || 'Invalid or expired OTP token.', 'danger')
    return { success: false }
  }
}

// --- SELLER LOGIN (DATABASE CREDS) ---
async function loginSeller(username, password) {
  try {
    const { data: isValid, error } = await supabase.rpc('verify_seller', {
      p_username: username,
      p_password: password
    })

    if (error) throw error

    if (isValid) {
      localStorage.setItem('apnamarket_seller_logged', 'true')
      showToast('Welcome, Administrator!', 'success')
      return { success: true }
    } else {
      showToast('Invalid administrator credentials.', 'danger')
      return { success: false }
    }
  } catch (err) {
    console.error('Seller authentication error:', err)
    showToast('Authentication failed. Database connection error.', 'danger')
    return { success: false }
  }
}

// --- CHECK SELLER AUTH STATE ---
function isSellerAuthenticated() {
  return localStorage.getItem('apnamarket_seller_logged') === 'true'
}

// --- LOGOUT HELPERS ---
async function logoutAll() {
  localStorage.removeItem('apnamarket_seller_logged')
  await supabase.auth.signOut()
  showToast('Logged out successfully.', 'info')
}

// --- USER PROFILE INJECTOR ---
async function getCustomerProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (error) throw error
    return data || {
      id: user.id,
      full_name: user.user_metadata.full_name || 'Customer',
      mobile_number: user.user_metadata.mobile_number || '',
      username: user.user_metadata.username || 'user',
      email: user.email
    }
  } catch (err) {
    console.error('Error fetching profile:', err)
    return {
      id: user.id,
      full_name: user.user_metadata.full_name || 'Customer',
      mobile_number: user.user_metadata.mobile_number || '',
      username: user.user_metadata.username || 'user',
      email: user.email
    }
  }
}

export {
  signUpCustomer,
  loginCustomer,
  loginWithGoogle,
  sendOtp,
  verifyOtp,
  loginSeller,
  isSellerAuthenticated,
  logoutAll,
  getCustomerProfile,
  showToast
}
