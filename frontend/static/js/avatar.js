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

// Set avatar with custom image or generated fallback
function setAvatar(element, name, size = 40, customAvatar = null) {
    if (element) {
        if (customAvatar) {
            element.src = customAvatar;
            element.onerror = () => {
                // Fallback to generated avatar if custom image fails to load
                element.src = generateAvatar(name, size);
            };
        } else {
            element.src = generateAvatar(name, size);
        }
    }
}