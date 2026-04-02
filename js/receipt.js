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

    const receiptHtml = `...`; // (the full receipt HTML from your original script – copy the exact same string)

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