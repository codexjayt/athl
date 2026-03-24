const STORAGE_KEY_ORDERS = 'brixOrders';
const STORAGE_KEY_SETTINGS = 'brixSettings';
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

// ---------- Data Persistence ----------
function loadData() {
    const savedOrders = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (savedOrders) orders = JSON.parse(savedOrders);
    const savedSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (savedSettings) settings = JSON.parse(savedSettings);
}
function saveOrders() { localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders)); refreshAllDisplays(); }
function saveSettings() { localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings)); populateDropdowns(); renderSettingsEditor(); }
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
    const discountBadge = order.discountValue > 0 ? `<span class="discount-badge" style="font-size:0.6rem; margin-left:0.5rem;">${order.discountPercent > 0 ? `${order.discountPercent}% OFF` : `-₱${order.discountValue}`}</span>` : '';
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
                    ${order.discountValue > 0 ? `<span class="original-price">₱${order.subTotal?.toFixed(2) || (order.totalPrice + order.discountValue).toFixed(2)}</span> ` : ''}
                    ₱${order.totalPrice.toFixed(2)} | Paid: ₱${order.amountPaid}
                </div>
            </div>
        </div>
        <div class="flex-btns">
            <button class="print-receipt-btn" onclick="event.stopPropagation(); printReceipt('${order.id}')"><i class="fas fa-print"></i> Receipt</button>
            <button class="edit-order-btn" onclick="event.stopPropagation(); openEditOrderModal('${order.id}')"><i class="fas fa-pencil-alt"></i> Edit</button>
            ${actionBtn}
        </div>
    </div>`;
}

function confirmStatusChange(orderId, newStatus) {
    const msg = newStatus === 'progress' ? 'Move this order to IN PROGRESS?' : 'Mark this order as COMPLETED?';
    if (confirm(msg)) changeOrderStatus(orderId, newStatus);
}
function changeOrderStatus(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    if(order) { order.status = newStatus; if (newStatus === 'completed') order.completedAt = new Date().toISOString(); saveOrders(); }
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

// ---------- Order Detail Modal (with notes & sort) ----------
function openOrderModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    
    document.getElementById('modalCustomer').innerText = order.customer;
    
    // Sort garments: by upper size (3XS → 5XL), then by surname
    const sorted = [...order.garments].sort((a, b) => {
        const sizeDiff = getSizeRank(a.upperSize) - getSizeRank(b.upperSize);
        if (sizeDiff !== 0) return sizeDiff;
        return (a.surname || '').localeCompare(b.surname || '');
    });
    
    // Build garment rows including Notes column
    const garmentRowsHtml = sorted.map(g => `
        <tr class="garment-row">
            <td><span class="garment-type-badge">${escapeHtml(g.garmentType)}</span></td>
            <td>${escapeHtml(g.surname) || '—'}</td>
            <td>${escapeHtml(g.number) || '—'}</td>
            <td><span class="size-tag">${escapeHtml(g.upperSize) || '—'}</span></td>
            <td><span class="size-tag">${escapeHtml(g.lowerSize) || '—'}</span></td>
            <td class="notes-cell">${escapeHtml(g.notes) || '—'}</td>
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
                ${order.discountValue > 0 ? `
                <div class="info-row"><div class="info-label">Discount</div><div class="info-value"><span class="discount-badge">${order.discountPercent > 0 ? `${order.discountPercent}% OFF` : `₱${order.discountAmount.toFixed(2)} OFF`}</span></div></div>
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
                        <thead><tr><th>Type</th><th>Surname</th><th>#</th><th>Upper</th><th>Lower</th><th>Notes</th></tr></thead>
                        <tbody>${garmentRowsHtml}</tbody>
                    </table>
                </div>
            </div>
            
            <div class="totals-section">
                <div class="total-card"><div class="total-label-sm">Total Garments</div><div class="total-value-sm">${order.totalGarments}</div></div>
                <div class="total-card"><div class="total-label-sm">Players</div><div class="total-value-sm">${order.totalPlayers}</div></div>
                ${order.discountValue > 0 ? `
                <div class="total-card"><div class="total-label-sm">Sub Total</div><div class="total-value-sm" style="text-decoration: line-through; color: #94a3b8;">₱${(order.subTotal || order.totalPrice + order.discountValue).toFixed(2)}</div></div>
                <div class="total-card"><div class="total-label-sm">Discount</div><div class="total-value-sm" style="color: #10b981;">-₱${order.discountValue.toFixed(2)}</div></div>
                ` : ''}
                <div class="total-card"><div class="total-label-sm">Amount Paid</div><div class="total-value-sm">₱${order.amountPaid.toFixed(2)}</div></div>
                <div class="total-card"><div class="total-label-sm">Total Price</div><div class="total-value-sm highlight">₱${order.totalPrice.toFixed(2)}</div></div>
            </div>
            
            ${designHtml}
            ${notesHtml}
            
            <div class="modal-actions">
                <button class="btn-receipt" onclick="event.stopPropagation(); document.getElementById('orderModal').classList.add('hidden'); printReceipt('${order.id}');"><i class="fas fa-print"></i> Print Receipt</button>
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

// ---------- Edit Order Modal (full with discount and image) ----------
function openEditOrderModal(orderId) {
    const order = orders.find(o => o.id === orderId);
    if(!order) return;
    const modalDiv = document.getElementById('editOrderFormContainer');
    modalDiv.innerHTML = `<div id="editOrderInner"></div>`;
    const container = document.getElementById('editOrderInner');
    renderEditForm(order, container, () => {
        document.getElementById('editOrderModal').classList.add('hidden');
        saveOrders();
        refreshAllDisplays();
    });
    document.getElementById('editOrderModal').classList.remove('hidden');
}

function renderEditForm(order, container, onSaveCallback) {
    let garmentsHtml = '';
    order.garments.forEach((g, idx) => {
        garmentsHtml += `<tr data-gidx="${idx}">
            <td><select class="edit-garment-type" data-idx="${idx}">${settings.garmentType.map(gt => `<option value="${gt.name}" ${g.garmentType === gt.name ? 'selected' : ''}>${gt.name}</option>`).join('')}<option value="Jersey">Jersey (dynamic)</option><option value="Custom">Custom</option></select></td>
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
                <div class="form-group"><label>Date Started</label><input type="date" id="editDateStarted" value="${order.dateStarted || ''}"></div>
                <div class="form-group"><label>Date Release</label><input type="date" id="editDateRelease" value="${order.dateRelease || ''}"></div>
            </div>
            <div class="form-row" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:1rem;">
                <div class="form-group"><label>Fabric</label><select id="editFabric">${settings.fabric.map(f => `<option value="${f.name}" ${order.fabric === f.name ? 'selected' : ''}>${f.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>Jersey Type</label><select id="editJersey">${settings.jerseyType.map(j => `<option value="${j.name}" ${order.jerseyType === j.name ? 'selected' : ''}>${j.name}</option>`).join('')}</select></div>
                <div class="form-group"><label>Lower Type</label><select id="editLower">${settings.lowerType.map(l => `<option value="${l.name}" ${order.lowerType === l.name ? 'selected' : ''}>${l.name}</option>`).join('')}</select></div>
            </div>
            <div class="form-group"><label>Discount %</label><input type="number" id="editDiscountPercent" value="${order.discountPercent || 0}" step="0.5"></div>
            <div class="form-group"><label>Discount Amount (₱)</label><input type="number" id="editDiscountAmount" value="${order.discountAmount || 0}" step="0.01"></div>
            <h3 style="color:#f97316;">Garments</h3>
            <table class="garments-table"><thead><tr><th>Type</th><th>Surname</th><th>#</th><th>Upper Size</th><th>Lower Size</th><th>Notes</th><th></th></tr></thead><tbody id="editGarmentsBody">${garmentsHtml}</tbody></table>
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
            <div class="form-group"><label>Notes</label><textarea id="editNotes" rows="2">${escapeHtml(order.notes || '')}</textarea></div>
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
            if (typeSelect) {
                const val = typeSelect.value;
                if (val === 'Jersey') {
                    const fabricPrice = parseFloat(document.querySelector('#editFabric option:checked')?.dataset?.price || 0);
                    const jerseyPrice = parseFloat(document.querySelector('#editJersey option:checked')?.dataset?.price || 0);
                    const lowerPrice = parseFloat(document.querySelector('#editLower option:checked')?.dataset?.price || 0);
                    subTotal += fabricPrice + jerseyPrice + lowerPrice;
                } else if (val === 'Custom') {
                    const customInp = row.querySelector('.custom-price-edit');
                    if (customInp) subTotal += parseFloat(customInp.value) || 0;
                } else {
                    const opt = typeSelect.options[typeSelect.selectedIndex];
                    const price = parseFloat(opt?.dataset?.price) || 0;
                    subTotal += price;
                }
            }
        });

        const discountPercent = parseFloat(document.getElementById('editDiscountPercent').value) || 0;
        const discountAmount = parseFloat(document.getElementById('editDiscountAmount').value) || 0;
        let totalAfterDiscount = subTotal;
        let discountValue = 0;

        if (discountAmount > 0) {
            discountValue = Math.min(discountAmount, subTotal);
            totalAfterDiscount = subTotal - discountValue;
        } else if (discountPercent > 0) {
            discountValue = (subTotal * discountPercent) / 100;
            totalAfterDiscount = subTotal - discountValue;
        }

        document.getElementById('editSubTotal').innerText = '₱' + subTotal.toFixed(2);
        document.getElementById('editTotalPrice').innerText = '₱' + totalAfterDiscount.toFixed(2);
    }

    function refreshEditGarmentSelects() {
        document.querySelectorAll('#editGarmentsBody tr').forEach(row => {
            const sel = row.querySelector('.edit-garment-type');
            if (sel && !row.querySelector('.custom-price-edit')) {
                // Save current value
                const currentVal = sel.value;
                // Rebuild options
                sel.innerHTML = settings.garmentType.map(g => `<option value="${g.name}" data-price="${g.price}">${g.name}</option>`).join('') +
                    '<option value="Jersey">Jersey (dynamic)</option><option value="Custom">Custom</option>';
                // Restore value if possible
                if (currentVal && Array.from(sel.options).some(opt => opt.value === currentVal)) {
                    sel.value = currentVal;
                } else {
                    sel.value = 'Jersey';
                }
                // Set onchange handler
                sel.onchange = () => {
                    if (sel.value === 'Custom') {
                        if (!row.querySelector('.custom-price-edit')) {
                            const td = sel.closest('td');
                            const input = document.createElement('input');
                            input.type = 'number';
                            input.placeholder = 'Price';
                            input.className = 'custom-price-edit';
                            input.style.width = '100%';
                            td.appendChild(input);
                        }
                    } else {
                        const custom = row.querySelector('.custom-price-edit');
                        if (custom) custom.remove();
                    }
                    calculateEditTotals();
                };
                // If value is Custom, add the price input
                if (sel.value === 'Custom') {
                    if (!row.querySelector('.custom-price-edit')) {
                        const td = sel.closest('td');
                        const input = document.createElement('input');
                        input.type = 'number';
                        input.placeholder = 'Price';
                        input.className = 'custom-price-edit';
                        input.style.width = '100%';
                        td.appendChild(input);
                    }
                }
                calculateEditTotals();
            }
        });
    }

    refreshEditGarmentSelects();

    document.getElementById('editAddGarmentBtn').onclick = () => {
        const tbody = document.getElementById('editGarmentsBody');
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td><select class="edit-garment-type"></select></td>
            <td><input type="text" class="edit-surname"></td>
            <td><input type="text" class="edit-number"></td>
            <td><input type="text" class="edit-upper"></td>
            <td><input type="text" class="edit-lower"></td>
            <td><input type="text" class="edit-notes"></td>
            <td><i class="fas fa-times remove-row"></i></td>
        `;
        tbody.appendChild(newRow);
        // Manually set up the new select
        const sel = newRow.querySelector('.edit-garment-type');
        sel.innerHTML = settings.garmentType.map(g => `<option value="${g.name}" data-price="${g.price}">${g.name}</option>`).join('') +
            '<option value="Jersey">Jersey (dynamic)</option><option value="Custom">Custom</option>';
        sel.value = 'Jersey';
        sel.onchange = () => {
            if (sel.value === 'Custom') {
                if (!newRow.querySelector('.custom-price-edit')) {
                    const td = sel.closest('td');
                    const inp = document.createElement('input');
                    inp.type = 'number';
                    inp.placeholder = 'Price';
                    inp.className = 'custom-price-edit';
                    inp.style.width = '100%';
                    td.appendChild(inp);
                }
            } else {
                const custom = newRow.querySelector('.custom-price-edit');
                if (custom) custom.remove();
            }
            calculateEditTotals();
        };
        newRow.querySelector('.remove-row').onclick = () => {
            newRow.remove();
            calculateEditTotals();
        };
        calculateEditTotals();
    };

    document.getElementById('editFabric').addEventListener('change', calculateEditTotals);
    document.getElementById('editJersey').addEventListener('change', calculateEditTotals);
    document.getElementById('editLower').addEventListener('change', calculateEditTotals);
    document.getElementById('editDiscountPercent').addEventListener('input', function () {
        if (this.value > 0) document.getElementById('editDiscountAmount').value = 0;
        calculateEditTotals();
    });
    document.getElementById('editDiscountAmount').addEventListener('input', function () {
        if (this.value > 0) document.getElementById('editDiscountPercent').value = 0;
        calculateEditTotals();
    });
    document.getElementById('editAmountPaid').addEventListener('input', calculateEditTotals);

    // Image handling
    const editImageInput = document.getElementById('editDesignImageInput');
    const editPreviewDiv = document.getElementById('editDesignPreview');
    editImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.match('image.*')) {
            if (file.size > 2 * 1024 * 1024) {
                alert('Image too large (max 2MB)');
                editImageInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                editPreviewDiv.innerHTML = `<img src="${ev.target.result}" style="max-width:150px; border-radius:12px;">`;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('saveEditBtn').onclick = () => {
        const updatedGarments = [];
        document.querySelectorAll('#editGarmentsBody tr').forEach(row => {
            const typeSel = row.querySelector('.edit-garment-type');
            let gType = typeSel?.value || 'Garment';
            let customPriceVal = null;
            if (gType === 'Custom') {
                const customInp = row.querySelector('.custom-price-edit');
                customPriceVal = customInp ? parseFloat(customInp.value) : 0;
            }
            updatedGarments.push({
                garmentType: gType,
                surname: row.querySelector('.edit-surname')?.value || '',
                number: row.querySelector('.edit-number')?.value || '',
                upperSize: row.querySelector('.edit-upper')?.value || '',
                lowerSize: row.querySelector('.edit-lower')?.value || '',
                notes: row.querySelector('.edit-notes')?.value || '',
                customPrice: customPriceVal
            });
        });

        let subTotalCalc = 0;
        updatedGarments.forEach(g => {
            if (g.garmentType === 'Jersey') {
                const fabPrice = settings.fabric.find(f => f.name === document.getElementById('editFabric').value)?.price || 0;
                const jerPrice = settings.jerseyType.find(j => j.name === document.getElementById('editJersey').value)?.price || 0;
                const lowPrice = settings.lowerType.find(l => l.name === document.getElementById('editLower').value)?.price || 0;
                subTotalCalc += fabPrice + jerPrice + lowPrice;
            } else if (g.garmentType === 'Custom') {
                subTotalCalc += (g.customPrice || 0);
            } else {
                const gt = settings.garmentType.find(gt => gt.name === g.garmentType);
                subTotalCalc += gt ? gt.price : 0;
            }
        });

        const discountPercent = parseFloat(document.getElementById('editDiscountPercent').value) || 0;
        const discountAmount = parseFloat(document.getElementById('editDiscountAmount').value) || 0;
        let discountValue = 0;
        let totalPriceCalc = subTotalCalc;

        if (discountAmount > 0) {
            discountValue = Math.min(discountAmount, subTotalCalc);
            totalPriceCalc = subTotalCalc - discountValue;
        } else if (discountPercent > 0) {
            discountValue = (subTotalCalc * discountPercent) / 100;
            totalPriceCalc = subTotalCalc - discountValue;
        }

        const amountPaid = parseFloat(document.getElementById('editAmountPaid').value) || 0;

        order.customer = document.getElementById('editCustomer').value;
        order.dateStarted = document.getElementById('editDateStarted').value;
        order.dateRelease = document.getElementById('editDateRelease').value;
        order.fabric = document.getElementById('editFabric').value;
        order.jerseyType = document.getElementById('editJersey').value;
        order.lowerType = document.getElementById('editLower').value;
        order.garments = updatedGarments;
        order.subTotal = subTotalCalc;
        order.discountPercent = discountPercent;
        order.discountAmount = discountAmount;
        order.discountValue = discountValue;
        order.totalPrice = totalPriceCalc;
        order.amountPaid = amountPaid;
        order.balanceDue = totalPriceCalc - amountPaid;
        order.totalPlayers = new Set(updatedGarments.map(g => g.surname).filter(Boolean)).size;
        order.totalGarments = updatedGarments.length;
        order.notes = document.getElementById('editNotes').value;

        const newImageFile = document.getElementById('editDesignImageInput').files[0];
        if (newImageFile) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                order.designImage = ev.target.result;
                saveOrders();
                onSaveCallback();
            };
            reader.readAsDataURL(newImageFile);
        } else {
            saveOrders();
            onSaveCallback();
        }
    };
    document.getElementById('cancelEditBtn').onclick = () => {
        document.getElementById('editOrderModal').classList.add('hidden');
    };
    calculateEditTotals();
}


// ---------- Receipt (with discount and design image) ----------
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

function printReceipt(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const summary = getGarmentSummary(order);
    const garmentRowsHtml = summary.map(item => `
        <div class="garment-item"><div><span class="garment-name">${escapeHtml(item.name)}</span><div class="garment-quantity">Quantity: ${item.quantity}</div></div><div class="garment-price">₱${item.totalPrice.toFixed(2)}</div></div>
    `).join('');

    const designImageHtml = order.designImage ? `<img src="${order.designImage}" alt="Design">` : '<div class="no-image">No design uploaded</div>';

    const receiptHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Receipt - ${escapeHtml(order.customer)}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Inter', sans-serif; background: #f4f4f8; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 2rem; }
.receipt { max-width: 700px; width: 100%; background: white; border-radius: 24px; box-shadow: 0 20px 35px -10px rgba(0,0,0,0.2); overflow: hidden; }
.receipt-header { background: #0a0f1a; color: #f97316; padding: 2rem; text-align: center; }
.receipt-header h1 { font-size: 2rem; letter-spacing: -0.5px; }
.receipt-header p { color: #b9c7d9; margin-top: 0.5rem; }
.receipt-body { padding: 2rem; }
.order-info { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; background: #f8f9fc; padding: 1rem; border-radius: 16px; margin-bottom: 2rem; }
.info-item { font-size: 0.9rem; }
.info-label { font-weight: 600; color: #f97316; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px; }
.info-value { font-weight: 500; color: #1e293b; margin-top: 0.25rem; }
.garment-summary { margin: 1.5rem 0; border-top: 1px solid #e2e8f0; padding-top: 1rem; }
.garment-item { display: flex; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid #eef2ff; }
.garment-name { font-weight: 500; color: #1e293b; }
.garment-price { font-weight: 600; color: #f97316; }
.garment-quantity { color: #64748b; font-size: 0.85rem; }
.totals { background: #f1f5f9; padding: 1rem; border-radius: 16px; margin: 1.5rem 0; text-align: right; }
.totals p { margin: 0.25rem 0; }
.totals .total-price { font-size: 1.5rem; font-weight: 800; color: #f97316; }
.design-image { margin: 1rem 0; text-align: center; }
.design-image img { max-width: 100%; max-height: 300px; border-radius: 12px; border: 1px solid #e2e8f0; object-fit: contain; }
.no-image { color: #94a3b8; font-style: italic; }
.receipt-footer { background: #f8f9fc; padding: 1.5rem; text-align: center; font-size: 0.75rem; color: #64748b; border-top: 1px solid #e2e8f0; }
@media print { body { background: white; padding: 0; } .no-print { display: none; } .receipt { box-shadow: none; } }
.no-print { text-align: center; margin-top: 1rem; }
.print-btn { background: #f97316; color: white; border: none; padding: 0.75rem 2rem; border-radius: 40px; font-weight: 600; cursor: pointer; }
</style>
</head>
<body>
<div class="receipt">
    <div class="receipt-header"><h1>⚡ BRIX ATHL</h1><p>Garment Order Receipt</p></div>
    <div class="receipt-body">
        <div class="order-info">
            <div class="info-item"><div class="info-label">Team / Customer</div><div class="info-value">${escapeHtml(order.customer)}</div></div>
            <div class="info-item"><div class="info-label">Order ID</div><div class="info-value">${escapeHtml(order.id)}</div></div>
            <div class="info-item"><div class="info-label">Date Started</div><div class="info-value">${order.dateStarted || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Date Wanted</div><div class="info-value">${order.dateRelease || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Fabric</div><div class="info-value">${order.fabric || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Jersey Type</div><div class="info-value">${order.jerseyType || 'N/A'}</div></div>
            <div class="info-item"><div class="info-label">Lower Type</div><div class="info-value">${order.lowerType || 'N/A'}</div></div>
            ${order.discountValue > 0 ? `<div class="info-item"><div class="info-label">Discount</div><div class="info-value" style="color:#10b981;">${order.discountPercent > 0 ? `${order.discountPercent}% OFF` : `₱${order.discountAmount.toFixed(2)} OFF`} (Save: ₱${order.discountValue.toFixed(2)})</div></div>` : ''}
        </div>
        <h3 style="margin-bottom: 0.75rem;">🧾 Garment Summary</h3>
        <div class="garment-summary">${garmentRowsHtml}</div>
        <div class="totals">
            <p><strong>Total Garments:</strong> ${order.totalGarments}</p>
            <p><strong>Players:</strong> ${order.totalPlayers}</p>
            ${order.discountValue > 0 ? `<p><strong>Sub Total:</strong> <span style="text-decoration: line-through;">₱${(order.subTotal || order.totalPrice + order.discountValue).toFixed(2)}</span></p><p><strong>Discount:</strong> <span style="color:#10b981;">-₱${order.discountValue.toFixed(2)}</span></p>` : ''}
            <p><strong>Amount Paid:</strong> ₱${order.amountPaid.toFixed(2)}</p>
            <p><strong>Balance Due:</strong> ₱${order.balanceDue.toFixed(2)}</p>
            <p class="total-price">Total Price: ₱${order.totalPrice.toFixed(2)}</p>
        </div>
        <div class="design-image"><div class="info-label">Approved Design</div>${designImageHtml}</div>
        <div class="info-item"><div class="info-label">Notes</div><div class="info-value">${escapeHtml(order.notes || '')}</div></div>
    </div>
    <div class="receipt-footer">Thank you for your order!<br>Brix Athl – Futuristic Garments</div>
</div>
<div class="no-print"><button class="print-btn" onclick="window.print()">🖨️ Print Receipt</button></div>
</body>
</html>`;
    const win = window.open();
    win.document.write(receiptHtml);
    win.document.close();
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
    
    const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
    const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
    let totalAfterDiscount = subTotal;
    
    if (discountAmount > 0) {
        totalAfterDiscount = subTotal - Math.min(discountAmount, subTotal);
    } else if (discountPercent > 0) {
        totalAfterDiscount = subTotal - (subTotal * discountPercent / 100);
    }
    
    const paid = parseFloat(document.getElementById('amountPaid').value) || 0;
    const balance = Math.max(0, totalAfterDiscount - paid);
    
    // Only show players, garments, discount inputs, balance due on new order
    document.getElementById('balanceDue').innerText = '₱' + balance.toFixed(2);
    document.getElementById('totalGarments').innerText = rows.length;
    
    const uniqueSurnames = new Set();
    rows.forEach(r => { const sur = r.querySelector('.surname')?.value; if (sur) uniqueSurnames.add(sur); });
    document.getElementById('totalPlayers').innerText = uniqueSurnames.size;
    
    // Store subtotal and total after discount for later saving
    window.currentSubTotal = subTotal;
    window.currentTotalAfterDiscount = totalAfterDiscount;
};

// ---------- Export / Import ----------
function exportAllTeams() {
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
function importTeamOrders() {
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
                    data.orders.forEach(order=>{
                        if(!orders.some(o=>o.id===order.id)){
                            orders.push(order);
                            imported++;
                        }
                    });
                }
            }catch(e){}
        }
        if(imported>0){ saveOrders(); alert(`Imported ${imported} orders`); }
        else alert('No new orders');
    };
    input.click();
}
function exportTeamSummary() {
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

// ---------- DOMContentLoaded ----------
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    populateDropdowns();
    renderSettingsEditor();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateStarted').value = today;
    setupNewOrderImage();

    const addRow = () => {
        const tbody = document.getElementById('garmentsBody');
        const row = document.createElement('tr');
        row.innerHTML = `<td><select class="garment-select"></select></td><td><input type="text" class="surname"></td><td><input type="text" class="number"></td><td><input type="text" class="upper-size"></td><td><input type="text" class="lower-size"></td><td><input type="text" class="notes"></td><td><i class="fas fa-times remove-row"></i></td>`;
        tbody.appendChild(row);
        const sel = row.querySelector('.garment-select');
        sel.innerHTML = settings.garmentType.map(g=>`<option value="${g.name}" data-price="${g.price}">${g.name}</option>`).join('')+'<option value="Jersey">Jersey (dynamic)</option><option value="Custom">Custom</option>';
        row.querySelector('.remove-row').onclick = () => { row.remove(); updateTotals(); };
        sel.onchange = () => { updateTotals(); };
        row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', updateTotals));
        updateTotals();
    };
    document.getElementById('addGarmentBtn').onclick = addRow;
    addRow();

    document.getElementById('orderForm').onsubmit = (e) => {
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
        const totalPrice = window.currentTotalAfterDiscount || 0;
        const discountPercent = parseFloat(document.getElementById('discountPercent').value) || 0;
        const discountAmount = parseFloat(document.getElementById('discountAmount').value) || 0;
        let discountValue = 0;
        if (discountAmount > 0) {
            discountValue = Math.min(discountAmount, subTotal);
        } else if (discountPercent > 0) {
            discountValue = (subTotal * discountPercent) / 100;
        }
        const amountPaid = parseFloat(document.getElementById('amountPaid').value)||0;
        let designImage = '';
        const fileInput = document.getElementById('designImageInput');
        
        const saveOrder = () => {
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
                discountPercent: discountPercent,
                discountAmount: discountAmount,
                discountValue: discountValue,
                totalPrice: totalPrice,
                amountPaid: amountPaid,
                balanceDue: totalPrice - amountPaid,
                notes: document.getElementById('orderNotes').value,
                status: 'tofile',
                createdAt: new Date().toISOString(),
                designImage: designImage || null
            };
            orders.push(newOrder);
            saveOrders();
            document.getElementById('orderForm').reset();
            document.getElementById('dateStarted').value=today;
            document.getElementById('garmentsBody').innerHTML='';
            document.getElementById('discountPercent').value = 0;
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
            reader.onload = (ev) => { designImage = ev.target.result; saveOrder(); };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            saveOrder();
        }
    };
    
    document.getElementById('clearForm').onclick = () => {
        document.getElementById('orderForm').reset();
        document.getElementById('dateStarted').value=today;
        document.getElementById('garmentsBody').innerHTML='';
        document.getElementById('discountPercent').value = 0;
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
    document.getElementById('discountPercent').addEventListener('input', function() {
        if (this.value > 0) document.getElementById('discountAmount').value = 0;
        updateTotals();
    });
    document.getElementById('discountAmount').addEventListener('input', function() {
        if (this.value > 0) document.getElementById('discountPercent').value = 0;
        updateTotals();
    });

    // Settings save
    document.getElementById('saveSettings').onclick = () => {
        settings.fabric=[]; document.querySelectorAll('#fabricSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.fabric.push({name,price}); });
        settings.jerseyType=[]; document.querySelectorAll('#jerseyTypeSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.jerseyType.push({name,price}); });
        settings.lowerType=[]; document.querySelectorAll('#lowerTypeSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.lowerType.push({name,price}); });
        settings.garmentType=[]; document.querySelectorAll('#garmentTypeSettings .settings-row').forEach(r=>{ const name=r.querySelector('input[type="text"]').value; const price=parseFloat(r.querySelector('input[type="number"]').value)||0; if(name) settings.garmentType.push({name,price}); });
        saveSettings(); alert('Settings saved');
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
            reader.onload=ev=>{ try{ const data=JSON.parse(ev.target.result); if(data.orders) orders=data.orders; if(data.settings) settings=data.settings; saveOrders(); saveSettings(); alert('Imported'); }catch(err){ alert('Invalid file'); } };
            reader.readAsText(file);
        }; inp.click();
    };
    document.getElementById('resetDataBtn').onclick = () => {
        if(confirm('Delete ALL data?')){
            orders=[]; settings={ fabric:[{name:'Mesh',price:0},{name:'Polyester',price:0}], jerseyType:[{name:'V-neck U-cut',price:0},{name:'Crew neck',price:0}], lowerType:[{name:'With lining',price:0},{name:'Without lining',price:0}], garmentType:[{name:'Hoodie',price:800},{name:'Jersey',price:300},{name:'Shorts',price:0}] };
            saveOrders(); saveSettings(); alert('Reset complete');
        }
    };
    document.getElementById('closeModal').onclick = () => document.getElementById('orderModal').classList.add('hidden');
    document.getElementById('closeModalBtn').onclick = () => document.getElementById('orderModal').classList.add('hidden');
    document.getElementById('closeEditModal').onclick = () => document.getElementById('editOrderModal').classList.add('hidden');
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