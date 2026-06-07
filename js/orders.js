import { supabase } from './supabase.js'
import { showToast } from './auth.js'
import { clearCart } from './cart.js'

// --- PLACE ORDER ---
async function placeOrder(checkoutDetails) {
  try {
    const { name, phone, address, paymentMethod, items, totalPrice, totalItems } = checkoutDetails
    
    if (!items || items.length === 0) {
      showToast('Your cart is empty!', 'warning')
      return { success: false }
    }

    const { data: { user } } = await supabase.auth.getUser()

    // 1. Double check and decrement stocks
    for (const item of items) {
      const { data: prod, error: getErr } = await supabase
        .from('products')
        .select('stock, name')
        .eq('id', item.id)
        .single()

      if (getErr) throw getErr
      if (prod.stock < item.quantity) {
        showToast(`Sorry, only ${prod.stock} units of ${prod.name} are available.`, 'warning')
        return { success: false }
      }
    }

    // 2. Insert Order Header record
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: user ? user.id : null,
        customer_name: name,
        customer_phone: phone,
        total_amount: totalItems,
        total_price: totalPrice,
        delivery_address: address,
        payment_method: paymentMethod,
        order_status: 'Pending'
      })
      .select()
      .single()

    if (orderErr) throw orderErr

    // 3. Insert Order Items (child rows) & Decrement Stock
    const orderItemsToInsert = items.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      price: parseFloat(item.price)
    }))

    const { error: itemsErr } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert)

    if (itemsErr) throw itemsErr

    // Decrement database stock
    for (const item of items) {
      const { data: currentProd } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .single()

      await supabase
        .from('products')
        .update({ stock: currentProd.stock - item.quantity })
        .eq('id', item.id)
    }

    // 4. Clear the cart
    await clearCart()
    
    showToast('Order placed successfully!', 'success')
    return { success: true, orderId: order.id }
  } catch (err) {
    console.error('Error placing order:', err)
    showToast(err.message || 'Error occurred during checkout.', 'danger')
    return { success: false }
  }
}

// --- FETCH CUSTOMER ORDERS ---
async function fetchCustomerOrders() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      showToast('Please log in to view your orders.', 'warning')
      return []
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching customer orders:', err)
    return []
  }
}

// --- GET SPECIFIC ORDER ITEMS ---
async function fetchOrderItems(orderId) {
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        price,
        products (
          name,
          category
        )
      `)
      .eq('order_id', orderId)

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error loading order items:', err)
    return []
  }
}

// --- SUBSCRIBE TO LIVE STATUS UPDATES (CUSTOMER SIDE) ---
function subscribeToOrderStatus(orderId, onUpdateCallback) {
  return supabase
    .channel(`order-status-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`
      },
      (payload) => {
        if (payload.new && onUpdateCallback) {
          onUpdateCallback(payload.new)
        }
      }
    )
    .subscribe()
}

export {
  placeOrder,
  fetchCustomerOrders,
  fetchOrderItems,
  subscribeToOrderStatus
}
