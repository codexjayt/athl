let currentContextOrderId = null;
let currentContextStatus = null;

function showContextMenu(e, orderId, status) {
    e.preventDefault();
    if (!isFullAccess()) return;
    currentContextOrderId = orderId;
    currentContextStatus = status;
    const menu = document.getElementById('contextMenu');
    const editItem = document.getElementById('contextEdit');
    const moveToPrint = document.getElementById('contextMoveToPrint');
    const moveToProgress = document.getElementById('contextMoveToProgress');
    const moveToCompleted = document.getElementById('contextMoveToCompleted');
    const deleteOrder = document.getElementById('contextDeleteOrder');
    if (status === 'tofile') {
        editItem.style.display = 'block';
        moveToPrint.style.display = 'block';
        moveToProgress.style.display = 'none';
        moveToCompleted.style.display = 'none';
    } else if (status === 'toprint') {
        editItem.style.display = 'block';
        moveToPrint.style.display = 'none';
        moveToProgress.style.display = 'block';
        moveToCompleted.style.display = 'none';
    } else if (status === 'progress') {
        editItem.style.display = 'block';
        moveToPrint.style.display = 'none';
        moveToProgress.style.display = 'none';
        moveToCompleted.style.display = 'block';
    } else if (status === 'completed') {
        editItem.style.display = 'block';
        moveToPrint.style.display = 'none';
        moveToProgress.style.display = 'none';
        moveToCompleted.style.display = 'none';
    }
    deleteOrder.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.style.display = 'block';
}

async function confirmStatusChange(orderId, newStatus) {
    if (!isFullAccess()) {
        alert('View‑only mode: you cannot change order status.');
        return;
    }
    let msg = '';
    if (newStatus === 'toprint') msg = 'Move this order to TO PRINT?';
    else if (newStatus === 'progress') msg = 'Move this order to IN PROGRESS?';
    else if (newStatus === 'completed') msg = 'Mark this order as COMPLETED?';
    if (confirm(msg)) {
        const order = orders.find(o => o.id === orderId);
        if(order) {
            order.status = newStatus;
            if (newStatus === 'completed') order.completedAt = new Date().toISOString();
            await saveOrders();
            refreshAllDisplays();
        }
    }
}

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