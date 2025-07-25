// Global variables
let map;
let marker;
let geocoder;

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    setupFormListeners();
});

// Initialize Google Maps
function initMap() {
    // Create a map centered at a default location
    map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 0, lng: 0 },
        zoom: 2,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true
    });
    
    // Initialize geocoder for address lookup
    geocoder = new google.maps.Geocoder();
    
    // Setup location search autocomplete
    const input = document.getElementById('location-input');
    const autocomplete = new google.maps.places.Autocomplete(input);
    
    // When a place is selected from autocomplete
    autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        
        if (!place.geometry) {
            // User entered the name of a place that was not suggested
            alert("No location details available for this place. Please select from the dropdown.");
            return;
        }
        
        // Set map view to the selected location
        map.setCenter(place.geometry.location);
        map.setZoom(13);
        
        // Place a marker at the location
        placeMarker(place.geometry.location);
        
        // Update form fields with location data
        document.getElementById('lat').value = place.geometry.location.lat();
        document.getElementById('lng').value = place.geometry.location.lng();
    });
    
    // Allow clicking on the map to set location
    map.addListener('click', function(event) {
        placeMarker(event.latLng);
        
        // Update form fields with location data
        document.getElementById('lat').value = event.latLng.lat();
        document.getElementById('lng').value = event.latLng.lng();
        
        // Reverse geocode to get address
        geocoder.geocode({ 'location': event.latLng }, function(results, status) {
            if (status === 'OK') {
                if (results[0]) {
                    document.getElementById('location-input').value = results[0].formatted_address;
                }
            }
        });
    });
    
    // Try to get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            // Success callback
            function(position) {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                
                // Center map on user's location
                map.setCenter(userLocation);
                map.setZoom(13);
                
                // Place marker at user's location
                placeMarker(userLocation);
                
                // Update form fields
                document.getElementById('lat').value = userLocation.lat;
                document.getElementById('lng').value = userLocation.lng;
                
                // Reverse geocode to get address
                geocoder.geocode({ 'location': userLocation }, function(results, status) {
                    if (status === 'OK') {
                        if (results[0]) {
                            document.getElementById('location-input').value = results[0].formatted_address;
                        }
                    }
                });
            },
            // Error callback
            function() {
                console.log('Error getting user location');
            }
        );
    }
}

// Place a marker on the map
function placeMarker(location) {
    // Remove existing marker if any
    if (marker) {
        marker.setMap(null);
    }
    
    // Create new marker
    marker = new google.maps.Marker({
        position: location,
        map: map,
        animation: google.maps.Animation.DROP
    });
}

// Setup event listeners for the form
function setupFormListeners() {
    // Form submission
    document.getElementById('forecast-form').addEventListener('submit', function(event) {
        event.preventDefault();
        generateForecast();
    });
    
    // Reset button
    document.getElementById('reset-button').addEventListener('click', function() {
        document.getElementById('forecast-form').reset();
        document.getElementById('forecast-results').classList.add('hidden');
        if (marker) {
            marker.setMap(null);
        }
        map.setCenter({ lat: 0, lng: 0 });
        map.setZoom(2);
    });
}

// Generate resource forecast
function generateForecast() {
    // Get form values
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    const peopleCount = document.getElementById('people-count').value;
    const condition = document.getElementById('condition').value;
    const severity = document.getElementById('severity').value;
    
    // Validate location
    if (!lat || !lng) {
        showError('Please select a location on the map or use the search box.');
        return;
    }
    
    // Show loading state
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '<div class="loading-spinner"></div><p>Generating forecast...</p>';
    document.getElementById('forecast-results').classList.remove('hidden');
    
    // Build API URL
    let apiUrl = `/api/resource-forecast?lat=${lat}&lng=${lng}`;
    
    // Add optional parameters if provided
    if (peopleCount) {
        apiUrl += `&people_count=${peopleCount}`;
    }
    if (condition) {
        apiUrl += `&condition=${condition}`;
    }
    if (severity) {
        apiUrl += `&severity=${severity}`;
    }
    
    // Call the API
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                displayForecastResults(data.forecast);
            } else {
                showError('Failed to generate forecast. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('An error occurred while generating the forecast. Please try again.');
        });
}

// Display forecast results
function displayForecastResults(forecast) {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';
    
    // Create summary section
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'forecast-summary';
    summaryDiv.innerHTML = `
        <h3>Resource Needs Forecast</h3>
        <p>Based on the provided information and historical data, here's the predicted resource needs:</p>
    `;
    resultsContainer.appendChild(summaryDiv);
    
    // Create results table
    const table = document.createElement('table');
    table.className = 'forecast-table';
    
    // Add table header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Resource Type</th>
            <th>Predicted Demand</th>
            <th>Quantity</th>
            <th>Confidence</th>
            <th>Details</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Add table body
    const tbody = document.createElement('tbody');
    
    // Sort resource types by predicted demand (highest first)
    const sortedResources = Object.entries(forecast).sort((a, b) => {
        return b[1].predicted_demand - a[1].predicted_demand;
    });
    
    // Add rows for each resource type
    sortedResources.forEach(([resourceType, data]) => {
        // Skip resources with zero demand
        if (data.predicted_demand === 0) return;
        
        // Format resource type for display
        const formattedType = resourceType.charAt(0).toUpperCase() + resourceType.slice(1).replace('_', ' ');
        
        // Create row
        const row = document.createElement('tr');
        
        // Format confidence as percentage
        const confidencePercent = Math.round(data.confidence * 100) + '%';
        
        // Create confidence indicator with color
        let confidenceClass = 'confidence-low';
        if (data.confidence >= 0.7) {
            confidenceClass = 'confidence-high';
        } else if (data.confidence >= 0.4) {
            confidenceClass = 'confidence-medium';
        }
        
        // Create details button if details exist
        let detailsButton = '';
        if (data.quantity.details) {
            detailsButton = `<button class="details-button" data-resource="${resourceType}">View Details</button>`;
        } else {
            detailsButton = '<span class="no-details">No details</span>';
        }
        
        // Set row content
        row.innerHTML = `
            <td>${formattedType}</td>
            <td>${data.predicted_demand} people</td>
            <td>${data.quantity.units} ${data.quantity.unit_type}</td>
            <td><span class="confidence-indicator ${confidenceClass}">${confidencePercent}</span></td>
            <td>${detailsButton}</td>
        `;
        
        tbody.appendChild(row);
        
        // Create hidden details row if details exist
        if (data.quantity.details) {
            const detailsRow = document.createElement('tr');
            detailsRow.className = 'details-row hidden';
            detailsRow.id = `details-${resourceType}`;
            
            let detailsHtml = '<td colspan="5"><div class="resource-details">';
            detailsHtml += '<h4>Detailed Breakdown:</h4><ul>';
            
            // Add each detail item
            for (const [detailName, detailValue] of Object.entries(data.quantity.details)) {
                // Format detail name
                const formattedName = detailName
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                
                detailsHtml += `<li><strong>${formattedName}:</strong> ${detailValue}</li>`;
            }
            
            detailsHtml += '</ul></div></td>';
            detailsRow.innerHTML = detailsHtml;
            
            tbody.appendChild(detailsRow);
        }
    });
    
    table.appendChild(tbody);
    resultsContainer.appendChild(table);
    
    // Add event listeners for details buttons
    document.querySelectorAll('.details-button').forEach(button => {
        button.addEventListener('click', function() {
            const resourceType = this.getAttribute('data-resource');
            const detailsRow = document.getElementById(`details-${resourceType}`);
            
            // Toggle details visibility
            detailsRow.classList.toggle('hidden');
            
            // Update button text
            if (detailsRow.classList.contains('hidden')) {
                this.textContent = 'View Details';
            } else {
                this.textContent = 'Hide Details';
            }
        });
    });
    
    // Add recommendations section
    const recommendationsDiv = document.createElement('div');
    recommendationsDiv.className = 'recommendations';
    recommendationsDiv.innerHTML = `
        <h3>Recommendations</h3>
        <ul>
            <li>Prioritize resources with high demand and confidence.</li>
            <li>Consider pre-positioning critical supplies in the affected area.</li>
            <li>Coordinate with local agencies to avoid duplication of efforts.</li>
            <li>Monitor the situation as it evolves and update the forecast as needed.</li>
        </ul>
    `;
    resultsContainer.appendChild(recommendationsDiv);
    
    // Add export options
    const exportDiv = document.createElement('div');
    exportDiv.className = 'export-options';
    exportDiv.innerHTML = `
        <h3>Export Options</h3>
        <button id="print-button" class="btn btn-secondary">Print Forecast</button>
        <button id="share-button" class="btn btn-secondary">Share Forecast</button>
    `;
    resultsContainer.appendChild(exportDiv);
    
    // Add print functionality
    document.getElementById('print-button').addEventListener('click', function() {
        window.print();
    });
    
    // Add share functionality (simple copy to clipboard)
    document.getElementById('share-button').addEventListener('click', function() {
        // Create shareable text
        let shareText = "Resource Needs Forecast\n\n";
        
        sortedResources.forEach(([resourceType, data]) => {
            if (data.predicted_demand === 0) return;
            
            const formattedType = resourceType.charAt(0).toUpperCase() + resourceType.slice(1).replace('_', ' ');
            shareText += `${formattedType}: ${data.quantity.units} ${data.quantity.unit_type} (${data.predicted_demand} people)\n`;
        });
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareText)
            .then(() => {
                alert('Forecast copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy: ', err);
                alert('Failed to copy forecast to clipboard.');
            });
    });
}

// Show error message
function showError(message) {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            <p>${message}</p>
        </div>
    `;
    document.getElementById('forecast-results').classList.remove('hidden');
}