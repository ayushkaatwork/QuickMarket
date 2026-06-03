import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Supabase Connection Configuration
const SUPABASE_URL = 'https://yujsfdqtcsbojjukvoyg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1anNmZHF0Y3Nib2pqdWt2b3lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODM1MTEsImV4cCI6MjA5NjA1OTUxMX0.HKvJMSS8HU3syoaYWacVjqd003DnsPqbdqcvAC4cnqQ'

let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
} catch (err) {
  console.error("Failed to initialize Supabase client:", err)
}

// App State
let listings = []
let cart = JSON.parse(localStorage.getItem('quickmarket_cart')) || []
let currentCategory = 'all'
let searchQuery = ''
let currentSort = 'newest'

// DOM Elements
const productGrid = document.getElementById('productGrid')
const loadingState = document.getElementById('loadingState')
const emptyState = document.getElementById('emptyState')
const setupHelper = document.getElementById('setupHelper')
const listingTitle = document.getElementById('listingTitle')
const sortBySelect = document.getElementById('sortBy')

// Search & Filter Elements
const searchInput = document.getElementById('searchInput')
const clearSearchBtn = document.getElementById('clearSearch')
const categoryFilters = document.getElementById('categoryFilters')
const resetFiltersBtn = document.getElementById('resetFiltersBtn')

// Cart Elements
const cartBtn = document.getElementById('cartBtn')
const cartSidebar = document.getElementById('cartSidebar')
const cartOverlay = document.getElementById('sidebarOverlay')
const closeCartBtn = document.getElementById('closeCartBtn')
const cartItemsContainer = document.getElementById('cartItemsContainer')
const cartBadge = document.getElementById('cartBadge')
const cartSubtotal = document.getElementById('cartSubtotal')
const cartTotal = document.getElementById('cartTotal')
const checkoutBtn = document.getElementById('checkoutBtn')

// Modal & Form Elements
const listProductBtn = document.getElementById('listProductBtn')
const modalOverlay = document.getElementById('modalOverlay')
const closeModalBtn = document.getElementById('closeModalBtn')
const cancelFormBtn = document.getElementById('cancelFormBtn')
const sellItemForm = document.getElementById('sellItemForm')
const initializeDbBtn = document.getElementById('initializeDbBtn')

// Toast container
const toastContainer = document.getElementById('toastContainer')

// Placeholder images mapping by category
const categoryPlaceholders = {
  'Electronics': 'https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=600&q=80',
  'Fashion': 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80',
  'Home': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80',
  'Books': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
  'Other': 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=600&q=80'
}

/* ==========================================================================
   TOAST NOTIFICATION HELPER
   ========================================================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  
  let icon = 'fa-info-circle'
  if (type === 'success') icon = 'fa-check-circle'
  if (type === 'danger') icon = 'fa-exclamation-circle'
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `
  toastContainer.appendChild(toast)
  
  // Slide out after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s forwards'
    setTimeout(() => {
      toast.remove()
    }, 300)
  }, 3000)
}

/* ==========================================================================
   DATA FETCHING & SYNC
   ========================================================================== */
async function loadListings() {
  showLoading(true)
  hideErrors()
  
  if (!supabase) {
    showToast("Supabase client is not initialized.", "danger")
    showLoading(false)
    return
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')

    if (error) {
      // Check if table doesn't exist (commonly error code 'PGRST116' or message containing 'does not exist')
      if (error.message && error.message.includes('does not exist')) {
        setupHelper.style.display = 'flex'
        showToast("Table 'products' not found in database. Schema setup needed.", "danger")
      } else {
        showToast(`Database error: ${error.message}`, "danger")
      }
      listings = []
      renderListings()
    } else {
      listings = data || []
      renderListings()
    }
  } catch (err) {
    console.error("Network or client error:", err)
    showToast("Failed to connect to Supabase network.", "danger")
  } finally {
    showLoading(false)
  }
}

// Initializing the Database table via direct client insert (if table exists) or instructing the user
async function checkOrInitializeSchema() {
  // Since we cannot run SQL DDL statements (like CREATE TABLE) directly using the client-side anon key,
  // we will guide the user visually on how to create the table, or offer them the schema script.
  const sqlScript = `
-- Run this in your Supabase SQL Editor:
CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert sample premium data
INSERT INTO products (title, price, category, image_url, description) VALUES
('iPhone 15 Pro Max', 1199.99, 'Electronics', 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=600&q=80', 'Titanium finish, 256GB storage, like new condition. Original box and charger included.'),
('MacBook Pro 16" M3 Max', 3499.00, 'Electronics', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80', '128GB Unified Memory, 2TB SSD, Space Black. Extreme performance for developers and creators.'),
('Minimalist Leather Backpack', 189.50, 'Fashion', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80', 'Handcrafted top-grain leather backpack. Water-resistant lining with a 15-inch laptop sleeve.'),
('Ergonomic Mesh Office Chair', 450.00, 'Home', 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80', 'Premium lumbar support, 4D armrests, breathable mesh back. Perfect for long work-from-home hours.');
  `
  
  // We can open a popup / log it, and show an instruction alert
  console.log("%cSupabase Setup Script Required:", "color: #6366f1; font-size: 16px; font-weight: bold;")
  console.log(sqlScript)

  // Show a alert modal explaining the action
  alert(`Please run the SQL schema script in your Supabase SQL Editor. The code has been printed to your browser's Console log (F12).\n\nThis will create the 'products' table and add mock items.`);
}

/* ==========================================================================
   RENDER & FILTER UI
   ========================================================================== */
function renderListings() {
  productGrid.innerHTML = ''
  
  // 1. Apply search filter
  let filtered = listings.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = currentCategory === 'all' || item.category === currentCategory
    return matchesSearch && matchesCategory
  })

  // 2. Apply sorting
  if (currentSort === 'price-low') {
    filtered.sort((a, b) => a.price - b.price)
  } else if (currentSort === 'price-high') {
    filtered.sort((a, b) => b.price - a.price)
  } else { // default: newest
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  // 3. Show empty state if no listings
  if (filtered.length === 0) {
    emptyState.style.display = 'flex'
    productGrid.style.display = 'none'
    return
  }

  emptyState.style.display = 'none'
  productGrid.style.display = 'grid'

  filtered.forEach(item => {
    const card = document.createElement('div')
    card.className = 'product-card'
    
    const imageUrl = item.image_url || categoryPlaceholders[item.category] || categoryPlaceholders['Other']
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)

    card.innerHTML = `
      <div class="card-image-wrapper">
        <img class="card-image" src="${imageUrl}" alt="${item.title}" loading="lazy">
        <span class="card-badge-category">${item.category}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">${item.title}</h3>
        <p class="card-desc">${item.description}</p>
        <div class="card-footer">
          <span class="card-price">${formattedPrice}</span>
          <button class="btn btn-primary btn-sm add-to-cart-btn" data-id="${item.id}">
            <i class="fa-solid fa-cart-plus"></i> Add
          </button>
        </div>
      </div>
    `
    productGrid.appendChild(card)
  })

  // Bind add-to-cart buttons
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id')
      addToCart(id)
    })
  })
}

function showLoading(isLoading) {
  loadingState.style.display = isLoading ? 'flex' : 'none'
  if (isLoading) {
    productGrid.style.display = 'none'
    emptyState.style.display = 'none'
  }
}

function hideErrors() {
  setupHelper.style.display = 'none'
}

/* ==========================================================================
   SHOPPING CART LOGIC
   ========================================================================== */
function addToCart(id) {
  const item = listings.find(l => l.id === id)
  if (!item) return

  // Check if item already in cart
  const exists = cart.find(c => c.id === id)
  if (exists) {
    showToast(`"${item.title}" is already in your bag.`, 'info')
    return
  }

  cart.push(item)
  localStorage.setItem('quickmarket_cart', JSON.stringify(cart))
  updateCartUI()
  showToast(`Added "${item.title}" to your bag!`, 'success')
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id)
  localStorage.setItem('quickmarket_cart', JSON.stringify(cart))
  updateCartUI()
  showToast("Item removed from bag.", "info")
}

function updateCartUI() {
  // Update badge count
  cartBadge.textContent = cart.length
  
  // Render cart list
  cartItemsContainer.innerHTML = ''
  
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-state" style="padding: 40px 0;">
        <i class="fa-solid fa-bag-shopping" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 12px;"></i>
        <p style="color: var(--text-secondary);">Your shopping bag is empty</p>
      </div>
    `
    cartSubtotal.textContent = '$0.00'
    cartTotal.textContent = '$0.00'
    return
  }

  let total = 0
  cart.forEach(item => {
    total += parseFloat(item.price)
    const row = document.createElement('div')
    row.className = 'cart-item'
    
    const imageUrl = item.image_url || categoryPlaceholders[item.category] || categoryPlaceholders['Other']
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.price)

    row.innerHTML = `
      <img src="${imageUrl}" alt="${item.title}" class="cart-item-img">
      <div class="cart-item-info">
        <h4 class="cart-item-title">${item.title}</h4>
        <span class="cart-item-price">${formattedPrice}</span>
      </div>
      <button class="remove-item-btn" data-id="${item.id}" aria-label="Remove item">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    `
    cartItemsContainer.appendChild(row)
  })

  const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)
  cartSubtotal.textContent = formattedTotal
  cartTotal.textContent = formattedTotal

  // Bind remove buttons
  document.querySelectorAll('.remove-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id')
      removeFromCart(id)
    })
  })
}

/* ==========================================================================
   FORM & MODAL HANDLERS
   ========================================================================== */
async function handlePublishListing(e) {
  e.preventDefault()
  
  const title = document.getElementById('prodTitle').value.trim()
  const price = parseFloat(document.getElementById('prodPrice').value)
  const category = document.getElementById('prodCategory').value
  const imageUrl = document.getElementById('prodImage').value.trim()
  const description = document.getElementById('prodDesc').value.trim()

  if (!title || isNaN(price) || !category || !description) {
    showToast("Please fill in all required fields.", "danger")
    return
  }

  const submitBtn = document.getElementById('submitFormBtn')
  submitBtn.disabled = true
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing...'

  try {
    const { data, error } = await supabase
      .from('products')
      .insert([
        {
          title,
          price,
          category,
          image_url: imageUrl || null,
          description
        }
      ])
      .select()

    if (error) {
      showToast(`Error listing item: ${error.message}`, "danger")
    } else {
      showToast("Listing published successfully!", "success")
      sellItemForm.reset()
      closeModal()
      loadListings() // reload lists
    }
  } catch (err) {
    console.error("Submit error:", err)
    showToast("Network error while publishing item.", "danger")
  } finally {
    submitBtn.disabled = false
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Listing'
  }
}

// Modal open/close helpers
function openModal() {
  modalOverlay.classList.add('active')
}

function closeModal() {
  modalOverlay.classList.remove('active')
}

function toggleCart(isOpen) {
  if (isOpen) {
    cartSidebar.classList.add('active')
    cartOverlay.classList.add('active')
  } else {
    cartSidebar.classList.remove('active')
    cartOverlay.classList.remove('active')
  }
}

/* ==========================================================================
   EVENT LISTENERS & BINDINGS
   ========================================================================== */
function initEventListeners() {
  // Modal controllers
  listProductBtn.addEventListener('click', openModal)
  closeModalBtn.addEventListener('click', closeModal)
  cancelFormBtn.addEventListener('click', closeModal)
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal()
  })

  // Cart Drawer controllers
  cartBtn.addEventListener('click', () => toggleCart(true))
  closeCartBtn.addEventListener('click', () => toggleCart(false))
  cartOverlay.addEventListener('click', () => toggleCart(false))

  // Checkout action
  checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) return
    showToast("Checkout completed! Thanks for demoing QuickMarket.", "success")
    cart = []
    localStorage.removeItem('quickmarket_cart')
    updateCartUI()
    toggleCart(false)
  })

  // Category Filtering
  categoryFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn')
    if (!btn) return

    // Toggle active state
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')

    currentCategory = btn.getAttribute('data-category')
    listingTitle.textContent = currentCategory === 'all' ? 'Recent Listings' : `${currentCategory} Listings`
    renderListings()
  })

  // Search input and clear
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value
    clearSearchBtn.style.display = searchQuery.length > 0 ? 'block' : 'none'
    renderListings()
  })

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = ''
    searchQuery = ''
    clearSearchBtn.style.display = 'none'
    renderListings()
  })

  // Sort listing
  sortBySelect.addEventListener('change', (e) => {
    currentSort = e.target.value
    renderListings()
  })

  // Reset filters
  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = ''
    searchQuery = ''
    clearSearchBtn.style.display = 'none'
    currentCategory = 'all'
    document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'))
    document.querySelector('[data-category="all"]').classList.add('active')
    listingTitle.textContent = 'Recent Listings'
    renderListings()
  })

  // Form submit
  sellItemForm.addEventListener('submit', handlePublishListing)

  // Database initialization help
  initializeDbBtn.addEventListener('click', checkOrInitializeSchema)
}

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners()
  updateCartUI()
  loadListings()
})
