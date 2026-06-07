import { supabase } from './supabase.js'
import { showToast } from './auth.js'

// Cart State (Local cache)
let localCart = JSON.parse(localStorage.getItem('quickmarket_cart')) || []

// --- FETCH CART ITEMS ---
async function getCartItems() {
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    try {
      // Sync local items to database if any exist
      if (localCart.length > 0) {
        await syncLocalCartToDb(user.id)
      }

      // Fetch from Supabase with product details
      const { data, error } = await supabase
        .from('cart')
        .select(`
          id,
          quantity,
          product_id,
          products (
            id,
            name,
            price,
            stock,
            image_url,
            category
          )
        `)
        .eq('customer_id', user.id)

      if (error) throw error

      // Format back to uniform structure
      return (data || []).map(item => ({
        id: item.product_id,
        quantity: item.quantity,
        name: item.products.name,
        price: item.products.price,
        stock: item.products.stock,
        image_url: item.products.image_url,
        category: item.products.category
      }))
    } catch (err) {
      console.error('Error fetching cart from DB:', err)
      return localCart
    }
  } else {
    // If guest, return localStorage items
    return localCart
  }
}

// --- SYNC LOCAL STORAGE TO DB ON LOGIN ---
async function syncLocalCartToDb(customerId) {
  try {
    for (const item of localCart) {
      await supabase
        .from('cart')
        .upsert({
          customer_id: customerId,
          product_id: item.id,
          quantity: item.quantity
        }, { onConflict: 'customer_id,product_id' })
    }
    // Clear local storage cart once synced
    localCart = []
    localStorage.removeItem('quickmarket_cart')
  } catch (err) {
    console.error('Error syncing cart:', err)
  }
}

// --- ADD TO CART ---
async function addToCart(productId) {
  try {
    // 1. Fetch product detail to check stock
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (error) throw error
    if (!product || product.stock <= 0) {
      showToast('Product is out of stock!', 'warning')
      return false
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      // 2. Authenticated user: save/update in DB
      const { data: existing, error: getErr } = await supabase
        .from('cart')
        .select('id, quantity')
        .eq('customer_id', user.id)
        .eq('product_id', productId)
        .maybeSingle()

      if (getErr) throw getErr

      if (existing) {
        if (existing.quantity >= product.stock) {
          showToast(`Cannot add more. Stock limit is ${product.stock}.`, 'warning')
          return false
        }
        
        await supabase
          .from('cart')
          .update({ quantity: existing.quantity + 1 })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('cart')
          .insert({
            customer_id: user.id,
            product_id: productId,
            quantity: 1
          })
      }
    } else {
      // 3. Guest: save/update in localStorage
      const idx = localCart.findIndex(item => item.id === productId)
      if (idx > -1) {
        if (localCart[idx].quantity >= product.stock) {
          showToast(`Cannot add more. Stock limit is ${product.stock}.`, 'warning')
          return false
        }
        localCart[idx].quantity += 1
      } else {
        localCart.push({
          id: product.id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          image_url: product.image_url,
          category: product.category,
          quantity: 1
        })
      }
      localStorage.setItem('quickmarket_cart', JSON.stringify(localCart))
    }

    showToast(`Added "${product.name}" to cart!`, 'success')
    return true
  } catch (err) {
    console.error('Error adding to cart:', err)
    showToast('Failed to add product to cart.', 'danger')
    return false
  }
}

// --- UPDATE CART QUANTITY ---
async function updateCartQuantity(productId, delta) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: item, error: getErr } = await supabase
        .from('cart')
        .select('id, quantity, products(stock)')
        .eq('customer_id', user.id)
        .eq('product_id', productId)
        .single()

      if (getErr) throw getErr

      const newQty = item.quantity + delta
      const stockLimit = item.products.stock

      if (newQty <= 0) {
        await supabase.from('cart').delete().eq('id', item.id)
        showToast('Item removed from cart.', 'info')
      } else if (newQty > stockLimit) {
        showToast(`Cannot exceed available stock of ${stockLimit}.`, 'warning')
        return false
      } else {
        await supabase
          .from('cart')
          .update({ quantity: newQty })
          .eq('id', item.id)
      }
    } else {
      const idx = localCart.findIndex(i => i.id === productId)
      if (idx > -1) {
        const newQty = localCart[idx].quantity + delta
        const stockLimit = localCart[idx].stock

        if (newQty <= 0) {
          localCart.splice(idx, 1)
          showToast('Item removed from cart.', 'info')
        } else if (newQty > stockLimit) {
          showToast(`Cannot exceed available stock of ${stockLimit}.`, 'warning')
          return false
        } else {
          localCart[idx].quantity = newQty
        }
        localStorage.setItem('quickmarket_cart', JSON.stringify(localCart))
      }
    }
    return true
  } catch (err) {
    console.error('Error updating cart quantity:', err)
    return false
  }
}

// --- CLEAR CART ---
async function clearCart() {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('cart').delete().eq('customer_id', user.id)
  }
  localCart = []
  localStorage.removeItem('quickmarket_cart')
}

// --- CALCULATE BILL TOTALS ---
function calculateBill(items) {
  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const deliveryCharge = subtotal > 250 || totalItems === 0 ? 0 : 30 // Free delivery above 250 INR
  const total = subtotal + deliveryCharge
  return {
    subtotal,
    totalItems,
    deliveryCharge,
    total
  }
}

export {
  getCartItems,
  addToCart,
  updateCartQuantity,
  clearCart,
  calculateBill
}
