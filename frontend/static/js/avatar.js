// Local avatar generator
function generateAvatar(name, size = 40) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = size;
    canvas.height = size;
    
    // Background color
    ctx.fillStyle = '#25d366';
    ctx.fillRect(0, 0, size, size);
    
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = `${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    ctx.fillText(initials, size / 2, size / 2);
    
    return canvas.toDataURL();
}

// Replace avatar URLs with local generation
function setAvatar(element, name, size = 40) {
    if (element) {
        element.src = generateAvatar(name, size);
    }
}