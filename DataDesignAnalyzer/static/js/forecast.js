document.addEventListener('DOMContentLoaded', function() {
  // Initialize map
  let forecastMap = null;
  let marker = null;
  let currentLat = null;
  let currentLng = null;
  
  // Initialize the map if the element exists
  const mapElement = document.getElementById('forecast-map');
  if (mapElement) {
    forecastMap = L.map('forecast-map').setView([0, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(forecastMap);
    
    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        forecastMap.setView([lat, lng], 13);
        
        // Set the initial marker at user's location
        marker = L.marker([lat, lng], {draggable: true}).addTo(forecastMap);
        
        // Update hidden form fields
        document.getElementById('location-lat').value = lat;
        document.getElementById('location-lng').value = lng;
        currentLat = lat;
        currentLng = lng;
        
        // Update coordinates when marker is dragged
        marker.on('dragend', function(event) {
          const position = marker.getLatLng();
          document.getElementById('location-lat').value = position.lat;
          document.getElementById('location-lng').value = position.lng;
          currentLat = position.lat;
          currentLng = position.lng;
        });
      });
    }
    
    // Allow clicking on map to set marker
    forecastMap.on('click', function(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      
      // Update or create marker
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        marker = L.marker([lat, lng], {draggable: true}).addTo(forecastMap);
        
        // Update coordinates when marker is dragged
        marker.on('dragend', function(event) {
          const position = marker.getLatLng();
          document.getElementById('location-lat').value = position.lat;
          document.getElementById('location-lng').value = position.lng;
          currentLat = position.lat;
          currentLng = position.lng;
        });
      }
      
      // Update hidden form fields
      document.getElementById('location-lat').value = lat;
      document.getElementById('location-lng').value = lng;
      currentLat = lat;
      currentLng = lng;
    });
  }
  
  // Handle form submission
  const forecastForm = document.getElementById('forecast-form');
  if (forecastForm) {
    forecastForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Get form data
      const peopleCount = document.getElementById('people-count').value;
      const condition = document.getElementById('condition').value;
      const severity = document.getElementById('severity').value;
      
      // Ensure we have location data
      if (!currentLat || !currentLng) {
        alert('Please select a location on the map.');
        return;
      }
      
      // Show loading indicator
      const resultsDiv = document.getElementById('forecast-results');
      resultsDiv.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p>Generating forecast...</p></div>';
      
      // Call the API
      fetch(`/api/resource-forecast?lat=${currentLat}&lng=${currentLng}&people_count=${peopleCount}&condition=${condition}&severity=${severity}`)
        .then(response => response.json())
        .then(data => {
          if (data.status === 'success') {
            displayForecastResults(data.forecast);
          } else {
            resultsDiv.innerHTML = `<div class="alert alert-danger">Error: ${data.message}</div>`;
          }
        })
        .catch(error => {
          console.error('Error fetching forecast:', error);
          resultsDiv.innerHTML = '<div class="alert alert-danger">Failed to generate forecast. Please try again.</div>';
        });
    });
  }
  
  function displayForecastResults(forecast) {
    const resultsDiv = document.getElementById('forecast-results');
    let html = '';
    
    // Create a table for the results
    html += '<div class="table-responsive"><table class="table table-striped">';
    html += '<thead><tr><th>Resource Type</th><th>Demand</th><th>Confidence</th><th>Quantity Needed</th></tr></thead>';
    html += '<tbody>';
    
    for (const [resourceType, data] of Object.entries(forecast)) {
      const resourceName = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
      const confidence = Math.round(data.confidence * 100);
      
      html += `<tr>
        <td><strong>${resourceName}</strong></td>
        <td>${data.predicted_demand} people</td>
        <td>${confidence}%</td>
        <td>`;
      
      if (data.quantity) {
        html += `${data.quantity.units} ${data.quantity.unit_type}`;
        
        // Display details if available
        if (data.quantity.details) {
          html += '<ul class="mt-2 mb-0">';
          for (const [detailName, detailValue] of Object.entries(data.quantity.details)) {
            const formattedName = detailName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            html += `<li>${formattedName}: ${detailValue}</li>`;
          }
          html += '</ul>';
        }
      }
      
      html += '</td></tr>';
    }
    
    html += '</tbody></table></div>';
    
    // Add a note about the forecast
    html += '<div class="alert alert-info mt-3">';
    html += '<p><strong>Note:</strong> This forecast is based on the provided information and historical data. Actual needs may vary.</p>';
    html += '<p>Consider coordinating with local emergency services for the most accurate resource allocation.</p>';
    html += '</div>';
    
    resultsDiv.innerHTML = html;
  }
});