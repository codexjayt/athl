let orders = [];
let settings = {
    fabric: [{ name: 'Mesh', price: 0 }, { name: 'Polyester', price: 0 }],
    jerseyType: [{ name: 'V-neck U-cut', price: 0 }, { name: 'Crew neck', price: 0 }],
    lowerType: [{ name: 'With lining', price: 0 }, { name: 'Without lining', price: 0 }],
    garmentType: [{ name: 'Hoodie', price: 800 }, { name: 'Jersey', price: 300 }, { name: 'Shorts', price: 0 }]
};

let currentAccessLevel = window.currentAccessLevel;

function isFullAccess() {
    return currentAccessLevel === 'full';
}