// ---------- UI Rendering Functions ----------
function refreshAllDisplays() { updateDashboard(); renderOrdersByStatus(); renderRecentOrders(); }

function updateDashboard() {
    document.getElementById('statToFile').innerText = orders.filter(o => o.status === 'tofile').length;
    document.getElementById('statToPrint').innerText = orders.filter(o => o.status === 'toprint').length;
    document.getElementById('statProgress').innerText = orders.filter(o => o.status === 'progress').length;
    document.getElementById('statCompleted').innerText = orders.filter(o => o.status === 'completed').length;
}

function renderOrderCard(order, status) {
    const thumb = order.designImage ? `<img src="${order.designImage}" class="order-image-thumb" alt="design">` : '';
    const discountBadge = order.discountAmount > 0 ? `<span class="discount-badge" style="font-size:0.6rem; margin-left:0.5rem;">-₱${order.discountAmount}</span>` : '';

    return `<div class="order-card" onclick="openOrderModal('${order.id}')" oncontextmenu="showContextMenu(event, '${order.id}', '${status}')">
        <div style="display:flex; align-items:center; gap:12px;">
            ${thumb}
            <div>
                <div class="order-title">
                    ${escapeHtml(order.customer)}
                    <span class="status-badge ${status}">${getStatusDisplay(status)}</span>
                    ${discountBadge}
                </div>
                <div style="margin-top:0.5rem; color:#b9c7d9;">${order.totalGarments} garments · ${order.totalPlayers} players</div>
                <div style="color:#f97316;">
                    ${order.discountAmount > 0 ? `<span class="original-price">₱${order.subTotal?.toFixed(2) || (order.totalPrice + order.discountAmount).toFixed(2)}</span> ` : ''}
                    ₱${order.totalPrice.toFixed(2)} | Paid: ₱${order.amountPaid}
                </div>
            </div>
        </div>
    </div>`;
}

function renderOrdersByStatus() {
    const tofileOrders = orders.filter(o => o.status === 'tofile');
    const toprintOrders = orders.filter(o => o.status === 'toprint');
    const tofileGrid = document.getElementById('tofileOrdersGrid');
    const toprintGrid = document.getElementById('toprintOrdersGrid');
    const tofileEmpty = document.getElementById('tofileEmpty');
    const toprintEmpty = document.getElementById('toprintEmpty');

    if (tofileOrders.length === 0) {
        if (tofileGrid) tofileGrid.innerHTML = '';
        if (tofileEmpty) tofileEmpty.classList.remove('hidden');
    } else {
        if (tofileEmpty) tofileEmpty.classList.add('hidden');
        if (tofileGrid) tofileGrid.innerHTML = tofileOrders.map(o => renderOrderCard(o, 'tofile')).join('');
    }

    if (toprintOrders.length === 0) {
        if (toprintGrid) toprintGrid.innerHTML = '';
        if (toprintEmpty) toprintEmpty.classList.remove('hidden');
    } else {
        if (toprintEmpty) toprintEmpty.classList.add('hidden');
        if (toprintGrid) toprintGrid.innerHTML = toprintOrders.map(o => renderOrderCard(o, 'toprint')).join('');
    }

    ['progress', 'completed'].forEach(st => {
        const filtered = orders.filter(o => o.status === st);
        const grid = document.getElementById(`${st}OrdersGrid`);
        const emptyDiv = document.getElementById(`${st}Empty`);
        if (filtered.length === 0) {
            if (grid) grid.innerHTML = '';
            if (emptyDiv) emptyDiv.classList.remove('hidden');
        } else {
            if (emptyDiv) emptyDiv.classList.add('hidden');
            if (grid) grid.innerHTML = filtered.map(o => renderOrderCard(o, st)).join('');
        }
    });
}

function renderRecentOrders() {
    const recent = [...orders]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);
    const container = document.getElementById('recentOrdersList');
    if (!recent.length) {
        container.innerHTML = '<div class="empty-state">No orders yet</div>';
        return;
    }
    container.innerHTML = recent.map(order => renderOrderCard(order, order.status)).join('');
}

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
            <td><span class="garment-type-badge">${escapeHtml(g.garmentType)}</span>        </td>
            <td>${escapeHtml(g.surname) || '—'}        </td>
            <td>${escapeHtml(g.number) || '—'}        </td>
            <td><span class="size-tag">${escapeHtml(g.upperSize) || '—'}</span>        </td>
            <td><span class="size-tag">${escapeHtml(g.lowerSize) || '—'}</span>        </td>
            <td class="notes-cell">${escapeHtml(g.notes) || '—'}        </td>
          </tr>
    `).join('');
    const designHtml = order.designImage ? `<div class="design-section"><div class="section-label">Approved Design</div><img src="${order.designImage}" class="design-image-full" alt="Design Preview"></div>` : '';
    const notesHtml = order.notes ? `<div class="notes-section"><div class="section-label">Order Notes</div><div class="notes-content">${escapeHtml(order.notes)}</div></div>` : '';
    const modalHtml = `...`; // (the full modal HTML from your original script – I'm truncating for brevity, but you should copy the exact same long string from your original script.js)
    document.getElementById('modalBody').innerHTML = modalHtml;
    document.getElementById('orderModal').classList.remove('hidden');
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

function openEditOrderModal(orderId) {
    if (!isFullAccess()) {
        alert('View‑only mode: you cannot edit orders.');
        return;
    }
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
    // This is the long function from your original script – keep exactly as is.
    // (I'm omitting it here for brevity, but you must copy the full function from your original script.js)
}

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