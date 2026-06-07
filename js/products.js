import { supabase } from './supabase.js'

// Fallback images based on product category
const categoryFallbacks = {
  'Vegetables': 'https://images.unsplash.com/photo-1597362925123-77861d3fbac7?auto=format&fit=crop&w=600&q=80',
  'Fruits': 'https://images.unsplash.com/photo-1619546813926-a78fa6372cd2?auto=format&fit=crop&w=600&q=80',
  'Grocery': 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80'
}

// --- RENDER SKELETON LOADER ---
function renderSkeletons(containerId, count = 4) {
  const container = document.getElementById(containerId)
  if (!container) return
  
  container.innerHTML = ''
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div')
    card.className = 'skeleton-card'
    card.innerHTML = `
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
    `
    container.appendChild(card)
  }
}

// --- FETCH PRODUCTS FROM DATABASE ---
async function fetchProducts(category = 'all', searchQuery = '') {
  try {
    let query = supabase.from('products').select('*')

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`)
    }

    // Sort by newest products
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching products:', err)
    return []
  }
}

// --- RENDER PRODUCTS GRID ---
function renderProductGrid(products, containerId, onAddToCartCallback) {
  const container = document.getElementById(containerId)
  const emptyState = document.getElementById('emptyState')
  
  if (!container) return

  container.innerHTML = ''

  if (products.length === 0) {
    if (emptyState) emptyState.style.display = 'flex'
    container.style.display = 'none'
    return
  }

  if (emptyState) emptyState.style.display = 'none'
  container.style.display = 'grid'

  products.forEach(product => {
    const card = document.createElement('div')
    const isOutOfStock = product.stock <= 0
    card.className = `product-card ${isOutOfStock ? 'out-of-stock' : ''}`
    
    // Image handling with fallback
    const imgUrl = product.image_url || categoryFallbacks[product.category] || categoryFallbacks['Vegetables']
    const formattedPrice = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(product.price)

    card.innerHTML = `
      <div class="product-img-wrapper">
        <img class="product-img" src="${imgUrl}" alt="${product.name}" onerror="this.onerror=null; this.src='${categoryFallbacks['Vegetables']}';">
        <span class="product-category-badge">${product.category}</span>
      </div>
      <div class="product-info">
        <h3 class="product-name">${product.name}</h3>
        <p class="product-desc">${product.description || 'No description available.'}</p>
        <div class="product-card-footer">
          <div>
            <span class="product-price">${formattedPrice}</span>
            <div class="product-stock ${product.stock < 5 ? 'low' : ''} ${isOutOfStock ? 'out' : ''}">
              ${isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
            </div>
          </div>
          <button class="add-cart-btn-circle add-to-cart-btn" data-id="${product.id}" ${isOutOfStock ? 'disabled' : ''}>
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
    `
    container.appendChild(card)
  })

  // Hook up event listeners to buttons
  container.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const productId = btn.getAttribute('data-id')
      if (onAddToCartCallback) {
        onAddToCartCallback(productId)
      }
    })
  })
}

export {
  fetchProducts,
  renderProductGrid,
  renderSkeletons,
  categoryFallbacks
}
