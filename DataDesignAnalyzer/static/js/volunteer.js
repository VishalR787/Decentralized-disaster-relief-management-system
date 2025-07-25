// Global variables
let map;
let markers = [];
let currentLat;
let currentLng;

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // Initialize map if the element exists
  const mapElement = document.getElementById('map');
  if (mapElement) {
    initMap();
  }
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize resource forecast functionality
  initResourceForecast();
  
  console.log("Volunteer dashboard initialized");
});

function initMap() {
  // Create the map
  map = L.map('map').setView([0, 0], 2);
  
  // Add the tile layer (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Try to get the user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Center the map on the user's location
      map.setView([lat, lng], 13);
      
      // Store current location
      currentLat = lat;
      currentLng = lng;
      
      // Add a marker for the volunteer's location
      const volunteerMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'volunteer-marker',
          html: '<i class="fas fa-user-circle"></i>',
          iconSize: [30, 30]
        })
      }).addTo(map);
      volunteerMarker.bindPopup('Your Location');
      
      // Load help requests
      loadHelpRequests();
      
      // Initialize forecast location
      if (document.getElementById('forecast-lat')) {
        document.getElementById('forecast-lat').value = lat;
        document.getElementById('forecast-lng').value = lng;
      }
    }, function(error) {
      console.error("Error getting location:", error);
      loadHelpRequests();
    });
  } else {
    console.warn("Geolocation is not supported by this browser.");
    loadHelpRequests();
  }
  
  // Add click event to map for selecting forecast location
  map.on('click', function(e) {
    if (document.getElementById('forecast-lat') && document.getElementById('forecast-lng')) {
      document.getElementById('forecast-lat').value = e.latlng.lat;
      document.getElementById('forecast-lng').value = e.latlng.lng;
      
      // Show a temporary marker or notification
      const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent("Forecast location selected")
        .openOn(map);
      
      setTimeout(() => map.closePopup(popup), 2000);
    }
  });
}

function loadHelpRequests() {
  // Clear existing markers
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  
  // Fetch help requests from the server
  fetch('/api/help-requests')
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        // Add markers for each help request
        data.help_requests.forEach(request => {
          if (request.location_lat && request.location_lng) {
            addHelpRequestMarker(request);
          }
        });
      } else {
        console.error('Error loading help requests:', data.message);
      }
    })
    .catch(error => {
      console.error('Error fetching help requests:', error);
    });
}

function addHelpRequestMarker(request) {
  // Create marker with appropriate icon based on urgency
  const markerClass = `help-request-marker marker-${request.urgency_level}`;
  const marker = L.marker([request.location_lat, request.location_lng], {
    icon: L.divIcon({
      className: markerClass,
      html: '<i class="fas fa-exclamation-circle"></i>',
      iconSize: [24, 24]
    })
  });
  
  // Create popup content
  const popupContent = `
    <div class="request-popup">
      <h5>${request.help_type.charAt(0).toUpperCase() + request.help_type.slice(1)} Help</h5>
      <p><strong>Urgency:</strong> ${request.urgency_level}</p>
      <p><strong>People affected:</strong> ${request.people_affected}</p>
      <p><strong>Location:</strong> ${request.location_name || 'Unknown'}</p>
      <button class="btn btn-sm btn-primary view-details-btn" onclick="showRequestDetails(${request.id})">
        View Details
      </button>
    </div>
  `;
  
  // Add popup to marker
  marker.bindPopup(popupContent);
  
  // Add marker to map and store in array
  marker.addTo(map);
  markers.push(marker);
}

function setupEventListeners() {
  // Availability toggle
  const availabilityToggle = document.getElementById('availabilityToggle');
  if (availabilityToggle) {
    availabilityToggle.addEventListener('change', function() {
      updateAvailability(this.checked);
    });
  }
  
  // Save profile button
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', saveProfile);
  }
  
  // Complete assignment buttons
  const completeButtons = document.querySelectorAll('.complete-assignment');
  completeButtons.forEach(button => {
    button.addEventListener('click', function() {
      const assignmentId = this.getAttribute('data-id');
      completeAssignment(assignmentId);
    });
  });
}

function updateAvailability(isAvailable) {
  fetch('/api/volunteer/availability', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_available: isAvailable })
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      showNotification('Availability updated successfully', 'success');
    } else {
      showNotification('Failed to update availability', 'error');
    }
  })
  .catch(error => {
    console.error('Error updating availability:', error);
    showNotification('Failed to update availability', 'error');
  });
}

function saveProfile() {
  const form = document.getElementById('editProfileForm');
  const formData = new FormData(form);
  
  // Add profile image if selected
  const profileImage = document.getElementById('profileImage').files[0];
  if (profileImage) {
    formData.append('profile_image', profileImage);
  }
  
  fetch('/api/volunteer/profile', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      showNotification('Profile updated successfully', 'success');
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
      modal.hide();
      // Reload page to show updated profile
      setTimeout(() => location.reload(), 1000);
    } else {
      showNotification('Failed to update profile: ' + data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error updating profile:', error);
    showNotification('Failed to update profile', 'error');
  });
}

function completeAssignment(assignmentId) {
  if (!confirm('Mark this assignment as completed?')) {
    return;
  }
  
  fetch(`/api/assignment/${assignmentId}/complete`, {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === 'success') {
      showNotification('Assignment marked as completed', 'success');
      // Reload page to update assignments list
      location.reload();
    } else {
      showNotification('Failed to complete assignment: ' + data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error completing assignment:', error);
    showNotification('Failed to complete assignment', 'error');
  });
}

function showRequestDetails(requestId) {
  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('requestDetailsModal'));
  modal.show();
  
  // Set loading state
  document.getElementById('requestDetailsContent').innerHTML = `
    <div class="text-center">
      <div class="spinner-border text-primary" role="status"></div>
      <p>Loading details...</p>
    </div>
  `;
  
  // Fetch request details
  fetch(`/api/help-request/${requestId}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === 'success') {
        displayRequestDetails(data.help_request);
      } else {
        document.getElementById('requestDetailsContent').innerHTML = `
          <div class="alert alert-danger">
            Failed to load request details: ${data.message}
          </div>
        `;
      }
    })
    .catch(error => {
      console.error('Error fetching request details:', error);
      document.getElementById('requestDetailsContent').innerHTML = `
        <div class="alert alert-danger">
          Failed to load request details. Please try again.
        </div>
      `;
    });
}

function displayRequestDetails(request) {
  // Format the request details
  let damageInfo = '';
  if (request.damage_level) {
    damageInfo = `
      <div class="mb-3">
        <h5>Damage Assessment</h5>
        <p>Level: <span class="badge bg-${request.damage_level === 'severe' ? 'danger' : (request.damage_level === 'moderate' ? 'warning' : 'success')}">${request.damage_level}</span></p>
        ${request.damage_image ? `<img src="${request.damage_image}" alt="Damage Image" class="img-fluid rounded mb-2" style="max-height: 200px;">` : ''}
      </div>
    `;
  }
  
  // Build the HTML content
  const content = `
    <div class="request-details">
      <div class="mb-3">
        <h5>Basic Information</h5>
        <p><strong>Help Type:</strong> ${request.help_type}</p>
        <p><strong>Urgency:</strong> <span class="badge bg-${request.urgency_level === 'high' ? 'danger' : (request.urgency_level === 'medium' ? 'warning' : 'success')}">${request.urgency_level}</span></p>
        <p><strong>People Affected:</strong> ${request.people_affected}</p>
        <p><strong>Requested:</strong> ${new Date(request.created_at).toLocaleString()}</p>
      </div>
      
      <div class="mb-3">
        <h5>Location</h5>
        <p><strong>Name:</strong> ${request.location_name || 'Unknown'}</p>
        <p><strong>Coordinates:</strong> ${request.location_lat}, ${request.location_lng}</p>
        <div id="detail-map" style="height: 200px;"></div>
      </div>
      
      <div class="mb-3">
        <h5>Description</h5>
        <p>${request.description || 'No description provided.'}</p>
      </div>
      
      ${damageInfo}
      
      <div class="mb-3">
        <h5>Victim Information</h5>
        <p><strong>Name:</strong> ${request.victim.name}</p>
        <p><strong>Contact:</strong> ${request.victim.phone || 'Not provided'}</p>
      </div>
    </div>
  `;
  
  // Update the modal content
  document.getElementById('requestDetailsContent').innerHTML = content;
  
  // Initialize the detail map
  setTimeout(() => {
    const detailMap = L.map('detail-map').setView([request.location_lat, request.location_lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(detailMap);
    L.marker([request.location_lat, request.location_lng]).addTo(detailMap);
  }, 100);
}

function showNotification(message, type) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById('notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    notification.className = 'notification';
    document.body.appendChild(notification);
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.color = 'white';
    notification.style.zIndex = '9999';
    document.body.appendChild(notification);
  }
  
  // Set notification type
  if (type === 'success') {
    notification.style.backgroundColor = '#28a745';
  } else if (type === 'error') {
    notification.style.backgroundColor = '#dc3545';
  } else {
    notification.style.backgroundColor = '#007bff';
  }
  
  // Set message and show notification
  notification.textContent = message;
  notification.style.display = 'block';
  
  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}

// Resource Forecast Functionality
function initResourceForecast() {
  console.log("Resource forecast initialized");
  const forecastForm = document.getElementById('forecast-form');
  
  if (forecastForm) {
    console.log("Forecast form found:", !!forecastForm);
    
    // Initialize with current location from the map
    if (currentLat && currentLng) {
      document.getElementById('forecast-lat').value = currentLat;
      document.getElementById('forecast-lng').value = currentLng;
    }
    
    forecastForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Get form data
      const peopleCount = document.getElementById('people-count').value;
      const condition = document.getElementById('condition').value;
      const severity = document.getElementById('severity').value;
      
      // Get location from hidden fields or map
      let lat = document.getElementById('forecast-lat').value;
      let lng = document.getElementById('forecast-lng').value;
      
      console.log("Forecast form submitted");
      console.log("Form data:", {
        peopleCount,
        condition,
        severity,
        lat,
        lng
      });
      
      // If no location set, use current map center
      if (!lat || !lng) {
        if (map) {
          const center = map.getCenter();
          lat = center.lat;
          lng = center.lng;
        } else {
          alert('Please ensure your location is available or visible on the map.');
          return;
        }
      }
      
      // Show loading indicator
      const resultsDiv = document.getElementById('forecast-results');
      resultsDiv.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"></div><p>Generating forecast...</p></div>';
      
      // Call the API
      fetch(`/api/resource-forecast?lat=${lat}&lng=${lng}&people_count=${peopleCount}&condition=${condition}&severity=${severity}`)
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
  } else {
    console.warn("Forecast form not found in the DOM");
  }
}

function displayForecastResults(forecast) {
  const resultsDiv = document.getElementById('forecast-results');
  let html = '';
  
  // Create a table for the results
  html += '<div class="table-responsive"><table class="table table-striped table-sm">';
  html += '<thead><tr><th>Resource</th><th>Demand</th><th>Confidence</th><th>Quantity</th></tr></thead>';
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
        html += '<ul class="mt-2 mb-0 small">';
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
  html += '<div class="alert alert-info mt-3 small">';
  html += '<p class="mb-0"><strong>Note:</strong> This forecast is based on the provided information and historical data. Actual needs may vary.</p>';
  html += '</div>';
  
  resultsDiv.innerHTML = html;
}

// Check for offline status
function checkOnlineStatus() {
  if (!navigator.onLine) {
    showOfflineNotification();
  }
  
  window.addEventListener('online', function() {
    hideOfflineNotification();
    // Reload data when coming back online
    loadHelpRequests();
  });
  
  window.addEventListener('offline', showOfflineNotification);
}

function showOfflineNotification() {
  let offlineNotification = document.getElementById('offline-notification');
  if (!offlineNotification) {
    offlineNotification = document.createElement('div');
    offlineNotification.id = 'offline-notification';
    offlineNotification.className = 'offline-notification';
    offlineNotification.innerHTML = '<i class="fas fa-wifi"></i> You are offline. Some features may be unavailable.';
    document.body.appendChild(offlineNotification);
  }
  
  offlineNotification.style.display = 'block';
}

function hideOfflineNotification() {
  const offlineNotification = document.getElementById('offline-notification');
  if (offlineNotification) {
    offlineNotification.style.display = 'none';
  }
}

// Initialize offline status check
checkOnlineStatus();
