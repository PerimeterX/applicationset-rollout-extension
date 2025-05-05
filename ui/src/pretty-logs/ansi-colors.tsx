import React from 'react';

// ANSI color codes mapping
const ANSI_COLORS: {[key: string]: string} = {
    // Foreground colors
    '30': '#000000', // Black
    '31': '#e15353', // Red
    '32': '#7adf47', // Green
    '33': '#f4c030', // Yellow
    '34': '#30a2f4', // Blue
    '35': '#ffa7c4', // Magenta
    '36': '#00ffff', // Cyan
    '37': '#ffffff', // White
    
    // Bright foreground colors
    '90': '#808080', // Bright Black
    '91': '#ff6b6b', // Bright Red
    '92': '#6cbb3c', // Bright Green
    '93': '#ffd93d', // Bright Yellow
    '94': '#4dabf7', // Bright Blue
    '95': '#ffa7c4', // Bright Magenta
    '96': '#00ffff', // Bright Cyan
    '97': '#ffffff', // Bright White
    
    // Background colors
    '40': '#000000', // Black
    '41': '#e15353', // Red
    '42': '#7adf47', // Green
    '43': '#f4c030', // Yellow
    '44': '#30a2f4', // Blue
    '45': '#ffa7c4', // Magenta
    '46': '#00ffff', // Cyan
    '47': '#ffffff', // White
    
    // Bright background colors
    '100': '#808080', // Bright Black
    '101': '#ff6b6b', // Bright Red
    '102': '#6cbb3c', // Bright Green
    '103': '#ffd93d', // Bright Yellow
    '104': '#4dabf7', // Bright Blue
    '105': '#ffa7c4', // Bright Magenta
    '106': '#00ffff', // Bright Cyan
    '107': '#ffffff', // Bright White
};

// Parse ANSI color codes
export const parseAnsiColors = (text: string): React.ReactNode => {
    // Regular expression to match ANSI escape sequences
    const ansiRegex = /\x1b\[([0-9;]*?)m/g;
    
    // Split the text by ANSI escape sequences
    const parts = text.split(ansiRegex);
    
    // If no ANSI codes found, return the original text
    if (parts.length === 1) {
        return text;
    }
    
    // Process each part
    const result: React.ReactNode[] = [];
    let currentColor = '';
    
    for (let i = 0; i < parts.length; i++) {
        // Skip empty parts
        if (!parts[i]) continue;
        
        // Check if this part is a color code
        if (i % 2 === 1) {
            // This is a color code
            const codes = parts[i].split(';');
            
            // Handle reset code (0)
            if (codes.includes('0')) {
                currentColor = '';
                continue;
            }
            
            // Get the last color code
            const lastCode = codes[codes.length - 1];
            currentColor = ANSI_COLORS[lastCode] || '';
        } else {
            // This is text content
            if (currentColor) {
                result.push(<span key={i} style={{color: currentColor}}>{parts[i]}</span>);
            } else {
                result.push(parts[i]);
            }
        }
    }
    
    return result;
};