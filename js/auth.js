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
  try {
    // 1. Verify username uniqueness
    const { data: existingUser, error: queryError } = await supabase
      .from('customers')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (queryError) throw queryError
    if (existingUser) {
      showToast('Username already taken. Please choose another.', 'warning')
      return { success: false }
    }

    // 2. Sign up via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          mobile_number: mobileNumber,
          username: username
        }
      }
    })

    if (error) throw error

    showToast('Registration successful! Please check your email for confirmation.', 'success')
    return { success: true, data }
  } catch (err) {
    console.error('Signup error:', err)
    showToast(err.message || 'Error occurred during registration.', 'danger')
    return { success: false }
  }
}

// --- CUSTOMER LOGIN (PASSWORD) ---
async function loginCustomer(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error

    showToast('Successfully logged in!', 'success')
    return { success: true, user: data.user }
  } catch (err) {
    console.error('Login error:', err)
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
        redirectTo: window.location.origin + '/pages/dashboard.html'
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
  try {
    const isEmail = emailOrPhone.includes('@')
    if (isEmail) {
      const params = {
        token,
        type: 'email',
        email: emailOrPhone
      }
      const { data, error } = await supabase.auth.verifyOtp(params)
      if (error) throw error
      showToast('OTP verified successfully!', 'success')
      return { success: true, user: data.user }
    } else {
      // WhatsApp OTP verification via Node.js backend on localhost:5000
      const cleanPhone = emailOrPhone.replace(/^\+/, '')
      const response = await fetch('http://localhost:5000/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, otp: token, redirectTo })
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'OTP verification failed')
      }
      if (data.hashed_token) {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.hashed_token,
          type: 'email'
        })
        if (verifyError) throw verifyError
        showToast('OTP verified successfully!', 'success')
        return { success: true, user: verifyData.user }
      }
      showToast('OTP verified successfully!', 'success')
      return { success: true, action_link: data.action_link }
    }
  } catch (err) {
    console.error('OTP verification error:', err)
    showToast(err.message || 'Invalid or expired OTP token.', 'danger')
    return { success: false }
  }
}

// --- SELLER LOGIN (MANUAL CREDS) ---
function loginSeller(username, password) {
  if (
    (username === 'admin' && password === 'admin123') ||
    (username === 'Amrit' && password === 'Amrit@1972') ||
    (username === 'amrit' && password === 'amrit1972')
  ) {
    localStorage.setItem('quickmarket_seller_logged', 'true')
    showToast('Welcome, Administrator!', 'success')
    return { success: true }
  } else {
    showToast('Invalid administrator credentials.', 'danger')
    return { success: false }
  }
}

// --- CHECK SELLER AUTH STATE ---
function isSellerAuthenticated() {
  return localStorage.getItem('quickmarket_seller_logged') === 'true'
}

// --- LOGOUT HELPERS ---
async function logoutAll() {
  localStorage.removeItem('quickmarket_seller_logged')
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
