import { supabase } from './supabase.js'
import { showToast } from './auth.js'

// --- PLAY ALERT BEEP ---
function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()
    
    osc.connect(gainNode)
    gainNode.connect(ctx.destination)
    
    // Play a dual-tone grocery checkout beep
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // High pitch
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    osc.start()
    
    // Beep 1
    osc.stop(ctx.currentTime + 0.15)
    
    // Beep 2 (short delayed beep)
    setTimeout(() => {
      try {
        const ctx2 = new AudioContextClass()
        const osc2 = ctx2.createOscillator()
        const gain2 = ctx2.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx2.destination)
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(1046.50, ctx2.currentTime) // Higher note C6
        gain2.gain.setValueAtTime(0.3, ctx2.currentTime)
        osc2.start()
        osc2.stop(ctx2.currentTime + 0.15)
      } catch (e) {}
    }, 200)

  } catch (e) {
    console.warn('Audio play restricted or unsupported:', e)
  }
}

// --- ADD NEW PRODUCT ---
async function addProduct(productDetails) {
  try {
    const { name, category, description, price, stock, imageUrl } = productDetails
    
    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        category,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        image_url: imageUrl || null
      })
      .select()
      .single()

    if (error) throw error
    showToast(`Product "${name}" added successfully!`, 'success')
    return { success: true, data }
  } catch (err) {
    console.error('Error adding product:', err)
    showToast(err.message || 'Failed to add product.', 'danger')
    return { success: false }
  }
}

// --- EDIT PRODUCT ---
async function editProduct(productId, updatedDetails) {
  try {
    const { name, category, description, price, stock, imageUrl } = updatedDetails

    const { data, error } = await supabase
      .from('products')
      .update({
        name,
        category,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        image_url: imageUrl || null
      })
      .eq('id', productId)
      .select()
      .single()

    if (error) throw error
    showToast(`Product "${name}" updated successfully!`, 'success')
    return { success: true, data }
  } catch (err) {
    console.error('Error updating product:', err)
    showToast(err.message || 'Failed to update product.', 'danger')
    return { success: false }
  }
}

// --- DELETE PRODUCT ---
async function deleteProduct(productId) {
  try {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)

    if (error) throw error
    showToast('Product deleted successfully.', 'success')
    return { success: true }
  } catch (err) {
    console.error('Error deleting product:', err)
    showToast(err.message || 'Failed to delete product.', 'danger')
    return { success: false }
  }
}

// --- LIST ALL ORDERS (SELLER SIDE) ---
async function fetchAllOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching seller orders:', err)
    return []
  }
}

// --- UPDATE ORDER STATUS ---
async function updateOrderStatus(orderId, status) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ order_status: status })
      .eq('id', orderId)
      .select()
      .single()

    if (error) throw error
    showToast(`Order status updated to "${status}"`, 'success')
    return { success: true, data }
  } catch (err) {
    console.error('Error updating order status:', err)
    showToast(err.message || 'Failed to update status.', 'danger')
    return { success: false }
  }
}

// --- SUBSCRIBE TO NEW ORDERS (REALTIME ALERTS) ---
function subscribeToNewOrders(onNewOrderCallback) {
  return supabase
    .channel('seller-orders')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders'
      },
      (payload) => {
        if (payload.new) {
          playNotificationSound()
          showToast(`New order received from ${payload.new.customer_name}!`, 'success')
          if (onNewOrderCallback) {
            onNewOrderCallback(payload.new)
          }
        }
      }
    )
    .subscribe()
}

export {
  addProduct,
  editProduct,
  deleteProduct,
  fetchAllOrders,
  updateOrderStatus,
  subscribeToNewOrders,
  playNotificationSound
}
