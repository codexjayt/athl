// Supabase configuration
const supabaseUrl = 'https://ypjlkheimduflarwxusl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwamxraGVpbWR1Zmxhcnd4dXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTIxMzcsImV4cCI6MjA5MDA4ODEzN30.noJduEXx2kZ1r2tF6CuCWqnUzmOFM0wh1hrTnfl2xzE';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Size order for sorting
const SIZE_ORDER = { '3XS':1,'2XS':2,'XS':3,'S':4,'M':5,'L':6,'XL':7,'2XL':8,'3XL':9,'4XL':10,'5XL':11 };