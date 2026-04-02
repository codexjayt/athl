document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    populateDropdowns();
    renderSettingsEditor();
    refreshAllDisplays();

    if (!isFullAccess()) {
        const settingsNav = document.querySelector('.nav-item[data-tab="settings"]');
        if (settingsNav) settingsNav.style.display = 'none';
    }

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateStarted').value = today;
    setupNewOrderImage();

    const addRow = () => {
        const tbody = document.getElementById('garmentsBody');
        const row = document.createElement('tr');
        const defaultOptions = settings.garmentType.map(gt=>`<option value="${gt.name}" data-price="${gt.price}">${gt.name}</option>`).join('') + '<option value="Jersey">Jersey (dynamic)</option><option value="Custom">Custom</option>';
        row.innerHTML = `        <td><select class="garment-select">${defaultOptions}</select></td>
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
            switchTab('toprogress');
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

    document.getElementById('resetDataBtn').onclick = resetAllData;
    document.getElementById('closeModal').onclick = () => document.getElementById('orderModal').classList.add('hidden');
    document.getElementById('closeModalBtn').onclick = () => document.getElementById('orderModal').classList.add('hidden');
    document.getElementById('closeEditModal').onclick = () => document.getElementById('editOrderModal').classList.add('hidden');
    document.getElementById('closeReceiptModal').onclick = () => document.getElementById('receiptModal').classList.add('hidden');
    document.getElementById('closeReceiptModalBtn').onclick = () => document.getElementById('receiptModal').classList.add('hidden');
    document.getElementById('downloadReceiptBtn').onclick = downloadCurrentReceipt;
    document.getElementById('exportAllTeamsBtn').onclick = exportAllTeams;
    document.getElementById('importTeamOrdersBtn').onclick = importTeamOrders;

    document.addEventListener('click', () => { document.getElementById('contextMenu').style.display = 'none'; });
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('.order-card')) document.getElementById('contextMenu').style.display = 'none'; });
    document.getElementById('contextEdit').addEventListener('click', () => { if (currentContextOrderId) openEditOrderModal(currentContextOrderId); document.getElementById('contextMenu').style.display = 'none'; });
    document.getElementById('contextMoveToPrint').addEventListener('click', () => { if (currentContextOrderId && currentContextStatus === 'tofile') confirmStatusChange(currentContextOrderId, 'toprint'); document.getElementById('contextMenu').style.display = 'none'; });
    document.getElementById('contextMoveToProgress').addEventListener('click', () => { if (currentContextOrderId && currentContextStatus === 'toprint') confirmStatusChange(currentContextOrderId, 'progress'); document.getElementById('contextMenu').style.display = 'none'; });
    document.getElementById('contextMoveToCompleted').addEventListener('click', () => { if (currentContextOrderId && currentContextStatus === 'progress') confirmStatusChange(currentContextOrderId, 'completed'); document.getElementById('contextMenu').style.display = 'none'; });
    document.getElementById('contextDeleteOrder').addEventListener('click', () => { if (currentContextOrderId) deleteOrder(currentContextOrderId); document.getElementById('contextMenu').style.display = 'none'; });

    window.switchTab = (tabId) => {
        document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
        document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');
        const tabs = {
            dashboard: document.getElementById('tab-dashboard'),
            new: document.getElementById('tab-new'),
            toprogress: document.getElementById('tab-toprogress'),
            progress: document.getElementById('tab-progress'),
            completed: document.getElementById('tab-completed'),
            settings: document.getElementById('tab-settings')
        };
        Object.values(tabs).forEach(t => t.classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        if (tabId === 'toprogress' || tabId === 'progress' || tabId === 'completed') renderOrdersByStatus();
    };
    document.querySelectorAll('.nav-item').forEach(item=>{ item.addEventListener('click',()=>switchTab(item.dataset.tab)); });
    refreshAllDisplays();
});