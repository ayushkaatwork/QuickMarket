-- Setup Script for Apna Market
-- Copy and run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/yujsfdqtcsbojjukvoyg/sql/new

-- 1. Create CUSTOMERS profile table
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  mobile_number TEXT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to customers" ON public.customers;
CREATE POLICY "Allow public read access to customers" ON public.customers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow customers to manage their own profile" ON public.customers;
CREATE POLICY "Allow customers to manage their own profile" ON public.customers FOR ALL USING (auth.uid() = id);

-- Trigger function to automatically create a customer record on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.customers (id, full_name, mobile_number, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
    COALESCE(NEW.raw_user_meta_data->>'mobile_number', NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to link auth.users sign-up with public.customers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- Clean up any legacy auto-confirm triggers that bypass email verification
DROP TRIGGER IF EXISTS on_auth_user_created_before ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_user();

-- 2. Create PRODUCTS table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Vegetables', 'Fruits', 'Grocery'
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anonymous insert for products" ON public.products;
CREATE POLICY "Allow anonymous insert for products" ON public.products FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anonymous update for products" ON public.products;
CREATE POLICY "Allow anonymous update for products" ON public.products FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anonymous delete for products" ON public.products;
CREATE POLICY "Allow anonymous delete for products" ON public.products FOR DELETE USING (true);

-- 3. Create ORDERS table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  total_amount INTEGER NOT NULL, -- total count of items
  total_price NUMERIC(10, 2) NOT NULL,
  order_status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Accepted', 'Packed', 'Out for Delivery', 'Delivered'
  delivery_address TEXT NOT NULL,
  payment_method TEXT NOT NULL, -- 'COD', 'UPI'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous read access to orders" ON public.orders;
CREATE POLICY "Allow anonymous read access to orders" ON public.orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anonymous insert for orders" ON public.orders;
CREATE POLICY "Allow anonymous insert for orders" ON public.orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anonymous update for orders" ON public.orders;
CREATE POLICY "Allow anonymous update for orders" ON public.orders FOR UPDATE USING (true);

-- 4. Create ORDER ITEMS table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(10, 2) NOT NULL
);

-- Enable RLS for order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous read for order_items" ON public.order_items;
CREATE POLICY "Allow anonymous read for order_items" ON public.order_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anonymous insert for order_items" ON public.order_items;
CREATE POLICY "Allow anonymous insert for order_items" ON public.order_items FOR INSERT WITH CHECK (true);

-- 5. Create CART table
CREATE TABLE IF NOT EXISTS public.cart (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (customer_id, product_id)
);

-- Enable RLS for cart
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow customers to manage their own cart" ON public.cart;
CREATE POLICY "Allow customers to manage their own cart" ON public.cart FOR ALL USING (true);

-- 6. Seed initial premium products (Vegetables, Fruits, Groceries)
INSERT INTO public.products (name, category, description, price, stock, image_url)
VALUES
('Organic Broccoli', 'Vegetables', 'Fresh, organic broccoli crowns packed with nutrients. Direct from local farms.', 2.49, 45, 'https://images.unsplash.com/photo-1584270354949-c26b0d5b4a0c?auto=format&fit=crop&w=600&q=80'),
('Roma Tomatoes (1kg)', 'Vegetables', 'Sweet, red Roma tomatoes. Plump, juicy, and perfect for salads or sauces.', 3.29, 60, 'https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=600&q=80'),
('Fresh Baby Spinach (200g)', 'Vegetables', 'Pre-washed tender baby spinach leaves, perfect for salads and green smoothies.', 1.99, 30, 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80'),
('Sweet Honeycrisp Apples', 'Fruits', 'Crisp and exceptionally juicy Honeycrisp apples. Premium selection.', 4.99, 50, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80'),
('Fresh Bananas (Bunch)', 'Fruits', 'Sweet, ripe bananas, packed with potassium. Bunch of 5-6 bananas.', 1.49, 100, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80'),
('Alfonso Mangoes (6 Pcs)', 'Fruits', 'King of mangoes. Extremely sweet, rich aroma, and luscious golden pulp.', 8.99, 15, 'https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&q=80'),
('Extra Virgin Olive Oil (500ml)', 'Grocery', 'Cold-pressed extra virgin olive oil, imported from Spain. Rich flavor profile.', 12.49, 20, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80'),
('Organic Brown Rice (1kg)', 'Grocery', 'Long-grain brown rice. Rich in fiber, nutty flavor, and easily digestible.', 3.99, 40, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'),
('Premium Almonds (250g)', 'Grocery', 'Whole raw almonds, crunchy and nutritious. High in protein and healthy fats.', 6.49, 35, 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?auto=format&fit=crop&w=600&q=80')
ON CONFLICT DO NOTHING;
