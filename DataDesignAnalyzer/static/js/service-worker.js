// service-worker.js - For offline functionality

const CACHE_NAME = 'disaster-relief-app-v1';
const OFFLINE_URL = '/offline.html';

// Resources to cache
const RESOURCES_TO_CACHE = [
    '/',
    '/victim',
    '/volunteer',
    '/static/css/styles.css',
    '/static/js/app.js',
    '/static/js/map.js',
    '/static/js/ai.js',
    OFFLINE_URL,
    'https://cdn.replit.com/agent/bootstrap-agent-dark-theme.min.css',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css'
];

// Install event - cache important resources
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching resources');
                return cache.addAll(RESOURCES_TO_CACHE);
            })
            .then(() => {
                console.log('[Service Worker] Cached all required resources');
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate');
    
    event.waitUntil(
        caches.keys()
            .then((keyList) => {
                return Promise.all(keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        console.log('[Service Worker] Removing old cache', key);
                        return caches.delete(key);
                    }
                }));
            })
            .then(() => {
                console.log('[Service Worker] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip non-HTTP requests
    if (!event.request.url.startsWith('http')) return;
    
    // Handle API requests differently
    if (event.request.url.includes('/api/')) {
        // For API requests, try network first, then fallback to cached response if available
        event.respondWith(
            fetch(event.request)
                .catch((error) => {
                    console.log('[Service Worker] Network request failed for API, trying cache', error);
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // For non-API requests, use cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if available
                if (cachedResponse) {
                    console.log('[Service Worker] Serving from cache:', event.request.url);
                    return cachedResponse;
                }
                
                // Otherwise fetch from network
                console.log('[Service Worker] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Cache the fetched response
                        if (networkResponse && networkResponse.status === 200) {
                            return caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, networkResponse.clone());
                                    return networkResponse;
                                });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.log('[Service Worker] Fetch failed, serving offline page', error);
                        
                        // Check if the request is for a page (HTML)
                        if (event.request.headers.get('Accept').includes('text/html')) {
                            return caches.match(OFFLINE_URL);
                        }
                        
                        // For other resources, return a simple error response
                        return new Response('Network error', { 
                            status: 503, 
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Listen for message events (e.g., from the main app)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for offline form submissions
self.addEventListener('sync', (event) => {
    if (event.tag === 'help-request-sync') {
        event.waitUntil(syncHelpRequests());
    } else if (event.tag === 'volunteer-skills-sync') {
        event.waitUntil(syncVolunteerSkills());
    }
});

// Sync help requests that were made offline
const syncHelpRequests = async () => {
    try {
        const db = await openDB();
        const offlineRequests = await db.getAll('helpRequests');
        
        for (const request of offlineRequests) {
            // Convert to FormData
            const formData = new FormData();
            for (const [key, value] of Object.entries(request.data)) {
                formData.append(key, value);
            }
            
            // Try to send
            try {
                const response = await fetch('/api/help-request', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    // If successful, remove from IndexedDB
                    await db.delete('helpRequests', request.id);
                    console.log('[Service Worker] Synced offline help request');
                    
                    // Notify the user
                    self.registration.showNotification('Disaster Relief App', {
                        body: 'Your help request has been sent successfully!',
                        icon: '/static/images/icon.png'
                    });
                }
            } catch (error) {
                console.error('[Service Worker] Failed to sync help request', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Error syncing help requests', error);
    }
};

// Sync volunteer skills that were submitted offline
const syncVolunteerSkills = async () => {
    try {
        const db = await openDB();
        const offlineSkills = await db.getAll('volunteerSkills');
        
        for (const skill of offlineSkills) {
            // Convert to FormData
            const formData = new FormData();
            for (const [key, value] of Object.entries(skill.data)) {
                formData.append(key, value);
            }
            
            // Try to send
            try {
                const response = await fetch('/api/volunteer-skills', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    // If successful, remove from IndexedDB
                    await db.delete('volunteerSkills', skill.id);
                    console.log('[Service Worker] Synced offline volunteer skills');
                    
                    // Notify the user
                    self.registration.showNotification('Disaster Relief App', {
                        body: 'Your volunteer skills have been updated successfully!',
                        icon: '/static/images/icon.png'
                    });
                }
            } catch (error) {
                console.error('[Service Worker] Failed to sync volunteer skills', error);
            }
        }
    } catch (error) {
        console.error('[Service Worker] Error syncing volunteer skills', error);
    }
};

// Open IndexedDB
const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('DisasterReliefDB', 1);
        
        request.onerror = (event) => {
            reject('Error opening IndexedDB');
        };
        
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create stores for offline data
            if (!db.objectStoreNames.contains('helpRequests')) {
                db.createObjectStore('helpRequests', { keyPath: 'id', autoIncrement: true });
            }
            
            if (!db.objectStoreNames.contains('volunteerSkills')) {
                db.createObjectStore('volunteerSkills', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
};
