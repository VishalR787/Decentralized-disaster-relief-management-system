// map.js - OpenStreetMap integration

let map = null;
let userMarker = null;
let markers = [];

// Initialize map
const initMap = (elementId, center = { lat: 0, lng: 0 }, zoom = 2) => {
    if (map) return map;

    // Create map
    map = L.map(elementId).setView([center.lat, center.lng], zoom);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    return map;
};

// Set view to coordinates
const setMapView = (lat, lng, zoom = 13) => {
    if (!map) return;
    map.setView([lat, lng], zoom);
};

// Add user marker
const addUserMarker = (lat, lng) => {
    if (!map) return;

    // Remove existing user marker
    if (userMarker) {
        map.removeLayer(userMarker);
    }

    // Create user marker with a different color
    userMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'user-marker',
            html: '<i class="fas fa-user-circle fa-2x text-primary"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(map);

    userMarker.bindPopup('Your location').openPopup();
    
    return userMarker;
};

// Add marker for help request
const addHelpRequestMarker = (lat, lng, helpType, urgency, details) => {
    if (!map) return;

    // Choose icon based on help type
    let iconClass = 'fa-question-circle';
    if (helpType === 'food') iconClass = 'fa-utensils';
    else if (helpType === 'shelter') iconClass = 'fa-home';
    else if (helpType === 'medical') iconClass = 'fa-first-aid';
    else if (helpType === 'evacuation') iconClass = 'fa-truck';
    else if (helpType === 'rescue') iconClass = 'fa-life-ring';
    else if (helpType === 'supplies') iconClass = 'fa-box';

    // Choose color based on urgency
    let colorClass = 'text-info';
    if (urgency === 'high') colorClass = 'text-danger';
    else if (urgency === 'medium') colorClass = 'text-warning';

    // Create marker
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'help-marker',
            html: `<i class="fas ${iconClass} fa-2x ${colorClass}"></i>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(map);

    // Add popup with details
    marker.bindPopup(`
        <div class="map-popup">
            <h6>${helpType.charAt(0).toUpperCase() + helpType.slice(1)} Help Needed</h6>
            <p><strong>Urgency:</strong> ${urgency}</p>
            ${details ? `<p>${details}</p>` : ''}
        </div>
    `);

    markers.push(marker);
    return marker;
};

// Add marker for volunteer
const addVolunteerMarker = (lat, lng, skills, details) => {
    if (!map) return;

    // Create marker
    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'volunteer-marker',
            html: '<i class="fas fa-hands-helping fa-2x text-success"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(map);

    // Format skills list
    const skillsList = skills 
        ? `<p><strong>Skills:</strong> ${skills.join(', ')}</p>`
        : '';

    // Add popup with details
    marker.bindPopup(`
        <div class="map-popup">
            <h6>Volunteer Available</h6>
            ${skillsList}
            ${details ? `<p>${details}</p>` : ''}
        </div>
    `);

    markers.push(marker);
    return marker;
};

// Clear all markers except user marker
const clearMarkers = () => {
    if (!map) return;

    markers.forEach(marker => {
        map.removeLayer(marker);
    });

    markers = [];
};

// Calculate route between two points
const calculateRoute = (startLat, startLng, endLat, endLng) => {
    if (!map) return;

    // Create a simple straight line for now (in a real app, use a routing API)
    const routeLine = L.polyline(
        [
            [startLat, startLng],
            [endLat, endLng]
        ],
        {
            color: 'blue',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10'
        }
    ).addTo(map);

    markers.push(routeLine);
    
    // Estimate distance using Haversine formula
    const distance = calculateDistance(startLat, startLng, endLat, endLng);
    
    return {
        route: routeLine,
        distance: distance,
        estimated_time: Math.round(distance / 30 * 60) // Rough estimate: 30 km/h
    };
};

// Calculate distance between points using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
};

const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
};

// Load data from API and display on map
const loadMapData = async () => {
    try {
        // Get system status which includes help requests
        const response = await fetch('/api/status');
        const data = await response.json();
        
        if (data.status !== 'success') {
            console.error('Failed to load map data:', data.message);
            return;
        }
        
        // Clear existing markers
        clearMarkers();
        
        // Load help requests and volunteers
        // In a real app, this would be a separate API endpoint with coordinates
        // For demo, we'll create some sample data
        
        // Sample help requests
        const helpRequests = [
            { lat: 34.05, lng: -118.24, type: 'food', urgency: 'medium', details: 'Family of 4 needs food supplies' },
            { lat: 34.07, lng: -118.26, type: 'medical', urgency: 'high', details: 'Medical assistance needed for elderly person' },
            { lat: 34.03, lng: -118.22, type: 'shelter', urgency: 'medium', details: 'Seeking temporary shelter for 3 people' },
            { lat: 34.06, lng: -118.28, type: 'evacuation', urgency: 'high', details: 'Need evacuation assistance for disabled person' },
            { lat: 34.04, lng: -118.20, type: 'supplies', urgency: 'low', details: 'Need basic supplies for 2 days' }
        ];
        
        // Sample volunteers
        const volunteers = [
            { lat: 34.06, lng: -118.23, skills: ['medical', 'driving'], details: 'Available with vehicle' },
            { lat: 34.08, lng: -118.25, skills: ['cooking', 'shelter'], details: 'Can provide temporary shelter for 5 people' },
            { lat: 34.04, lng: -118.26, skills: ['rescue', 'first_aid'], details: 'Rescue trained, has medical supplies' },
            { lat: 34.02, lng: -118.24, skills: ['logistics', 'driving'], details: 'Has truck for transportation' }
        ];
        
        // Add markers to map
        helpRequests.forEach(req => {
            addHelpRequestMarker(req.lat, req.lng, req.type, req.urgency, req.details);
        });
        
        volunteers.forEach(vol => {
            addVolunteerMarker(vol.lat, vol.lng, vol.skills, vol.details);
        });
        
    } catch (error) {
        console.error('Error loading map data:', error);
    }
};

// Initialize map when document is ready
document.addEventListener('DOMContentLoaded', () => {
    const mapContainer = document.getElementById('map');
    
    if (mapContainer) {
        // Initialize map
        initMap('map');
        
        // Try to get user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    // Set map view to user location
                    setMapView(latitude, longitude, 13);
                    
                    // Add user marker
                    addUserMarker(latitude, longitude);
                    
                    // Load data
                    loadMapData();
                },
                (error) => {
                    console.error('Error getting location:', error);
                    
                    // Default view (zoom out to show more area)
                    setMapView(34.05, -118.24, 10);
                    
                    // Load data
                    loadMapData();
                }
            );
        } else {
            // Default view if geolocation not supported
            setMapView(34.05, -118.24, 10);
            
            // Load data
            loadMapData();
        }
        
        // Add refresh button event listener
        const refreshButton = document.getElementById('refresh-map');
        if (refreshButton) {
            refreshButton.addEventListener('click', loadMapData);
        }
    }
});
