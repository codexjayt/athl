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
    
    const uniquePlayers = new Set();
    rows.forEach(r => {
        const surname = r.querySelector('.surname')?.value;
        const number = r.querySelector('.number')?.value;
        if (surname && surname.trim() !== '') {
            const key = `${surname.trim()}|${number?.trim() || ''}`;
            uniquePlayers.add(key);
        }
    });
    document.getElementById('totalPlayers').innerText = uniquePlayers.size;
    
    document.getElementById('subTotal').innerText = '₱' + subTotal.toFixed(2);
    document.getElementById('totalPrice').innerText = '₱' + totalAfterDiscount.toFixed(2);
    
    window.currentSubTotal = subTotal;
    window.currentTotalAfterDiscount = totalAfterDiscount;
    window.currentDiscountAmount = discountAmount;
};