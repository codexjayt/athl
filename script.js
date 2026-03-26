// Supabase configuration
const supabaseUrl = 'https://ypjlkheimduflarwxusl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwamxraGVpbWR1Zmxhcnd4dXNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTIxMzcsImV4cCI6MjA5MDA4ODEzN30.noJduEXx2kZ1r2tF6CuCWqnUzmOFM0wh1hrTnfl2xzE';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let orders = [];
let settings = {
    fabric: [{ name: 'Mesh', price: 0 }, { name: 'Polyester', price: 0 }],
    jerseyType: [{ name: 'V-neck U-cut', price: 0 }, { name: 'Crew neck', price: 0 }],
    lowerType: [{ name: 'With lining', price: 0 }, { name: 'Without lining', price: 0 }],
    garmentType: [{ name: 'Hoodie', price: 800 }, { name: 'Jersey', price: 300 }, { name: 'Shorts', price: 0 }]
};

// Size order for sorting (3XS → 5XL)
const SIZE_ORDER = { '3XS':1,'2XS':2,'XS':3,'S':4,'M':5,'L':6,'XL':7,'2XL':8,'3XL':9,'4XL':10,'5XL':11 };
function getSizeRank(s) { return SIZE_ORDER[s?.toUpperCase()] || 999; }
function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, function(m){ if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }

// ---------- Data Persistence (Supabase) ----------
async function loadData() {
    // Load orders
    const { data: ordersData, error: ordersError } = await supabaseClient
        .from('orders')
        .select('*');
    if (!ordersError && ordersData) {
        orders = ordersData;
    } else {
        orders = [];
        console.error(ordersError);
    }

    // Load settings (single row)
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
        // Keep default settings (already set above)
        console.error(settingsError);
    }
    refreshAllDisplays();
}

async function saveOrders() {
    // Upsert all orders (insert or update)
    for (const order of orders) {
        const { error } = await supabaseClient
            .from('orders')
            .upsert(order, { onConflict: 'id' });
        if (error) console.error('Error saving order:', error);
    }
    refreshAllDisplays();
}

async function saveSettings() {
    const { error } = await supabaseClient
        .from('settings')
        .upsert({
            id: 1,
            fabric: settings.fabric,
            jersey_type: settings.jerseyType,
            lower_type: settings.lowerType,
            garment_type: settings.garmentType,
            updated_at: new Date()
        });
    if (!error) {
        populateDropdowns();
        renderSettingsEditor();
    } else {
        console.error('Error saving settings:', error);
    }
}

function refreshAllDisplays() { updateDashboard(); renderOrdersByStatus(); renderRecentOrders(); }

function updateDashboard() {
    document.getElementById('statToFile').innerText = orders.filter(o => o.status === 'tofile').length;
    document.getElementById('statProgress').innerText = orders.filter(o => o.status === 'progress').length;
    document.getElementById('statCompleted').innerText = orders.filter(o => o.status === 'completed').length;
}

// ---------- Order Card Rendering ----------
function renderOrderCard(order, status) {
    const actionBtn = status === 'tofile' ? `<button class="action-order-btn" onclick="event.stopPropagation(); confirmStatusChange('${order.id}', 'progress')"><i class="fas fa-play"></i> Start</button>` : (status === 'progress' ? `<button class="action-order-btn" onclick="event.stopPropagation(); confirmStatusChange('${order.id}', 'completed')"><i class="fas fa-check"></i> Complete</button>` : '');
    const thumb = order.designImage ? `<img src="${order.designImage}" class="order-image-thumb" alt="design">` : '';
    const discountBadge = order.discountAmount > 0 ? `<span class="discount-badge" style="font-size:0.6rem; margin-left:0.5rem;">-₱${order.discountAmount}</span>` : '';
    return `<div class="order-card" onclick="openOrderModal('${order.id}')">
        <div style="display:flex; align-items:center; gap:12px;">
            ${thumb}
            <div>
                <div class="order-title">
                    ${escapeHtml(order.customer)}
                    <span class="status-badge ${status}">${status === 'tofile' ? 'TO FILE' : status === 'progress' ? 'IN PROGRESS' : 'COMPLETED'}</span>
                    ${discountBadge}
                </div>
                <div style="margin-top:0.5rem; color:#b9c7d9;">${order.totalGarments} garments · ${order.totalPlayers} players</div>
                <div style="color:#f97316;">
                    ${order.discountAmount > 0 ? `<span class="original-price">₱${order.subTotal?.toFixed(2) || (order.totalPrice + order.discountAmount).toFixed(2)}</span> ` : ''}
                    ₱${order.totalPrice.toFixed(2)} | Paid: ₱${order.amountPaid}
                </div>
            </div>
        </div>
        <div class="flex-btns">
            <button class="print-receipt-btn" onclick="event.stopPropagation(); showReceiptPreview('${order.id}')"><i class="fas fa-download"></i> Receipt (JPG)</button>
            <button class="edit-order-btn" onclick="event.stopPropagation(); openEditOrderModal('${order.id}')"><i class="fas fa-pencil-alt"></i> Edit</button>
            ${actionBtn}
        </div>
    </div>`;
}

async function confirmStatusChange(orderId, newStatus) {
    const msg = newStatus === 'progress' ? 'Move this order to IN PROGRESS?' : 'Mark this order as COMPLETED?';
    if (confirm(msg)) {
        await changeOrderStatus(orderId, newStatus);
    }
}
async function changeOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    if(order) {
        order.status = newStatus;
        if (newStatus === 'completed') order.completedAt = new Date().toISOString();
        await saveOrders();
    }
}
function renderOrdersByStatus() {
    ['tofile','progress','completed'].forEach(st => {
        const filtered = orders.filter(o => o.status === st);
        const grid = document.getElementById(`${st}OrdersGrid`);
        const emptyDiv = document.getElementById(`${st}Empty`);
        if(filtered.length===0) { if(grid) grid.innerHTML=''; if(emptyDiv) emptyDiv.classList.remove('hidden'); }
        else { if(emptyDiv) emptyDiv.classList.add('hidden'); if(grid) grid.innerHTML = filtered.map(o => renderOrderCard(o, st)).join(''); }
    });
}
function renderRecentOrders() {
    const recent = [...orders].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
    const container = document.getElementById('recentOrdersList');
    if(!recent.length) { container.innerHTML='<div class="empty-state">No orders yet</div>'; return; }
    container.innerHTML = recent.map(order => `
        <div onclick="openOrderModal('${order.id}')" style="display:flex; justify-content:space-between; align-items:center; padding:1rem; background:rgba(0,0,0,0.3); border-radius:16px; cursor:pointer; margin-bottom:0.5rem;">
            <div><strong style="color:#fff;">${escapeHtml(order.customer)}</strong><div style="font-size:0.8rem; color:#b9c7d9;">${order.totalGarments} garments · ₱${order.totalPrice.toFixed(2)}</div></div>
            <span class="status-badge ${order.status}">${order.status === 'tofile' ? 'TO FILE' : order.status === 'progress' ? 'IN PROGRESS' : 'COMPLETED'}</span>
        </div>
    `).join('');
}

// ---------- Order Detail Modal (unchanged but uses async save) ----------
function openOrderModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    document.getElementById('modalCustomer').innerText = order.customer;

    const sorted = [...order.garments].sort((a, b) => {
        const sizeDiff = getSizeRank(a.upperSize) - getSizeRank(b.upperSize);
        if (sizeDiff !== 0) return sizeDiff;
        return (a.surname || '').localeCompare(b.surname || '');
    });

    const garmentRowsHtml = sorted.map(g => `
        <tr class="garment-row">
            <td><span class="garment-type-badge">${escapeHtml(g.garmentType)}</span>   </td>
            <td>${escapeHtml(g.surname) || '—'}   </td>
            <td>${escapeHtml(g.number) || '—'}   </td>
            <td><span class="size-tag">${escapeHtml(g.upperSize) || '—'}</span>   </td>
            <td><span class="size-tag">${escapeHtml(g.lowerSize) || '—'}</span>   </td>
            <td class="notes-cell">${escapeHtml(g.notes) || '—'}   </td>
         </tr>
    `).join('');

    const designHtml = order.designImage ? `
        <div class="design-section">
            <div class="section-label">Approved Design</div>
            <img src="${order.designImage}" class="design-image-full" alt="Design Preview">
        </div>
    ` : '';

    const notesHtml = order.notes ? `
        <div class="notes-section">
            <div class="section-label">Order Notes</div>
            <div class="notes-content">${escapeHtml(order.notes)}</div>
        </div>
    ` : '';

    const modalHtml = `
        <style>
            .order-modal-body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
            .order-info-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                padding: 1.25rem;
                margin-bottom: 1.5rem;
                border: 1px solid rgba(249, 115, 22, 0.2);
            }
            .info-row { display: flex; flex-direction: column; gap: 0.25rem; }
            .info-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #f97316; }
            .info-value { font-size: 1rem; font-weight: 500; color: #ffffff; word-break: break-word; }
            .info-value.price { font-size: 1.25rem; font-weight: 700; color: #f97316; }
            .garments-section {
                margin: 1.5rem 0;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 20px;
                overflow: hidden;
            }
            .garments-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1rem 1.25rem;
                background: rgba(249, 115, 22, 0.15);
                cursor: pointer;
                transition: all 0.2s ease;
                border-bottom: 1px solid rgba(249, 115, 22, 0.3);
            }
            .garments-header:hover { background: rgba(249, 115, 22, 0.25); }
            .garments-title { display: flex; align-items: center; gap: 0.75rem; font-weight: 600; font-size: 1rem; color: #f97316; }
            .garments-title i { font-size: 1.1rem; }
            .garments-count { background: rgba(249, 115, 22, 0.3); padding: 0.2rem 0.6rem; border-radius: 40px; font-size: 0.75rem; font-weight: 600; color: #f97316; }
            .toggle-icon { font-size: 1.2rem; color: #f97316; transition: transform 0.3s ease; }
            .toggle-icon.rotated { transform: rotate(180deg); }
            .garments-table-wrapper { overflow-x: auto; transition: all 0.3s ease; }
            .garments-table-wrapper.hidden { display: none; }
            .garments-modal-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
            .garments-modal-table th { text-align: left; padding: 0.875rem 0.75rem; background: rgba(0, 0, 0, 0.4); color: #f97316; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(249, 115, 22, 0.3); }
            .garments-modal-table td { padding: 0.75rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; }
            .garment-type-badge { background: rgba(249, 115, 22, 0.2); padding: 0.25rem 0.6rem; border-radius: 40px; font-size: 0.75rem; font-weight: 500; color: #f97316; display: inline-block; }
            .size-tag { background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.5rem; border-radius: 8px; font-size: 0.75rem; font-weight: 500; display: inline-block; }
            .notes-cell { max-width: 200px; white-space: normal; word-break: break-word; }
            .totals-section {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
                margin: 1.5rem 0;
                padding: 1rem;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 16px;
            }
            .total-card { text-align: center; padding: 0.75rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
            .total-label-sm { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
            .total-value-sm { font-size: 1.1rem; font-weight: 700; color: #ffffff; }
            .total-value-sm.highlight { color: #f97316; font-size: 1.3rem; }
            .design-section { margin: 1.5rem 0; text-align: center; }
            .section-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #f97316; margin-bottom: 0.75rem; }
            .design-image-full { max-width: 100%; max-height: 250px; border-radius: 16px; border: 1px solid rgba(249, 115, 22, 0.4); object-fit: contain; background: #1a1f2e; }
            .notes-section { margin: 1.5rem 0; padding: 1rem; background: rgba(0, 0, 0, 0.3); border-radius: 16px; }
            .notes-content { color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; margin-top: 0.5rem; }
            .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(249, 115, 22, 0.2); }
            .btn-receipt, .btn-edit { padding: 0.65rem 1.5rem; border-radius: 40px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; border: none; display: inline-flex; align-items: center; gap: 0.5rem; }
            .btn-receipt { background: rgba(249, 115, 22, 0.15); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.5); }
            .btn-receipt:hover { background: rgba(249, 115, 22, 0.3); transform: translateY(-2px); }
            .btn-edit { background: linear-gradient(135deg, #f97316, #fd8b3a); color: white; }
            .btn-edit:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4); }
        </style>

        <div class="order-modal-body">
            <div class="order-info-grid">
                <div class="info-row"><div class="info-label">Team / Customer</div><div class="info-value">${escapeHtml(order.customer)}</div></div>
                <div class="info-row"><div class="info-label">Order ID</div><div class="info-value">${escapeHtml(order.id)}</div></div>
                <div class="info-row"><div class="info-label">Date Started</div><div class="info-value">${order.dateStarted || '—'}</div></div>
                <div class="info-row"><div class="info-label">Date Wanted</div><div class="info-value">${order.dateRelease || '—'}</div></div>
                <div class="info-row"><div class="info-label">Fabric</div><div class="info-value">${escapeHtml(order.fabric) || '—'}</div></div>
                <div class="info-row"><div class="info-label">Jersey Type</div><div class="info-value">${escapeHtml(order.jerseyType) || '—'}</div></div>
                <div class="info-row"><div class="info-label">Lower Type</div><div class="info-value">${escapeHtml(order.lowerType) || '—'}</div></div>
                ${order.discountAmount > 0 ? `
                <div class="info-row"><div class="info-label">Discount</div><div class="info-value"><span class="discount-badge">₱${order.discountAmount.toFixed(2)} OFF</span></div></div>
                ` : ''}
                <div class="info-row"><div class="info-label">Balance</div><div class="info-value price">₱${(order.totalPrice - order.amountPaid).toFixed(2)}</div></div>
            </div>

            <div class="garments-section">
                <div class="garments-header" id="garmentsToggleBtn">
                    <div class="garments-title"><i class="fas fa-tshirt"></i><span>Garments</span><span class="garments-count">${order.totalGarments} items</span></div>
                    <i class="fas fa-chevron-down toggle-icon" id="garmentsToggleIcon"></i>
                </div>
                <div class="garments-table-wrapper" id="garmentsTableWrapper">
                    <table class="garments-modal-table">
                        <thead>汽<th>Type</th><th>Surname</th><th>#</th><th>Upper</th><th>Lower</th><th>Notes</th> </thead>
                        <tbody>${garmentRowsHtml}</tbody>
                     </table>
                </div>
            </div>

            <div class="totals-section">
                <div class="total-card"><div class="total-label-sm">Total Garments</div><div class="total-value-sm">${order.totalGarments}</div></div>
                <div class="total-card"><div class="total-label-sm">Players</div><div class="total-value-sm">${order.totalPlayers}</div></div>
                ${order.discountAmount > 0 ? `
                <div class="total-card"><div class="total-label-sm">Sub Total</div><div class="total-value-sm" style="text-decoration: line-through; color: #94a3b8;">₱${(order.subTotal || order.totalPrice + order.discountAmount).toFixed(2)}</div></div>
                <div class="total-card"><div class="total-label-sm">Discount</div><div class="total-value-sm" style="color: #10b981;">-₱${order.discountAmount.toFixed(2)}</div></div>
                ` : ''}
                <div class="total-card"><div class="total-label-sm">Amount Paid</div><div class="total-value-sm">₱${order.amountPaid.toFixed(2)}</div></div>
                <div class="total-card"><div class="total-label-sm">Total Price</div><div class="total-value-sm highlight">₱${order.totalPrice.toFixed(2)}</div></div>
            </div>

            ${designHtml}
            ${notesHtml}

            <div class="modal-actions">
                <button class="btn-receipt" onclick="event.stopPropagation(); document.getElementById('orderModal').classList.add('hidden'); showReceiptPreview('${order.id}');"><i class="fas fa-download"></i> Download Receipt (JPG)</button>
                <button class="btn-edit" onclick="event.stopPropagation(); document.getElementById('orderModal').classList.add('hidden'); openEditOrderModal('${order.id}');"><i class="fas fa-pencil-alt"></i> Edit Order</button>
            </div>
        </div>
    `;

    document.getElementById('modalBody').innerHTML = modalHtml;
    document.getElementById('orderModal').classList.remove('hidden');

    // Garments toggle
    setTimeout(() => {
        const toggleBtn = document.getElementById('garmentsToggleBtn');
        const tableWrapper = document.getElementById('garmentsTableWrapper');
        const toggleIcon = document.getElementById('garmentsToggleIcon');
        if (toggleBtn && tableWrapper) {
            let isVisible = true;
            toggleBtn.addEventListener('click', () => {
                if (isVisible) { tableWrapper.classList.add('hidden'); toggleIcon.classList.add('rotated'); }
                else { tableWrapper.classList.remove('hidden'); toggleIcon.classList.remove('rotated'); }
                isVisible = !isVisible;
            });
        }
    }, 50);
}

// ---------- Edit Order Modal (garment types preserved, discount amount only) ----------
function openEditOrderModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if(!order) return;
    const modalDiv = document.getElementById('editOrderFormContainer');
    modalDiv.innerHTML = `<div id="editOrderInner"></div>`;
    const container = document.getElementById('editOrderInner');
    renderEditForm(order, container, async () => {
        document.getElementById('editOrderModal').classList.add('hidden');
        await saveOrders();
        refreshAllDisplays();
    });
    document.getElementById('editOrderModal').classList.remove('hidden');
}

function buildGarmentSelectOptions(currentType) {
    let html = '';
    settings.garmentType.forEach(gt => {
        const selected = (gt.name === currentType) ? 'selected' : '';
        html += `<option value="${gt.name}" data-price="${gt.price}" ${selected}>${gt.name}</option>`;
    });
    const jerseySelected = (currentType === 'Jersey') ? 'selected' : '';
    html += `<option value="Jersey" ${jerseySelected}>Jersey (dynamic)</option>`;
    const customSelected = (currentType === 'Custom') ? 'selected' : '';
    html += `<option value="Custom" ${customSelected}>Custom</option>`;
    return html;
}

function renderEditForm(order, container, onSaveCallback) {
    let garmentsHtml = '';
    order.garments.forEach((g, idx) => {
        const selectOptions = buildGarmentSelectOptions(g.garmentType);
        const customPriceField = (g.garmentType === 'Custom') ? 
            `<input type="number" class="custom-price-edit" data-idx="${idx}" value="${g.customPrice || 0}" placeholder="Price" style="margin-top:5px; width:100%; background:#1e2a36; border:1px solid #f97316; border-radius:12px; padding:0.4rem;">` : '';
        garmentsHtml += `<tr data-gidx="${idx}">
               <td><select class="edit-garment-type" data-idx="${idx}">${selectOptions}</select>${customPriceField}</td>
               <td><input type="text" class="edit-surname" data-idx="${idx}" value="${escapeHtml(g.surname)}"></td>
               <td><input type="text" class="edit-number" data-idx="${idx}" value="${escapeHtml(g.number)}"></td>
               <td><input type="text" class="edit-upper" data-idx="${idx}" value="${escapeHtml(g.upperSize)}"></td>
               <td><input type="text" class="edit-lower" data-idx="${idx}" value="${escapeHtml(g.lowerSize)}"></td>
               <td><input type="text" class="edit-notes" data-idx="${idx}" value="${escapeHtml(g.notes)}"></td>
               <td><i class="fas fa-trash remove-row" data-removeidx="${idx}"></i></td>
           </tr>`;
    });
    const designPreview = order.designImage ? `<img src="${order.designImage}" style="max-width:150px; border-radius:12px;">` : '<span style="color:#94a3b8;">No design uploaded</span>';
    const formHtml = `
        <div>
            <div class="form-row" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem;">
                <div class="form-group"><label>Team/Customer</label><input type="text" id="editCustomer" value="${escapeHtml(order.customer)}"></div>
                <div class="form-group"><label>Date Started</label><input type="date" id="editDateStarted" value="${order.dateStarted||''}"></div>
                <div class="form-group"><label>Date Release</label><input type="date" id="editDateRelease" value="${order.dateRelease||''}"></div>
            </div>
            <div class="form-row" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem;">
                <div class="form-group"><label>Fabric</label><select id="editFabric">${settings.fabric.map(f=>`<option value="${f.name}" ${order.fabric===f.name?'selected':''}>${f.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>Jersey Type</label><select id="editJersey">${settings.jerseyType.map(j=>`<option value="${j.name}" ${order.jerseyType===j.name?'selected':''}>${j.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>Lower Type</label><select id="editLower">${settings.lowerType.map(l=>`<option value="${l.name}" ${order.lowerType===l.name?'selected':''}>${l.name}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>Discount Amount (₱)</label><input type="number" id="editDiscountAmount" value="${order.discountAmount || 0}" step="0.01"></div>
            <h3 style="color:#f97316;">Garments</h3>
            <table class="garments-table"><thead> <th>Type</th><th>Surname</th><th>#</th><th>Upper Size</th><th>Lower Size</th><th>Notes</th><th></th> </thead><tbody id="editGarmentsBody">${garmentsHtml}</tbody></table>
            <button type="button" class="add-row-btn" id="editAddGarmentBtn">+ Add Garment</button>
            <div class="form-section">
                <h3 style="color:#f97316;">Approved Design</h3>
                <div class="image-upload-area">
                    <div id="editDesignPreview" class="image-preview">${designPreview}</div>
                    <input type="file" id="editDesignImageInput" accept="image/jpeg,image/png,image/jpg">
                    <small style="color:#94a3b8;">Upload new image to replace existing</small>
                </div>
            </div>
            <div class="totals-grid">
                <div class="total-item"><div class="total-label">SUB TOTAL</div><div class="total-value" id="editSubTotal">₱0.00</div></div>
                <div class="total-item"><div class="total-label">TOTAL AFTER DISCOUNT</div><div class="total-value" id="editTotalPrice">₱0.00</div></div>
                <div class="total-item"><div class="total-label">AMOUNT PAID</div><input type="number" id="editAmountPaid" value="${order.amountPaid}" step="0.01" style="width:100%; background:#1e2a36; color:#fff; border:1px solid #f97316; border-radius:12px; padding:0.5rem;"></div>
            </div>
            <div class="form-group"><label>Notes</label><textarea id="editNotes" rows="2">${escapeHtml(order.notes||'')}</textarea></div>
            <div class="flex-btns" style="justify-content:flex-end; margin-top:1rem;">
                <button class="btn-secondary" id="cancelEditBtn">Cancel</button>
                <button class="btn-primary" id="saveEditBtn">Save Changes</button>
            </div>
        </div>`;
    container.innerHTML = formHtml;

    function calculateEditTotals() {
        const rows = document.querySelectorAll('#editGarmentsBody tr');
        let subTotal = 0;
        rows.forEach(row => {
            const typeSelect = row.querySelector('.edit-garment-type');
            if(typeSelect){
                const val = typeSelect.value;
                if(val === 'Jersey'){
                    const fabricPrice = parseFloat(document.querySelector('#editFabric option:checked')?.dataset?.price||0);
                    const jerseyPrice = parseFloat(document.querySelector('#editJersey option:checked')?.dataset?.price||0);
                    const lowerPrice = parseFloat(document.querySelector('#editLower option:checked')?.dataset?.price||0);
                    subTotal += fabricPrice + jerseyPrice + lowerPrice;
                } else if(val === 'Custom'){
                    const customInp = row.querySelector('.custom-price-edit');
                    if(customInp) subTotal += parseFloat(customInp.value)||0;
                } else {
                    const opt = typeSelect.options[typeSelect.selectedIndex];
                    const price = parseFloat(opt?.dataset?.price)||0;
                    subTotal += price;
                }
            }
        });

        const discountAmount = parseFloat(document.getElementById('editDiscountAmount').value) || 0;
        let totalAfterDiscount = Math.max(0, subTotal - discountAmount);

        document.getElementById('editSubTotal').innerText = '₱' + subTotal.toFixed(2);
        document.getElementById('editTotalPrice').innerText = '₱' + totalAfterDiscount.toFixed(2);
    }

    document.getElementById('editAddGarmentBtn').onclick = () => {
        const tbody = document.getElementById('editGarmentsBody');
        const newRow = document.createElement('tr');
        const defaultOptions = buildGarmentSelectOptions('Jersey');
        newRow.innerHTML = `
               <td><select class="edit-garment-type">${defaultOptions}</select></td>
               <td><input type="text" class="edit-surname"></td>
               <td><input type="text" class="edit-number"></td>
               <td><input type="text" class="edit-upper"></td>
               <td><input type="text" class="edit-lower"></td>
               <td><input type="text" class="edit-notes"></td>
               <td><i class="fas fa-times remove-row"></i></td>`;
        tbody.appendChild(newRow);
        const sel = newRow.querySelector('.edit-garment-type');
        sel.onchange = () => {
            const td = sel.closest('td');
            let customInput = td.querySelector('.custom-price-edit');
            if(sel.value === 'Custom'){
                if(!customInput){
                    const inp = document.createElement('input');
                    inp.type='number';
                    inp.placeholder='Price';
                    inp.className='custom-price-edit';
                    inp.style.marginTop='5px';
                    inp.style.width='100%';
                    inp.style.background='#1e2a36';
                    inp.style.border='1px solid #f97316';
                    inp.style.borderRadius='12px';
                    inp.style.padding='0.4rem';
                    td.appendChild(inp);
                }
            } else {
                if(customInput) customInput.remove();
            }
            calculateEditTotals();
        };
        newRow.querySelector('.remove-row').onclick = () => { newRow.remove(); calculateEditTotals(); };
        calculateEditTotals();
    };

    document.querySelectorAll('#editGarmentsBody .remove-row').forEach(btn => {
        btn.onclick = () => {
            btn.closest('tr').remove();
            calculateEditTotals();
        };
    });

    document.getElementById('editFabric').addEventListener('change', calculateEditTotals);
    document.getElementById('editJersey').addEventListener('change', calculateEditTotals);
    document.getElementById('editLower').addEventListener('change', calculateEditTotals);
    document.getElementById('editDiscountAmount').addEventListener('input', calculateEditTotals);
    document.getElementById('editAmountPaid').addEventListener('input', calculateEditTotals);

    const editImageInput = document.getElementById('editDesignImageInput');
    const editPreviewDiv = document.getElementById('editDesignPreview');
    editImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file && file.type.match('image.*')) {
            if(file.size > 2 * 1024 * 1024) { alert('Image too large (max 2MB)'); editImageInput.value = ''; return; }
            const reader = new FileReader();
            reader.onload = (ev) => { editPreviewDiv.innerHTML = `<img src="${ev.target.result}" style="max-width:150px; border-radius:12px;">`; };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('saveEditBtn').onclick = async () => {
        const updatedGarments = [];
        document.querySelectorAll('#editGarmentsBody tr').forEach(row=>{
            const typeSel = row.querySelector('.edit-garment-type');
            let gType = typeSel?.value || 'Garment';
            let customPriceVal = null;
            if(gType === 'Custom'){
                const customInp = row.querySelector('.custom-price-edit');
                customPriceVal = customInp ? parseFloat(customInp.value) : 0;
            }
            updatedGarments.push({
                garmentType: gType,
                surname: row.querySelector('.edit-surname')?.value||'',
                number: row.querySelector('.edit-number')?.value||'',
                upperSize: row.querySelector('.edit-upper')?.value||'',
                lowerSize: row.querySelector('.edit-lower')?.value||'',
                notes: row.querySelector('.edit-notes')?.value||'',
                customPrice: customPriceVal
            });
        });

        let subTotalCalc = 0;
        updatedGarments.forEach(g => {
            if(g.garmentType === 'Jersey'){
                const fabPrice = settings.fabric.find(f=>f.name===document.getElementById('editFabric').value)?.price||0;
                const jerPrice = settings.jerseyType.find(j=>j.name===document.getElementById('editJersey').value)?.price||0;
                const lowPrice = settings.lowerType.find(l=>l.name===document.getElementById('editLower').value)?.price||0;
                subTotalCalc += fabPrice + jerPrice + lowPrice;
            } else if(g.garmentType === 'Custom'){
                subTotalCalc += (g.customPrice||0);
            } else {
                const gt = settings.garmentType.find(gt=>gt.name===g.garmentType);
                subTotalCalc += gt ? gt.price : 0;
            }
        });

        const discountAmount = parseFloat(document.getElementById('editDiscountAmount').value) || 0;
        let discountValue = Math.min(discountAmount, subTotalCalc);
        let totalPriceCalc = subTotalCalc - discountValue;
        const amountPaid = parseFloat(document.getElementById('editAmountPaid').value)||0;

        order.customer = document.getElementById('editCustomer').value;
        order.dateStarted = document.getElementById('editDateStarted').value;
        order.dateRelease = document.getElementById('editDateRelease').value;
        order.fabric = document.getElementById('editFabric').value;
        order.jerseyType = document.getElementById('editJersey').value;
        order.lowerType = document.getElementById('editLower').value;
        order.garments = updatedGarments;
        order.subTotal = subTotalCalc;
        order.discountAmount = discountAmount;
        order.discountValue = discountValue;
        order.totalPrice = totalPriceCalc;
        order.amountPaid = amountPaid;
        order.balanceDue = totalPriceCalc - amountPaid;
        order.totalPlayers = new Set(updatedGarments.map(g=>g.surname).filter(s => s && s.trim() !== '')).size;
        order.totalGarments = updatedGarments.length;
        order.notes = document.getElementById('editNotes').value;

        const newImageFile = document.getElementById('editDesignImageInput').files[0];
        if(newImageFile) {
            const reader = new FileReader();
            reader.onload = async (ev) => { order.designImage = ev.target.result; await saveOrders(); onSaveCallback(); };
            reader.readAsDataURL(newImageFile);
        } else {
            await saveOrders();
            onSaveCallback();
        }
    };
    document.getElementById('cancelEditBtn').onclick = () => { document.getElementById('editOrderModal').classList.add('hidden'); };
    calculateEditTotals();
}

// ---------- Receipt Preview & Download (unchanged but with dark text) ----------
let currentReceiptOrderId = null;
let currentReceiptElement = null;

function showReceiptPreview(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    currentReceiptOrderId = orderId;

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === '0001-01-01') return 'N/A';
        return dateStr;
    };

    const summary = getGarmentSummary(order);
    const garmentRowsHtml = summary.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0;">
            <div>
                <div style="font-weight: 600; color: #1e293b;">${escapeHtml(item.name)}</div>
                <div style="font-size: 0.85rem; color: #64748b;">Quantity: ${item.quantity}</div>
            </div>
            <div style="font-weight: 700; color: #f97316;">₱${item.totalPrice.toFixed(2)}</div>
        </div>
    `).join('') || '<div style="color: #64748b;">No garments</div>';

    const designImageHtml = order.designImage && order.designImage.startsWith('data:image')
        ? `<img src="${order.designImage}" alt="Design" style="max-width:100%; max-height:200px; border-radius:12px; margin-top:0.5rem;">`
        : '<div style="color:#94a3b8; font-style:italic;">No design uploaded</div>';

    const receiptHtml = `
        <div id="receiptToCapture" style="font-family: 'Inter', sans-serif; background: white; border-radius: 24px; overflow: hidden; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: #0a0f1a; color: #f97316; padding: 2rem; text-align: center;">
                <h1 style="font-size: 2rem; letter-spacing: -0.5px; margin:0;">⚡ BRIX ATHL</h1>
                <p style="color: #b9c7d9; margin-top: 0.5rem;">Garment Order Receipt</p>
            </div>

            <!-- Body -->
            <div style="padding: 2rem;">
                <!-- Order Info Grid -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f8f9fc; padding: 1rem; border-radius: 16px; margin-bottom: 2rem;">
                    <div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Team / Customer</div><div style="font-weight: 500; color: #1e293b;">${escapeHtml(order.customer)}</div></div>
                    <div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Order ID</div><div style="font-weight: 500; color: #1e293b;">${escapeHtml(order.id)}</div></div>
                    <div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Date Started</div><div style="font-weight: 500; color: #1e293b;">${formatDate(order.dateStarted)}</div></div>
                    <div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Date Wanted</div><div style="font-weight: 500; color: #1e293b;">${formatDate(order.dateRelease)}</div></div>
                    <div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Fabric</div><div style="font-weight: 500; color: #1e293b;">${order.fabric || 'N/A'}</div></div>
                    <div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Jersey Type</div><div style="font-weight: 500; color: #1e293b;">${order.jerseyType || 'N/A'}</div></div>
                    <div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Lower Type</div><div style="font-weight: 500; color: #1e293b;">${order.lowerType || 'N/A'}</div></div>
                    ${order.discountAmount > 0 ? `<div><div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Discount</div><div style="font-weight: 500; color: #10b981;">₱${order.discountAmount.toFixed(2)} OFF</div></div>` : ''}
                </div>

                <!-- Garment Summary -->
                <h3 style="font-size: 1.25rem; margin: 0 0 1rem 0; color: #1e293b;">🧾 Garment Summary</h3>
                <div style="margin-bottom: 1.5rem;">
                    ${garmentRowsHtml}
                </div>

                <!-- Totals -->
                <div style="background: #f1f5f9; padding: 1.25rem; border-radius: 16px; margin: 1.5rem 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 500; color: #1e293b;">Total Garments:</span>
                        <span style="font-weight: 600; color: #1e293b;">${order.totalGarments}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 500; color: #1e293b;">Players:</span>
                        <span style="font-weight: 600; color: #1e293b;">${order.totalPlayers}</span>
                    </div>
                    ${order.discountAmount > 0 ? `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="font-weight: 500; color: #1e293b;">Sub Total:</span>
                            <span style="text-decoration: line-through; color: #64748b;">₱${(order.subTotal || order.totalPrice + order.discountAmount).toFixed(2)}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span style="font-weight: 500; color: #1e293b;">Discount:</span>
                            <span style="color: #10b981;">-₱${order.discountAmount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 500; color: #1e293b;">Amount Paid:</span>
                        <span style="font-weight: 600; color: #1e293b;">₱${order.amountPaid.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 500; color: #1e293b;">Balance Due:</span>
                        <span style="font-weight: 600; color: #1e293b;">₱${order.balanceDue.toFixed(2)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 1rem; padding-top: 0.75rem; border-top: 2px solid #e2e8f0;">
                        <span style="font-weight: 700; font-size: 1.2rem; color: #1e293b;">Total Price:</span>
                        <span style="font-weight: 800; font-size: 1.4rem; color: #f97316;">₱${order.totalPrice.toFixed(2)}</span>
                    </div>
                </div>

                <!-- Design Image -->
                <div style="margin: 1.5rem 0; text-align: center;">
                    <div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Approved Design</div>
                    ${designImageHtml}
                </div>

                <!-- Notes -->
                <div style="margin-top: 1rem;">
                    <div style="font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem;">Notes</div>
                    <div style="color: #1e293b; margin-top: 0.25rem;">${escapeHtml(order.notes || '')}</div>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #f8f9fc; padding: 1.5rem; text-align: center; font-size: 0.75rem; color: #64748b; border-top: 1px solid #e2e8f0;">
                Thank you for your order!<br>Brix Athl – Futuristic Garments
            </div>
        </div>
    `;

    const container = document.getElementById('receiptContent');
    container.innerHTML = receiptHtml;
    currentReceiptElement = document.getElementById('receiptToCapture');
    document.getElementById('receiptModal').classList.remove('hidden');
}

function downloadCurrentReceipt() {
    if (!currentReceiptElement) {
        alert('No receipt to download.');
        return;
    }
    const order = orders.find(o => o.id === currentReceiptOrderId);
    if (!order) return;

    html2canvas(currentReceiptElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `receipt_${order.customer.replace(/\s/g, '_')}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
    }).catch(err => {
        console.error('Error generating receipt image:', err);
        alert('Could not generate receipt image. Please try again.');
    });
}

function getGarmentSummary(order) {
    const summaryMap = new Map();
    order.garments.forEach(g => {
        let unitPrice = 0;
        if (g.garmentType === 'Jersey') {
            const fabric = settings.fabric.find(f => f.name === order.fabric);
            const jersey = settings.jerseyType.find(j => j.name === order.jerseyType);
            const lower = settings.lowerType.find(l => l.name === order.lowerType);
            unitPrice = (fabric?.price || 0) + (jersey?.price || 0) + (lower?.price || 0);
        } else if (g.garmentType === 'Custom') {
            unitPrice = g.customPrice || 0;
        } else {
            const gt = settings.garmentType.find(gt => gt.name === g.garmentType);
            unitPrice = gt ? gt.price : 0;
        }
        const existing = summaryMap.get(g.garmentType);
        if (existing) {
            existing.quantity++;
            existing.totalPrice += unitPrice;
        } else {
            summaryMap.set(g.garmentType, { name: g.garmentType, quantity: 1, totalPrice: unitPrice, unitPrice: unitPrice });
        }
    });
    return Array.from(summaryMap.values());
}

// ---------- New Order Form Helpers ----------
function setupNewOrderImage() {
    const imgInput = document.getElementById('designImageInput');
    const previewDiv = document.getElementById('designImagePreview');
    imgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file && file.type.match('image.*')) {
            if(file.size > 2 * 1024 * 1024) { alert('Image too large (max 2MB)'); imgInput.value = ''; previewDiv.innerHTML = ''; return; }
            const reader = new FileReader();
            reader.onload = (ev) => { previewDiv.innerHTML = `<img src="${ev.target.result}" style="max-width:100%; border-radius:8px;">`; };
            reader.readAsDataURL(file);
        } else if(file) { alert('Please select JPG/PNG image'); imgInput.value = ''; previewDiv.innerHTML = ''; }
    });
}

window.updateTotals = function() {
    let subTotal = 0;
    const rows = document.querySelectorAll('#garmentsBody tr');
    rows.forEach(r => {
        const s = r.querySelector('.garment-select');
        if (s) {
            const val = s.value;
            if (val === 'Jersey') {
                const fp = parseFloat(document.querySelector('#fabricSelect option:checked')?.dataset?.price || 0);
                const jp = parseFloat(document.querySelector('#jerseyTypeSelect option:checked')?.dataset?.price || 0);
                const lp = parseFloat(document.querySelector('#lowerTypeSelect option:checked')?.dataset?.price || 0);
                subTotal += fp + jp + lp;
            } else if (val === 'Custom') {
                subTotal += 0;
            } else {
                subTotal += parseFloat(s.selectedOptions[0]?.dataset?.price) || 0;
            }
        }
    });

    const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
    let totalAfterDiscount = Math.max(0, subTotal - discountAmount);
    
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const balance = Math.max(0, totalAfterDiscount - paid);
    
    document.getElementById('balanceDue').innerText = '₱' + balance.toFixed(2);
    document.getElementById('totalGarments').innerText = rows.length;
    
    // Player count: only non‑empty surnames
    const uniqueSurnames = new Set();
    rows.forEach(r => { const sur = r.querySelector('.surname')?.value; if (sur && sur.trim() !== '') uniqueSurnames.add(sur); });
    document.getElementById('totalPlayers').innerText = uniqueSurnames.size;
    
    document.getElementById('subTotal').innerText = '₱' + subTotal.toFixed(2);
    document.getElementById('totalPrice').innerText = '₱' + totalAfterDiscount.toFixed(2);
    
    window.currentSubTotal = subTotal;
    window.currentTotalAfterDiscount = totalAfterDiscount;
    window.currentDiscountAmount = discountAmount;
};

// ---------- Export / Import (still works with local data, but we adapt) ----------
async function exportAllTeams() {
    const teams = [...new Set(orders.map(o=>o.customer))];
    if(teams.length===0) { alert('No teams to export'); return; }
    teams.forEach(team=>{
        const teamOrders = orders.filter(o=>o.customer===team);
        const data = { teamName: team, exportDate: new Date().toISOString(), orders: teamOrders };
        const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${team.replace(/[^a-z0-9]/gi,'_')}_orders.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    });
    alert(`Exported ${teams.length} team files`);
}
async function importTeamOrders() {
    const input = document.createElement('input');
    input.type='file';
    input.accept='.json';
    input.multiple=true;
    input.onchange=async(e)=>{
        const files=Array.from(e.target.files);
        let imported=0;
        for(const file of files){
            try{
                const text=await file.text();
                const data=JSON.parse(text);
                if(data.orders && Array.isArray(data.orders)){
                    for (const order of data.orders) {
                        if(!orders.some(o=>o.id===order.id)){
                            orders.push(order);
                            imported++;
                        }
                    }
                }
            }catch(e){}
        }
        if(imported>0){ await saveOrders(); alert(`Imported ${imported} orders`); }
        else alert('No new orders');
    };
    input.click();
}
async function exportTeamSummary() {
    const summary = [...new Set(orders.map(o=>o.customer))].map(team=>({
        teamName:team,
        toFile:orders.filter(o=>o.customer===team && o.status==='tofile').length,
        progress:orders.filter(o=>o.customer===team && o.status==='progress').length,
        completed:orders.filter(o=>o.customer===team && o.status==='completed').length,
        totalRevenue:orders.filter(o=>o.customer===team).reduce((s,o)=>s+o.totalPrice,0)
    }));
    const blob = new Blob([JSON.stringify({exportDate:new Date().toISOString(), summary},null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'team_summary.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

// ---------- Settings Dropdowns & Editor ----------
function populateDropdowns() {
    const fabricSel = document.getElementById('fabricSelect');
    if(fabricSel) fabricSel.innerHTML = settings.fabric.map(f=>`<option value="${f.name}" data-price="${f.price}">${f.name} (+₱${f.price})</option>`).join('');
    const jerseySel = document.getElementById('jerseyTypeSelect');
    if(jerseySel) jerseySel.innerHTML = settings.jerseyType.map(j=>`<option value="${j.name}" data-price="${j.price}">${j.name} (+₱${j.price})</option>`).join('');
    const lowerSel = document.getElementById('lowerTypeSelect');
    if(lowerSel) lowerSel.innerHTML = settings.lowerType.map(l=>`<option value="${l.name}" data-price="${l.price}">${l.name} (+₱${l.price})</option>`).join('');
}
function renderSettingsEditor() {
    const fabricDiv=document.getElementById('fabricSettings');
    fabricDiv.innerHTML=settings.fabric.map((item,i)=>`<div class="settings-row" style="display:flex; gap:1rem; margin-bottom:0.5rem;"><input type="text" value="${escapeHtml(item.name)}" data-fabric-name="${i}" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><input type="number" value="${item.price}" data-fabric-price="${i}" step="0.01" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><button class="remove-setting" data-type="fabric" data-index="${i}" style="background:#dc2626; border:none; padding:0.5rem 1rem; border-radius:20px; color:white;"><i class="fas fa-trash"></i></button></div>`).join('');
    const jerseyDiv=document.getElementById('jerseyTypeSettings');
    jerseyDiv.innerHTML=settings.jerseyType.map((item,i)=>`<div class="settings-row" style="display:flex; gap:1rem; margin-bottom:0.5rem;"><input type="text" value="${escapeHtml(item.name)}" data-jersey-name="${i}" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><input type="number" value="${item.price}" data-jersey-price="${i}" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><button class="remove-setting" data-type="jerseyType" data-index="${i}" style="background:#dc2626; border:none; padding:0.5rem 1rem; border-radius:20px;"><i class="fas fa-trash"></i></button></div>`).join('');
    const lowerDiv=document.getElementById('lowerTypeSettings');
    lowerDiv.innerHTML=settings.lowerType.map((item,i)=>`<div class="settings-row" style="display:flex; gap:1rem; margin-bottom:0.5rem;"><input type="text" value="${escapeHtml(item.name)}" data-lower-name="${i}" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><input type="number" value="${item.price}" data-lower-price="${i}" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><button class="remove-setting" data-type="lowerType" data-index="${i}" style="background:#dc2626; border:none; padding:0.5rem 1rem; border-radius:20px;"><i class="fas fa-trash"></i></button></div>`).join('');
    const garmentDiv=document.getElementById('garmentTypeSettings');
    garmentDiv.innerHTML=settings.garmentType.map((item,i)=>`<div class="settings-row" style="display:flex; gap:1rem; margin-bottom:0.5rem;"><input type="text" value="${escapeHtml(item.name)}" data-garment-name="${i}" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><input type="number" value="${item.price}" data-garment-price="${i}" style="background:#1e2a36; border:1px solid #f97316; color:#fff; padding:0.5rem; border-radius:12px;"><button class="remove-setting" data-type="garmentType" data-index="${i}" style="background:#dc2626; border:none; padding:0.5rem 1rem; border-radius:20px;"><i class="fas fa-trash"></i></button></div>`).join('');
}

// ---------- Reset All Data ----------
async function resetAllData() {
    if (!confirm('Delete ALL orders and reset settings to default?')) return;
    // Delete all orders
    const { error: deleteError } = await supabaseClient.from('orders').delete().neq('id', '');
    if (deleteError) console.error(deleteError);
    // Reset settings to default
    settings = {
        fabric: [{ name: 'Mesh', price: 0 }, { name: 'Polyester', price: 0 }],
        jerseyType: [{ name: 'V-neck U-cut', price: 0 }, { name: 'Crew neck', price: 0 }],
        lowerType: [{ name: 'With lining', price: 0 }, { name: 'Without lining', price: 0 }],
        garmentType: [{ name: 'Hoodie', price: 800 }, { name: 'Jersey', price: 300 }, { name: 'Shorts', price: 0 }]
    };
    await saveSettings();
    // Clear local array
    orders = [];
    refreshAllDisplays();
    alert('All data reset.');
}

// ---------- DOMContentLoaded ----------
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    populateDropdowns();
    renderSettingsEditor();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateStarted').value = today;
    setupNewOrderImage();

    const addRow = () => {
        const tbody = document.getElementById('garmentsBody');
        const row = document.createElement('tr');
        const defaultOptions = settings.garmentType.map(gt=>`<option value="${gt.name}" data-price="${gt.price}">${gt.name}</option>`).join('') + '<option value="Jersey">Jersey (dynamic)</option><option value="Custom">Custom</option>';
        row.innerHTML = `  <td><select class="garment-select">${defaultOptions}</select></td>
                           <td><input type="text" class="surname"></td>
                           <td><input type="text" class="number"></td>
                           <td><input type="text" class="upper-size"></td>
                           <td><input type="text" class="lower-size"></td>
                           <td><input type="text" class="notes"></td>
                           <td><i class="fas fa-times remove-row"></i></td>`;
        tbody.appendChild(row);
        row.querySelector('.remove-row').onclick = () => { row.remove(); updateTotals(); };
        row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateTotals));
        updateTotals();
    };
    document.getElementById('addGarmentBtn').onclick = addRow;
    addRow();

    document.getElementById('orderForm').onsubmit = async (e) => {
        e.preventDefault();
        const customer = document.getElementById('customer').value;
        if(!customer) return alert('Enter team name');
        const garments = [];
        document.querySelectorAll('#garmentsBody tr').forEach(row=>{
            garments.push({
                garmentType: row.querySelector('.garment-select').value,
                surname: row.querySelector('.surname').value,
                number: row.querySelector('.number').value,
                upperSize: row.querySelector('.upper-size').value,
                lowerSize: row.querySelector('.lower-size').value,
                notes: row.querySelector('.notes').value
            });
        });
        const subTotal = window.currentSubTotal || 0;
        const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
        const discountValue = Math.min(discountAmount, subTotal);
        const totalPrice = subTotal - discountValue;
        const amountPaid = parseFloat(document.getElementById('amountPaid').value)||0;
        let designImage = '';
        const fileInput = document.getElementById('designImageInput');
        
        const saveOrder = async (imageData) => {
            const newOrder = {
                id:'ORD-'+Date.now(),
                customer,
                dateStarted: document.getElementById('dateStarted').value,
                dateRelease: document.getElementById('dateRelease').value,
                fabric: document.getElementById('fabricSelect').value,
                jerseyType: document.getElementById('jerseyTypeSelect').value,
                lowerType: document.getElementById('lowerTypeSelect').value,
                garments,
                totalPlayers: document.getElementById('totalPlayers').innerText,
                totalGarments: document.getElementById('totalGarments').innerText,
                subTotal: subTotal,
                discountAmount: discountAmount,
                discountValue: discountValue,
                totalPrice: totalPrice,
                amountPaid: amountPaid,
                balanceDue: totalPrice - amountPaid,
                notes: document.getElementById('orderNotes').value,
                status: 'tofile',
                createdAt: new Date().toISOString(),
                designImage: imageData || null
            };
            orders.push(newOrder);
            await saveOrders();
            document.getElementById('orderForm').reset();
            document.getElementById('dateStarted').value=today;
            document.getElementById('garmentsBody').innerHTML='';
            document.getElementById('discountAmount').value = 0;
            addRow();
            updateTotals();
            document.getElementById('designImagePreview').innerHTML = '';
            document.getElementById('designImageInput').value = '';
            switchTab('tofile');
            alert('Order created');
        };
        
        if(fileInput.files[0]) {
            const reader = new FileReader();
            reader.onload = async (ev) => { await saveOrder(ev.target.result); };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            await saveOrder();
        }
    };
    
    document.getElementById('clearForm').onclick = () => {
        document.getElementById('orderForm').reset();
        document.getElementById('dateStarted').value=today;
        document.getElementById('garmentsBody').innerHTML='';
        document.getElementById('discountAmount').value = 0;
        addRow();
        updateTotals();
        document.getElementById('designImagePreview').innerHTML = '';
        document.getElementById('designImageInput').value = '';
    };
    
    document.getElementById('amountPaid').addEventListener('input', updateTotals);
    document.getElementById('fabricSelect').addEventListener('change', updateTotals);
    document.getElementById('jerseyTypeSelect').addEventListener('change', updateTotals);
    document.getElementById('lowerTypeSelect').addEventListener('change', updateTotals);
    document.getElementById('discountAmount').addEventListener('input', updateTotals);

    // Settings save
    document.getElementById('saveSettings').onclick = async () => {
        settings.fabric=[]; document.querySelectorAll('#fabricSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.fabric.push({name,price}); });
        settings.jerseyType=[]; document.querySelectorAll('#jerseyTypeSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.jerseyType.push({name,price}); });
        settings.lowerType=[]; document.querySelectorAll('#lowerTypeSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.lowerType.push({name,price}); });
        settings.garmentType=[]; document.querySelectorAll('#garmentTypeSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.garmentType.push({name,price}); });
        await saveSettings();
        alert('Settings saved');
    };
    document.querySelectorAll('.add-setting-btn').forEach(btn=>{
        btn.onclick=()=>{
            const type=btn.dataset.type;
            if(type==='fabric') settings.fabric.push({name:'New Fabric',price:0});
            if(type==='jerseyType') settings.jerseyType.push({name:'New Jersey',price:0});
            if(type==='lowerType') settings.lowerType.push({name:'New Lower',price:0});
            if(type==='garmentType') settings.garmentType.push({name:'New Garment',price:0});
            renderSettingsEditor();
        };
    });
    document.addEventListener('click',(e)=>{
        const btn=e.target.closest('.remove-setting');
        if(btn){
            const type=btn.dataset.type;
            const idx=parseInt(btn.dataset.index);
            if(type==='fabric') settings.fabric.splice(idx,1);
            if(type==='jerseyType') settings.jerseyType.splice(idx,1);
            if(type==='lowerType') settings.lowerType.splice(idx,1);
            if(type==='garmentType') settings.garmentType.splice(idx,1);
            renderSettingsEditor();
        }
    });
    document.getElementById('exportMasterBtn').onclick = () => {
        const blob=new Blob([JSON.stringify({orders,settings,exportDate:new Date().toISOString()},null,2)],{type:'application/json'});
        const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='brix_master.json'; a.click(); URL.revokeObjectURL(a.href);
    };
    document.getElementById('importMasterBtn').onclick = () => {
        const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
        inp.onchange=e=>{ const file=e.target.files[0]; const reader=new FileReader();
            reader.onload=async ev=>{ try{ const data=JSON.parse(ev.target.result); if(data.orders) orders=data.orders; if(data.settings) settings=data.settings; await saveOrders(); await saveSettings(); alert('Imported'); }catch(err){ alert('Invalid file'); } };
            reader.readAsText(file);
        }; inp.click();
    };
    document.getElementById('resetDataBtn').onclick = resetAllData;
    document.getElementById('closeModal').onclick = () => document.getElementById('orderModal').classList.add('hidden');
    document.getElementById('closeModalBtn').onclick = () => document.getElementById('orderModal').classList.add('hidden');
    document.getElementById('closeEditModal').onclick = () => document.getElementById('editOrderModal').classList.add('hidden');
    
    // Receipt modal handlers
    document.getElementById('closeReceiptModal').onclick = () => document.getElementById('receiptModal').classList.add('hidden');
    document.getElementById('closeReceiptModalBtn').onclick = () => document.getElementById('receiptModal').classList.add('hidden');
    document.getElementById('downloadReceiptBtn').onclick = downloadCurrentReceipt;
    
    document.getElementById('exportAllTeamsBtn').onclick = exportAllTeams;
    document.getElementById('importTeamOrdersBtn').onclick = importTeamOrders;
    document.getElementById('exportTeamSummaryBtn').onclick = exportTeamSummary;

    window.switchTab = (tabId) => {
        document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
        document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');
        Object.values({dashboard:document.getElementById('tab-dashboard'),new:document.getElementById('tab-new'),tofile:document.getElementById('tab-tofile'),progress:document.getElementById('tab-progress'),completed:document.getElementById('tab-completed'),settings:document.getElementById('tab-settings')}).forEach(t=>t.classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        if(tabId==='tofile'||tabId==='progress'||tabId==='completed') renderOrdersByStatus();
    };
    document.querySelectorAll('.nav-item').forEach(item=>{ item.addEventListener('click',()=>switchTab(item.dataset.tab)); });
    refreshAllDisplays();
});
