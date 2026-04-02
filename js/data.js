async function loadData() {
    const { data: ordersData, error: ordersError } = await supabaseClient
        .from('orders')
        .select('*');
    if (!ordersError && ordersData) {
        orders = ordersData.map(order => ({
            id: order.id,
            customer: order.customer,
            dateStarted: order.date_started,
            dateRelease: order.date_release,
            fabric: order.fabric,
            jerseyType: order.jersey_type,
            lowerType: order.lower_type,
            garments: order.garments,
            totalPlayers: order.total_players,
            totalGarments: order.total_garments,
            subTotal: order.sub_total,
            discountAmount: order.discount_amount,
            discountValue: order.discount_value,
            totalPrice: order.total_price,
            amountPaid: order.amount_paid,
            balanceDue: order.balance_due,
            notes: order.notes,
            status: order.status,
            createdAt: order.created_at,
            designImage: order.design_image
        }));
    } else {
        orders = [];
        console.error(ordersError);
    }

    const { data: settingsData, error: settingsError } = await supabaseClient
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();
    if (!settingsError && settingsData) {
        settings = {
            fabric: settingsData.fabric,
            jerseyType: settingsData.jersey_type,
            lowerType: settingsData.lower_type,
            garmentType: settingsData.garment_type
        };
    } else {
        console.error(settingsError);
    }
    refreshAllDisplays();
}

async function saveOrders() {
    for (const order of orders) {
        const dbOrder = {
            id: order.id,
            customer: order.customer,
            date_started: order.dateStarted,
            date_release: order.dateRelease,
            fabric: order.fabric,
            jersey_type: order.jerseyType,
            lower_type: order.lowerType,
            garments: order.garments,
            total_players: order.totalPlayers,
            total_garments: order.totalGarments,
            sub_total: order.subTotal,
            discount_amount: order.discountAmount,
            discount_value: order.discountValue,
            total_price: order.totalPrice,
            amount_paid: order.amountPaid,
            balance_due: order.balanceDue,
            notes: order.notes,
            status: order.status,
            created_at: order.createdAt,
            design_image: order.designImage
        };
        const { error } = await supabaseClient
            .from('orders')
            .upsert(dbOrder, { onConflict: 'id' });
        if (error) console.error('Error saving order:', error);
    }
    refreshAllDisplays();
}

async function saveSettings() {
    const dbSettings = {
        id: 1,
        fabric: settings.fabric,
        jersey_type: settings.jerseyType,
        lower_type: settings.lowerType,
        garment_type: settings.garmentType,
        updated_at: new Date()
    };
    const { error } = await supabaseClient
        .from('settings')
        .upsert(dbSettings);
    if (!error) {
        populateDropdowns();
        renderSettingsEditor();
    } else {
        console.error('Error saving settings:', error);
    }
}

async function deleteOrder(orderId) {
    if (!isFullAccess()) {
        alert('View‑only mode: you cannot delete orders.');
        return;
    }
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    if (!confirm(`Delete order for "${order.customer}"? This action is permanent.`)) return;

    orders = orders.filter(o => o.id !== orderId);
    const { error } = await supabaseClient.from('orders').delete().eq('id', orderId);
    if (error) {
        console.error('Error deleting order:', error);
        alert('Failed to delete order. Please try again.');
        await loadData();
        return;
    }
    await saveOrders();
    alert('✅ Order deleted.');
}

async function resetAllData() {
    if (!confirm('Delete ALL orders and reset settings to default?')) return;
    const { error: deleteError } = await supabaseClient.from('orders').delete().neq('id', '');
    if (deleteError) console.error(deleteError);
    settings = {
        fabric: [{ name: 'Mesh', price: 0 }, { name: 'Polyester', price: 0 }],
        jerseyType: [{ name: 'V-neck U-cut', price: 0 }, { name: 'Crew neck', price: 0 }],
        lowerType: [{ name: 'With lining', price: 0 }, { name: 'Without lining', price: 0 }],
        garmentType: [{ name: 'Hoodie', price: 800 }, { name: 'Jersey', price: 300 }, { name: 'Shorts', price: 0 }]
    };
    await saveSettings();
    orders = [];
    refreshAllDisplays();
    alert('All data reset.');
}