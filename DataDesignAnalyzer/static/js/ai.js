// ai.js - Client-side AI functionality for disaster relief app

// Classify damage level from image (client-side processing)
const classifyDamageFromImage = async (imageFile) => {
    return new Promise((resolve, reject) => {
        if (!imageFile) {
            resolve({ damageLevel: 'unknown', confidence: 0 });
            return;
        }
        
        // Check if the file is an image
        if (!imageFile.type.startsWith('image/')) {
            reject(new Error('File is not an image'));
            return;
        }
        
        // Create a FileReader to read the image
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const img = new Image();
            
            img.onload = () => {
                // Create a canvas to manipulate the image
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Resize to 128x128 for processing
                canvas.width = 128;
                canvas.height = 128;
                ctx.drawImage(img, 0, 0, 128, 128);
                
                // Get image data for analysis
                const imageData = ctx.getImageData(0, 0, 128, 128).data;
                
                // Perform simple image analysis (edge detection)
                const edges = detectEdges(imageData, 128, 128);
                
                // Count edges as a simple measure of damage
                // More edges/lines often indicate more damage
                const edgeCount = edges.filter(Boolean).length;
                const edgeRatio = edgeCount / (128 * 128);
                
                // Simple classification rules
                let damageLevel, confidence;
                
                if (edgeRatio > 0.2) {
                    damageLevel = 'severe';
                    confidence = Math.min(0.9, 0.7 + edgeRatio);
                } else if (edgeRatio > 0.1) {
                    damageLevel = 'moderate';
                    confidence = 0.6 + edgeRatio;
                } else {
                    damageLevel = 'minimal';
                    confidence = 0.8 - edgeRatio;
                }
                
                // Format result
                resolve({
                    damageLevel,
                    confidence: Math.round(confidence * 100) / 100,
                    edgeRatio: Math.round(edgeRatio * 1000) / 1000
                });
                
                // Display processed image if available
                const previewContainer = document.getElementById('damage-analysis-preview');
                if (previewContainer) {
                    // Original image thumbnail
                    const originalCanvas = document.createElement('canvas');
                    originalCanvas.width = 150;
                    originalCanvas.height = 150;
                    const originalCtx = originalCanvas.getContext('2d');
                    originalCtx.drawImage(img, 0, 0, 150, 150);
                    
                    // Edge detection visualization
                    const edgeCanvas = document.createElement('canvas');
                    edgeCanvas.width = 150;
                    edgeCanvas.height = 150;
                    const edgeCtx = edgeCanvas.getContext('2d');
                    
                    // Visualize edges
                    const edgeImgData = edgeCtx.createImageData(150, 150);
                    for (let i = 0; i < edges.length; i++) {
                        const scaledI = Math.floor(i * (150*150) / (128*128));
                        const value = edges[i] ? 255 : 0;
                        
                        edgeImgData.data[scaledI * 4] = value;
                        edgeImgData.data[scaledI * 4 + 1] = value;
                        edgeImgData.data[scaledI * 4 + 2] = value;
                        edgeImgData.data[scaledI * 4 + 3] = 255;
                    }
                    edgeCtx.putImageData(edgeImgData, 0, 0);
                    
                    // Show analysis results
                    previewContainer.innerHTML = `
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>Original Image:</strong></p>
                                <img src="${originalCanvas.toDataURL()}" class="img-fluid" alt="Original image">
                            </div>
                            <div class="col-md-6">
                                <p><strong>Damage Analysis:</strong></p>
                                <p>Damage Level: <span class="badge ${getBadgeColorForDamage(damageLevel)}">${damageLevel}</span></p>
                                <p>Confidence: ${Math.round(confidence * 100)}%</p>
                                <p>Detail Score: ${Math.round(edgeRatio * 1000) / 10}/100</p>
                            </div>
                        </div>
                    `;
                }
            };
            
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            img.src = event.target.result;
        };
        
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsDataURL(imageFile);
    });
};

// Get badge color class based on damage level
const getBadgeColorForDamage = (damageLevel) => {
    switch (damageLevel) {
        case 'severe': return 'bg-danger';
        case 'moderate': return 'bg-warning';
        case 'minimal': return 'bg-success';
        default: return 'bg-secondary';
    }
};

// Simple edge detection algorithm (Sobel operator)
const detectEdges = (imageData, width, height) => {
    const edges = new Array(width * height).fill(false);
    const threshold = 30;
    
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const pos = (y * width + x) * 4;
            
            // Get surrounding pixels (simplified Sobel)
            const topLeft = imageData[(y-1) * width * 4 + (x-1) * 4];
            const top = imageData[(y-1) * width * 4 + x * 4];
            const topRight = imageData[(y-1) * width * 4 + (x+1) * 4];
            const left = imageData[y * width * 4 + (x-1) * 4];
            const right = imageData[y * width * 4 + (x+1) * 4];
            const bottomLeft = imageData[(y+1) * width * 4 + (x-1) * 4];
            const bottom = imageData[(y+1) * width * 4 + x * 4];
            const bottomRight = imageData[(y+1) * width * 4 + (x+1) * 4];
            
            // Sobel X gradient
            const gx = -topLeft - 2*left - bottomLeft + topRight + 2*right + bottomRight;
            
            // Sobel Y gradient
            const gy = -topLeft - 2*top - topRight + bottomLeft + 2*bottom + bottomRight;
            
            // Gradient magnitude
            const g = Math.sqrt(gx*gx + gy*gy);
            
            // Threshold for edge detection
            if (g > threshold) {
                edges[y * width + x] = true;
            }
        }
    }
    
    return edges;
};

// Suggest urgency level based on form inputs
const suggestUrgencyLevel = (helpType, peopleAffected, description) => {
    let score = 0;
    
    // Help type factors
    if (helpType === 'medical') score += 30;
    else if (helpType === 'rescue') score += 35;
    else if (helpType === 'evacuation') score += 25;
    else if (helpType === 'shelter') score += 20;
    else if (helpType === 'food') score += 15;
    else if (helpType === 'supplies') score += 10;
    
    // People affected
    score += Math.min(30, peopleAffected * 3);
    
    // Check description for urgent keywords
    const urgentKeywords = ['urgent', 'emergency', 'immediate', 'critical', 'danger', 'life', 'threatening', 'severe', 'dying', 'injured', 'trapped'];
    
    let keywordCount = 0;
    for (const keyword of urgentKeywords) {
        if (description.toLowerCase().includes(keyword)) {
            keywordCount++;
        }
    }
    
    score += keywordCount * 5;
    
    // Determine urgency level based on score
    if (score >= 50) return 'high';
    else if (score >= 25) return 'medium';
    else return 'low';
};

// Add event listeners for client-side AI functions
document.addEventListener('DOMContentLoaded', () => {
    // Image upload for damage analysis
    const imageInput = document.getElementById('image');
    if (imageInput) {
        imageInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                // Show loading state
                const previewContainer = document.getElementById('damage-analysis-preview');
                if (previewContainer) {
                    previewContainer.innerHTML = `
                        <div class="text-center">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            <p>Analyzing image...</p>
                        </div>
                    `;
                }
                
                // Analyze image
                const result = await classifyDamageFromImage(file);
                
                // Update hidden field with damage assessment result
                const damageField = document.getElementById('damage_level');
                if (damageField) {
                    damageField.value = result.damageLevel;
                }
                
            } catch (error) {
                console.error('Error analyzing image:', error);
                
                const previewContainer = document.getElementById('damage-analysis-preview');
                if (previewContainer) {
                    previewContainer.innerHTML = `
                        <div class="alert alert-danger">
                            Error analyzing image: ${error.message}
                        </div>
                    `;
                }
            }
        });
    }
    
    // Real-time urgency suggestion as user fills form
    const helpTypeSelect = document.getElementById('help_type');
    const peopleAffectedInput = document.getElementById('people_affected');
    const descriptionInput = document.getElementById('description');
    const urgencyIndicator = document.getElementById('urgency-indicator');
    
    if (helpTypeSelect && peopleAffectedInput && descriptionInput && urgencyIndicator) {
        const updateUrgencySuggestion = () => {
            const helpType = helpTypeSelect.value;
            const peopleAffected = parseInt(peopleAffectedInput.value || '0');
            const description = descriptionInput.value || '';
            
            if (!helpType) return;
            
            const urgency = suggestUrgencyLevel(helpType, peopleAffected, description);
            
            // Update UI
            let badgeClass = 'bg-info';
            if (urgency === 'high') badgeClass = 'bg-danger';
            else if (urgency === 'medium') badgeClass = 'bg-warning text-dark';
            
            urgencyIndicator.innerHTML = `
                <div class="mt-2">
                    <p class="mb-1">Suggested Urgency:</p>
                    <span class="badge ${badgeClass}">${urgency}</span>
                </div>
            `;
            
            // Update hidden field
            const urgencyField = document.getElementById('urgency_level');
            if (urgencyField) {
                urgencyField.value = urgency;
            }
        };
        
        // Add event listeners
        helpTypeSelect.addEventListener('change', updateUrgencySuggestion);
        peopleAffectedInput.addEventListener('input', updateUrgencySuggestion);
        descriptionInput.addEventListener('input', updateUrgencySuggestion);
    }
});
