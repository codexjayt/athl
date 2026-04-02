function getSizeRank(s) {
    return SIZE_ORDER[s?.toUpperCase()] || 999;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function getStatusDisplay(status) {
    if (status === 'tofile') return 'TO FILE';
    if (status === 'toprint') return 'TO PRINT';
    if (status === 'progress') return 'IN PROGRESS';
    return 'COMPLETED';
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '0001-01-01') return 'N/A';
    return dateStr;
}